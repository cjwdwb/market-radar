// 本地生产构建；真实只读日频库 + 模拟实时行情。没有分钟分析/FPS推断。
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,fixture,pause} from './fixture.mjs';
const combined=process.env.REFERENCE_COMBINED==='1';
const base='http://127.0.0.1:5297',out='outputs/coverage29/'+(combined?'performance-combined':'performance');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={date:new Date().toISOString(),browser:browser.version(),node:process.version,environment:{runtime:'local workerd production build',clock:'real advancing',motion:'normal',prices:'actual Coin Metrics current-vintage daily / 3656 values',live:'fixture',physicalDevice:'NOT RUN',refreshHz:'UNKNOWN',analysis:'NOT APPLICABLE: daily is unsupported by minute methods',databaseScans:'SQL statement count NOT MEASURED; HTTP query count observed',comparativeImprovement:'NOT CLAIMED: newly enabled long-range query'},runs:[]};
const save=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const deadline=setTimeout(()=>{report.timeout=true;save();void browser.close();},150000);
async function overlapping(width){
 const app=await fixture(browser,base,{width,height:width===1440?1000:844,intro:false}),p=app.page,row={width,requests:app.requests,errors:app.errors,warnings:app.warnings,timeline:[],queries:[],quoteResponses:[]};report.runs.push(row);
 p.on('response',r=>{if(new URL(r.url()).pathname==='/api/quotes')row.quoteResponses.push(Date.now());});
 const headers={Origin:base,'Content-Type':'application/json','X-Archive-Key':'fixture-only-reference-browser-session'};
 const api=async(path,body={})=>{const t=performance.now();const r=await fetch(base+'/__archive/'+path,{method:'POST',headers,body:JSON.stringify(body)});assert.equal(r.status,200);const data=await r.json();return {data,ms:performance.now()-t};};
 try{
  const c=(await api('catalog')).data.reference.series[0];row.version=c.version;row.scope='12 actual local 31-day page queries over ~3s, concurrent chart input and ordinary fixture quote polling; no artificial backend delay';
  await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});const canvas=p.locator('.candle-canvas');await canvas.scrollIntoViewIfNeeded();
  await pause(Math.max(0,row.quoteResponses.at(-1)+4300-Date.now()));
  row.started=Date.now();row.probeStart=await p.evaluate(()=>performance.now());
  const queries=(async()=>{for(let i=0;i<12;i++){const t=Date.now();const q=await api('reference-query',{asset:c.asset,version:c.version,from:c.range.from+i*31*86400000,cutoff:c.range.cutoff});assert.equal(q.data.version,c.version);assert.equal(q.data.points.length,31);row.queries.push({at:t,ms:q.ms});await pause(250);}})();
  const b=await canvas.boundingBox();row.timeline.push({event:'chart input start',at:Date.now()});await p.mouse.move(b.x+b.width*.65,b.y+b.height*.45);await p.mouse.down();await p.mouse.move(b.x+b.width*.35,b.y+b.height*.45,{steps:20});await p.mouse.up();await canvas.focus();await p.keyboard.press('ArrowLeft');await p.keyboard.press('End');await p.mouse.wheel(0,120);await p.mouse.wheel(0,-120);row.timeline.push({event:'chart input end',at:Date.now()});
  await queries;row.finished=Date.now();await p.getByRole('button',{name:/ETH/}).first().click();await pause(500);
  const probe=await p.evaluate(()=>window.__stop275()),tasks=probe.longtask.filter(v=>v.start>=row.probeStart);row.longtasks={count:tasks.length,totalMs:tasks.reduce((n,v)=>n+v.duration,0),maxMs:Math.max(0,...tasks.map(v=>v.duration))};row.health=(await api('health')).data;
  row.quoteResponsesDuringQueries=row.quoteResponses.filter(t=>t>=row.started&&t<=row.finished).length;assert.ok(row.quoteResponsesDuringQueries>=1);
  assert.deepEqual(app.errors,[]);assert.equal(row.health.active,0);assert.equal(row.health.pending,0);
 }catch(e){row.failure=String(e.stack||e);}finally{await app.context.close();save();}
}
try{if(combined){for(const width of [1440,390])await overlapping(width);}else for(const width of [1440,390])for(let index=0;index<3;index++){
 const app=await fixture(browser,base,{width,height:width===1440?1000:844,intro:false}),p=app.page,start=Date.now();
 const row={width,index,requests:app.requests,errors:app.errors,warnings:app.warnings,heap:[],queries:[],feedback:[]};report.runs.push(row);let sampler;
 const headers={Origin:base,'Content-Type':'application/json','X-Archive-Key':'fixture-only-reference-browser-session'};
 try{
  const cdp=await app.context.newCDPSession(p);await cdp.send('Performance.enable');
  const sample=async()=>{const m=await cdp.send('Performance.getMetrics');row.heap.push(m.metrics.find(m=>m.name==='JSHeapUsedSize').value);};
  const seen=new Map();p.on('request',r=>{if(r.url().endsWith('/__archive/reference-query'))seen.set(r,performance.now());});
  p.on('response',r=>{if(seen.has(r.request()))row.queries.push({status:r.status(),ms:performance.now()-seen.get(r.request())});});
  await p.goto(base+'/#radar',{waitUntil:'networkidle'});sampler=setInterval(()=>void sample().catch(()=>{}),500);await sample();
  const panel=p.locator('.history-workspace');await panel.locator(':scope > summary').click();await panel.getByText('连接本地归档数据库',{exact:true}).click();await panel.getByLabel('本地归档会话密钥').fill(headers['X-Archive-Key']);await panel.getByRole('button',{name:'连接归档',exact:true}).click();
  const ref=panel.locator('.reference-history');await ref.locator(':scope > summary').click();
  const measure=async(name,endpoint)=>{
   await p.evaluate(()=>{window.__referenceMeasure={};const ref=document.querySelector('.reference-history');ref.addEventListener('click',()=>{window.__referenceMeasure.start=performance.now();const o=new MutationObserver(()=>{if(ref.querySelector('.reference-result')&&!ref.querySelector('[role=status]')){o.disconnect();requestAnimationFrame(()=>window.__referenceMeasure.visible=performance.now());}});o.observe(ref,{childList:true,subtree:true});},{once:true,capture:true});});
   await ref.getByRole('button',{name,exact:true}).click();await p.waitForFunction(()=>window.__referenceMeasure?.visible);assert.equal(await ref.locator('.macro-records time').first().getAttribute('datetime'),endpoint);
   row.feedback.push(await p.evaluate(()=>({start:window.__referenceMeasure.start,ms:window.__referenceMeasure.visible-window.__referenceMeasure.start})));assert.ok(await ref.locator('.macro-records li').count()<=31);
  };
  await measure('查询日频价格','2021-10-01');await measure('下一页日频','2021-11-01');await measure('上一页日频','2021-10-01');
  row.version=await ref.locator('.reference-result > details').textContent();row.archiveQueryCount=seen.size;assert.equal(seen.size,3);
  await panel.getByRole('link',{name:'返回实时图表',exact:true}).click();const canvas=p.locator('.candle-canvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();
  const t=performance.now();await p.mouse.move(b.x+b.width*.65,b.y+b.height*.45);await p.mouse.down();await p.mouse.move(b.x+b.width*.35,b.y+b.height*.45,{steps:12});await p.mouse.up();await canvas.focus();await p.keyboard.press('ArrowLeft');await p.keyboard.press('End');row.chartInteractionMs=performance.now()-t;
  await p.mouse.wheel(0,180);await p.mouse.wheel(0,-180);await p.getByRole('button',{name:/ETH/}).first().click();
  while(Date.now()-start<17000)await pause(500);
  await sample();const probe=await p.evaluate(()=>window.__stop275()),tasks=probe.longtask.filter(v=>v.start>=row.feedback[0].start);
  row.longtasks={count:tasks.length,totalMs:tasks.reduce((n,v)=>n+v.duration,0),maxMs:Math.max(0,...tasks.map(v=>v.duration))};row.heapPeak=Math.max(...row.heap);row.heapEnd=row.heap.at(-1);row.elapsedMs=Date.now()-start;
  row.health=await(await fetch(base+'/__archive/health',{method:'POST',headers,body:'{}'})).json();assert.equal(row.health.active,0);assert.equal(row.health.pending,0);
  assert.ok(row.requests.filter(r=>r.path==='/api/quotes').length>=3);assert.deepEqual(app.errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }catch(e){row.failure=String(e.stack||e);}finally{clearInterval(sampler);await app.context.close();save();}
}}finally{clearTimeout(deadline);await browser.close();save();}
if(report.runs.some(r=>r.failure))process.exitCode=1;
