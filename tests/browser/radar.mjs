// Optional browser verification: requires Playwright + Edge, a running local preview and ignored .dev.vars.
// Test responses are intercepted only inside these disposable contexts; never imported by production.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {viewDigest} from '../../lib/information/fed-view.mjs';
import {createRequire} from 'node:module';
const loadPlaywright=createRequire(import.meta.url);
const {chromium}=loadPlaywright(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.RADAR_PREVIEW_URL||'http://localhost:5173';
// This harness creates signed test cookies, simulated data and test storage. Never target production.
const testUrl=new URL(base);
if(!['127.0.0.1','localhost','[::1]'].includes(testUrl.hostname)||!['http:','https:'].includes(testUrl.protocol))throw Error('Radar fixture requires a loopback preview URL.');
const stamp=1789372800000,output=process.env.RADAR_OUTPUT_DIR||'outputs/radar';fs.mkdirSync(output,{recursive:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const observedWarnings=[];
function series(symbol,mode){
  const interval=(symbol.endsWith('-USDT')?15:5)*60000;
  if(mode.startsWith('state26-')){
   const count=mode==='state26-short'?24:80;
   return Array.from({length:count},(_,i)=>{const reference=['QQQ','000300.SS','^HSI'].includes(symbol);const close=mode==='state26-mixed'&&symbol==='NVDA'?(i<62?100+i*.2:112.4-(i-62)*.04):100+i*(reference?.002:symbol.endsWith('-USDT')?.06:.02);return {time:stamp-(count-i)*interval-(mode==='state26-lag'&&symbol==='QQQ'?interval:0),close,open:close,high:close+.02,low:close-.02,volume:100,confirmed:true};});
  }
 return Array.from({length:70},(_,i)=>{const unusual=['normal','partial','tiny'].includes(mode),scale=mode==='tiny'?1e-10:mode==='large'?10000:1;const raw=mode==='large'?100+i*.0004:mode==='gentle'?100+i*.04:mode==='flat'?100:i===69&&unusual?103:100+(i%2)*.02;const close=raw*scale;return {time:stamp-(70-i)*interval,close,open:close,high:(raw+.02)*scale,low:(raw-.02)*scale,volume:i===69&&unusual?500:100,confirmed:true};});
}
async function fixture(browser,{mode='normal',intro=false,storage=false,delay=0,motionPreference,os='no-preference',probe=false,revealProbe=false,watchlist}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:os});
 // Explicit synthetic credentials for the isolated performance Worker; never read private env in this mode.
 const vars=process.env.RADAR_SYNTHETIC_AUTH==='1'?{ACCESS_CODE_HASH:crypto.createHash('sha256').update('PERFFIXTUREONLY').digest('hex'),ACCESS_SESSION_SECRET:'perf-fixture-only-not-a-production-secret-275'}:Object.fromEntries(fs.readFileSync('.dev.vars','utf8').trim().split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}));
 const payload=`${Math.floor(Date.now()/1000)+3600}.${crypto.randomBytes(16).toString('hex')}`;
 const sig=crypto.createHmac('sha256',vars.ACCESS_SESSION_SECRET).update(`radar-v1:${vars.ACCESS_CODE_HASH}:${payload}`).digest('hex');
 await context.addCookies([{name:'__Host-radar_access',value:`${payload}.${sig}`,url:base.replace('http:','https:'),secure:true,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();await page.clock.install({time:stamp});await page.clock.setFixedTime(stamp);
 if(motionPreference)await page.addInitScript(value=>{if(!localStorage.getItem('market-radar-preferences-v1'))localStorage.setItem('market-radar-preferences-v1',JSON.stringify({motionPreference:value}));},motionPreference);
 if(watchlist)await page.addInitScript(list=>{const key='market-radar-preferences-v1';if(!localStorage.getItem(key)||!JSON.parse(localStorage.getItem(key)).watchlist)localStorage.setItem(key,JSON.stringify({...JSON.parse(localStorage.getItem(key)||'{}'),watchlist:list}));},watchlist);
 if(probe)await page.addInitScript(()=>{
  window.__motionProbe={listeners:0,halos:[],cls:0};
  const add=MediaQueryList.prototype.addEventListener,remove=MediaQueryList.prototype.removeEventListener;
  MediaQueryList.prototype.addEventListener=function(...args){if(this.media.includes('prefers-reduced-motion')&&args[0]==='change')window.__motionProbe.listeners++;return add.apply(this,args);};
  MediaQueryList.prototype.removeEventListener=function(...args){if(this.media.includes('prefers-reduced-motion')&&args[0]==='change')window.__motionProbe.listeners--;return remove.apply(this,args);};
  const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
   // Stretch only the fixture's halo so switching Settings can deterministically test cancellation.
   const halo=this.classList.contains('price-halo');const result=animate.call(this,frames,halo?{...options,duration:10000}:options);
   if(halo)window.__motionProbe.halos.push(result);return result;
  };
  new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput)window.__motionProbe.cls+=entry.value;}).observe({type:'layout-shift',buffered:true});
 });
 if(!intro)await page.addInitScript(()=>sessionStorage.setItem('radar-brand-seen','1'));
 if(revealProbe)await page.addInitScript(()=>{
  window.__revealProbe=[];const animate=Element.prototype.animate;
  Element.prototype.animate=function(frames,options){
   const reveal=this.matches('.watch-panel .panel-heading,.right-column .panel,.footnote');
   const animation=animate.call(this,frames,reveal?{...options,duration:20000}:options);
   if(reveal)window.__revealProbe.push(animation);return animation;
  };
 });
 if(storage)await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Storage unavailable')};Storage.prototype.setItem=()=>{throw Error('Storage unavailable')};});
 const errors=[],requests=[],priceOffset={value:0};page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url())});
 page.on('console',message=>{if(['warning','error'].includes(message.type()))observedWarnings.push({mode,type:message.type(),text:message.text().slice(0,500)});});
 await page.route('**/api/quotes?**',async route=>{
  if(delay)await pause(delay);
  const symbols=new URL(route.request().url()).searchParams.get('symbols').split(',');
  await route.fulfill({json:{results:symbols.map(symbol=>{
   if(mode==='error'||mode==='partial'&&symbol==='NVDA'||mode==='benchmark-error'&&['QQQ','000300.SS','^HSI'].includes(symbol))return {symbol,error:'测试：该标的请求失败'};
   const okx=symbol.endsWith('-USDT'),points=series(symbol,mode),scale=mode==='tiny'?1e-10:mode==='large'?10000:1;
   return {symbol,quote:{symbol,name:symbol,currency:okx?'USDT':symbol.endsWith('.HK')||symbol==='^HSI'?'HKD':symbol.endsWith('.SS')?'CNY':'USD',source:okx?'OKX 欧易':'Yahoo Finance',price:points.at(-1).close+priceOffset.value,change:3*scale,changePercent:3,previousClose:100*scale,high:103.02*scale,low:99.98*scale,volume:1000000,timestamp:mode==='stale'?stamp-3600000:stamp,fetchedAt:stamp,session:'open',delayMinutes:0,points:okx?[]:points}};
  }),fetchedAt:stamp}});
 });
 await page.route('**/api/history?**',async route=>{
  if(delay)await pause(delay);
  const symbol=new URL(route.request().url()).searchParams.get('symbol');
  await route.fulfill({status:mode==='error'?503:200,json:{symbol,points:mode==='empty'?[]:series(symbol,mode),currency:symbol.endsWith('-USDT')?'USDT':'USD',source:symbol.endsWith('-USDT')?'OKX 欧易':'Yahoo Finance',fetchedAt:mode==='history-stale'?stamp-180000:stamp,timezone:'UTC'}});
 });
 await page.route('**/api/monitor**',route=>route.fulfill({status:401,json:{error:'仅站主管理'}}));
 return {context,page,errors,requests,priceOffset};
}

