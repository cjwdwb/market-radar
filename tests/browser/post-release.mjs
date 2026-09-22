// Opt-in production read-only QA. Never imports the fixture or reads credentials.
// User enters the access code in this disposable headed browser; no session is saved.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base='https://market-radar-rex.swt-aether.chatgpt.site';
const out='outputs/post-release245';fs.mkdirSync(out,{recursive:true});
const report={date:new Date().toISOString(),environment:'production / disposable desktop Edge / real providers',checks:[],quotes:[],requests:[],limitations:[],blockedWrites:0};
const browser=await chromium.launch({channel:'msedge',headless:false});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();page.setDefaultTimeout(15000);
report.browser=browser.version();
await context.route('**/*',route=>{
 const req=route.request(),url=new URL(req.url());
 if(!['GET','HEAD'].includes(req.method())&&!(url.origin===base&&url.pathname==='/api/access'&&req.method()==='POST')){
  report.blockedWrites++;return route.abort();
 }
 return route.continue();
});
page.on('request',req=>{const url=new URL(req.url());if(url.origin===base&&['/api/quotes','/api/history'].includes(url.pathname))report.requests.push({at:new Date().toISOString(),endpoint:url.pathname});});
page.on('response',async response=>{
 if(new URL(response.url()).pathname!=='/api/quotes'||!response.ok())return;
 try{const data=await response.json();for(const row of data.results||[]){if(!['BTC-USDT','ETH-USDT'].includes(row.symbol))continue;
 const q=row.quote;if(q)report.quotes.push({symbol:row.symbol,source:q.source,price:q.price,timestamp:q.timestamp,fetchedAt:q.fetchedAt,session:q.session,observedAt:new Date().toISOString()});
 }}catch{/* No raw response/error logging. */}
});
const check=(name,result,detail)=>report.checks.push({name,result,detail});
try{
 await page.goto(base,{waitUntil:'domcontentloaded',timeout:60000});
 if(new URL(page.url()).pathname==='/access'){
  check('Access gate','PASS','Visible access form; no credentials read or injected.');
  console.log('LOGIN_REQUIRED: enter access code in the separate Edge window. No credential capture.');
 }else check('Access gate','NOT RUN','No access form observed.');
 await page.locator('.classic-experience').waitFor({state:'visible',timeout:900000});
 console.log('LOGIN_COMPLETE: beginning read-only workflow.');
 await page.locator('.asset-radar-awareness').waitFor();
 await page.waitForTimeout(6000); // One natural quote cycle; no controlled production clock.
 await page.screenshot({path:`${out}/production-classic.png`});
 for(const symbol of ['ETH','BTC']){
  await page.locator('.symbol-rail button').filter({hasText:symbol}).first().click();
  assert.equal(await page.locator('.selected-title h2').innerText(),symbol);
  const awareness=page.locator('.asset-radar-awareness');
  assert.equal(await awareness.getAttribute('data-symbol'),`${symbol}-USDT`);
  await page.getByRole('tab',{name:'1 周',exact:true}).click();
  await awareness.click();await page.locator('.radar-asset-context').waitFor();
  assert.match(await page.locator('.radar-asset-context').innerText(),new RegExp(`${symbol}-USDT`));
  const details=page.locator('.asset-intelligence-details');assert.equal(await details.getAttribute('open'),null);
  await details.locator('summary').click();
  const contextText=await page.locator('.radar-asset-context').innerText();
  const eventCount=await page.locator('.radar-feed .radar-signal').count();
  for(const s of await page.locator('.radar-feed .radar-signal').evaluateAll(els=>els.map(el=>el.dataset.symbol)))assert.equal(s,`${symbol}-USDT`);
  await page.screenshot({path:`${out}/production-${symbol.toLowerCase()}-context.png`});
  await page.getByRole('button',{name:'返回图表',exact:true}).click();
  assert.equal(await page.locator('.selected-title h2').innerText(),symbol);
  assert.equal(await page.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');
  check(`${symbol} chart/context return`,'PASS',{contextText,eventCount,chart:await page.locator('.price-chart').count(),candles:await page.locator('.candle-canvas').count()});
  if(!eventCount)report.limitations.push(`${symbol}: no live event; no claim of real anomaly triggering.`);
 }
 await page.locator('.settings-trigger').click();await page.locator('input[name=motion-preference][value=reduced]').check();
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion),'reduced');
 const start=report.quotes.length;await page.waitForTimeout(7000);
 assert.ok(await page.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected')==='true');
 await page.locator('#price-alerts').scrollIntoViewIfNeeded();
 assert.ok(await page.getByRole('button',{name:'新建价格提醒',exact:true}).isVisible());
 check('Reduced motion retains selection and alert entry','PASS','Only ephemeral test-browser preference changed. No alerts created or notifications enabled.');
 check('Real quotes in reduced mode',report.quotes.length>start?'PASS':'BLOCKED',`${report.quotes.length-start} observed BTC/ETH quote records after mode change; this is response evidence, not a polling-frequency measurement.`);
 await page.screenshot({path:`${out}/production-reduced.png`});
 report.limitations.push('No natural in-flight halo cancellation assertion; covered separately with fixture. Request counts include normal polling and explicit symbol/range changes, not a navigation amplification metric. No real data mutations/notifications or fault injection. Desktop Edge is not iPhone Safari.');
}catch(error){
 check('Current production QA step',error.name==='AssertionError'?'FAIL':'BLOCKED',error.name==='TimeoutError'?'Browser navigation, login or required content timed out.':error.name==='AssertionError'?error.message:'Browser operation did not complete; investigate separately.');
 console.log(`QA_STOPPED: ${error.name}; no raw credentials or request data logged.`);
}finally{
 fs.writeFileSync(`${out}/production.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({checks:report.checks,quotesObserved:report.quotes.length,blockedWrites:report.blockedWrites}));
 await context.close();await browser.close();
}
