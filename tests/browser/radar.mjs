// Optional browser verification: requires Playwright + Edge, a running local preview and ignored .dev.vars.
// Test responses are intercepted only inside these disposable contexts; never imported by production.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const loadPlaywright=createRequire(import.meta.url);
const {chromium}=loadPlaywright(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.RADAR_PREVIEW_URL||'http://localhost:5173';
const stamp=1789372800000,output='outputs/radar';fs.mkdirSync(output,{recursive:true});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function series(symbol,mode){
  const interval=(symbol.endsWith('-USDT')?15:5)*60000;
 return Array.from({length:70},(_,i)=>{const unusual=['normal','partial'].includes(mode);const close=i===69&&unusual?103:100+(i%2)*.02;return {time:stamp-(70-i)*interval,close,open:close,high:close+.02,low:close-.02,volume:i===69&&unusual?500:100,confirmed:true};});
}
async function fixture(browser,{mode='normal',intro=false,storage=false,delay=0}={}){
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
 const vars=Object.fromEntries(fs.readFileSync('.dev.vars','utf8').trim().split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}));
 const payload=`${Math.floor(Date.now()/1000)+3600}.${crypto.randomBytes(16).toString('hex')}`;
 const sig=crypto.createHmac('sha256',vars.ACCESS_SESSION_SECRET).update(`radar-v1:${vars.ACCESS_CODE_HASH}:${payload}`).digest('hex');
 await context.addCookies([{name:'__Host-radar_access',value:`${payload}.${sig}`,url:base.replace('http:','https:'),secure:true,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();await page.clock.install({time:stamp});await page.clock.setFixedTime(stamp);
 if(!intro)await page.addInitScript(()=>sessionStorage.setItem('radar-brand-seen','1'));
 if(storage)await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Storage unavailable')};Storage.prototype.setItem=()=>{throw Error('Storage unavailable')};});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url())});
 await page.route('**/api/quotes?**',async route=>{
  if(delay)await pause(delay);
  const symbols=new URL(route.request().url()).searchParams.get('symbols').split(',');
  await route.fulfill({json:{results:symbols.map(symbol=>{
   if(mode==='error'||mode==='partial'&&symbol==='NVDA'||mode==='benchmark-error'&&['QQQ','000300.SS','^HSI'].includes(symbol))return {symbol,error:'测试：该标的请求失败'};
   const okx=symbol.endsWith('-USDT'),points=series(symbol,mode);
   return {symbol,quote:{symbol,name:symbol,currency:okx?'USDT':symbol.endsWith('.HK')||symbol==='^HSI'?'HKD':symbol.endsWith('.SS')?'CNY':'USD',source:okx?'OKX 欧易':'Yahoo Finance',price:points.at(-1).close,change:3,changePercent:3,previousClose:100,high:103.02,low:99.98,volume:1000000,timestamp:mode==='stale'?stamp-3600000:stamp,fetchedAt:stamp,session:'open',delayMinutes:0,points:okx?[]:points}};
  }),fetchedAt:stamp}});
 });
 await page.route('**/api/history?**',async route=>{
  if(delay)await pause(delay);
  const symbol=new URL(route.request().url()).searchParams.get('symbol');
  await route.fulfill({status:mode==='error'?503:200,json:{symbol,points:mode==='empty'?[]:series(symbol,mode),currency:symbol.endsWith('-USDT')?'USDT':'USD',source:symbol.endsWith('-USDT')?'OKX 欧易':'Yahoo Finance',fetchedAt:stamp,timezone:'UTC'}});
 });
 await page.route('**/api/monitor**',route=>route.fulfill({status:401,json:{error:'仅站主管理'}}));
 return {context,page,errors,requests};
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
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 const report={viewports:[],checks:[],errors:[]};let page;
 try{
  if(process.env.RADAR_INTEGRATION==='1')await integrationChecks(browser,report);
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
