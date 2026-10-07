// Reuses the existing real-clock fixture; no production data/model or FPS claims.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,fixture,pause} from './fixture.mjs';
const base=process.env.RADAR_PERF_URL||'http://127.0.0.1:5301',out='outputs/ai30a/performance';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const report={at:new Date().toISOString(),node:process.version,browser:browser.version(),clock:'real advancing',motion:'normal',data:'synthetic market + server-owned fixture interpretation',providerNetwork:'blocked by local workerd',postDelayMs:800,fps:'NOT MEASURED',cpuThrottle:'none',power:'unknown',runs:[]};
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const app=await fixture(browser,base,{...viewport,intro:false,interpretation:true}),p=app.page,cdp=await app.context.newCDPSession(p),samples=[];await cdp.send('Performance.enable');
  await p.route('**/api/interpretation',async r=>{if(r.request().method()==='POST')await pause(800);await r.continue().catch(()=>{});});
  const start=Date.now();await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.candle-canvas').waitFor();
  const sample=async()=>{const {metrics}=await cdp.send('Performance.getMetrics');samples.push({at:Date.now()-start,...Object.fromEntries(metrics.filter(m=>['JSHeapUsedSize','TaskDuration','ScriptDuration'].includes(m.name)).map(m=>[m.name,m.value]))});};await sample();
  await p.locator('.asset-radar-awareness').click();const ai=p.locator('.ai-interpretation');await ai.locator(':scope>summary').click();await ai.getByRole('button',{name:'查看解释',exact:true}).waitFor();
  const generated=performance.now();await ai.getByRole('button',{name:'查看解释',exact:true}).click();const waiting=await ai.getByRole('button',{name:'取消解释'}).isVisible();
  const beforeRefresh=app.requests.filter(r=>r.path==='/api/quotes').length;await p.getByRole('button',{name:'刷新行情',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('.refresh-button')?.disabled);assert.ok(app.requests.filter(r=>r.path==='/api/quotes').length>beforeRefresh);
  await ai.getByRole('button',{name:'返回图表',exact:true}).click();const canvas=p.locator('.candle-canvas');await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox();await p.mouse.move(box.x+box.width*.6,box.y+box.height*.4);await p.mouse.down();await p.mouse.move(box.x+box.width*.4,box.y+box.height*.4,{steps:5});await p.mouse.up();await canvas.focus();await p.keyboard.press('ArrowRight');
  await p.locator('.ai-classic-link').waitFor();const generatedMs=performance.now()-generated;await p.locator('.ai-classic-link').click();assert.match(await ai.innerText(),/演示结果/);await ai.getByRole('button',{name:'返回图表',exact:true}).click();
  while(Date.now()-start<33000){await sample();await pause(1000);}await sample();
  const probe=await p.evaluate(()=>window.__stop275());assert.deepEqual(app.errors,[]);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  report.runs.push({viewport,elapsedMs:Date.now()-start,waitingObserved:waiting,completionWith800msFixtureDelayMs:generatedMs,quoteRequests:app.requests.filter(r=>r.path==='/api/quotes').length,historyRequests:app.requests.filter(r=>r.path==='/api/history').length,heapSamples:samples,maximumSampledHeapBytes:Math.max(...samples.map(s=>s.JSHeapUsedSize)),longTasks:probe.longtask,longAnimationFrames:probe.loaf,errors:app.errors,warnings:app.warnings});await app.context.close();
 }
}finally{await browser.close();fs.writeFileSync(out+'/verification.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report.runs.map(r=>({viewport:r.viewport,completionMs:r.completionWith800msFixtureDelayMs,quotes:r.quoteRequests,maximumSampledHeapBytes:r.maximumSampledHeapBytes,longTasks:r.longTasks.length}))));