async function refinementChecks(browser,report,phase){
 const after=phase==='after',folder=`${output}/${phase}`;fs.mkdirSync(folder,{recursive:true});
 report.refinement=[];
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
  const app=await fixture(browser,{os:'reduce'}),p=app.page;await p.setViewportSize({width,height});await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.candle-canvas').waitFor();await p.waitForFunction(()=>document.querySelector('.asset-radar-awareness')?.textContent.includes('活跃事件'));
  await p.locator('.asset-radar-awareness').click();const outer=p.locator('.asset-intelligence-details');await outer.locator(':scope > summary').click();
  assert.match(await outer.innerText(),/主事件/);assert.match(await outer.innerText(),/净变化/);assert.match(await outer.innerText(),/RMS/);
  if(after){const method=p.locator('.state-method-details');assert.equal(await method.getAttribute('open'),null);assert.match(await outer.innerText(),/较低.*不等于低风险/);assert.match(await outer.innerText(),/检测覆盖/);}
  const context=p.locator('.radar-asset-context');await context.scrollIntoViewIfNeeded();await p.screenshot({path:`${folder}/${name}-context.png`});
  report.refinement.push({name,width,height,contextHeight:await context.evaluate(el=>el.getBoundingClientRect().height)});
  if(after){const method=p.locator('.state-method-details');await p.keyboard.press('Tab');await method.locator('summary').focus();await p.keyboard.press('Enter');assert.equal(await method.getAttribute('open'),'');assert.match(await method.innerText(),/报价获取/);assert.match(await method.innerText(),/门槛/);assert.ok((await method.locator('summary').boundingBox()).height>=44);await method.locator('summary').click();}
  await p.getByRole('button',{name:'返回图表',exact:true}).click();await p.getByRole('tab',{name:'1 周',exact:true}).click();await p.locator('.price-chart .recharts-area-curve').waitFor();
  const area=p.locator('.price-chart .recharts-surface');assert.ok((await area.boundingBox()).width>100);
  for(let i=0;i<2;i++){await p.locator('.asset-radar-awareness').click();await p.getByRole('button',{name:'返回图表',exact:true}).click();await p.locator('.price-chart .recharts-area-curve').waitFor();assert.equal(await p.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');}
  await p.setViewportSize({width:width+20,height});await p.locator('.price-chart .recharts-area-curve').waitFor();await p.setViewportSize({width,height});
  await p.locator('.price-chart').scrollIntoViewIfNeeded();await area.focus();await p.keyboard.press('ArrowRight');await p.locator('.chart-tooltip').waitFor();assert.match(await p.locator('.chart-tooltip').innerText(),/USDT/);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${folder}/${name}-chart.png`});
  assert.deepEqual(app.errors,[]);report.errors.push(...app.errors);report.checks.push(`${phase} ${name}: hierarchy/limits, week chart resize/return/keyboard tooltip, no overflow`);await app.context.close();
 }
 const tiny=await fixture(browser,{mode:'tiny'}),p=tiny.page;await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.getByRole('tab',{name:'1 周',exact:true}).click();await p.locator('.price-chart .recharts-area-curve').waitFor();
 report.tinyAxis=await p.locator('.recharts-yAxis-tick-labels text').allTextContents();
 if(after){assert.ok(report.tinyAxis.length>=2);assert.ok(report.tinyAxis.every(text=>Number(text.replaceAll(',',''))>0));assert.ok(new Set(report.tinyAxis).size>=2);}
  await p.screenshot({path:`${folder}/tiny-price.png`});report.errors.push(...tiny.errors);await tiny.context.close();report.checks.push(`${phase} tiny price axis captured${after?' and remains nonzero/distinct':''}`);
 if(after){
  const large=await fixture(browser,{mode:'large'}),page=large.page;await page.setViewportSize({width:320,height:740});await page.goto(base+'/#price-chart',{waitUntil:'networkidle'});await page.getByRole('tab',{name:'1 周',exact:true}).click();await page.locator('.price-chart .recharts-area-curve').waitFor();
  const ticks=page.locator('.recharts-yAxis-tick-labels text');report.largeAxis=await ticks.allTextContents();assert.ok(report.largeAxis.length>=2);assert.equal(new Set(report.largeAxis).size,report.largeAxis.length);
  assert.ok(await ticks.evaluateAll(nodes=>nodes.every(node=>{const b=node.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth;})));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.price-chart').scrollIntoViewIfNeeded();await page.screenshot({path:`${folder}/large-price-narrow.png`});report.errors.push(...large.errors);await large.context.close();report.checks.push('large narrow-range prices have distinct ticks within 320px viewport');
 }
 const noHydration=await fixture(browser);await noHydration.page.route('**/*',route=>route.request().resourceType()==='script'?route.abort():route.fallback());await noHydration.page.goto(base,{waitUntil:'domcontentloaded'});
 report.initialState=await noHydration.page.locator('.classic-experience [data-dimension=direction]').getAttribute('data-availability');if(after)assert.equal(report.initialState,'waiting');await noHydration.context.close();report.checks.push(`${phase} server loading state: ${report.initialState}`);
 if(after){const paused=await fixture(browser);await paused.page.addInitScript(()=>localStorage.setItem('market-radar-preferences-v1',JSON.stringify({auto:false})));await paused.page.goto(base,{waitUntil:'networkidle'});assert.equal(await paused.page.locator('.classic-experience [data-dimension=direction]').getAttribute('data-availability'),'paused');await paused.context.close();report.checks.push('saved user pause remains paused after hydration');}
 report.chartSizeWarnings=observedWarnings.filter(item=>/width\(|height\(/.test(item.text));if(after)assert.equal(report.chartSizeWarnings.length,0);
 fs.writeFileSync(`${folder}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,tinyAxis:report.tinyAxis,initialState:report.initialState,chartSizeWarnings:report.chartSizeWarnings.length,measurements:report.refinement}));
}

async function assetStateChecks(browser,report){
 const stateIn=page=>page.locator('.classic-experience .asset-state-summary');
 const facts=locator=>locator.locator('dl').innerText();
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
  const app=await fixture(browser,{mode:'state26-gentle',os:'reduce'}),p=app.page;await p.setViewportSize({width,height});
  await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.candle-canvas').waitFor();
  await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension="direction"]')?.dataset.availability==='available');
  const classic=stateIn(p),original=await facts(classic);assert.match(original,/窗口偏上/);
  assert.doesNotMatch(await p.locator('.asset-radar-awareness').innerText(),/\d+ 个活跃事件/);
  await p.getByRole('tab',{name:'1 周',exact:true}).click();await p.locator('.price-chart').waitFor();assert.equal(await facts(classic),original);
  await classic.scrollIntoViewIfNeeded();await p.screenshot({path:`${output}/state25-${name}-classic.png`});
  const open=classic.locator('button');assert.ok((await open.boundingBox()).height>=44);await p.keyboard.press('Tab');await open.focus();assert.notEqual(await open.evaluate(el=>getComputedStyle(el).outlineStyle),'none');await p.keyboard.press('Enter');
  const context=p.locator('.radar-asset-context'),summary=context.locator('.asset-state-summary'),details=context.locator('.asset-intelligence-details');await context.waitFor();
  assert.equal(await facts(summary),original);assert.equal(await p.locator('.radar-feed .radar-signal').count(),0);assert.equal(await details.getAttribute('open'),null);
  await details.locator(':scope > summary').focus();await p.keyboard.press('Enter');await details.locator('.state-method-details > summary').click();assert.match(await details.innerText(),/7 个收盘价 \/ 6 个收益率/);assert.match(await details.innerText(),/13 个收盘价 \/ 12 个收益率/);assert.match(await details.innerText(),/不是标准差|不是.*年化/);assert.match(await details.innerText(),/报价获取/);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await context.scrollIntoViewIfNeeded();await p.screenshot({path:`${output}/state25-${name}-details.png`,fullPage:true});
  await context.getByRole('button',{name:'返回图表',exact:true}).click();await p.locator('.price-chart').waitFor();
  assert.equal(await p.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await facts(classic),original);
  assert.equal(await classic.getAttribute('data-symbol'),'BTC-USDT');
  report.checks.push(`2.6 ${name}: no-event direction, shared facts, 90/180m windows, keyboard/44px detail, manual range return, reduced motion, no overflow`);
  report.errors.push(...app.errors);await app.context.close();
 }
 const app=await fixture(browser),p=app.page;await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.candle-canvas').waitFor();
 for(const [label,symbol] of [['NVDA','NVDA'],['0700','0700.HK'],['BTC','BTC-USDT']]){
  await p.locator('.symbol-rail button').filter({hasText:label}).click();assert.equal(await stateIn(p).getAttribute('data-symbol'),symbol);await stateIn(p).locator('button').click();assert.equal(await p.locator('.radar-asset-context .asset-state-summary').getAttribute('data-symbol'),symbol);await p.getByRole('button',{name:'返回图表',exact:true}).click();
 }
 report.checks.push('2.5 quick symbol changes keep state identity across Classic/Radar');
 // Isolated navigation measurement: fixed market clock, paused scheduled time; explicit range fetches complete before sampling.
 await p.clock.pauseAt(stamp+600000);await p.clock.setFixedTime(stamp);await p.clock.runFor(10000);await pause(500);const start=app.requests.length;
 for(let i=0;i<2;i++){await stateIn(p).locator('button').click();await p.clock.runFor(48);await p.locator('.asset-intelligence-details > summary').click();await p.clock.runFor(48);await p.getByRole('button',{name:'返回图表',exact:true}).click();await p.clock.runFor(48);}
 report.stateNavigationRequests=app.requests.slice(start);assert.equal(report.stateNavigationRequests.length,0);await p.clock.resume();
 const beforeWatch=await facts(stateIn(p));await p.locator('.asset-radar-awareness').click();const event=p.locator('.radar-signal[data-context-event]');await event.locator('.signal-context summary').click();await event.getByRole('button',{name:'移出自选',exact:true}).click();assert.equal(await facts(p.locator('.radar-asset-context .asset-state-summary')),beforeWatch);
 await event.getByRole('button',{name:'设置价格提醒',exact:true}).click();await p.locator('#alert-price').fill('200');await p.getByRole('button',{name:'创建提醒',exact:true}).click();assert.equal(await facts(p.locator('.radar-asset-context .asset-state-summary')),beforeWatch);
 await p.getByRole('button',{name:'返回图表',exact:true}).click();
 await app.context.setOffline(true);await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension="direction"]')?.dataset.availability==='offline');assert.match(await stateIn(p).innerText(),/网络已断开/);
 await app.context.setOffline(false);await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension="direction"]')?.dataset.availability==='available');
 await p.locator('.settings-trigger').click();await p.getByRole('switch',{name:'开启自动监控',exact:true}).click();await p.keyboard.press('Escape');await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension="direction"]')?.dataset.availability==='paused');
 report.checks.push('2.5 zero isolated navigation/disclosure requests; Watch/Alert do not change facts; offline/recovery/pause invalidate current state');report.errors.push(...app.errors);await app.context.close();
 for(const [mode,expected] of [['flat','available'],['stale','stale'],['history-stale','stale'],['empty','insufficient'],['error','waiting'],['benchmark-error','available']]){
  const sample=await fixture(browser,{mode}),page=sample.page;await page.goto(base+'/#price-chart',{waitUntil:'networkidle'});
  if(mode==='benchmark-error')await page.locator('.symbol-rail button').filter({hasText:'NVDA'}).click();
  await page.waitForFunction(value=>document.querySelector('.classic-experience [data-dimension="direction"]')?.dataset.availability===value,expected);
  if(mode==='flat'){assert.equal(await stateIn(page).locator('[data-dimension="volatility"]').getAttribute('data-availability'),'insufficient');assert.match(await stateIn(page).innerText(),/基线为零或过小/);}
  if(mode!=='flat'&&mode!=='benchmark-error')assert.match(await stateIn(page).innerText(),/暂不可判断/);
  report.checks.push(`2.5 ${mode}: dimension availability ${expected}, explicit limits`);report.errors.push(...sample.errors);await sample.context.close();
 }
 const slow=await fixture(browser,{delay:2500}),page=slow.page;await page.goto(base+'/#price-chart',{waitUntil:'domcontentloaded'});await stateIn(page).waitFor();await page.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension="direction"]')?.dataset.availability==='waiting');await page.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension="direction"]')?.dataset.availability==='available');report.checks.push('2.5 slow request shows waiting before real fixture completion');report.errors.push(...slow.errors);await slow.context.close();
}

