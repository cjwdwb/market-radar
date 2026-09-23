// Real-clock fixture correctness: visible gesture results and an in-place completed-bar revision.
// Diagnostic assertions only; no FPS or latency conclusions from this script.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,fixture,pause} from './fixture.mjs';
const base=process.env.RADAR_PERF_URL||'http://127.0.0.1:5291',out=process.env.RADAR_CHART_OUTPUT_DIR||'outputs/perf275/correctness-chart';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),report={checks:[],errors:[]};const deadline=setTimeout(()=>void browser.close(),120000);
try{for(const width of [1440,390]){
 const app=await fixture(browser,base,{width,height:width===390?844:1000,probe:false,intro:false});const p=app.page;
 try{
  await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});const svg=p.locator('.candle-canvas');await svg.waitFor();await svg.scrollIntoViewIfNeeded();
  const initial=Number(await svg.getAttribute('data-view-count'));await p.getByRole('button',{name:'放大 K 线',exact:true}).click();await p.waitForFunction(n=>Number(document.querySelector('.candle-canvas')?.getAttribute('data-view-count'))<n,initial);
  await svg.scrollIntoViewIfNeeded();const b=await svg.boundingBox(),start=Number(await svg.getAttribute('data-view-start'));
  await p.mouse.move(b.x+b.width*.3,b.y+b.height*.4);await p.mouse.down();await p.mouse.move(b.x+b.width*.65,b.y+b.height*.4,{steps:12});await p.mouse.up();
  await p.waitForFunction(n=>Number(document.querySelector('.candle-canvas')?.getAttribute('data-view-start'))<n,start);
  const count=Number(await svg.getAttribute('data-view-count'));await p.keyboard.down('Control');await p.mouse.wheel(0,-120);await p.keyboard.up('Control');await p.waitForFunction(n=>Number(document.querySelector('.candle-canvas')?.getAttribute('data-view-count'))<n,count);
  await svg.focus();await p.keyboard.press('Home');await p.waitForFunction(()=>Number(document.querySelector('.candle-canvas')?.getAttribute('data-view-start'))===0);await p.keyboard.press('End');await p.waitForFunction(()=>document.querySelector('.candle-canvas')?.getAttribute('data-follow-latest')==='true');
  const scroll=await p.evaluate(()=>scrollY);await p.mouse.wheel(0,scroll>100?-180:180);await p.waitForFunction(old=>scrollY!==old,scroll);report.checks.push(`${width}: zoom count, pointer pan, Ctrl-wheel, Home/End, ordinary wheel page scroll`);
  await p.setViewportSize({width:width+20,height:width===390?844:1000});await p.setViewportSize({width,height:width===390?844:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(width===1440){
   const close=()=>p.locator('.candle-readout b').innerText();await svg.focus();await p.keyboard.press('End');await p.keyboard.press('Escape');const before=await close(),beforeAt=await p.locator('.candle-readout strong').innerText();
   // Fourth ordinary history response revises the latest completed bar. Keep native 15s cadence.
   const until=Date.now()+65000;while(app.requests.filter(r=>r.path==='/api/history'&&r.query.includes('range=15m')).length<4&&Date.now()<until)await pause(500);
   assert.ok(app.requests.filter(r=>r.path==='/api/history'&&r.query.includes('range=15m')).length>=4);
   await p.waitForFunction(()=>Number(document.querySelector('.candle-readout b')?.textContent?.replace(/[^\d.-]/g,''))===102.81);const after=await close(),afterAt=await p.locator('.candle-readout strong').innerText();assert.notEqual(after,before);
   report.revision={before,after,beforeAt,afterAt,sameBar:beforeAt===afterAt,identityPrecision:'displayed UTC month/day/hour/minute; fixture bars have 15-minute granularity',sameBarStatus:beforeAt===afterAt?'PASS':'NOT RUN — real source grid boundary crossed'};
   report.checks.push(beforeAt===afterAt?'same displayed candle timestamp: completed-bar revision visibly updates close under native polling':'latest close visibly updates; same-bar revision NOT RUN because real source grid advanced');report.requests=app.requests;
  }
  report.errors.push(...app.errors);assert.deepEqual(app.errors,[]);await p.screenshot({path:`${out}/${width}.png`});
 }finally{await app.context.close();}
}}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}finally{clearTimeout(deadline);await browser.close();fs.writeFileSync(`${out}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
