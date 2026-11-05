// Explicit production-built Worker exercise. All outbound requests terminate in this fixture.
// Usage: node --experimental-strip-types --import ./tests/register-types.mjs tests/reliability-runtime.mjs [absolute-dist] [report-file]
import assert from 'node:assert/strict';
import {Miniflare,Log,LogLevel} from 'miniflare';
import {resolve,dirname} from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {accessCodeHash} from '../worker/access-gate.ts';
import {marketError,errorResponse} from '../lib/market-request.ts';

const build=resolve(process.argv[2]??'dist');
const reportPath=resolve(process.argv[3]??'outputs/reliability/runtime.json');
const config=JSON.parse(await readFile(resolve(build,'server/wrangler.json'),'utf8'));
const sourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
const sourceDirty=Boolean(execFileSync('git',['status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim());
const workerSha256=createHash('sha256').update(await readFile(resolve(build,'server/index.js'))).digest('hex');
const startedAt=new Date().toISOString();
const checks=[],outbound=[];let mode='valid',unexpected=0,stalledController;
const standardErrors={'typed-timeout':['timeout'],'typed-denied':['upstream_denied',403],'typed-invalid':['invalid_data'],'typed-environment':['environment_denied'],'typed-transport':['transport_error'],'typed-unavailable':['upstream_unavailable',503]};
function fixtureHistory(){
 const fetchedAt=Date.now()-1000,open=Math.floor(fetchedAt/900000)*900000;
 return {symbol:'BTC-USDT',range:'1d',currency:'USDT',source:'OKX 欧易',timezone:'UTC',fetchedAt,points:[{time:open-900000,open:99,high:102,low:98,close:100,volume:20,confirmed:true},{time:open,open:100,high:103,low:99,close:102,volume:5,confirmed:false}]};
}
const runtime=new Miniflare({
 name:'reliability-fixture',host:'127.0.0.1',port:0,modules:true,scriptPath:resolve(build,'server/index.js'),modulesRoot:resolve(build,'server'),
 modulesRules:[{type:'ESModule',include:['**/*.js'],fallthrough:true}],compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,
 bindings:{ACCESS_CODE_HASH:accessCodeHash('reliability-fixture-only'),ACCESS_SESSION_SECRET:'reliability-fixture-session-secret-not-production',MONITOR_URL:'https://monitor-fixture.invalid',MONITOR_TOKEN:'reliability-fixture-token'},
 assets:{workerName:'reliability-fixture',directory:resolve(build,'client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},
 log:new Log(LogLevel.ERROR),
 outboundService(request){
  const url=new URL(request.url);
  if(mode==='quotes'&&url.origin==='https://openapi.okx.com'&&url.pathname==='/api/v5/market/tickers'){
   outbound.push({mode,method:request.method,path:'okx-tickers',at:new Date().toISOString()});
   return Response.json({code:'0',data:[{instId:'BTC-USDT',last:'102',open24h:'100',ts:String(Date.now()),high24h:'103',low24h:'99',volCcy24h:'1000'}]});
  }
  if(url.origin!=='https://monitor-fixture.invalid'||url.pathname!=='/history'){unexpected++;return new Response('Unexpected outbound denied',{status:403});}
  outbound.push({mode,method:request.method,symbol:url.searchParams.get('symbol'),range:url.searchParams.get('range'),traceId:request.headers.get('X-Market-Trace'),at:new Date().toISOString()});
  if(standardErrors[mode]){const [code,upstreamStatus]=standardErrors[mode];return errorResponse(marketError(code,{traceId:'remote-fixture-trace'},{upstreamStatus}));}
  if(mode==='mismatched-503')return Response.json({error:'remote text',errorInfo:{code:'rate_limited',retryAt:Date.now()+180000}},{status:503});
  if(mode==='429')return Response.json({error:'remote text',errorInfo:{code:'rate_limited',upstreamStatus:429,retryAt:Date.now()+180000,traceId:'remote-fixture-trace'}},{status:429,headers:{'Retry-After':'120'}});
  if(mode==='timeout')return new Response(new ReadableStream({start(controller){stalledController=controller;}}),{headers:{'Content-Type':'application/json'}});
  if(mode==='html')return new Response('<html>synthetic challenge</html>',{headers:{'Content-Type':'text/html'}});
  if(mode==='json')return new Response('{',{headers:{'Content-Type':'application/json'}});
  if(['401','403','503'].includes(mode))return new Response('',{status:Number(mode)});
  const history=fixtureHistory();if(mode==='identity')history.symbol='ETH-USDT';if(mode==='invalid')history.points[0].high=1;
  return Response.json(history);
 },
});
let failure;
const watchdog=setTimeout(()=>{console.error('Runtime verification exceeded 90 seconds');void runtime.dispose();},90000);
try{
 await runtime.ready;
 const visit=await runtime.dispatchFetch('http://localhost/from-aether',{redirect:'manual'});assert.equal(visit.status,303);const cookie=visit.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
 const headers={cookie};
 const denied=await runtime.dispatchFetch('http://localhost/api/history?symbol=BTC-USDT&range=1d');assert.equal(denied.status,401);assert.equal((await denied.json()).code,'ACCESS_REQUIRED');assert.equal(outbound.length,0);checks.push({name:'anonymous-history-denied',status:'PASS'});
 const root=await runtime.dispatchFetch('http://localhost/',{headers});assert.equal(root.status,200);const html=await root.text();assert.match(html,/<title>市场雷达 · Market Radar<\/title>/);checks.push({name:'visitor-root',status:'PASS'});
 const rsc=await runtime.dispatchFetch('http://localhost/.rsc',{headers:{...headers,rsc:'1'}});assert.equal(rsc.status,200);await rsc.arrayBuffer();checks.push({name:'visitor-exact-root-rsc',status:'PASS'});
 for(const path of ['/api/monitor','/.rsc/extra']){const response=await runtime.dispatchFetch(`http://localhost${path}`,{headers:{...headers,rsc:'1'},redirect:'manual'});assert.equal(response.status,401);await response.arrayBuffer();}checks.push({name:'visitor-write-and-neighbor-boundaries',status:'PASS'});
 const write=await runtime.dispatchFetch('http://localhost/api/history',{method:'POST',headers});assert.equal(write.status,401);await write.arrayBuffer();
 assert.equal(outbound.length,0,'server rendering and access checks must not fetch market data');
 mode='quotes';const quotes=await runtime.dispatchFetch('http://localhost/api/quotes?symbols=BTC-USDT,ETH-USDT',{headers});const batch=await quotes.json();assert.equal(quotes.status,200);assert.equal(batch.results.length,2);assert.equal(batch.results[0].quote.currency,'USDT');assert.equal(batch.results[1].errorInfo.code,'unsupported_asset');assert.equal(outbound.length,1);checks.push({name:'direct-quote-partial-result',status:'PASS',observableProviderAttempts:1});
 for(const [next,expected,code] of [['valid',200,null],['identity',502,'invalid_data'],['invalid',502,'invalid_data'],['html',502,'unexpected_content_type'],['json',502,'invalid_json'],['401',502,'proxy_auth_error'],['403',502,'proxy_auth_error'],['503',502,'proxy_unavailable'],['mismatched-503',502,'proxy_unavailable'],['typed-timeout',504,'timeout'],['typed-denied',502,'upstream_denied'],['typed-invalid',502,'invalid_data'],['typed-environment',503,'environment_denied'],['typed-transport',502,'transport_error'],['typed-unavailable',502,'upstream_unavailable'],['timeout',504,'timeout'],['429',429,'rate_limited']]){
  mode=next;const count=outbound.length,start=performance.now();
  const response=await runtime.dispatchFetch('http://localhost/api/history?symbol=BTC-USDT&range=1d',{headers});const body=await response.json();const elapsedMs=Math.round(performance.now()-start);
  assert.equal(response.status,expected,next);assert.equal(outbound.length-count,1,`${next}: no direct fallback/fanout`);assert.match(response.headers.get('Cache-Control')??'',/no-store/);
  if(code){assert.equal(body.errorInfo.code,code,next);assert.equal(body.errorInfo.traceId,outbound.at(-1).traceId);assert.equal(response.headers.get('X-Market-Trace'),body.errorInfo.traceId);assert.doesNotMatch(JSON.stringify(body),/monitor-fixture|reliability-fixture-token|remote-fixture-trace|validatedMonitorError|stack/);}
  else{assert.equal(body.symbol,'BTC-USDT');assert.equal(body.currency,'USDT');assert.ok(body.fetchedAt<Date.now());assert.ok(body.metadata.limitations.includes('legacy_proxy_metadata_unverified'));}
  if(next==='timeout'){assert.ok(elapsedMs>=5500&&elapsedMs<9000,`actual proxy deadline: ${elapsedMs}ms`);try{stalledController?.close();}catch{ /* The Worker may already have cancelled the stream. */ }}
  if(next==='429')assert.ok(Number(response.headers.get('Retry-After'))>=179&&Number(response.headers.get('Retry-After'))<=180);
  checks.push({name:`proxy-${next}`,status:'PASS',httpStatus:response.status,errorCode:code,elapsedMs,observableProxyAttempts:1,remoteProviderAttempts:'UNKNOWN'});
 }
 const before=outbound.length;const cooling=await runtime.dispatchFetch('http://localhost/api/history?symbol=ETH-USDT&range=1d',{headers});assert.equal(cooling.status,429);await cooling.arrayBuffer();assert.equal(outbound.length,before);checks.push({name:'provider-cooldown-no-dispatch',status:'PASS'});
 assert.equal(unexpected,0);assert.ok(checks.length>=15);
}catch(error){failure=error;checks.push({name:'runtime-matrix',status:'FAIL',message:error instanceof Error?error.message:'Unknown assertion failure'});}
finally{
 clearTimeout(watchdog);try{stalledController?.close();}catch{ /* Already closed. */ }await runtime.dispose();
 const report={environment:'B: production-built local workerd with synthetic outbound fixture',sourceSha,sourceDirty,workerSha256,configuration:{compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,bindings:'synthetic access and monitor only',externalNetwork:'denied'},startedAt,finishedAt:new Date().toISOString(),status:failure?'FAIL':'PASS',checks,observedProxyRequests:outbound.filter(item=>item.mode!=='quotes').length,observedDirectProviderRequests:outbound.filter(item=>item.mode==='quotes').length,unexpectedOutbound:unexpected,remoteProviderAttempts:'UNKNOWN: monitor is synthetic',liveSourceRequests:0};
 await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify({status:report.status,checks:checks.length,report:reportPath,sourceSha,workerSha256,externalNetwork:'denied'}));
}
if(failure)throw failure;