async function state26RefinementChecks(browser,report,phase){
 const after=phase==='after',viewportFilter=process.env.RADAR_REFINEMENT_VIEWPORT,folder=`${output}/${phase}${viewportFilter?`-${viewportFilter}`:''}`;fs.mkdirSync(folder,{recursive:true});report.refinement=[];
 const baseline=after?JSON.parse(fs.readFileSync(`${output}/before/verification.json`,'utf8')):null;
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
  if(viewportFilter&&name!==viewportFilter)continue;
  const app=await fixture(browser,{mode:'state26-gentle',os:'reduce'}),p=app.page;await p.setViewportSize({width,height});await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});
  await p.locator('.symbol-rail button').filter({hasText:'NVDA'}).click();await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension=relative]')?.dataset.availability==='available');
  await p.getByRole('tab',{name:'1 周',exact:true}).click();await p.locator('.price-chart .recharts-area-curve').waitFor();
  await p.locator('.classic-experience .state-detail-link').click();const context=p.locator('.radar-asset-context'),outer=context.locator('.asset-intelligence-details'),transition=context.locator('.state-transition-details');
  assert.equal(await outer.getAttribute('open'),null);await outer.locator(':scope > summary').click();assert.equal(await transition.getAttribute('open'),null);await transition.locator(':scope > summary').click();
  const items=transition.locator('[data-transition]');assert.equal(await items.count(),5);
  const row={name,width,height,transitionHeight:await transition.evaluate(el=>el.getBoundingClientRect().height),contextHeight:await context.evaluate(el=>el.getBoundingClientRect().height),facts:await items.evaluateAll(nodes=>nodes.map(el=>({id:el.dataset.transition,numbers:el.textContent.match(/[−+-]?\d+(?:\.\d+)?/g)})))};
  // Let the existing hash-navigation frames settle before capturing this deeper section.
  await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
  await transition.evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await pause(200);
  const summaryBox=await transition.locator(':scope > summary').boundingBox();assert.ok(summaryBox.y>=40&&summaryBox.y+summaryBox.height<height-64,'Comparison heading must be in the captured viewport');
  await p.screenshot({path:`${folder}/${name}-comparison.png`});
  if(after){
   assert.deepEqual(row.facts,baseline.refinement.find(item=>item.name===name).facts,'All original numerical evidence retained');
   assert.ok(row.transitionHeight<baseline.refinement.find(item=>item.name===name).transitionHeight*.6,'One-action overview is materially shorter');
   for(let i=0;i<5;i++){const disclosure=items.nth(i).locator(':scope > details'),summary=disclosure.locator(':scope > summary');assert.equal(await disclosure.getAttribute('open'),null);assert.ok((await summary.boundingBox()).height>=44);await p.keyboard.press('Tab');await summary.focus();assert.notEqual(await summary.evaluate(el=>getComputedStyle(el).outlineStyle),'none');await p.keyboard.press('Enter');assert.equal(await disclosure.getAttribute('open'),'');assert.match(await disclosure.innerText(),/前一窗口/);assert.match(await disclosure.innerText(),/当前窗口/);assert.match(await disclosure.innerText(),/Yahoo Finance/);}
   assert.equal(await items.locator(':scope > details[open]').count(),5,'Opening one does not close another');
   await items.first().locator('summary').focus();await p.keyboard.press('Enter');assert.equal(await items.first().locator('details').getAttribute('open'),null);
   const bottom=context.getByRole('button',{name:'返回 NVDA 图表',exact:true});await bottom.scrollIntoViewIfNeeded();await pause(150);const box=await bottom.boundingBox();assert.ok(box.height>=44);assert.ok(box.y>=0&&box.y+box.height<=height);row.bottomReturnVisible=true;
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${folder}/${name}-return.png`});await bottom.focus();await p.keyboard.press('Enter');await p.locator('.price-chart .recharts-area-curve').waitFor();assert.equal(await p.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await p.locator('.classic-experience .asset-state-summary').getAttribute('data-symbol'),'NVDA');
  }else row.bottomReturnVisible=await context.getByRole('button',{name:'返回 NVDA 图表',exact:true}).count()>0;
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(app.errors,[]);report.errors.push(...app.errors);report.refinement.push(row);report.checks.push(`${phase} ${name}: transition overview / preserved evidence / keyboard / bottom return`);await app.context.close();
 }
 if(after&&!viewportFilter){
  const app=await fixture(browser,{mode:'state26-short',os:'reduce'}),p=app.page;await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.symbol-rail button').filter({hasText:'NVDA'}).click();await p.locator('.classic-experience .state-detail-link').click();await p.locator('.asset-intelligence-details > summary').click();await p.locator('.state-transition-details > summary').click();
  const unavailable=p.locator('[data-transition="short.direction"]');assert.equal(await unavailable.locator('details').getAttribute('open'),null);assert.match(await unavailable.innerText(),/前窗暂无法比较/);
  await app.context.setOffline(true);await p.waitForFunction(()=>document.querySelector('.radar-asset-context [data-dimension=direction]')?.dataset.availability==='offline');const missing=p.locator('.state-missing-reasons');assert.equal(await missing.locator('li').count(),3);assert.match(await missing.innerText(),/短窗方向/);assert.match(await missing.innerText(),/中窗方向/);assert.match(await missing.innerText(),/短窗相对表现/);assert.match(await missing.innerText(),/网络已断开/);assert.match(await unavailable.innerText(),/网络已断开/);
  report.checks.push('after partial/offline: unavailable reason visible with item collapsed; missing participant labels explicit');assert.deepEqual(app.errors,[]);report.errors.push(...app.errors);await app.context.close();
 }
 fs.writeFileSync(`${folder}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}

