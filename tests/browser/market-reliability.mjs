// Paired, isolated production-build evidence. Only synthetic data and credentials.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';

const stamp = 1789372800000;
const viewports = [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]];
const sleep = ms => new Promise(done => setTimeout(done,ms));
const preferences = 'market-radar-preferences-v1';
const watchlist = ['BTC-USDT','ETH-USDT','NVDA'];
const error = {error:'合成场景：行情源暂不可用',errorInfo:{code:'upstream_unavailable',stage:'upstream'}};

function history(symbol,range,epoch=0) {
  const crypto = symbol.endsWith('-USDT');
  const [intervalMs,count,bar] = crypto ? ({'15m':[900000,96,'15m'],'1d':[900000,96,'15m'],'1w':[3600000,168,'1H'],'1m':[14400000,180,'4H'],'3m':[86400000,90,'1Dutc']}[range]) : [300000,70,'5m'];
  const points = Array.from({length:count},(_,i) => {
    const close = (symbol === 'ETH-USDT' ? 200 : 100) + i*.02 + (i===count-1 ? 3 : 0);
    return {time:stamp-(count-i)*intervalMs,open:close-.01,high:close+.03,low:close-.03,close,volume:i===count-1?500:100,...(i===count-1?{}:{confirmed:true})};
  });
  return {symbol,range,points,currency:crypto?'USDT':'USD',source:crypto?'OKX 欧易':'Yahoo Finance',timezone:'UTC',fetchedAt:stamp+epoch,metadata:{intervalMs,bar,exchange:crypto?'OKX':'fixture',instrument:symbol,marketType:crypto?'spot':'equity',volumeUnit:crypto?'base':'shares',bucketTimezone:'UTC',completion:crypto?'source':'time_window',firstAt:points[0].time,lastAt:points.at(-1).time,lastCompleteAt:points.at(-2).time+intervalMs,invalidRows:0,duplicateRows:0,gapCount:0,path:crypto?'candles':'yahoo-chart',limitations:['synthetic_fixture']}};
}

function quote(symbol,epoch=0) {
  const data = history(symbol,'1d',epoch),crypto=symbol.endsWith('-USDT');
  return {symbol,name:symbol,currency:crypto?'USDT':symbol.endsWith('.HK')||symbol==='^HSI'?'HKD':symbol.endsWith('.SS')?'CNY':'USD',source:data.source,price:data.points.at(-1).close+epoch/1000,change:3,changePercent:3,previousClose:100,high:110,low:99,volume:1000000,timestamp:stamp+epoch,fetchedAt:stamp+epoch,session:'open',delayMinutes:0,points:crypto?[]:data.points};
}

async function until(predicate,message) {
  for(let i=0;i<150;i++){if(await predicate())return;await sleep(20);}
  throw Error(message);
}

async function settle(page,ms=48) { await page.clock.runFor(ms); await sleep(35); await page.clock.runFor(32); }
async function chooseRange(page,label) { await page.getByRole('tab',{name:label,exact:true}).focus();await page.keyboard.press('Enter');await settle(page); }

