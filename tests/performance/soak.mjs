// Finite real-time resource trend and timeline attribution, never a zero-leak/FPS proof.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,fixture,pause} from './fixture.mjs';
const label=process.argv[2]||'baseline',out=`outputs/perf275/${label}`,base=process.env.RADAR_PERF_URL||'http://127.0.0.1:5290';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),app=await fixture(browser,base,{intro:false}),p=app.page,report={label,clock:'real',durationTargetMs:120000,checkpoints:[],actions:[],errors:app.errors,warnings:app.warnings,requests:app.requests};
const deadline=setTimeout(()=>{report.timeout=true;process.exitCode=1;void browser.close();},180000);
try{
 const cdp=await app.context.newCDPSession(p);await cdp.send('Performance.enable');await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.candle-canvas').waitFor();
 await cdp.send('Tracing.start',{categories:'devtools.timeline,v8',transferMode:'ReturnAsStream'});let traceRunning=true;
 async function stopTrace(){if(!traceRunning)return;traceRunning=false;const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await complete;let buffer='',bytes=0;try{while(true){const chunk=await cdp.send('IO.read',{handle:stream,size:65536});bytes+=Buffer.byteLength(chunk.data);if(bytes>64*1024*1024){report.trace='CAP EXCEEDED; NOT ANALYZED';break;}buffer+=chunk.data;if(chunk.eof){fs.writeFileSync(`${out}/timeline.json`,buffer);const events=JSON.parse(buffer).traceEvents;const totals={};for(const e of events)if(e.ph==='X'&&['Layout','UpdateLayoutTree','Paint','FunctionCall','EvaluateScript','RunMicrotasks'].includes(e.name)){const t=totals[e.name]??={count:0,totalMs:0,maxMs:0};t.count++;t.totalMs+=(e.dur||0)/1000;t.maxMs=Math.max(t.maxMs,(e.dur||0)/1000);}report.trace={bytes,totals,limits:'Nested durations overlap; no summing across categories, no presented-frame inference'};break;}}}finally{await cdp.send('IO.close',{handle:stream});}}
 const started=Date.now();
 for(let i=0;i<=12;i++){
  if(i)await pause(Math.max(0,started+i*10000-Date.now()));
  if(i===3)await stopTrace();
  if(i===4){app.control.fail=true;report.actions.push('40s simulated quote outage');}
  if(i===5){app.control.fail=false;report.actions.push('50s provider responses recover; existing backoff retained');}
  if(i===6){await app.context.setOffline(true);await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension=direction]')?.dataset.availability==='offline');await app.context.setOffline(false);report.actions.push('60s offline invalidation/recovery');}
  if(i===7){await p.locator('.settings-trigger').click();await p.getByRole('switch',{name:'开启自动监控',exact:true}).click();await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension=direction]')?.dataset.availability==='paused');await p.locator('.settings-trigger').click();await p.getByRole('switch',{name:'开启自动监控',exact:true}).click();await p.keyboard.press('Escape');report.actions.push('70s pause invalidation/resume');}
  if(i===8){await p.locator('.settings-trigger').click();await p.locator('input[name=motion-preference][value=reduced]').check();await p.locator('input[name=motion-preference][value=normal]').check();await p.keyboard.press('Escape');report.actions.push('80s reduced→normal; normal restored');}
  if(i===9){const tab=await app.context.newPage();await tab.goto('about:blank');await tab.bringToFront();await pause(800);report.backgroundVisibility=await p.evaluate(()=>document.visibilityState);await tab.close();await p.bringToFront();}
  await p.locator('.classic-experience .asset-state-summary button').click();await p.locator('.asset-intelligence-details > summary').click();await p.locator('.radar-asset-context').getByRole('button',{name:'返回图表',exact:true}).click();await p.locator('.candle-canvas').waitFor();
  const canvas=p.locator('.candle-canvas');await canvas.scrollIntoViewIfNeeded();await canvas.focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('Escape');
  const raw=await cdp.send('Performance.getMetrics');report.checkpoints.push({elapsed:Date.now()-started,...await cdp.send('Memory.getDOMCounters'),...Object.fromEntries(raw.metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize','ScriptDuration','LayoutDuration','RecalcStyleDuration','TaskDuration','JSEventListeners'].includes(m.name)).map(m=>[m.name,m.value])),state:await p.locator('.classic-experience [data-dimension=direction]').getAttribute('data-availability')});
 }
 await stopTrace();report.elapsed=Date.now()-started;report.finalProbe=await p.evaluate(()=>{const d=window.__stop275();return {rafSamples:d.raf.length,longtask:d.longtask,loaf:d.loaf};});assert.deepEqual(app.errors,[]);
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}finally{clearTimeout(deadline);await app.context.close();await browser.close();fs.writeFileSync(`${out}/soak.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({file:`${out}/soak.json`,failure:report.failure,checkpoints:report.checkpoints.length}));}