async function fed27Checks(browser,report){
 const body={format:'fed-monetary-view-v1',source:'fed-board:monetary-v1',attribution:'Source: Board of Governors of the Federal Reserve System',rightsUrl:'https://www.federalreserve.gov/disclaimer.htm',identity:'reconstructed',vintage:'current',readRevision:1,exportedAt:stamp,range:{from:Date.parse('2026-09-01T00:00:00Z'),cutoff:stamp},coverage:{status:'endpoint_snapshot',expectedCount:null,limitation:'Not a complete historical or point-in-time collection'},records:Array.from({length:7},(_,i)=>({id:`https://www.federalreserve.gov/newsevents/pressreleases/monetary2026090${i+1}a.htm`,url:`https://www.federalreserve.gov/newsevents/pressreleases/monetary2026090${i+1}a.htm`,title:`Fixture only — monetary record ${i+1}`,publishedAt:Date.parse(`2026-09-0${i+1}T18:00:00Z`),publicationPrecision:'minute',firstReceivedAt:stamp-1000,versionReceivedAt:stamp-1000,version:1,contentHash:'1'.repeat(64)}))};
 const text=JSON.stringify({...body,viewId:await viewDigest(body)}),file={name:'fixture-public-view.json',mimeType:'application/json',buffer:Buffer.from(text)};
 for(const [name,width,height]of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
  const app=await fixture(browser,{mode:'state26-gentle',os:'reduce',watchlist:['NVDA']}),p=app.page;await p.setViewportSize({width,height});await p.goto(base+'/#radar',{waitUntil:'networkidle'});
  const panel=p.locator('.macro-timeline');assert.equal(await panel.getAttribute('open'),null);await panel.locator(':scope > summary').focus();await p.keyboard.press('Enter');
  await panel.locator('input[type=file]').setInputFiles(file);await panel.locator('.macro-records li').first().waitFor();assert.equal(await panel.locator('.macro-records li').count(),5);assert.match(await panel.innerText(),/未在线重新核验/);assert.equal(await panel.locator('.macro-provenance').getAttribute('open'),null);await panel.locator('.macro-provenance > summary').click();assert.match(await panel.innerText(),/不是当时的在线观察/);assert.match(await panel.innerText(),/入库时间指/);await panel.locator('.macro-provenance > summary').click();
  await panel.getByRole('button',{name:'下一页',exact:true}).click();assert.equal(await panel.locator('.macro-records li').count(),2);
  const dates=panel.locator('input[type=date]');await dates.nth(0).fill('2026-09-07');assert.equal(await panel.locator('.macro-records li').count(),1);assert.match(await panel.locator('[role=status]').innerText(),/第 1\/1 页/);
  await dates.nth(0).fill('2026-09-08');assert.equal(await panel.locator('.macro-records li').count(),0);assert.match(await panel.innerText(),/不代表没有官方发布/);
  await dates.nth(0).fill('2026-08-01');assert.match(await panel.locator('[role=alert]').innerText(),/有效日期/);await dates.nth(0).fill('2026-09-01');
  const detail=panel.locator('.macro-records details').first();await detail.locator('summary').focus();await p.keyboard.press('Enter');assert.match(await detail.innerText(),/首次入库/);assert.match(await detail.innerText(),/此版本入库/);assert.equal(await panel.locator('a').first().getAttribute('rel'),'noopener noreferrer');
  for(const target of [panel.locator(':scope > summary'),dates.nth(0),detail.locator('summary'),panel.getByRole('button',{name:'下一页',exact:true})])assert.ok((await target.boundingBox()).height>=44);
  await panel.evaluate(el=>el.scrollIntoView({block:'start'}));await p.screenshot({path:`${output}/fed-${name}.png`});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(name==='desktop'){
   await p.clock.pauseAt(stamp+1000);await p.clock.setFixedTime(stamp);await pause(300);const start=app.requests.length;
   await panel.getByRole('button',{name:'下一页',exact:true}).click();await dates.nth(0).fill('2026-09-02');await panel.locator('input[type=file]').setInputFiles(file);await p.clock.runFor(48);await panel.locator('.macro-records li').first().waitFor();assert.deepEqual(app.requests.slice(start),[]);report.fedQueryApiRequests=[];await p.clock.resume();
   const acceptedId=await panel.locator('.macro-view').getAttribute('data-view-id'),acceptedRows=await panel.locator('.macro-records a').allTextContents();
   const invalid=structuredClone(body);invalid.records[0].url='javascript:alert(1)';await panel.locator('input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...invalid,viewId:await viewDigest(invalid)}))});await panel.locator('[role=alert]').waitFor();assert.equal(await panel.locator('.macro-view').getAttribute('data-view-id'),acceptedId);assert.deepEqual(await panel.locator('.macro-records a').allTextContents(),acceptedRows);assert.match(await panel.locator('[role=alert]').innerText(),/已保留上一份归档/);
   await panel.locator('input[type=file]').setInputFiles({name:'oversized.json',mimeType:'application/json',buffer:Buffer.alloc(1048577)});assert.match(await panel.locator('[role=alert]').innerText(),/1 MiB/);
   await panel.locator('input[type=file]').setInputFiles(file);await panel.locator('.macro-records li').first().waitFor();await p.reload({waitUntil:'networkidle'});assert.equal(await p.locator('.macro-records li').count(),0);
  }
  assert.deepEqual(app.errors,[]);report.viewports.push({name,width,height});report.checks.push(`macro ${name}: offline import, UTC bounds, fixed pages, reset, provenance, keyboard, 44px, no overflow`);await app.context.close();
 }
 for(const motionPreference of ['system','normal','reduced']){
  const app=await fixture(browser,{mode:'state26-gentle',motionPreference,os:'reduce',watchlist:['NVDA']}),p=app.page;await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.symbol-rail button').filter({hasText:'NVDA'}).click();await p.getByRole('tab',{name:'1 周',exact:true}).click();await p.locator('.price-chart .recharts-area-curve').waitFor();await p.locator('.classic-experience .asset-state-summary button').click();const panel=p.locator('.macro-timeline');await panel.locator(':scope > summary').click();await panel.locator('input[type=file]').setInputFiles(file);await panel.locator('.macro-records li').first().waitFor();await p.locator('.radar-asset-context').getByRole('button',{name:'返回图表',exact:true}).click();assert.equal(await p.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await p.locator('.classic-experience .asset-state-summary').getAttribute('data-symbol'),'NVDA');assert.deepEqual(app.errors,[]);await app.context.close();report.checks.push(`macro ${motionPreference}: selected/range workflow preserved`);
 }
 if(process.env.RADAR_FED_REAL_VIEW){
  const realText=fs.readFileSync(process.env.RADAR_FED_REAL_VIEW,'utf8'),real=JSON.parse(realText);assert.ok(real.records.length>0);assert.ok(real.records.every(r=>!r.title.includes('Fixture')));
  const app=await fixture(browser,{os:'reduce',watchlist:[]}),p=app.page;await p.clock.setFixedTime(Date.now());await p.setViewportSize({width:390,height:844});await p.goto(base+'/#radar',{waitUntil:'networkidle'});const panel=p.locator('.macro-timeline');await panel.locator(':scope > summary').click();await panel.locator('input[type=file]').setInputFiles({name:'real-board-public-view.json',mimeType:'application/json',buffer:Buffer.from(realText)});await panel.locator('.macro-records li').first().waitFor();assert.match(await panel.innerText(),/Federal Reserve/);assert.ok((await panel.innerText()).includes(real.records[0].title));await panel.locator('.macro-records details > summary').first().click();await panel.evaluate(el=>el.scrollIntoView({block:'start'}));await p.screenshot({path:`${output}/fed-real-mobile.png`});assert.deepEqual(app.errors,[]);report.realInformation={identity:'real Board metadata exported from local database; surrounding market quotes remain fixtures',viewId:real.viewId,records:real.records.length,source:real.source};await app.context.close();report.checks.push('real Board metadata: DB view imported and visible; no mocked information records');
 }
}

async function watchlist27Checks(browser,report){
 report.watchlist27=[];
 const download=async(p,button)=>{const waiting=p.waitForEvent('download');await button.click();const item=await waiting;assert.equal(await item.failure(),null);return JSON.parse(fs.readFileSync(await item.path(),'utf8'));};
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
  const app=await fixture(browser,{mode:'state26-gentle',os:'reduce',watchlist:['NVDA','ETH-USDT']}),p=app.page;
  await p.setViewportSize({width,height});await p.goto(base+'/#watchlist',{waitUntil:'networkidle'});
  const overview=p.locator('.watch-state-overview');assert.equal(await overview.getAttribute('open'),null);
  await overview.locator(':scope > summary').focus();await p.keyboard.press('Enter');
  const state=overview.locator('[data-state-symbol=NVDA]');await state.waitFor();
  await p.waitForFunction(()=>document.querySelector('.watch-state-overview [data-watch-dimension="relative"]')?.textContent.includes('相对跑赢'));
  await p.waitForFunction(()=>document.querySelector('.watch-state-overview [data-state-symbol="ETH-USDT"] [data-watch-dimension="short.direction"]')?.textContent.includes('窗口偏上'));
  const facts=await state.locator('dl').innerText();assert.match(facts,/90m/);assert.match(facts,/180m/);
  const details=state.locator('.watch-state-details');assert.equal(await details.getAttribute('open'),null);
  await details.locator(':scope > summary').focus();await p.keyboard.press('Enter');await details.locator('.asset-state-evidence').waitFor();assert.match(await details.innerText(),/较低波动不等于低风险/);
  await details.locator(':scope > summary').click();await state.scrollIntoViewIfNeeded();await p.screenshot({path:`${output}/${name}-classic.png`});
  const exported=await download(p,p.locator('.classic-experience .watch-export'));
  assert.deepEqual(exported.assets.map(x=>x.symbol),['NVDA','ETH-USDT']);assert.equal(exported.origin,'saved_browser');assert.equal(exported.identityStatus,'unverified_owner_universe');assert.equal(exported.sessionEdited,false);
  await overview.locator('.watch-state-link').filter({hasText:'NVDA'}).click();await p.getByRole('tab',{name:'1 周',exact:true}).click();await p.locator('.price-chart .recharts-area-curve').waitFor();
  await p.locator('.classic-experience .asset-state-summary button').click();
  const radar=p.locator('.radar-watchlist [data-state-symbol=NVDA]');assert.equal(await radar.locator('dl').innerText(),facts);
  const classic=p.locator('.classic-experience .asset-state-summary');assert.equal(await classic.getAttribute('data-symbol'),'NVDA');
  await radar.scrollIntoViewIfNeeded();await p.screenshot({path:`${output}/${name}-radar.png`});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const target of [radar.locator('.watch-state-details > summary'),p.locator('.radar-watchlist .watch-export')])assert.ok((await target.boundingBox()).height>=44);
  await p.locator('.radar-asset-context').getByRole('button',{name:'返回图表',exact:true}).click();assert.equal(await p.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');
  if(name==='desktop'){
   await p.clock.pauseAt(stamp+1000);await p.clock.setFixedTime(stamp);await pause(400);const start=app.requests.length;
   await classic.locator('button').click();await p.clock.runFor(48);await radar.locator('.watch-state-details > summary').click();await p.clock.runFor(48);await download(p,p.locator('.radar-watchlist .watch-export'));
   await p.locator('.radar-asset-context').getByRole('button',{name:'返回图表',exact:true}).click();await p.clock.runFor(48);
   report.watchlistNavigationRequests=app.requests.slice(start);assert.deepEqual(report.watchlistNavigationRequests,[]);await p.clock.resume();
   await classic.locator('button').click();await p.getByRole('button',{name:'Radar 移除 ETH-USDT',exact:true}).click();
   assert.equal(await p.locator('.radar-watchlist [data-state-symbol="ETH-USDT"]').count(),0);await p.getByRole('button',{name:'撤销',exact:true}).click();await p.locator('.radar-watchlist [data-state-symbol="ETH-USDT"]').waitFor();
   await p.getByRole('button',{name:'Radar 移除 ETH-USDT',exact:true}).click();const edited=await download(p,p.locator('.radar-watchlist .watch-export'));assert.equal(edited.sessionEdited,true);assert.deepEqual(edited.assets.map(x=>x.symbol),['NVDA']);
   await p.reload({waitUntil:'networkidle'});assert.equal(await p.locator('.radar-watchlist [data-state-symbol="ETH-USDT"]').count(),0);
   await p.getByRole('button',{name:'Radar 添加自选',exact:true}).click();await p.locator('#custom-symbol').fill('ETH-USDT');await p.getByRole('button',{name:'添加并查看',exact:true}).click();await p.locator('.radar-watchlist [data-state-symbol="ETH-USDT"]').waitFor({state:'attached'});
   assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem('market-radar-preferences-v1')).watchlist),['NVDA','ETH-USDT']);
  }
  report.watchlist27.push({name,width,height,exportedSymbols:exported.assets.map(x=>x.symbol)});report.checks.push(`watchlist ${name}: shared facts, local download, keyboard, chart/manual range, 44px, no overflow`);
  assert.deepEqual(app.errors,[]);await app.context.close();
 }
 for(const [mode,list] of [['state26-short',['NVDA']],['stale',['NVDA']],['empty',['BTC-USDT']],['benchmark-error',['NVDA']],['state26-gentle',[]]]){
  const app=await fixture(browser,{mode,watchlist:list,os:'reduce'}),p=app.page;await p.goto(base+'/#radar',{waitUntil:'networkidle'});const panel=p.locator('.radar-watchlist');
  assert.equal(await panel.locator('[data-state-symbol]').count(),list.length);
  if(!list.length)assert.match(await panel.innerText(),/尚未添加/);
  if(mode==='state26-short')assert.match(await panel.locator('[data-watch-dimension="medium.direction"]').innerText(),/样本不足/);
  if(mode==='stale')assert.match(await panel.locator('[data-watch-dimension="short.direction"]').innerText(),/已过期/);
  if(mode==='empty'){await p.waitForFunction(()=>document.querySelector('.radar-watchlist [data-watch-dimension="short.direction"]')?.textContent.includes('样本不足'));assert.match(await panel.locator('[data-watch-dimension="short.direction"]').innerText(),/样本不足/);}
  if(mode==='benchmark-error')assert.match(await panel.locator('[data-watch-dimension="relative"]').innerText(),/等待/);
  const exported=await download(p,panel.locator('.watch-export'));assert.deepEqual(exported.assets.map(x=>x.symbol),list);assert.deepEqual(app.errors,[]);await app.context.close();report.checks.push(`watchlist ${mode}: partial/empty export and dimension limits`);
 }
 for(const motionPreference of ['system','normal','reduced']){
  const app=await fixture(browser,{mode:'state26-gentle',motionPreference,os:'reduce'}),p=app.page;await p.goto(base+'/#radar',{waitUntil:'networkidle'});
  const result=await download(p,p.locator('.radar-watchlist .watch-export'));assert.equal(result.origin,'app_default');assert.equal(result.assets.length,8);
  await p.locator('.radar-watchlist .watch-state-details > summary').first().click();await p.locator('.radar-watchlist .asset-state-evidence').first().waitFor();assert.ok(await p.locator('.radar-watchlist .asset-state-evidence').count());assert.deepEqual(app.errors,[]);await app.context.close();report.checks.push(`watchlist ${motionPreference}: disclosure and local export under motion override`);
 }
 const blocked=await fixture(browser,{storage:true}),p=blocked.page;await p.goto(base+'/#radar',{waitUntil:'networkidle'});assert.equal((await download(p,p.locator('.radar-watchlist .watch-export'))).origin,'storage_unavailable');assert.deepEqual(blocked.errors,[]);await blocked.context.close();report.checks.push('storage unavailable remains explicit in local export');
}

