// 生产等效本地构建 + 真实推进时钟。所有价格均fixture；不代表真机FPS/生产延迟。
import { writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, fixture, pause } from './fixture.mjs';
import { historyFixture } from '../fixtures/history28.mjs';
const overlap=process.env.HISTORY29_OVERLAP==='1',final=process.env.HISTORY29_FINAL==='1',out='outputs/stage29c/'+(overlap?'performance-overlap':final?'performance-final':'performance');mkdirSync(out,{recursive:true});
const data=await historyFixture({count:2000}),file={name:'matched-history29.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))};
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={date:new Date().toISOString(),browser:browser.version(),node:process.version,data:{identity:'fixture',digest:data.digest,bars:2000,bytes:file.buffer.length},environment:{clock:'real advancing',motion:'normal',runtime:'local workerd production build',cache:'routing disables HTTP cache',cpuThrottle:'none',physicalRefreshHz:'UNKNOWN',power:'UNKNOWN',fieldINP:'NOT MEASURED',trueDevice:'NOT RUN',providerLatency:'NOT MEASURED: isolated fixture replies'},runs:[]};
const save=()=>writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const deadline=setTimeout(()=>{report.timeout=true;save();void browser.close();},8*60000);
async function run(label,base,width,index,database=false){
 const app=await fixture(browser,base,{width,height:width===1440?1000:844,intro:false}),p=app.page,started=Date.now();
 const row={label,width,index,database,requests:app.requests,errors:app.errors,warnings:app.warnings,heap:[],actions:[],health:[]};report.runs.push(row);let sampler;
 try{
  const cdp=await app.context.newCDPSession(p);await cdp.send('Performance.enable');
  const sample=async()=>{const m=await cdp.send('Performance.getMetrics');row.heap.push(m.metrics.find(m=>m.name==='JSHeapUsedSize').value);};
  await p.goto(base+'/#radar',{waitUntil:'networkidle'});await p.locator('.history-workspace > summary').click();const panel=p.locator('.history-workspace');
  sampler=setInterval(()=>void sample().catch(()=>{}),1000);await sample();
  if(database){await panel.getByText('连接本地归档数据库',{exact:true}).click();await panel.getByLabel('本地归档会话密钥').fill('fixture-only-history29-browser-session');await panel.getByRole('button',{name:'连接归档',exact:true}).click();await panel.getByLabel('归档序列').waitFor();const key=await panel.getByLabel('归档序列').locator('option').evaluateAll(es=>es.find(e=>e.textContent.includes('C29-USD')&&e.textContent.includes('5 分钟')).value);await panel.getByLabel('归档序列').selectOption(key);}
  await p.evaluate(()=>{
   const panel=document.querySelector('.history-workspace');window.__historyMeasure={};
   const start=()=>{window.__historyMeasure.start=performance.now();const observer=new MutationObserver(()=>{if(panel.querySelector('.history-view')){observer.disconnect();requestAnimationFrame(()=>{window.__historyMeasure.visible=performance.now();});}});observer.observe(panel,{childList:true,subtree:true});};
   panel.querySelector('input[type=file]').addEventListener('change',start,{once:true});panel.addEventListener('click',e=>{if(e.target.textContent==='查询历史')start();},{capture:true});
  });
  const begin=Date.now();
  if(database)await panel.getByRole('button',{name:'查询历史',exact:true}).click();else await panel.locator('input[type=file]').setInputFiles(file);
  await p.mouse.wheel(0,150);
  if(database){for(let i=0;i<4;i++){const t=performance.now();const r=await fetch(base+'/__archive/health',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','X-Archive-Key':'fixture-only-history29-browser-session'},body:'{}'});row.health.push({ms:performance.now()-t,...await r.json()});}}
  await p.waitForFunction(()=>window.__historyMeasure?.visible,{timeout:30000});
  row.feedback=await p.evaluate(()=>({inputToNextFrameMs:window.__historyMeasure.visible-window.__historyMeasure.start,...window.__historyMeasure}));row.operationMs=Date.now()-begin;
  await p.screenshot({path:`${out}/${label}-${width}-${index}-history.png`});
  await panel.getByRole('button',{name:'返回实时 Radar',exact:true}).click();await p.evaluate(()=>location.hash='#price-chart');await p.locator('.candle-canvas').waitFor();
  const canvas=p.locator('.candle-canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();const actionAt=performance.now();
  await p.mouse.move(box.x+box.width*.65,box.y+box.height*.45);await p.mouse.down();await p.mouse.move(box.x+box.width*.35,box.y+box.height*.45,{steps:12});await p.mouse.up();await canvas.focus();await p.keyboard.press('ArrowLeft');await p.keyboard.press('End');row.actions.push({name:'chart drag and keyboard',ms:performance.now()-actionAt});
  await p.mouse.wheel(0,350);await pause(250);await p.mouse.wheel(0,-350);
  // 显式换symbol独立于导航；不改变刷新频率，等待正常crypto轮询。
  const eth=p.getByRole('button',{name:/ETH/}).first();if(await eth.count()){await eth.click();row.actions.push({name:'explicit ETH selection'});}
  while(Date.now()-started<17000)await pause(500);
  await sample();row.heapPeak=Math.max(...row.heap);row.heapEnd=row.heap.at(-1);
  const probe=await p.evaluate(()=>window.__stop275());const tasks=probe.longtask.filter(t=>t.start>=row.feedback.start);
  row.longtasks={count:tasks.length,totalMs:tasks.reduce((n,t)=>n+t.duration,0),maxMs:Math.max(0,...tasks.map(t=>t.duration))};row.eventTiming=probe.events.filter(e=>e.start>=row.feedback.start);row.clock=await p.evaluate(()=>Date.now());row.elapsedMs=Date.now()-started;
  assert.ok(row.requests.filter(r=>r.path==='/api/quotes').length>=3);assert.deepEqual(app.errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }catch(e){row.failure=String(e.stack||e);}finally{clearInterval(sampler);await app.context.close();save();}
}
async function overlapping(width){
 const base='http://127.0.0.1:5297',app=await fixture(browser,base,{width,height:width===1440?1000:844,intro:false}),p=app.page,row={label:'overlapping DB/quotes/chart',width,errors:app.errors,warnings:app.warnings,requests:app.requests,timeline:[]};report.runs.push(row);let lastQuote=Date.now();
 const headers={Origin:base,'Content-Type':'application/json','X-Archive-Key':'fixture-only-history29-browser-session'};
 const health=async()=>{const t=performance.now();const data=await(await fetch(base+'/__archive/health',{method:'POST',headers,body:'{}'})).json();return {ms:performance.now()-t,...data};};
 p.on('response',r=>{if(r.url().includes('/api/quotes')){lastQuote=Date.now();row.timeline.push({event:'quote response',at:lastQuote});}});
 try{
  await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.candle-canvas').waitFor();await p.evaluate(()=>location.hash='#radar');const panel=p.locator('.history-workspace');await panel.locator(':scope > summary').click();await panel.getByText('连接本地归档数据库',{exact:true}).click();await panel.getByLabel('本地归档会话密钥').fill(headers['X-Archive-Key']);await panel.getByRole('button',{name:'连接归档',exact:true}).click();await panel.getByLabel('归档序列').waitFor();const key=await panel.getByLabel('归档序列').locator('option').evaluateAll(es=>es.find(e=>e.textContent.includes('C29-USD')&&e.textContent.includes('5 分钟')).value);await panel.getByLabel('归档序列').selectOption(key);
  await pause(Math.max(0,lastQuote+4700-Date.now()));
  const response=p.waitForResponse(r=>r.url().endsWith('/__archive/query')),begin=Date.now();row.timeline.push({event:'query begin',at:begin});
  await panel.getByRole('button',{name:'查询历史',exact:true}).click();await p.evaluate(()=>location.hash='#price-chart');const canvas=p.locator('.candle-canvas');await p.waitForFunction(()=>{const b=document.querySelector('.candle-canvas')?.getBoundingClientRect();return b&&b.height>0&&b.top>=0&&b.bottom<=innerHeight;});const b=await canvas.boundingBox();row.activeAtDrag=await health();row.timeline.push({event:'drag begin',at:Date.now()});
  await p.mouse.move(b.x+b.width*.65,b.y+b.height*.45);await p.mouse.down();await p.mouse.move(b.x+b.width*.35,b.y+b.height*.45,{steps:8});await p.mouse.up();row.timeline.push({event:'drag end',at:Date.now()});
  const r=await response,analysis=await r.json();row.timeline.push({event:'query response consumed',at:Date.now()});row.snapshot=analysis.selection;row.scan=analysis.scan;assert.equal(analysis.scan.rows,30000);assert.equal(analysis.scan.status,'complete');assert.equal(row.activeAtDrag.active,1);
  await p.mouse.wheel(0,200);await p.mouse.wheel(0,-200);const eth=p.getByRole('button',{name:/ETH/}).first();await eth.click();row.timeline.push({event:'explicit symbol change',at:Date.now()});
  await p.evaluate(()=>location.hash='#radar');await panel.scrollIntoViewIfNeeded();await panel.getByRole('button',{name:'查询历史',exact:true}).click();row.beforeCancel=await health();await panel.getByRole('button',{name:'停止等待',exact:true}).click();await pause(100);row.afterCancel=await health();assert.equal(row.beforeCancel.active,1);assert.equal(row.afterCancel.active,0);assert.equal(row.afterCancel.pending,0);assert.match(await panel.innerText(),/已取消本次操作/);
  const probe=await p.evaluate(()=>window.__stop275());row.longtasks=probe.longtask;assert.deepEqual(app.errors,[]);await p.screenshot({path:`${out}/${width}.png`});
 }catch(e){row.failure=String(e.stack||e);}finally{await app.context.close();save();}
}
try{if(overlap){for(const width of [1440,390])await overlapping(width);}else{for(const width of [1440,390])for(let i=0;i<3;i++){if(!final)await run('baseline','http://127.0.0.1:5295',width,i);await run('candidate','http://127.0.0.1:5296',width,i);}for(const width of [1440,390])await run('database','http://127.0.0.1:5297',width,0,true);}}finally{clearTimeout(deadline);await browser.close();save();}
if(report.runs.some(r=>r.failure))process.exitCode=1;
