// Entire market, user, grant and Provider payload below is synthetic. Never a source-use approval.
import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { SYNTHETIC_PILOT_ID } from '../../lib/ai/real-config.ts';
import { privateFixtureSnapshot, privateFixtureGrant } from './ai30b-private.mjs';

export const NOW = Date.UTC(2026, 9, 22, 12), ORIGIN='https://fixture-market.invalid', SITE='fixture-site', SUBJECT='fixture-owner';
export const SCOPE=createHash('sha256').update(JSON.stringify(['ai-scope-v1',SITE,SUBJECT,1])).digest('hex');
const source=`import {createSiteInterpretationHandler,handleSiteInterpretation} from './worker/ai-site-interpretation.ts';
import {createSiteContextRuntime} from './lib/ai/site-runtime.ts';
import {D1Records} from './lib/ai/d1-records.ts';
import {createSelectionCatalog} from './lib/ai/claim-selection.ts';
import {DEEPSEEK_AI} from './lib/ai/real-config.ts';
const NOW=${NOW},PRIVATE_FIXTURE_NOW=NOW,PRIVATE_FIXTURE_SYMBOL='BTC-USDT',ORIGIN=${JSON.stringify(ORIGIN)};
const privateFixtureSnapshot=${privateFixtureSnapshot.toString()},privateFixtureGrant=${privateFixtureGrant.toString()};
let time=NOW,loads=0,calls=0,flags={},grant={...privateFixtureGrant(NOW),siteId:'fixture-site',deployment:'site_pilot',storage:'d1-private',audience:'site-owner'};
const provider={kind:'deepseek',async generate(body,signal){calls++;if(flags.delay)await new Promise(resolve=>setTimeout(resolve,flags.delay));
 const input=JSON.parse(JSON.parse(body).input[0].content),catalog=createSelectionCatalog(input.context);
 return {status:'completed',json:JSON.stringify({selectedClaimIds:catalog.deterministicBaseline.selectedClaimIds}),usage:{inputTokens:1000,outputTokens:100,totalTokens:1100,cachedTokens:0,reasoningTokens:0},provider:'deepseek',returnedModel:DEEPSEEK_AI.model,returnedServiceTier:null,responseId:'fixture-response',adapterVersion:DEEPSEEK_AI.adapterVersion,billingProfile:DEEPSEEK_AI.billingProfile};}};
export default {async fetch(envelope,env,ctx){const wire=await envelope.json();const request=new Request(ORIGIN+wire.path,{method:wire.method,headers:wire.headers,...(wire.body===undefined?{}:{body:wire.body})});const url=new URL(request.url);
 if(url.pathname==='/__test/config'){const c=await request.json();if(c.time!==undefined)time=c.time;if(c.flags)flags=c.flags;if(c.revoked!==undefined)grant.revoked=c.revoked;if(c.grant)Object.assign(grant,c.grant);return Response.json({ok:true});}
 if(url.pathname==='/__test/stats')return Response.json({time,loads,calls});
 if(url.pathname==='/__test/purge'){await new D1Records(env.DB).purgeExpired(time);return Response.json({ok:true});}
 if(url.pathname==='/__test/default')return handleSiteInterpretation(new Request(ORIGIN+'/api/interpretation'),{AI_SITE_ENABLED:'1',DB:env.DB,MARKET_RADAR_DEEPSEEK_API_KEY:'fixture-not-real'},ctx);
 if(flags.hostedWithoutKey){
   const clock=Date.now;
   globalThis.__siteFixtureGrant=grant;
   Date.now=()=>time;
   try{return await handleSiteInterpretation(request,{AI_SITE_ENABLED:'1',DB:env.DB,AI_SITE_ID:'fixture-site',AI_SITE_ORIGIN:ORIGIN},ctx);}
   finally{delete globalThis.__siteFixtureGrant;Date.now=clock;}
 }
 let linkReads=0;
 const db=flags.jumpLinkAt?{batch:(list)=>env.DB.batch(list),prepare(sql){const raw=env.DB.prepare(sql);return {bind(...args){const bound=raw.bind(...args);return {async all(){const result=await bound.all();if(sql.includes('FROM ai_context_policy_links l')&&++linkReads===flags.jumpLinkAt){if(flags.jumpTime!==undefined)time=flags.jumpTime;if(flags.revokeOnLink)await env.DB.prepare('UPDATE ai_access_grants SET enabled=0').run();if(flags.readOnlyOnLink)await env.DB.prepare('UPDATE ai_access_grants SET permissions_json=?').bind(JSON.stringify(['read'])).run();}return result;}};}};}}:env.DB;
 const records=new D1Records(db),runtime=createSiteContextRuntime({db,grant:flags.noGrant?null:grant,now:()=>time,provider,
 loader:async()=>{loads++;if(flags.loadDelay)await new Promise(resolve=>setTimeout(resolve,flags.loadDelay));const data=privateFixtureSnapshot(time);if(flags.historyAge)data.histories['BTC-USDT'].fetchedAt-=flags.historyAge;return data;}});
 return createSiteInterpretationHandler({config:{siteId:'fixture-site',origin:ORIGIN,symbols:['BTC-USDT']},reader:{get:(s,u)=>records.getGrant(s,u)},runtime,now:()=>time})(request,ctx);
}};`;
let compiled;
// Supply a synthetic source decision to the hosted entry only inside this test bundle.
const sourceDecisionPlugin = {
 name:'fixture-site-policy', setup(builder) {
   builder.onResolve({filter:/real-context-policy$/}, args => {
     if (basename(args.importer)==='ai-site-interpretation.ts') return {path:'policy',namespace:'site-fixture'};
   });
   builder.onLoad({filter:/.*/,namespace:'site-fixture'}, () => ({contents:'export const approvedSiteContextGrant=()=>globalThis.__siteFixtureGrant ?? null;'}));
 },
};
async function script(){if(!compiled)compiled=(await build({plugins:[sourceDecisionPlugin],stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'fixture-c2.mjs'},bundle:true,write:false,platform:'neutral',format:'esm',external:['node:*'],conditions:['workerd','browser'],logLevel:'silent'})).outputFiles[0].text;return compiled;}
export async function recordsFixture(t){
 const dir=mkdtempSync(join(tmpdir(),'mr-c2-records-'));let mf,db,egress=0;
 const start=async()=>{mf=new Miniflare({d1Persist:dir,workers:await Promise.all(['alpha','beta'].map(async name=>({name,modules:true,script:await script(),compatibilityDate:'2026-05-22',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'fixture-c2'},outboundService:()=>{egress++;return new Response('',{status:503});}})))});db=await mf.getD1Database('DB','alpha');};
 await start();t.after(async()=>{await mf.dispose();const resolved=realpathSync(dir);if(dirname(resolved)!==realpathSync(tmpdir())||!basename(resolved).startsWith('mr-c2-records-'))throw Error('unsafe_fixture_cleanup');rmSync(resolved,{recursive:true,force:true});});
 for(const name of ['ai-production-budget','ai-production-records']){const sql=readFileSync(new URL('../../db/'+name+'.sql',import.meta.url),'utf8').replace(/^--.*$/gm,'');const statements=sql.split(/;(?=\s*(?:CREATE|INSERT)|\s*$)/).filter(s=>s.trim());await db.batch(statements.map(s=>db.prepare(s)));}
 const grant=privateFixtureGrant(NOW);
 await db.batch([
  db.prepare("INSERT INTO metadata VALUES(1,'market-radar-product-budget-v2',2)"),
  db.prepare("INSERT INTO ai_budget_policies VALUES('fixture-policy','pilot',?,?,?,3,250000000,1,0,NULL)").bind(SYNTHETIC_PILOT_ID,grant.authorizationId,SCOPE),
  db.prepare("UPDATE ai_budget_control SET enabled=1,import_status='verified',import_hash=?,policy_id='fixture-policy' WHERE id=1").bind('e'.repeat(64)),
  db.prepare('INSERT INTO ai_access_grants VALUES(?,?,1,1,?,?,?)').bind(SITE,SUBJECT,NOW+3600000,JSON.stringify(['read','invoke']),JSON.stringify(['BTC-USDT'])),
  db.prepare('INSERT INTO ai_context_policy_links VALUES(?,?,?,?,?,?)').bind('fixture-policy',grant.authorizationId,grant.policyVersion,SCOPE,NOW,NOW+1200000),
 ]);
 return {get db(){return db},get egress(){return egress},async restart(){await mf.dispose();await start();},
 async request(path='/api/interpretation',body,options={}){const worker=await mf.getWorker(options.worker||'alpha');const method=options.method|| (body===undefined?'GET':'POST');const response=await worker.fetch('http://fixture.invalid/',{method:'POST',body:JSON.stringify({path,method,headers:{...(options.subject===null?{}:{'oai-authenticated-user-id':options.subject||SUBJECT}),...(method==='POST'?{origin:ORIGIN,'content-type':'application/json'}:{}),...options.headers},...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)})})});return {status:response.status,headers:response.headers,body:await response.json()};},
 async rows(table){if(!['ai_snapshots','ai_results','requests','ai_dispatch_intents','request_profiles','ai_context_policy_links'].includes(table))throw Error('fixture_table');return (await db.prepare('SELECT * FROM '+table+' ORDER BY 1').all()).results;},
 };
}