async function state26Checks(browser,report){
 report.state26=[];
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
  const app=await fixture(browser,{mode:'state26-gentle',os:'reduce'}),p=app.page;await p.setViewportSize({width,height});await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});
  await p.locator('.symbol-rail button').filter({hasText:'NVDA'}).click();const classic=p.locator('.classic-experience .asset-state-summary');
  await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension="relative"]')?.dataset.availability==='available');
  assert.equal(await classic.getAttribute('data-symbol'),'NVDA');assert.equal(await classic.getAttribute('data-rule'),'asset-state-v2');assert.equal(await classic.locator('[data-dimension=relative]').getAttribute('data-benchmark'),'QQQ');
  assert.equal(await classic.locator('[data-dimension=medium-direction]').getAttribute('data-availability'),'available');assert.equal(await classic.locator('[data-alignment]').getAttribute('data-alignment'),'aligned');assert.match(await classic.innerText(),/百分点/);
  const summaryHeight=await classic.evaluate(el=>el.getBoundingClientRect().height);const facts=await classic.locator('dl').innerText();await p.getByRole('tab',{name:'1 周',exact:true}).click();await p.locator('.price-chart .recharts-area-curve').waitFor();await classic.scrollIntoViewIfNeeded();await pause(200);await p.screenshot({path:`${output}/state26-${name}-classic.png`});
  await classic.locator('button').click();const context=p.locator('.radar-asset-context'),details=context.locator('.asset-intelligence-details');assert.equal(await context.locator('.asset-state-summary dl').innerText(),facts);assert.equal(await p.locator('.radar-feed .radar-signal').count(),0);
  assert.equal(await details.getAttribute('open'),null);await details.locator(':scope > summary').click();const method=details.locator('.state-method-details'),transition=details.locator('.state-transition-details');assert.equal(await method.getAttribute('open'),null);assert.equal(await transition.getAttribute('open'),null);
  assert.match(await details.innerText(),/相对差/);assert.match(await details.innerText(),/较低波动不等于低风险/);await context.scrollIntoViewIfNeeded();await pause(200);await p.screenshot({path:`${output}/state26-${name}-context.png`});
  await details.locator('.asset-state-evidence').evaluate(el=>el.scrollIntoView({block:'start'}));await pause(150);await p.screenshot({path:`${output}/state26-${name}-readout.png`});
  await method.locator('summary').focus();await p.keyboard.press('Enter');assert.match(await method.innerText(),/19 个收盘价 \/ 18 个收益率/);assert.match(await method.innerText(),/37 个收盘价 \/ 36 个收益率/);assert.match(await method.innerText(),/19 个配对点 \/ 18 段收益/);assert.match(await method.innerText(),/QQQ/);assert.match(await method.innerText(),/报价获取/);assert.match(await method.innerText(),/门槛/);
  await transition.locator(':scope > summary').focus();await p.keyboard.press('Enter');assert.equal(await transition.locator('[data-status=unavailable]').count(),0);assert.equal(await transition.locator('[data-transition]').count(),5);for(const item of await transition.locator('.state-transition-item').all()){assert.equal(await item.getAttribute('open'),null);await item.locator(':scope > summary').click();}assert.match(await transition.innerText(),/前一窗口/);assert.match(await transition.innerText(),/回看重算/);assert.match(await transition.innerText(),/参考/);
  for(const selector of [method,transition])assert.ok((await selector.locator(':scope > summary').boundingBox()).height>=44);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));report.state26.push({name,width,height,expandedHeight:await context.evaluate(el=>el.getBoundingClientRect().height),summaryHeight});
  await transition.scrollIntoViewIfNeeded();await pause(150);await p.screenshot({path:`${output}/state26-${name}-transition.png`});
  await context.getByRole('button',{name:'返回图表',exact:true}).click();await p.locator('.price-chart .recharts-area-curve').waitFor();assert.equal(await p.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');assert.equal(await classic.locator('dl').innerText(),facts);
  if(name==='desktop'){
   // Existing polling is suspended only in this isolated fixture measurement, after explicit symbol/range loads.
   await p.clock.pauseAt(stamp+600000);await p.clock.setFixedTime(stamp);await p.clock.runFor(10000);await pause(500);const start=app.requests.length;
   for(let i=0;i<2;i++){await classic.locator('button').click();await p.clock.runFor(48);await transition.locator(':scope > summary').click();await p.clock.runFor(48);await context.getByRole('button',{name:'返回图表',exact:true}).click();await p.clock.runFor(48);}
   report.state26NavigationRequests=app.requests.slice(start);assert.deepEqual(report.state26NavigationRequests,[]);await p.clock.resume();
  }
  assert.deepEqual(app.errors,[]);report.errors.push(...app.errors);await app.context.close();report.checks.push(`2.6 ${name}: real horizon endpoints, no-event relative/alignment, complete expandable methods/transition, keyboard, range return, no overflow`);
 }
 for(const [mode,relative,medium,alignment] of [['state26-short','available','insufficient','insufficient'],['state26-lag','insufficient','available','insufficient'],['benchmark-error','waiting','available','insufficient'],['state26-mixed','available','available','mixed']]){
  const app=await fixture(browser,{mode,os:'reduce'}),p=app.page;await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.symbol-rail button').filter({hasText:'NVDA'}).click();const summary=p.locator('.classic-experience .asset-state-summary');
  await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension=direction]')?.dataset.availability==='available');await p.waitForFunction(expected=>document.querySelector('.classic-experience [data-dimension=relative]')?.dataset.availability===expected,relative);
  assert.equal(await summary.locator('[data-dimension=medium-direction]').getAttribute('data-availability'),medium);assert.equal(await summary.locator('[data-alignment]').getAttribute('data-alignment'),alignment);
  await summary.locator('button').click();await p.locator('.asset-intelligence-details > summary').click();await p.locator('.state-transition-details > summary').click();const transitions=p.locator('.state-transition-details');
  if(mode==='state26-short')assert.equal(await transitions.locator('[data-transition="short.direction"]').getAttribute('data-status'),'unavailable');
  if(mode==='state26-lag'||mode==='benchmark-error'){assert.equal(await transitions.locator('[data-transition="short.relative"]').getAttribute('data-status'),'unavailable');assert.notEqual(await transitions.locator('[data-transition="short.direction"]').getAttribute('data-status'),'unavailable');}
  assert.deepEqual(app.errors,[]);report.errors.push(...app.errors);await app.context.close();report.checks.push(`2.6 ${mode}: local failure / mixed relation and independent transition`);
 }
 const app=await fixture(browser,{mode:'state26-gentle'}),p=app.page;await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.symbol-rail button').filter({hasText:'NVDA'}).click();await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension=relative]')?.dataset.availability==='available');
 // Freeze scheduling, advance only explicit wall time and the existing clock; no new quotes can renew old data.
 await p.clock.pauseAt(stamp+1000);await p.clock.setFixedTime(stamp+180001);await p.clock.runFor(10000);await p.waitForFunction(()=>document.querySelector('.classic-experience [data-dimension=relative]')?.dataset.availability==='stale');assert.equal(await p.locator('.classic-experience [data-dimension=direction]').getAttribute('data-availability'),'stale');
 report.checks.push('2.6 explicit clock ages asset and benchmark without new quotes');report.errors.push(...app.errors);await app.context.close();
 report.state26SizeWarnings=observedWarnings.filter(item=>/width\(|height\(/.test(item.text));assert.deepEqual(report.state26SizeWarnings,[]);
}

async function integrationChecks(browser,report){
 const app=await fixture(browser),{page}=app;
 await page.goto(base+'/#price-chart',{waitUntil:'networkidle'});await page.locator('.candle-canvas').waitFor();
 const awareness=page.locator('.asset-radar-awareness');await awareness.waitFor();
 await page.waitForFunction(()=>document.querySelector('.asset-radar-awareness')?.textContent.includes('活跃事件'));
 // Context replaces, but does not overwrite, the user's existing Radar filters.
 await page.locator('.desktop-nav a[href="#radar"]').click();await page.getByRole('button',{name:'美股',exact:true}).click();
 await page.locator('.desktop-nav a[href="#overview"]').click();await page.keyboard.press('Tab');await awareness.focus();
 assert.equal(await awareness.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');await page.keyboard.press('Enter');
 await page.locator('.radar-asset-context').waitFor();assert.match(await page.locator('.radar-asset-context').innerText(),/BTC-USDT/);
 assert.ok(await page.locator('.radar-signal[data-context-event]').count());
 for(const symbol of await page.locator('.radar-feed .radar-signal').evaluateAll(els=>els.map(el=>el.dataset.symbol)))assert.equal(symbol,'BTC-USDT');
 assert.equal(await page.locator('.radar-feed details[open]').count(),0);
 await page.getByRole('button',{name:'退出资产筛选',exact:true}).click();assert.equal(await page.getByRole('button',{name:'美股',exact:true}).getAttribute('aria-pressed'),'true');
 await page.locator('.desktop-nav a[href="#overview"]').click();await awareness.click();
 const card=page.locator('.radar-signal[data-context-event]');await card.locator('.signal-context > summary').click();
 await card.getByRole('button',{name:'查看图表',exact:true}).click();await page.locator('.radar-context-banner').waitFor();
 assert.equal(await page.locator('.selected-title h2').innerText(),'BTC');
 await page.getByRole('tab',{name:'1 周',exact:true}).click();await page.locator('.price-chart').waitFor();await pause(300);
 // Stop scheduled polling only during the navigation measurement; advance frames explicitly.
 await page.clock.pauseAt(stamp+600000);await pause(500);
 const requestStart=app.requests.length;
 await page.getByRole('button',{name:'返回 Radar',exact:true}).click();await page.clock.runFor(48);await page.locator('.radar-asset-context').waitFor();
 assert.equal(await card.locator('details').getAttribute('open'),'');
 for(let i=0;i<3;i++){
  await page.getByRole('button',{name:'返回图表',exact:true}).click();await page.clock.runFor(48);await awareness.waitFor();
  assert.equal(await page.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');
  await awareness.click();await page.clock.runFor(48);await page.locator('.radar-asset-context').waitFor();
 }
 report.integrationNavigationRequests=app.requests.slice(requestStart);assert.equal(report.integrationNavigationRequests.length,0);await page.clock.resume();
 // User-authored price alerts remain independent from system events and are reused.
 await card.getByRole('button',{name:'设置价格提醒',exact:true}).click();await page.locator('#alert-price').fill('200');
 await page.getByRole('button',{name:'创建提醒',exact:true}).click();await card.getByRole('button',{name:'查看价格提醒 (1)',exact:true}).waitFor();
 await card.getByRole('button',{name:'查看价格提醒 (1)',exact:true}).click();await page.locator('#price-alerts').waitFor();
 assert.equal(await page.locator('[role=dialog]').count(),0);assert.equal(await page.locator('.alert-item').count(),1);
 await page.getByRole('switch',{name:'暂停BTC提醒',exact:true}).click();await awareness.click();
 await page.locator('.radar-signal[data-context-event]').locator('details > summary').click();
 await page.locator('.radar-signal[data-context-event]').getByRole('button',{name:'设置价格提醒',exact:true}).waitFor();
 report.checks.push('2.3 keyboard Classic→asset Radar; filter/disclosure preserved; manual range retained; zero navigation requests; price alert state shared');
 // Different symbol invalidates the source reference immediately.
 await page.locator('.radar-signal[data-context-event] .signal-asset').click();await page.locator('.radar-context-banner').waitFor();
 // Do not navigate to #watchlist: hash cleanup would hide a table-selection regression.
 await page.locator('.watch-table .asset-cell').filter({hasText:'NVDA'}).click();assert.equal(await page.locator('.radar-context-banner').count(),0);
 await page.locator('.watch-table .asset-cell').filter({hasText:'BTC'}).click();assert.equal(await page.locator('.radar-context-banner').count(),0);
 assert.match(page.url(),/#price-chart$/);
 await page.locator('.symbol-rail button').filter({hasText:'NVDA'}).click();assert.equal(await page.locator('.radar-context-banner').count(),0);
 assert.match(await awareness.getAttribute('aria-label'),/NVDA/);
 await awareness.click();assert.match(await page.locator('.radar-asset-context').innerText(),/NVDA/);
 report.checks.push('2.3 symbol changes invalidate source and related Radar follows the current asset');
 await page.getByRole('button',{name:'返回图表',exact:true}).click();
 await page.getByRole('switch',{name:'自动刷新与提醒',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.asset-radar-awareness')?.textContent.includes('扫描暂不可用'));
 assert.ok(!(await awareness.innerText()).includes('活跃事件'));report.checks.push('2.3 paused scanner never presents cached events as active awareness');
 report.errors.push(...app.errors);assert.deepEqual(app.errors,[]);await app.context.close();

 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
  const mobile=await fixture(browser),p=mobile.page;await p.setViewportSize({width,height});await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.locator('.candle-canvas').waitFor();
  const indicator=p.locator('.asset-radar-awareness');await p.waitForFunction(()=>document.querySelector('.asset-radar-awareness')?.textContent.includes('活跃事件'));await indicator.scrollIntoViewIfNeeded();
  assert.ok((await indicator.boundingBox()).height>=44);
  await p.screenshot({path:`${output}/integration-${name}-classic.png`});
  await indicator.click();await p.locator('.radar-asset-context').waitFor();await p.locator('.radar-asset-context').scrollIntoViewIfNeeded();
  const assetDetails=p.locator('.asset-intelligence-details');
  assert.equal(await assetDetails.getAttribute('open'),null);
  await assetDetails.locator(':scope > summary').click();assert.match(await assetDetails.innerText(),/部分覆盖/);
  assert.match(await assetDetails.innerText(),/事件关系/);
  assert.ok((await assetDetails.locator(':scope > summary').boundingBox()).height>=44);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.screenshot({path:`${output}/asset-intelligence-${name}.png`});
  await assetDetails.locator(':scope > summary').click();
  await p.screenshot({path:`${output}/integration-${name}-radar.png`});
  const event=p.locator('.radar-signal[data-context-event]');await event.locator('.signal-context > summary').click();
  await event.getByRole('button',{name:'查看图表',exact:true}).click();await p.locator('.radar-context-banner').waitFor();
  await p.screenshot({path:`${output}/integration-${name}-origin.png`});
  await p.getByRole('button',{name:'返回 Radar',exact:true}).click();await p.locator('.radar-asset-context').waitFor();
  // Same shared Watchlist in mobile context, including persistence after watch/unwatch.
  await event.getByRole('button',{name:'移出自选',exact:true}).click();await event.getByRole('button',{name:'加入自选',exact:true}).waitFor();
  assert.ok(!(await p.evaluate(()=>JSON.parse(localStorage.getItem('market-radar-preferences-v1')).watchlist)).includes('BTC-USDT'));
  await event.getByRole('button',{name:'加入自选',exact:true}).click();await p.getByRole('button',{name:'添加并查看',exact:true}).click();await event.getByRole('button',{name:'移出自选',exact:true}).waitFor();
  assert.ok((await p.evaluate(()=>JSON.parse(localStorage.getItem('market-radar-preferences-v1')).watchlist)).includes('BTC-USDT'));
  await event.getByRole('button',{name:'设置价格提醒',exact:true}).click();await p.locator('#alert-price').fill('200');await p.getByRole('button',{name:'创建提醒',exact:true}).click();
  await event.getByRole('button',{name:'查看价格提醒 (1)',exact:true}).click();await p.locator('.alert-item').waitFor();
  await p.locator('.asset-radar-awareness').click();await p.locator('.radar-asset-context').waitFor();
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await event.evaluate(el=>getComputedStyle(el).animationName),'none');
  const sizes=await p.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));assert.ok(sizes.content<=width,`integration ${name} overflow`);
  report.checks.push(`2.3 ${name}: context, chart, return, watch/unwatch, alert, reduced-motion, no overflow`);
  assert.deepEqual(mobile.errors,[]);report.errors.push(...mobile.errors);await mobile.context.close();
 }
}
async function assetIntelligenceChecks(browser,report){
 const app=await fixture(browser),p=app.page;
 await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});
 const awareness=p.locator('.asset-radar-awareness');await awareness.waitFor();
 for(const [label,symbol] of [['NVDA','NVDA'],['0700','0700.HK'],['BTC','BTC-USDT']]){
  await p.locator('.symbol-rail button').filter({hasText:label}).click();
  assert.equal(await awareness.getAttribute('data-symbol'),symbol);
  const summary=await awareness.locator('span').nth(1).evaluate(el=>el.firstChild.textContent);
  const freshness=await awareness.getAttribute('data-freshness');await awareness.click();
  const context=p.locator('.radar-asset-context');assert.equal(await context.getAttribute('data-symbol'),symbol);
  assert.equal(await context.getAttribute('data-freshness'),freshness);
  assert.equal(await context.locator('div > p').first().innerText(),summary);
  await context.locator('.asset-intelligence-details > summary').focus();await p.keyboard.press('Enter');
  assert.equal(await context.locator('.asset-intelligence-details').getAttribute('open'),'');
  assert.match(await context.innerText(),/0 条启用的价格提醒/);
  await context.locator('.asset-intelligence-details > summary').click();await p.getByRole('button',{name:'返回图表',exact:true}).click();
 }
 report.checks.push('2.4 fast symbol switching shares context, freshness and summary across Classic/Radar; keyboard details');
 await awareness.click();await p.clock.pauseAt(stamp+600000);await pause(300);const start=app.requests.length;
 for(let i=0;i<4;i++){await p.locator('.asset-intelligence-details > summary').click();await p.clock.runFor(48);}
 assert.equal(app.requests.length-start,0);await p.clock.resume();
 report.checks.push('2.4 context disclosure adds zero requests');report.errors.push(...app.errors);await app.context.close();
 for(const [mode,expected] of [['quiet','current'],['stale','stale'],['empty','insufficient'],['benchmark-error','degraded']]){
  const sample=await fixture(browser,{mode}),page=sample.page;
  await page.goto(base+'/#price-chart',{waitUntil:'networkidle'});
  // Empty history is injected into /api/history (crypto); stocks carry history in /api/quotes.
  await page.locator('.symbol-rail button').filter({hasText:mode==='empty'?'BTC':'NVDA'}).click();
  await page.waitForFunction(value=>document.querySelector('.asset-radar-awareness')?.dataset.freshness===value,expected).catch(async()=>{throw Error(`${mode}: expected ${expected}, saw ${await page.locator('.asset-radar-awareness').innerText()}`)});
  await page.locator('.asset-radar-awareness').click();
  assert.equal(await page.locator('.radar-asset-context').getAttribute('data-freshness'),expected);
  if(mode==='quiet')assert.match(await page.locator('.radar-empty').innerText(),/暂无活跃事件/);
  else assert.doesNotMatch(await page.locator('.radar-empty').innerText(),/暂无活跃事件|暂无异常事件/);
  report.checks.push(`2.4 ${mode} asset freshness: ${expected}`);report.errors.push(...sample.errors);await sample.context.close();
 }
}
async function motionChecks(browser,report){
 for(const [preference,os,expected] of [['system','no-preference','normal'],['system','reduce','reduced'],['reduced','no-preference','reduced'],['normal','reduce','normal']]){
  const app=await fixture(browser,{motionPreference:preference,os,intro:true,probe:true}),{page}=app;
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.candle-canvas').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),expected);
  await page.locator('.settings-trigger').click();assert.equal(await page.locator(`input[name=motion-preference][value=${preference}]`).isChecked(),true);
  assert.match(await page.locator('#motion-system-status').innerText(),os==='reduce'?/减少动态效果/:/标准动态效果/);
  assert.equal(await page.locator('.experience-setting label').first().evaluate(el=>getComputedStyle(el).transitionDuration).then(value=>value.startsWith('0s')),expected==='reduced');
  await page.emulateMedia({reducedMotion:os==='reduce'?'no-preference':'reduce'});
  const live=preference==='system'?(expected==='normal'?'reduced':'normal'):expected;
  await page.waitForFunction(mode=>document.documentElement.dataset.motion===mode,live,{timeout:5000}).catch(async()=>{throw Error(JSON.stringify({preference,os,live,state:await page.evaluate(()=>({dataset:{...document.documentElement.dataset},matches:matchMedia('(prefers-reduced-motion: reduce)').matches,listeners:window.__motionProbe.listeners}))}));});
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),live);
  assert.equal(await page.evaluate(()=>window.__motionProbe.listeners),1);
  await page.locator('input[name=motion-preference][value=reduced]').check();await page.keyboard.press('Escape');
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'reduced');
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.intro),undefined);
  report.checks.push(`2.45 ${preference} / OS ${os}: bootstrap, CSS mode, live OS, one listener`);
  report.errors.push(...app.errors);await app.context.close();
 }
 const app=await fixture(browser,{probe:true}),{page}=app;
 await page.goto(base+'/#overview',{waitUntil:'networkidle'});await page.locator('.candle-canvas').waitFor();
 await page.waitForFunction(()=>document.querySelector('.asset-radar-awareness')?.textContent.includes('活跃事件'));
 app.priceOffset.value=1;await page.locator('.refresh-button').click();
 await page.waitForFunction(()=>window.__motionProbe.halos.some(a=>a.playState==='running'));
 await page.locator('.settings-trigger').click();await page.locator('input[name=motion-preference][value=reduced]').check();
 assert.equal(await page.evaluate(()=>window.__motionProbe.halos.some(a=>a.playState==='running')),false);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
 await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'reduced');
 await page.locator('.settings-trigger').click();await page.locator('input[name=motion-preference][value=system]').check();await page.emulateMedia({reducedMotion:'reduce'});await pause(50);
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'reduced');
 await page.locator('input[name=motion-preference][value=normal]').check();assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'normal');
 await page.keyboard.press('Escape');app.priceOffset.value=2;await page.locator('.refresh-button').click();await page.waitForFunction(()=>window.__motionProbe.halos.some(a=>a.playState==='running'));
 await page.locator('.settings-trigger').click();await page.locator('input[name=motion-preference][value=system]').check();assert.equal(await page.evaluate(()=>window.__motionProbe.halos.some(a=>a.playState==='running')),false);
 await page.keyboard.press('Tab');await page.locator('input[name=motion-preference][value=reduced]').focus();assert.equal(await page.locator('input[name=motion-preference][value=reduced]').locator('..').evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
 report.checks.push('2.45 live user preference cancels real price halo; reload persists; normal overrides OS; system restores OS; keyboard focus');
 report.motionMeasurement={fixtureCLS:await page.evaluate(()=>window.__motionProbe.cls),osListeners:await page.evaluate(()=>window.__motionProbe.listeners)};
 report.errors.push(...app.errors);await app.context.close();
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
  const test=await fixture(browser),p=test.page;await p.setViewportSize({width,height});await p.goto(base+'/#overview',{waitUntil:'networkidle'});
  await (width>600?p.locator('.settings-trigger'):p.locator('.mobile-dock button')).click();
  const radio=p.locator('input[name=motion-preference][value=reduced]');await radio.check();
  const bounds=await p.locator('[role=dialog]').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,name+' dialog bounds');
  assert.ok(await radio.locator('..').evaluate(el=>el.getBoundingClientRect().height)>=44);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:`${output}/${name}-settings-verified.png`});
  await p.keyboard.press('Escape');await p.locator('.candle-canvas').waitFor();await p.locator('.candle-canvas').scrollIntoViewIfNeeded();
  const canvas=p.locator('.candle-canvas');await canvas.focus();await p.keyboard.press('ArrowLeft');await p.keyboard.press('+');await p.keyboard.press('Home');
  report.checks.push(`2.45 ${name}: motion Settings containment, 44px choice, no overflow, chart keyboard`);report.errors.push(...test.errors);await test.context.close();
 }
 const fail=await fixture(browser,{storage:true,intro:true,os:'reduce'});await fail.page.goto(base,{waitUntil:'networkidle'});assert.equal(await fail.page.evaluate(()=>document.documentElement.dataset.motion),'reduced');await fail.page.locator('.settings-trigger').click();await fail.page.locator('input[name=motion-preference][value=normal]').check();assert.equal(await fail.page.evaluate(()=>document.documentElement.dataset.motion),'normal');await fail.page.reload({waitUntil:'networkidle'});assert.equal(await fail.page.evaluate(()=>document.documentElement.dataset.motion),'reduced');report.errors.push(...fail.errors);await fail.context.close();report.checks.push('2.45 blocked storage allows live choice and falls back to OS after reload');
 const noHydration=await fixture(browser,{intro:true});await noHydration.page.route('**/*',route=>route.request().resourceType()==='script'?route.abort():route.fallback());await noHydration.page.goto(base,{waitUntil:'domcontentloaded'});await noHydration.page.clock.runFor(2500);assert.equal(await noHydration.page.evaluate(()=>document.documentElement.dataset.intro),undefined);assert.ok(await noHydration.page.locator('h1').isVisible());await noHydration.context.close();report.checks.push('2.45 hydration failure leaves opening fail-open and server content visible');
}

