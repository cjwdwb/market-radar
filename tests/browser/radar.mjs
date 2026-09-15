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
 const page=await context.newPage();await page.clock.setFixedTime(stamp);
 if(!intro)await page.addInitScript(()=>sessionStorage.setItem('radar-brand-seen','1'));
 if(storage)await page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Storage unavailable')};Storage.prototype.setItem=()=>{throw Error('Storage unavailable')};});
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url())});
 await page.route('**/api/quotes?**',async route=>{
  if(delay)await pause(delay);
  const symbols=new URL(route.request().url()).searchParams.get('symbols').split(',');
  await route.fulfill({json:{results:symbols.map(symbol=>{
   if(mode==='error'||mode==='partial'&&symbol==='NVDA')return {symbol,error:'测试：该标的请求失败'};
   const okx=symbol.endsWith('-USDT'),points=series(symbol,mode);
   return {symbol,quote:{symbol,name:symbol,currency:okx?'USDT':symbol.endsWith('.HK')?'HKD':symbol.endsWith('.SS')?'CNY':'USD',source:okx?'OKX 欧易':'Yahoo Finance',price:points.at(-1).close,change:3,changePercent:3,previousClose:100,high:103.02,low:99.98,volume:1000000,timestamp:mode==='stale'?stamp-3600000:stamp,fetchedAt:stamp,session:'open',delayMinutes:0,points:okx?[]:points}};
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
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'msedge',headless:true});
 const report={viewports:[],checks:[],errors:[]};let page;
 try{
  const app=await fixture(browser);page=app.page;
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('.candle-canvas').waitFor();
  assert.equal(await page.locator('.classic-experience').isVisible(),true);
  await page.locator('.settings-trigger').click();await page.locator('input[name=market-experience][value=radar]').check();await page.keyboard.press('Escape');
  await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.locator('#radar').isVisible(),true);
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#radar').isVisible(),true);report.checks.push('default Radar persists after reload');
  await page.goto(base+'/#overview',{waitUntil:'networkidle'});assert.equal(await page.locator('.classic-experience').isVisible(),true);report.checks.push('explicit Classic anchor overrides default');
  await page.locator('.desktop-nav a[href="#radar"]').click();await page.locator('.radar-feed .radar-signal').first().waitFor();
  const requestStart=app.requests.length;
  for(let i=0;i<4;i++){await page.locator('.desktop-nav a[href="#overview"]').click();await page.locator('.desktop-nav a[href="#radar"]').click();}
  report.navigationRequests=app.requests.slice(requestStart);assert.equal(report.navigationRequests.length,0);report.checks.push('eight experience navigation clicks add zero API requests');
  await page.getByRole('button',{name:'Radar 移除 SOL-USDT',exact:true}).click();
  await page.locator('.desktop-nav a[href="#watchlist"]').click();await pause(100);assert.equal(await page.getByRole('button',{name:'查看Solana行情',exact:true}).count(),0);
  await page.locator('.desktop-nav a[href="#radar"]').click();await page.getByRole('button',{name:'Radar 添加自选',exact:true}).click();await page.locator('#custom-symbol').fill('SOL-USDT');await page.getByRole('button',{name:'添加并查看',exact:true}).click();
  await page.getByRole('button',{name:'Radar 移除 SOL-USDT',exact:true}).waitFor();
  await page.locator('.desktop-nav a[href="#watchlist"]').click();await page.getByRole('button',{name:'查看Solana行情',exact:true}).waitFor();report.checks.push('Radar add/remove updates Classic watchlist');
  await page.locator('.desktop-nav a[href="#radar"]').click();await page.locator('.radar-feed .signal-asset').first().click();await page.locator('.classic-experience').waitFor();assert.match(page.url(),/#price-chart$/);assert.ok(await page.locator('.recent-signals button').count());report.checks.push('signal opens asset and recent signals');
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
  await page.locator('.signal-context summary').first().click();assert.equal(await page.locator('.signal-context[open]').count(),1);report.checks.push('mobile filters and provenance disclosure');
  await page.context().setOffline(true);await pause(100);assert.ok(await page.getByText('网络已断开',{exact:true}).count());await page.context().setOffline(false);
  report.errors.push(...app.errors);await app.context.close();
  for(const mode of ['quiet','stale','error','partial','empty']){
   const test=await fixture(browser,{mode});page=test.page;await page.goto(base+'/#radar',{waitUntil:'networkidle'});await pause(2000);
   const count=await page.locator('.radar-feed .radar-signal').count();
   if(['quiet','stale','error'].includes(mode))assert.equal(count,0,mode);
   if(mode==='partial')assert.ok(count>0);
   await page.screenshot({path:`${output}/state-${mode}.png`});report.checks.push(`${mode} state: ${count} signals`);report.errors.push(...test.errors);await test.context.close();
  }
  const slow=await fixture(browser,{delay:2500});page=slow.page;await page.goto(base+'/#radar',{waitUntil:'domcontentloaded'});await pause(700);assert.equal(await page.locator('#radar').isVisible(),true);assert.match(await page.locator('.radar-scan-status').innerText(),/获取|等待/);await page.locator('.radar-feed .radar-signal').first().waitFor();report.checks.push('slow data keeps navigable loading surface');await slow.context.close();
  const noStorage=await fixture(browser,{storage:true,intro:true});page=noStorage.page;await page.goto(base,{waitUntil:'networkidle'});assert.equal(await page.locator('.classic-experience').isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.dataset.intro),undefined);report.checks.push('unavailable storage has visible Classic fallback');report.errors.push(...noStorage.errors);await noStorage.context.close();
  const intro=await fixture(browser,{intro:true});page=intro.page;await page.goto(base,{waitUntil:'networkidle'});await pause(1700);assert.equal(await page.evaluate(()=>sessionStorage.getItem('radar-brand-seen')),'1');assert.equal(await page.evaluate(()=>document.documentElement.dataset.intro),undefined);await page.locator('.desktop-nav a[href="#radar"]').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.intro),undefined);await page.reload({waitUntil:'domcontentloaded'});assert.equal(await page.evaluate(()=>document.documentElement.dataset.intro),undefined);report.checks.push('shared first-session intro exits and never replays on navigation/reload');report.errors.push(...intro.errors);await intro.context.close();
  assert.deepEqual(report.errors,[]);fs.writeFileSync(`${output}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(error){console.error(error);if(page&&!page.isClosed())await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});process.exitCode=1;}
 finally{await browser.close();}
})();
