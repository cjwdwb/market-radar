// Real-time laboratory proxy. No frozen clock, animation overrides, timer acceleration or GPU flags.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,fixture,archive,pause} from './fixture.mjs';
const label=process.argv[2]||'baseline',base=process.env.RADAR_PERF_URL||'http://127.0.0.1:5290',out=`outputs/perf275/${label}`;
fs.mkdirSync(out,{recursive:true});
const report={label,started:new Date().toISOString(),environment:{runtime:'local workerd production build',node:process.version,cache:'Playwright routing disables HTTP cache; new context each run',cpuThrottle:'none requested',data:'isolated synthetic fixtures; stages 0/1 retain same latest bar, 2 revises; new completed timestamp only on real grid boundary',clock:'real advancing',motion:'normal',physicalRefreshHz:'UNKNOWN',power:'UNKNOWN',presentedFrames:'NOT SUPPORTED',reactCommitProfiler:'NOT SUPPORTED',fieldINP:'NOT MEASURED'},runs:[]};
const quantile=(a,q)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*q))]:null;
function summarize(data){return {supported:data.supported,rafSchedulingProxy:{count:data.raf.length,p50:quantile(data.raf,.5),p95:quantile(data.raf,.95),p99:quantile(data.raf,.99),max:Math.max(0,...data.raf),over33:data.raf.filter(x=>x>33.4).length},longtasks:data.supported.includes('longtask')?{count:data.longtask.length,total:data.longtask.reduce((s,e)=>s+e.duration,0),max:Math.max(0,...data.longtask.map(e=>e.duration))}:'NOT SUPPORTED',loaf:data.supported.includes('long-animation-frame')?{count:data.loaf.length,totalBlocking:data.loaf.reduce((s,e)=>s+(e.blockingDuration||0),0)}:'NOT SUPPORTED',eventTiming:data.supported.includes('event')?{count:data.events.length,p95:quantile(data.events.map(e=>e.duration),.95)}:'NOT SUPPORTED'};}
const browser=await chromium.launch({channel:'msedge',headless:true});report.environment.browser=browser.version();
const deadline=setTimeout(()=>{report.timeout=true;void browser.close();},15*60_000);
const save=()=>{const json=JSON.stringify(report,null,2);if(Buffer.byteLength(json)>2*1024*1024){process.exitCode=1;void browser.close();fs.writeFileSync(`${out}/report-limit.json`,JSON.stringify({label,error:'2MiB report cap exceeded; stopped; previous partial report retained'}));return;}fs.writeFileSync(`${out}/report.json`,json);};
async function metrics(cdp){const perf=await cdp.send('Performance.getMetrics'),dom=await cdp.send('Memory.getDOMCounters');return {at:Date.now(),...dom,...Object.fromEntries(perf.metrics.filter(x=>['JSHeapUsedSize','JSHeapTotalSize','LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration','Nodes','JSEventListeners'].includes(x.name)).map(x=>[x.name,x.value]))};}
async function cycle(size,index,{probe=true,duration=33000}={}){
 const app=await fixture(browser,base,{...size,probe}),p=app.page,run={viewport:size,index,probe,actions:[],checks:[],requests:app.requests,errors:app.errors,warnings:app.warnings};report.runs.push(run);const started=Date.now();
 try{
  const cdp=await app.context.newCDPSession(p);await cdp.send('Performance.enable');
  await p.goto(base,{waitUntil:'networkidle'});await p.locator('.candle-canvas').waitFor();await pause(1700);run.start=await metrics(cdp);
  await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension=direction]')?.dataset.availability==='available');
  run.environment=await p.evaluate(()=>({visibility:document.visibilityState,dpr:devicePixelRatio,cores:navigator.hardwareConcurrency,ua:navigator.userAgent,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,clock:Date.now()}));
  async function action(name,fn){const at=performance.now();await fn();run.actions.push({name,completionMs:performance.now()-at});}
  await action('S1 scroll down/up',async()=>{await p.mouse.wheel(0,600);await pause(350);await p.mouse.wheel(0,-600);await pause(350);});
  const canvas=p.locator('.candle-canvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();
  await action('S2 hover',async()=>{for(let i=0;i<20;i++)await p.mouse.move(b.x+20+i*(b.width-100)/20,b.y+b.height*.45);});
  await action('S2 drag/zoom/keyboard',async()=>{await p.mouse.down();await p.mouse.move(b.x+Math.min(100,b.width*.4),b.y+b.height*.45,{steps:15});await p.mouse.up();await p.keyboard.down('Control');await p.mouse.wheel(0,-150);await p.keyboard.up('Control');await canvas.focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('End');});
  await action('S2 range/context/return',async()=>{await p.getByRole('tab',{name:'1 周',exact:true}).click();await p.locator('.price-chart .recharts-area-curve').waitFor();await p.locator('.classic-experience .asset-state-summary button').click();await p.locator('.radar-asset-context').getByRole('button',{name:'返回图表',exact:true}).click();assert.equal(await p.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');await p.getByRole('tab',{name:'15 分钟',exact:true}).click();await canvas.waitFor();});
  run.checks.push('context returns same asset/manual range');
  await p.locator('.classic-experience .asset-state-summary button').click();const panel=p.locator('.macro-timeline');await panel.locator(':scope > summary').click();
  const small=await archive(),large=await archive(200,true);const input=panel.locator('input[type=file]');
  await action('S5 small import',async()=>{await input.setInputFiles(small.file);await panel.locator('.macro-view').waitFor();});
  await action('S5 1MiB/200 import',async()=>{await input.setInputFiles(large.file);await p.waitForFunction(id=>document.querySelector('.macro-view')?.getAttribute('data-view-id')===id,large.view.viewId);});
  await panel.getByRole('button',{name:'下一页',exact:true}).click();const accepted={id:await panel.locator('.macro-view').getAttribute('data-view-id'),status:await panel.locator('[role=status]').innerText(),links:await panel.locator('.macro-records a').allTextContents(),dates:await panel.locator('input[type=date]').evaluateAll(els=>els.map(e=>e.value))};
  await action('S5 invalid import',async()=>{await input.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});await panel.locator('[role=alert]').waitFor();});
  run.importPreserved=await panel.evaluate((el,id)=>el.querySelector('.macro-view')?.getAttribute('data-view-id')===id,accepted.id);
  if(run.importPreserved){assert.equal(await panel.locator('[role=status]').innerText(),accepted.status);assert.deepEqual(await panel.locator('.macro-records a').allTextContents(),accepted.links);assert.deepEqual(await panel.locator('input[type=date]').evaluateAll(els=>els.map(e=>e.value)),accepted.dates);}
  await p.screenshot({path:`${out}/${size.width}-${index}-import.png`});
  await input.setInputFiles(small.file);await panel.locator('.macro-view').waitFor();await p.locator('.radar-asset-context').getByRole('button',{name:'返回图表',exact:true}).click();await canvas.waitFor();
  // Composite slice includes one scheduled stock poll after range resets.
  // The separate fixed-range soak verifies two scheduled stock polls; no timer alteration.
  while(Date.now()-started<duration){await p.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await pause(1000);}
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(app.errors,[]);
  run.end=await metrics(cdp);run.elapsed=Date.now()-started;run.metrics=probe?summarize(await p.evaluate(()=>window.__stop275())):'PROBE DISABLED';run.clockEnd=await p.evaluate(()=>Date.now());
  await p.screenshot({path:`${out}/${size.width}-${index}-chart.png`});
 }catch(e){run.failure=String(e.stack||e);}finally{await app.context.close();save();}
}
try{
 for(const size of [{width:1440,height:1000},{width:390,height:844}])for(let i=0;i<Number(process.env.PERF_REPEATS||5);i++)await cycle(size,i);
 if(process.env.PERF_REPEATS!=='1')await cycle({width:1440,height:1000},'probe-off',{probe:false});
}finally{clearTimeout(deadline);await browser.close();report.finished=new Date().toISOString();save();console.log(JSON.stringify({report:`${out}/report.json`,runs:report.runs.length,failures:report.runs.filter(r=>r.failure).map(r=>r.failure),preservation:report.runs.map(r=>r.importPreserved)}));if(report.runs.some(r=>r.failure))process.exitCode=1;}