async function postReleaseChecks(browser,report){
 const opening=await fixture(browser,{intro:true,probe:true});
 // Hold only the fixture's safety timer, then pause actual running CSS animations
 // so a live OS change can deterministically be observed before natural completion.
 await opening.page.addInitScript(()=>{const schedule=window.setTimeout;window.setTimeout=(fn,ms,...args)=>schedule(fn,[1100,1600].includes(ms)?10000:ms,...args);});
 await opening.page.goto(base,{waitUntil:'domcontentloaded'});
 const runningOpening=await opening.page.evaluate(()=>{
  const animations=document.querySelector('.brand-opening').getAnimations({subtree:true}).filter(a=>a.playState==='running');
  window.__openingProbe=animations;animations.forEach(a=>a.pause());return animations.length;
 });
 assert.ok(runningOpening>0,'opening CSS animation must actually be running before cancellation test');
 await opening.page.waitForFunction(()=>window.__motionProbe.listeners===1);
 await opening.page.emulateMedia({reducedMotion:'reduce'});
 await opening.page.waitForFunction(()=>document.documentElement.dataset.motion==='reduced'&&!document.documentElement.dataset.intro);
 assert.equal(await opening.page.evaluate(()=>getComputedStyle(document.querySelector('.brand-opening')).display),'none');
 assert.equal(await opening.page.evaluate(()=>window.__openingProbe.some(a=>a.playState==='running'||a.playState==='paused')),false);
 await opening.page.emulateMedia({reducedMotion:'no-preference'});await opening.page.waitForFunction(()=>document.documentElement.dataset.motion==='normal');
 assert.equal(await opening.page.evaluate(()=>document.documentElement.dataset.intro),undefined);
 assert.deepEqual(opening.errors,[]);report.checks.push('post-release observed opening CSS animations end on live OS reduction and do not replay on restore (fixture timing held)');await opening.context.close();
 for(const [label,raw] of [['old','{}'],['invalid','{"motionPreference":"invalid"}'],['malformed','not-json']]){
  const app=await fixture(browser,{os:'reduce'}),p=app.page;
  await p.addInitScript(value=>localStorage.setItem('market-radar-preferences-v1',value),raw);
  await p.goto(base+'/#overview',{waitUntil:'networkidle'});
  await p.locator('.settings-trigger').click();
  assert.equal(await p.locator('input[name=motion-preference][value=system]').isChecked(),true);
  assert.equal(await p.evaluate(()=>document.documentElement.dataset.motion),'reduced');
  assert.deepEqual(app.errors,[]);report.checks.push(`post-release ${label} settings fall back to system in hydrated browser`);await app.context.close();
 }
 const app=await fixture(browser,{revealProbe:true}),p=app.page;
 await p.goto(base+'/#overview',{waitUntil:'networkidle'});
 const cta=p.locator('[data-magnetic]');await cta.scrollIntoViewIfNeeded();
 const box=await cta.boundingBox();await p.mouse.move(box.x+box.width-3,box.y+box.height/2);
 await p.waitForFunction(()=>document.querySelector('[data-magnetic]').style.translate!=='');
 await p.evaluate(()=>document.querySelector('.watch-panel .panel-heading').scrollIntoView());
 await p.waitForFunction(()=>window.__revealProbe.some(a=>a.playState==='running'));
 const running=await p.evaluate(()=>window.__revealProbe.filter(a=>a.playState==='running').length);
 // Live OS change reaches the actual shared controller; no direct preference event injection.
 await p.emulateMedia({reducedMotion:'reduce'});await p.waitForFunction(()=>document.documentElement.dataset.motion==='reduced');
 assert.equal(await p.evaluate(()=>window.__revealProbe.some(a=>a.playState==='running')),false);
 assert.equal(await cta.evaluate(el=>el.style.translate),'');
 await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForFunction(()=>document.documentElement.dataset.motion==='normal');
 assert.equal(await p.evaluate(()=>document.documentElement.dataset.intro),undefined);
 assert.deepEqual(app.errors,[]);report.checks.push(`post-release live OS reduced cancels ${running} running reveal(s) and magnetic offset; restore does not replay intro`);await app.context.close();
 const fail=await fixture(browser,{storage:true,os:'reduce'});await fail.page.goto(base+'/#overview',{waitUntil:'domcontentloaded'});
 await fail.page.getByText('浏览器未允许保存设置，关闭后本次更改可能丢失。',{exact:true}).waitFor();
 await fail.page.locator('.settings-trigger').click();await fail.page.locator('input[name=motion-preference][value=normal]').check();
 assert.equal(await fail.page.evaluate(()=>document.documentElement.dataset.motion),'normal');
 assert.deepEqual(fail.errors,[]);report.errors.push(...fail.errors);
 report.checks.push('post-release storage write failure explicitly warns that changes may be lost');await fail.context.close();
}