async function fixtureScenario(browser,fixture,origin,{motion='reduced',touch=false}={}) {
  const browserOptions=touch?{newContext:options=>browser.newContext({...options,hasTouch:true})}:browser;
  const app=await fixture(browserOptions,{mode:'normal',os:motion==='reduced'?'reduce':'no-preference',motionPreference:motion,watchlist});
  const {page}=app,state={epoch:0,quoteMode:'healthy',historyFailed:false,tailShift:0,hold:null},calls=[],external=[],held=[];
  await page.addInitScript(({preferences,watchlist,motion})=>{
    const old=JSON.parse(localStorage.getItem(preferences)||'{}');
    localStorage.setItem(preferences,JSON.stringify({...old,watchlist,auto:false,backgroundTabs:true,marketMode:'classic',motionPreference:motion,displayTimePreference:old.displayTimePreference??'UTC'}));
    window.__reliabilityVisibility='visible';
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__reliabilityVisibility});
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__reliabilityVisibility==='hidden'});
  },{preferences,watchlist,motion});
  await page.route('**/api/history?**',async route=>{
    const params=new URL(route.request().url()).searchParams,symbol=params.get('symbol'),range=params.get('range');
    const row={kind:'history',symbol,range,epoch:state.epoch,failed:state.historyFailed,done:false};calls.push(row);
    const data=history(symbol,range,state.epoch);
    if(state.tailShift&&symbol==='BTC-USDT') {
      data.points.forEach(point=>point.time-=state.tailShift);
      for(const key of ['firstAt','lastAt','lastCompleteAt'])data.metadata[key]-=state.tailShift;
    }
    const response=state.historyFailed?{status:503,json:error}:{json:data};
    try {
      if(state.hold?.symbol===symbol&&state.hold?.range===range){state.hold=null;await new Promise(release=>held.push({release,row}));}
      await route.fulfill(response);
    } catch(cause) { row.cancelled=String(cause).includes('closed')||String(cause).includes('handled'); if(!row.cancelled)throw cause; }
    finally {row.done=true;}
  });
  await page.route('**/api/quotes?**',async route=>{
    const symbols=new URL(route.request().url()).searchParams.get('symbols').split(','),row={kind:'quotes',symbols,epoch:state.epoch,mode:state.quoteMode,done:false};calls.push(row);
    const results=symbols.flatMap(symbol=>state.quoteMode==='missing'&&symbol==='BTC-USDT'?[]:state.quoteMode==='partial'&&symbol==='ETH-USDT'?[{symbol,error:'合成场景：单一标的失败',errorInfo:{code:'upstream_unavailable',stage:'upstream'}}]:[{symbol,quote:quote(symbol,state.epoch)}]);
    await route.fulfill({json:{results,fetchedAt:stamp+state.epoch+9999}});row.done=true;
  });
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}
    return route.fallback();
  });
  // Clock remains paused outside explicit advances; no uncontrolled polling races.
  await page.clock.pauseAt(stamp+1000);
  return {...app,state,calls,external,held};
}