async function visualCapture(browser, phase) {
 const folder=process.env.RADAR_VISUAL_OUTPUT_DIR||`outputs/visual245/${phase}`;fs.mkdirSync(folder,{recursive:true});
 const measures=[];
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const app=await fixture(browser),{page}=app;await page.setViewportSize({width,height});
  await page.goto(base+'/#overview',{waitUntil:'networkidle'});await page.locator('.candle-canvas').waitFor();await page.waitForFunction(()=>document.querySelector('.asset-radar-awareness')?.textContent.includes('活跃事件'));await pause(450);
  await page.screenshot({path:`${folder}/${name}-overview.png`});
  await page.locator('#price-chart').scrollIntoViewIfNeeded();await pause(450);await page.screenshot({path:`${folder}/${name}-chart.png`});
  await page.locator('.asset-radar-awareness').click();await page.locator('.asset-intelligence-details > summary').click();await pause(250);
  await page.locator('.radar-asset-context').scrollIntoViewIfNeeded();await page.screenshot({path:`${folder}/${name}-context.png`});
  measures.push({name,contextHeight:await page.locator('.radar-asset-context').evaluate(el=>el.getBoundingClientRect().height),contentWidth:await page.evaluate(()=>document.documentElement.scrollWidth),width});
  await page.getByRole('button',{name:'返回图表',exact:true}).click();
  await page.getByRole('tab',{name:'1 周',exact:true}).click();await page.locator('.price-chart').waitFor();
  await page.locator('.asset-radar-awareness').click();await page.getByRole('button',{name:'返回图表',exact:true}).click();await page.locator('.price-chart').waitFor();
  await page.locator('#watchlist').scrollIntoViewIfNeeded();await pause(350);await page.screenshot({path:`${folder}/${name}-watchlist.png`});
  await (width>900?page.locator('.settings-trigger'):page.locator('.mobile-dock button')).click();await pause(250);await page.screenshot({path:`${folder}/${name}-settings.png`});
  assert.deepEqual(app.errors,[]);await app.context.close();
 }
 fs.writeFileSync(`${folder}/measurements.json`,JSON.stringify(measures,null,2));fs.writeFileSync(`${folder}/console.json`,JSON.stringify({browser:browser.version(),warnings:observedWarnings},null,2));console.log(JSON.stringify(measures));
}
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 const report={browser:browser.version(),viewports:[],checks:[],errors:[],warnings:observedWarnings};let page;
 try{
  if(process.env.RADAR_STATE26_REFINEMENT_PHASE){await state26RefinementChecks(browser,report,process.env.RADAR_STATE26_REFINEMENT_PHASE);return;}
  if(process.env.RADAR_REFINEMENT_PHASE){await refinementChecks(browser,report,process.env.RADAR_REFINEMENT_PHASE);return;}
  if(process.env.RADAR_VISUAL_PHASE){await visualCapture(browser,process.env.RADAR_VISUAL_PHASE);return;}
  if(process.env.RADAR_POST_RELEASE==='1'){await postReleaseChecks(browser,report);fs.writeFileSync(`${output}/post-release-extra.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;}
  if(process.env.RADAR_FED27_ONLY==='1'){await fed27Checks(browser,report);fs.writeFileSync(`${output}/verification.json`,JSON.stringify({...report,warnings:observedWarnings},null,2));console.log(JSON.stringify(report));return;}
  if(process.env.RADAR_WATCHLIST27_ONLY==='1'){await watchlist27Checks(browser,report);fs.writeFileSync(`${output}/verification.json`,JSON.stringify({...report,warnings:observedWarnings},null,2));console.log(JSON.stringify(report));return;}
  if(process.env.RADAR_STATE26_ONLY==='1'){await state26Checks(browser,report);fs.writeFileSync(`${output}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));return;}
  if(process.env.RADAR_MOTION==='1')await motionChecks(browser,report);
  if(process.env.RADAR_STATE==='1')await assetStateChecks(browser,report);
  if(process.env.RADAR_STATE26==='1')await state26Checks(browser,report);
  if(process.env.RADAR_INTEGRATION==='1'){await integrationChecks(browser,report);await assetIntelligenceChecks(browser,report);}
  const app=await fixture(browser);page=app.page;
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.candle-canvas').waitFor();
  assert.equal(await page.locator('.classic-experience').isVisible(),true);
  await page.locator('.settings-trigger').click();await page.locator('input[name=market-experience][value=radar]').check();await page.keyboard.press('Escape');
  await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.locator('#radar').isVisible(),true);
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#radar').isVisible(),true);report.checks.push('default Radar persists after reload');
  await page.goto(base+'/#overview',{waitUntil:'networkidle'});assert.equal(await page.locator('.classic-experience').isVisible(),true);report.checks.push('explicit Classic anchor overrides default');
  await page.locator('.desktop-nav a[href="#radar"]').click();await page.locator('.radar-feed .radar-signal').first().waitFor();
  const quoteSymbols=new Set(app.requests.filter(url=>url.includes('/api/quotes?')).flatMap(url=>(new URL(url).searchParams.get('symbols')||'').split(',')));
  for(const benchmark of ['BTC-USDT','QQQ','000300.SS','^HSI'])assert.ok(quoteSymbols.has(benchmark),`missing benchmark ${benchmark}`);
  assert.equal(await page.getByRole('button',{name:'Radar 移除 QQQ',exact:true}).count(),0);report.checks.push('benchmarks share quote snapshots without entering My Radar');
  assert.ok(await page.locator('.signal-cluster').count());assert.ok(await page.locator('.signal-confidence').count());assert.ok(await page.locator('.radar-summary').count());report.checks.push('cluster, confidence and deterministic summary render');
  await page.clock.pauseAt(stamp+600000);await pause(500);
  const requestStart=app.requests.length;
  for(let i=0;i<4;i++){await page.locator('.desktop-nav a[href="#overview"]').click();await page.clock.runFor(48);await page.locator('.desktop-nav a[href="#radar"]').click();await page.clock.runFor(48);}
  report.navigationRequests=app.requests.slice(requestStart);assert.equal(report.navigationRequests.length,0);await page.clock.resume();report.checks.push('eight experience navigation clicks add zero API requests (polling clock paused)');
  await page.getByRole('button',{name:'Radar 移除 SOL-USDT',exact:true}).click();
  await page.locator('.desktop-nav a[href="#watchlist"]').click();await pause(100);assert.equal(await page.getByRole('button',{name:'查看Solana行情',exact:true}).count(),0);
  await page.locator('.desktop-nav a[href="#radar"]').click();await page.getByRole('button',{name:'Radar 添加自选',exact:true}).click();await page.locator('#custom-symbol').fill('SOL-USDT');await page.getByRole('button',{name:'添加并查看',exact:true}).click();
  await page.getByRole('button',{name:'Radar 移除 SOL-USDT',exact:true}).waitFor();
  await page.locator('.desktop-nav a[href="#watchlist"]').click();await page.getByRole('button',{name:'查看Solana行情',exact:true}).waitFor();report.checks.push('Radar add/remove updates Classic watchlist');
  await page.locator('.desktop-nav a[href="#radar"]').click();assert.ok(await page.locator('.radar-coverage-summary').count());await page.locator('.radar-feed .signal-asset').first().click();await page.locator('.classic-experience').waitFor();assert.match(page.url(),/#price-chart$/);assert.ok(await page.locator('.radar-context-banner').count());assert.ok(await page.locator('.recent-signals button').count());report.checks.push('signal opens asset, chart context and recent signals');
  await page.getByRole('button',{name:'返回 Radar',exact:true}).click();await page.locator('#radar').waitFor();assert.equal(await page.locator('.radar-context-banner').count(),0);report.checks.push('Radar context returns without a new navigation flow');
  await page.locator('.desktop-nav a[href="#overview"]').click();await page.locator('#price-chart').scrollIntoViewIfNeeded();
  await page.getByRole('button',{name:'展开图表',exact:true}).click();await page.locator('.desktop-nav a[href="#price-alerts"]').click();await pause(300);assert.equal(await page.locator('#price-alerts').isVisible(),true);
  await page.getByRole('button',{name:'新建价格提醒',exact:true}).click();await page.locator('#alert-price').fill('200');await page.getByRole('button',{name:'创建提醒',exact:true}).click();assert.ok(await page.locator('.alert-item').count());report.checks.push('expanded chart navigation and price alert creation');
  await page.locator('.desktop-nav a[href="#radar"]').click();
  await pause(4500);
  for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));await pause(200);
   const size=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));assert.ok(size.content<=width,`${name} overflow: ${size.content}`);
   await page.screenshot({path:`${output}/${name}.png`});report.viewports.push({name,width,height,...size});
  }
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.radar-feed .radar-signal').first().evaluate(el=>getComputedStyle(el).animationName),'none');report.checks.push('live reduced-motion removes signal animation');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('.desktop-nav a[href="#overview"]').focus();await page.keyboard.press('Enter');await pause(100);assert.equal(await page.locator('.classic-experience').isVisible(),true);
  await page.locator('.desktop-nav a[href="#radar"]').focus();await page.keyboard.press('Enter');await pause(100);assert.equal(await page.locator('#radar').isVisible(),true);
  await page.locator('.radar-filters button').first().focus();assert.notEqual(await page.locator('.radar-filters button').first().evaluate(el=>getComputedStyle(el).outlineStyle),'none');report.checks.push('keyboard navigation and visible focus');
  await page.setViewportSize({width:390,height:844});await page.locator('.radar-filters button').filter({hasText:'My Radar'}).click();assert.ok(await page.locator('.radar-feed .radar-signal').count());
  await page.locator('.signal-context summary').first().click();assert.equal(await page.locator('.signal-context[open]').count(),1);assert.ok(await page.locator('.signal-evidence').first().isVisible());assert.ok(await page.getByRole('heading',{name:/高可信|中可信|低可信/}).first().isVisible());report.checks.push('mobile filters, evidence and confidence disclosure');
  if(await page.locator('.signal-cluster .signal-context').count()){await page.locator('.signal-cluster .signal-context').first().evaluate(el=>{el.open=true});const secondary=page.locator('.signal-cluster .cluster-evidence').first();await secondary.waitFor();const detail=await secondary.innerText();assert.match(detail,/阈值/);for(const label of ['数据来源','报价时间','获取时间','K 线结束','信号发现'])assert.match(detail,new RegExp(label));report.checks.push('cluster disclosure retains secondary thresholds and provenance');}
  await page.context().setOffline(true);await pause(100);assert.ok(await page.getByText('网络已断开',{exact:true}).count());await page.context().setOffline(false);
  report.errors.push(...app.errors);await app.context.close();
  for(const mode of ['quiet','stale','error','partial','empty']){
   const test=await fixture(browser,{mode});page=test.page;await page.goto(base+'/#radar',{waitUntil:'networkidle'});await pause(2000);
   const count=await page.locator('.radar-feed .radar-signal').count();
   if(['quiet','stale','error'].includes(mode))assert.equal(count,0,mode);
   if(mode==='partial')assert.ok(count>0);
   await page.screenshot({path:`${output}/state-${mode}.png`});report.checks.push(`${mode} state: ${count} signals`);report.errors.push(...test.errors);await test.context.close();
  }
  const benchmarkError=await fixture(browser,{mode:'benchmark-error'});page=benchmarkError.page;await page.goto(base+'/#overview',{waitUntil:'networkidle'});await pause(500);assert.equal(await page.locator('.connection-banner').count(),0);assert.equal(await page.locator('.classic-experience').isVisible(),true);report.checks.push('benchmark-only failure does not pollute Classic health');report.errors.push(...benchmarkError.errors);await benchmarkError.context.close();
  const slow=await fixture(browser,{delay:2500});page=slow.page;await page.goto(base+'/#radar',{waitUntil:'domcontentloaded'});await pause(700);assert.equal(await page.locator('#radar').isVisible(),true);assert.match(await page.locator('.radar-scan-status').innerText(),/获取|等待/);await page.locator('.radar-feed .radar-signal').first().waitFor();report.checks.push('slow data keeps navigable loading surface');await slow.context.close();
  const noStorage=await fixture(browser,{storage:true,intro:true});page=noStorage.page;await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.locator('.classic-experience').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.dataset.intro),undefined);report.checks.push('unavailable storage has visible Classic fallback');report.errors.push(...noStorage.errors);await noStorage.context.close();
  const intro=await fixture(browser,{intro:true});page=intro.page;await page.goto(base,{waitUntil:'networkidle'});await pause(1700);assert.equal(await page.evaluate(()=>sessionStorage.getItem('radar-brand-seen')),'1');assert.equal(await page.evaluate(()=>document.documentElement.dataset.intro),undefined);await page.locator('.desktop-nav a[href="#radar"]').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.intro),undefined);await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>document.documentElement.dataset.intro),undefined);report.checks.push('shared first-session intro exits and never replays on navigation/reload');report.errors.push(...intro.errors);await intro.context.close();
  assert.deepEqual(report.errors,[]);fs.writeFileSync(`${output}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){console.error(error);if(page&&!page.isClosed())await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1;}
 finally{await browser.close();}
})();