const marketCalls = app => app.calls.length;
const historyCalls = (app,start=0,symbol='BTC-USDT') => app.calls.slice(start).filter(r=>r.kind==='history'&&r.symbol===symbol);
const statusText = async page => await page.locator('.market-data-status').count()?page.locator('.market-data-status').innerText():'';
const statusValue = async (page,label) => await page.locator('.market-data-status').count()?page.locator('.market-data-status dl>div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent():null;
const chartSnapshot = page => page.locator('.candle-canvas').evaluate(el=>({start:el.dataset.viewStart,count:el.dataset.viewCount,selected:el.dataset.selectedTime,first:el.dataset.firstTime,follow:el.dataset.followLatest}));

export async function reliabilityChecks({browser,fixture,base,output,report,phase,observedWarnings=[]}) {
  assert.ok(['before','after'].includes(phase));assert.equal(process.env.RADAR_SYNTHETIC_AUTH,'1');
  const url=new URL(base);assert.equal(url.hostname,'127.0.0.1');
  const folder=resolve(output,phase),build=resolve(process.env.RADAR_BUILD_DIR||'dist');mkdirSync(folder,{recursive:true});
  Object.assign(report,{phase,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),buildDirectory:build,identity:'Synthetic market fixture on a local production build; no private files, credentials, actual market or model requests',screenshots:[],baselineFailures:[],observations:[],externalRequests:[],conditions:{stamp,watchlist,auto:false,displayTimePreference:'UTC',motion:'reduced except explicit standard-motion check',grid:'native 15m/1H/4H/1Dutc; last confirmation unknown',outbound:'browser external abort and Miniflare outbound denial'},notRun:['physical devices','production authenticated refresh','real source availability','FPS measurement']});
  const check=(name,passed,detail={})=>{report.observations.push({name,passed:!!passed,...detail});if(passed)report.checks.push(name);else if(phase==='before')report.baselineFailures.push({name,...detail});else assert.ok(passed,`${name}: ${JSON.stringify(detail)}`);};
  const runtime=new Miniflare({host:'127.0.0.1',port:Number(url.port),modules:true,scriptPath:resolve(build,'server/index.js'),modulesRoot:resolve(build,'server'),modulesRules:[{type:'ESModule',include:['**/*.js'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{ACCESS_CODE_HASH:createHash('sha256').update('PERFFIXTUREONLY').digest('hex'),ACCESS_SESSION_SECRET:'perf-fixture-only-not-a-production-secret-275'},assets:{directory:resolve(build,'client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},outboundService:()=>new Response('isolated reliability fixture',{status:503})});
  await runtime.ready;
  let current;
  async function capture(app,name,state,width,height) {
    const page=app.page;
    await page.locator('#price-chart').evaluate(el=>{el.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-75,behavior:'instant'});});await settle(page);
    const path=resolve(folder,`${name}-${state}.png`);await page.screenshot({path,animations:'disabled'});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    check(`${name} ${state}: no horizontal overflow`,!overflow);report.screenshots.push({name,state,width,height,path});
  }
  async function open(app,width,height) {
    const p=app.page;await p.setViewportSize({width,height});await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});
    await settle(p);await p.locator('.candle-canvas').waitFor();await settle(p,1800);
    await until(()=>app.calls.every(row=>row.done),'initial fixture requests did not finish');
    assert.equal(await p.getByRole('switch',{name:'自动刷新与提醒',exact:true}).getAttribute('aria-checked'),'false');
  }
  async function manual(app) {
    const button=app.page.getByRole('button',{name:'刷新行情',exact:true});await until(()=>button.isEnabled(),'manual refresh remains busy');
    const start=app.calls.length;await button.click({force:true});await settle(app.page);
    await until(async()=>await button.isEnabled()&&app.calls.slice(start).every(row=>row.done),'manual refresh did not settle');return start;
  }
  try {
    for(const [name,width,height] of viewports) {
      const app=current=await fixtureScenario(browser,fixture,url.origin,{touch:name==='narrow'}),p=app.page;
      try {
        await open(app,width,height);
        check(`${name}: initial selected chart and analysis share the crypto 15m acquisition`,historyCalls(app).length===1,{requests:historyCalls(app)});
        check(`${name}: source-unknown candle stays unknown`,/未知/.test(await p.locator('.candle-readout').innerText()));
        await capture(app,name,'healthy',width,height);
        const oldTime=await statusValue(p,'走势实际获取'),oldChart=await p.locator('.candle-canvas').innerHTML();
        app.state.epoch=1000;const first=await manual(app),firstHistory=historyCalls(app,first);
        check(`${name}: manual refresh inside five seconds bypasses cache and shares chart/analysis request`,firstHistory.length===1,{requests:firstHistory,elapsedClock:await p.evaluate(()=>Date.now())-stamp});
        check(`${name}: successful manual refresh advances original acquisition time`,oldTime!==await statusValue(p,'走势实际获取'),{oldTime,newTime:await statusValue(p,'走势实际获取')});
        const validTime=await statusValue(p,'走势实际获取');
        app.state.historyFailed=true;app.state.quoteMode='partial';app.state.epoch=2000;await manual(app);
        check(`${name}: partial quote failure is visible`,await p.locator('.connection-banner').count()>0,{text:await p.locator('.connection-banner').allTextContents()});
        check(`${name}: failed history preserves chart and source acquisition time`,await p.locator('.candle-canvas').count()===1&&validTime!==null&&validTime===await statusValue(p,'走势实际获取'),{oldTime:validTime,newTime:await statusValue(p,'走势实际获取')});
        check(`${name}: history and selected analysis failure are disclosed`,/更新失败/.test(await p.locator('.chart-footer').innerText())&&/分析基线更新失败/.test(await statusText(p)));
        if(await p.locator('.market-data-status').count())await p.locator('.market-data-status>summary').click({force:true});
        await capture(app,name,'failed-retained',width,height);
        app.state.quoteMode='missing';await manual(app);
        const btcRow=p.locator('.watch-table tbody tr').filter({has:p.getByRole('button',{name:'查看比特币行情',exact:true})});
        check(`${name}: omitted quote result marks the old BTC quote failed`,await btcRow.count()>0&&/上次报价/.test(await btcRow.innerText()));
        app.state.historyFailed=false;app.state.quoteMode='healthy';app.state.epoch=3000;await manual(app);
        check(`${name}: recovery clears quote, chart and analysis failure`,await p.locator('.connection-banner').count()===0&&!/更新失败/.test(await p.locator('.chart-footer').innerText())&&!/分析基线更新失败/.test(await statusText(p)));
        check(`${name}: chart remains populated through recovery`,oldChart.length>0&&(await p.locator('.candle-canvas').innerHTML()).length>0);
        await capture(app,name,'recovered',width,height);
        if(name==='desktop') {
          const paused=marketCalls(app);await p.clock.runFor(120000);await sleep(50);
          await app.context.setOffline(true);await settle(p);assert.ok(await p.locator('.connection-banner').count());
          await app.context.setOffline(false);await settle(p);
          for(const visibility of ['hidden','visible']){await p.evaluate(value=>{window.__reliabilityVisibility=value;document.dispatchEvent(new Event('visibilitychange'));},visibility);await settle(p);}
          await p.clock.runFor(61000);await sleep(50);
          check('paused: elapsed timers, offline/online and hidden/visible add no reads',marketCalls(app)===paused,{extraCalls:app.calls.slice(paused)});
          const explicit=await manual(app);check('paused: explicit manual refresh still reads quote and history',app.calls.slice(explicit).some(r=>r.kind==='quotes')&&historyCalls(app,explicit).length===1);
        }
        if(await p.locator('.market-data-status[open]').count())await p.locator('.market-data-status>summary').click({force:true});
        await p.locator('.candle-canvas').focus();await p.keyboard.press('ArrowLeft');await settle(p);
        check(`${name}: keyboard chart focus remains visible`,await p.locator('.candle-canvas').evaluate(el=>getComputedStyle(el).outlineStyle!=='none'));
        await p.getByRole('tab',{name:'1 周',exact:true}).focus();await p.keyboard.press('Enter');await settle(p);await p.locator('.price-chart .recharts-area-curve').waitFor();
        await p.locator('.asset-radar-awareness').click({force:true});await settle(p);await p.getByRole('button',{name:'返回图表',exact:true}).click({force:true});await settle(p);
        check(`${name}: related Radar return preserves manual week range`,await p.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected')==='true');
        if(name==='narrow') {
          const tab=p.getByRole('tab',{name:'15 分钟',exact:true});
          await tab.evaluate(el=>el.scrollIntoView({block:'center',inline:'center',behavior:'instant'}));await settle(p);
          const hit=await tab.evaluate(el=>{const r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,target=document.elementFromPoint(x,y);return {x,y,width:r.width,height:r.height,reachable:target===el||el.contains(target),hit:target?.getAttribute('aria-label')??target?.textContent?.slice(0,60)};});
          report.observations.push({name:'narrow: native scroll and touch target geometry',...hit});
          assert.ok(hit.reachable,`320px tab obscured after native scroll: ${JSON.stringify(hit)}`);
          await p.touchscreen.tap(hit.x,hit.y);await settle(p);
          check('narrow: touch selects the first range after returning from Radar',await tab.getAttribute('aria-selected')==='true',{hit});
        }
        await chooseRange(p,'15 分钟');await p.locator('.candle-canvas').waitFor();
        const hasZones=await p.locator('input[name="display-timezone"]').count()>0;
        // Settings is unmounted while closed; discover the radios only after opening.
        await p.locator('.settings-trigger').click({force:true});await settle(p);
        if(await p.locator('input[name="display-timezone"]').count()) {
          await p.keyboard.press('Escape');await settle(p);await p.getByRole('button',{name:'放大 K 线',exact:true}).click({force:true});await settle(p);
          const viewport=await chartSnapshot(p),before=marketCalls(app),texts=[];
          await p.locator('.settings-trigger').click({force:true});await settle(p);
          for(const zone of ['device','UTC','Asia/Shanghai']) {
            await p.locator(`input[name="display-timezone"][value="${zone}"]`).check({force:true});await settle(p);
            texts.push({zone,text:await p.locator('.chart-footer').innerText(),actual:await p.locator('.candle-canvas').getAttribute('data-timezone')});
            check(`${name}: ${zone} changes formatting without moving the chart`,JSON.stringify(viewport)===JSON.stringify(await chartSnapshot(p)));
          }
          await p.keyboard.press('Escape');await settle(p);
          check(`${name}: timezone changes add zero API requests`,marketCalls(app)===before,{extraCalls:app.calls.slice(before)});
          check(`${name}: UTC and Shanghai use distinct visible time labels`,texts[1].text!==texts[2].text&&texts[2].actual==='Asia/Shanghai',{texts});
          const saved=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),preferences);
          check(`${name}: timezone persists with paused auto and watchlist intact`,saved.displayTimePreference==='Asia/Shanghai'&&saved.auto===false&&JSON.stringify(saved.watchlist)===JSON.stringify(watchlist));
          if(name==='desktop'){await p.reload({waitUntil:'networkidle'});await settle(p,1800);await p.locator('.candle-canvas').waitFor();check('timezone: stored Shanghai choice survives reload',await p.locator('.candle-canvas').getAttribute('data-timezone')==='Asia/Shanghai');}
        } else {check(`${name}: device, UTC and Shanghai display settings exist`,hasZones);await p.keyboard.press('Escape');await settle(p);}
        await chooseRange(p,'1 日');
        app.state.epoch=await p.evaluate(()=>Date.now())-stamp;await manual(app);
        check(`${name}: crypto one-day range is described as a rolling window`,/最近窗口.*非自然日/.test(await p.locator('.chart-footer').innerText()),{footer:await p.locator('.chart-footer').innerText()});
        check(`${name}: interactions add no horizontal overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        assert.deepEqual(app.errors,[]);assert.deepEqual(app.external,[]);report.errors.push(...app.errors);report.viewports.push({name,width,height});
      } catch(cause) {await p.screenshot({path:resolve(folder,`${name}-failure.png`),animations:'disabled'}).catch(()=>{});report.failureText=await p.locator('#price-chart').textContent().catch(()=>null);throw cause;}
      finally {for(const held of app.held)held.release();await app.context.close();current=null;}
    }
    // Deliberately release an obsolete response after the newer selected range is visible.
    const app=current=await fixtureScenario(browser,fixture,url.origin,{motion:'normal'}),p=app.page;
    try {
      await open(app,1440,1000);app.state.hold={symbol:'ETH-USDT',range:'1w'};
      await chooseRange(p,'1 周');
      await p.getByRole('button',{name:'查看以太坊行情',exact:true}).click({force:true});await settle(p);
      await until(()=>app.held.length===1,'old ETH week response was not held');
      await p.getByRole('button',{name:'查看比特币行情',exact:true}).click({force:true});await settle(p);
      await chooseRange(p,'1 月');await p.locator('.price-chart .recharts-area-curve').waitFor();
      const title=await p.locator('.selected-title').innerText(),range=await p.locator('.range-trigger[aria-selected="true"]').innerText(),footer=await p.locator('.chart-footer').innerText();
      app.held[0].release();await settle(p);await sleep(100);await settle(p);
      check('rapid asset/range: obsolete history cannot replace current BTC month view',title===await p.locator('.selected-title').innerText()&&range===await p.locator('.range-trigger[aria-selected="true"]').innerText()&&footer===await p.locator('.chart-footer').innerText(),{title,range,footer});
      check('month selection uses native 4H metadata',phase==='before'?false:/原生 4H/.test(footer),{footer});
      await chooseRange(p,'15 分钟');await p.locator('.candle-canvas').waitFor();
      await capture(app,'desktop-standard','healthy',1440,1000);
      app.state.tailShift=6*3600000;app.state.epoch=await p.evaluate(()=>Date.now())-stamp;await manual(app);
      check('fresh acquisition with an old native crypto tail is explicitly disclosed',/最新 K 线时间落后/.test(await p.locator('.chart-footer').innerText()),{footer:await p.locator('.chart-footer').innerText(),fetchedAt:stamp+app.state.epoch,lastAt:stamp-900000-app.state.tailShift});
      await capture(app,'desktop-standard','old-tail',1440,1000);
      await p.emulateMedia({reducedMotion:'reduce'});await p.locator('.settings-trigger').click({force:true});await settle(p);await p.locator('input[name="motion-preference"][value="system"]').check({force:true});await p.keyboard.press('Escape');await settle(p);
      check('live reduced-motion preference follows the operating-system setting',await p.evaluate(()=>document.documentElement.dataset.motion)==='reduced');
      assert.deepEqual(app.errors,[]);assert.deepEqual(app.external,[]);report.errors.push(...app.errors);
    } finally {for(const held of app.held)held.release();await app.context.close();current=null;}
    report.warnings=observedWarnings;
  } catch(cause) {
    report.failure={message:String(cause),stack:cause.stack};
    if(current&&!current.page.isClosed())await current.page.screenshot({path:resolve(folder,'failure.png'),animations:'disabled'}).catch(()=>{});
    throw cause;
  } finally {writeFileSync(resolve(folder,'verification.json'),JSON.stringify(report,null,2));await runtime.dispose();}
}

