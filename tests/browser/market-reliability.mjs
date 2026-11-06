// Paired, isolated production-build evidence. Only synthetic data and credentials.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
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

async function fixtureScenario(browser,fixture,origin,{motion='reduced',touch=false,quoteMode='healthy'}={}) {
  const browserOptions=touch?{newContext:options=>browser.newContext({...options,hasTouch:true})}:browser;
  const app=await fixture(browserOptions,{mode:'normal',os:motion==='reduced'?'reduce':'no-preference',motionPreference:motion,watchlist});
  const {page}=app,state={epoch:0,quoteMode,historyFailed:false,tailShift:0,hold:null},calls=[],external=[],held=[];
  await page.addInitScript(({preferences,watchlist,motion})=>{
    const old=JSON.parse(localStorage.getItem(preferences)||'{}');
    localStorage.setItem(preferences,JSON.stringify({...old,watchlist,auto:false,backgroundTabs:true,marketMode:'classic',motionPreference:motion,displayTimePreference:old.displayTimePreference??'UTC'}));
    window.__reliabilityVisibility='visible';
    Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__reliabilityVisibility});
    Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__reliabilityVisibility==='hidden'});
  },{preferences,watchlist,motion});
  await page.route('**/api/history?**',async route=>{
    const params=new URL(route.request().url()).searchParams,symbol=params.get('symbol'),range=params.get('range');
    const epoch=state.realtime?state.realtime.epoch+Date.now()-state.realtime.start:state.epoch;
    const row={kind:'history',symbol,range,epoch,failed:state.historyFailed,done:false};calls.push(row);
    const data=history(symbol,range,epoch);
    if(state.realtime){const last=data.points.at(-1),delta=epoch/10000;for(const key of ['open','high','low','close'])last[key]+=delta;}
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
    const epoch=state.realtime?state.realtime.epoch+Date.now()-state.realtime.start:state.epoch;
    const symbols=new URL(route.request().url()).searchParams.get('symbols').split(','),row={kind:'quotes',symbols,epoch,mode:state.quoteMode,done:false};calls.push(row);
    const results=symbols.flatMap(symbol=>state.quoteMode==='missing'&&symbol==='BTC-USDT'?[]:state.quoteMode==='none'||state.quoteMode==='partial'&&symbol==='ETH-USDT'?[{symbol,error:'合成场景：报价暂不可用',errorInfo:{code:'upstream_unavailable',stage:'upstream'}}]:[{symbol,quote:quote(symbol,epoch)}]);
    await route.fulfill({json:{results,fetchedAt:stamp+epoch+9999}});row.done=true;
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
  if(process.env.RADAR_RELIABILITY_ONLY==='soak')return reliabilitySoak({browser,base,output,report});
  assert.ok(['before','after'].includes(phase));assert.equal(process.env.RADAR_SYNTHETIC_AUTH,'1');
  const url=new URL(base);assert.equal(url.hostname,'127.0.0.1');
  const only=process.env.RADAR_RELIABILITY_ONLY;assert.ok(!only||['screens','continuous','summary'].includes(only));
  const folder=resolve(output,phase+(only?'-'+only:'')),build=resolve(process.env.RADAR_BUILD_DIR||'dist');mkdirSync(folder,{recursive:true});
  Object.assign(report,{phase,only:only??null,testSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',cwd:dirname(build)}).trim(),buildServerSha256:createHash('sha256').update(readFileSync(resolve(build,'server/index.js'))).digest('hex'),buildDirectory:build,identity:'Synthetic market fixture on a local production build; no private files, credentials, actual market or model requests',screenshots:[],baselineFailures:[],observations:[],externalRequests:[],conditions:{stamp,watchlist,auto:false,displayTimePreference:'UTC',motion:'reduced except explicit standard-motion check',grid:'native 15m/1H/4H/1Dutc; last confirmation unknown',outbound:'browser external abort and Miniflare outbound denial'},notRun:['physical devices','production authenticated refresh','real source availability','FPS measurement']});
  const check=(name,passed,detail={})=>{report.observations.push({name,passed:!!passed,...detail});if(passed)report.checks.push(name);else if(phase==='before')report.baselineFailures.push({name,...detail});else assert.ok(passed,`${name}: ${JSON.stringify(detail)}`);};
  const runtime=new Miniflare({host:'127.0.0.1',port:Number(url.port),modules:true,scriptPath:resolve(build,'server/index.js'),modulesRoot:resolve(build,'server'),modulesRules:[{type:'ESModule',include:['**/*.js'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{ACCESS_CODE_HASH:createHash('sha256').update('PERFFIXTUREONLY').digest('hex'),ACCESS_SESSION_SECRET:'perf-fixture-only-not-a-production-secret-275'},assets:{directory:resolve(build,'client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},outboundService:()=>new Response('isolated reliability fixture',{status:503})});
  await runtime.ready;
  let current;
  async function capture(app,name,state,width,height) {
    const page=app.page;
    await page.locator(state==='healthy'?'.period-tabs':'.chart-footer').evaluate(el=>{el.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-90,behavior:'instant'});});await settle(page);
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
    if(!only||only==='summary') {
      for(const quoteMode of ['partial','none']) {
        const app=current=await fixtureScenario(browser,fixture,url.origin,{quoteMode}),p=app.page;
        try {
          await open(app,390,844);
          const runtime=await p.locator('.runtime-summary small').innerText(),price=await p.locator('.chart-price strong').innerText();
          if(quoteMode==='partial') {
            check('runtime: a valid BTC price with incomplete quotes reports partial acquisition',/\d/.test(price)&&runtime.includes('部分报价已取得，其他标的待更新')&&!runtime.includes('尚未取得有效报价'),{price,runtime});
            app.state.quoteMode='healthy';app.state.epoch=1000;await manual(app);
            const batch=(await p.locator('.runtime-summary small').innerText()).split(' · ')[0];
            check('runtime: a successful complete batch is labelled as a batch acquisition',batch.startsWith('最近整批报价获取'),{batch});
            app.state.quoteMode='partial';app.state.epoch=2000;await manual(app);
            const later=await p.locator('.runtime-summary small').innerText();
            check('runtime: a later partial failure retains the previous batch time and states pending quotes',later.startsWith(batch)&&later.includes('部分报价待更新'),{batch,later});
          } else check('runtime: no valid quotes still reports waiting',runtime.includes('尚未取得有效报价')&&!/\d/.test(price),{price,runtime});
          check(`runtime ${quoteMode}: no horizontal overflow at 390px`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
          assert.deepEqual(app.errors,[]);assert.deepEqual(app.external,[]);
        } finally {await app.context.close();current=null;}
      }
      if(only==='summary'){report.warnings=observedWarnings;return;}
    }
    if(only==='screens') {
      for(const [name,width,height] of viewports) {
        const app=current=await fixtureScenario(browser,fixture,url.origin),p=app.page;
        try {
          await open(app,width,height);await capture(app,name,'healthy',width,height);
          app.state.epoch=1000;await manual(app);
          app.state.historyFailed=true;app.state.quoteMode='partial';app.state.epoch=2000;await manual(app);
          if(await p.locator('.market-data-status').count())await p.locator('.market-data-status>summary').click({force:true});
          await capture(app,name,'failed-retained',width,height);
          app.state.historyFailed=false;app.state.quoteMode='healthy';app.state.epoch=3000;await manual(app);await capture(app,name,'recovered',width,height);
          assert.deepEqual(app.errors,[]);assert.deepEqual(app.external,[]);report.viewports.push({name,width,height});
        } finally {await app.context.close();current=null;}
      }
      report.warnings=observedWarnings;return;
    }
    if(!only) {
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
      check('month selection uses native 4H metadata',/原生 4H/.test(footer),{footer});
      await chooseRange(p,'15 分钟');await p.locator('.candle-canvas').waitFor();
      await capture(app,'desktop-standard','healthy',1440,1000);
      app.state.tailShift=6*3600000;app.state.epoch=await p.evaluate(()=>Date.now())-stamp;await manual(app);
      check('fresh acquisition with an old native crypto tail is explicitly disclosed',/最新 K 线时间落后/.test(await p.locator('.chart-footer').innerText()),{footer:await p.locator('.chart-footer').innerText(),fetchedAt:stamp+app.state.epoch,lastAt:stamp-900000-app.state.tailShift});
      await capture(app,'desktop-standard','old-tail',1440,1000);
      await p.emulateMedia({reducedMotion:'reduce'});await p.locator('.settings-trigger').click({force:true});await settle(p);await p.locator('input[name="motion-preference"][value="system"]').check({force:true});await p.keyboard.press('Escape');await settle(p);
      check('live reduced-motion preference follows the operating-system setting',await p.evaluate(()=>document.documentElement.dataset.motion)==='reduced');
      assert.deepEqual(app.errors,[]);assert.deepEqual(app.external,[]);report.errors.push(...app.errors);
    } finally {for(const held of app.held)held.release();await app.context.close();current=null;}
    }
    // A separate observation with advancing browser time and genuine timer intervals.
    // It records latency/long tasks, not frame rate or an optimization claim.
    const live=current=await fixtureScenario(browser,fixture,url.origin,{motion:'normal'}),page=live.page;
    try {
      await open(live,1440,1000);
      await page.evaluate(()=>{window.__reliabilityLongTasks=[];if(PerformanceObserver.supportedEntryTypes.includes('longtask'))new PerformanceObserver(list=>window.__reliabilityLongTasks.push(...list.getEntries().map(entry=>({start:entry.startTime,duration:entry.duration})))).observe({type:'longtask'});});
      const initialPrice=await page.locator('.chart-price strong').innerText(),initialTime=await statusValue(page,'走势实际获取'),startCalls=live.calls.length;
      live.state.realtime={start:Date.now(),epoch:await page.evaluate(()=>Date.now())-stamp};
      const started=performance.now(),actions=[];await page.clock.resume();
      await page.getByRole('switch',{name:'自动刷新与提醒',exact:true}).click();
      const action=async(name,execute,feedback)=>{const start=performance.now();await execute();if(feedback)await until(feedback,name+' feedback absent');actions.push({name,elapsedMs:+(performance.now()-start).toFixed(2)});};
      const initialCount=await page.locator('.zoom-tools>span').innerText();
      await action('zoom while automatic refresh runs',async()=>{await page.getByRole('button',{name:'放大 K 线',exact:true}).click();},async()=>await page.locator('.zoom-tools>span').innerText()!==initialCount);
      await sleep(Math.max(1,5100-(performance.now()-started)));
      await action('drag the chart',async()=>{const box=await page.locator('.candle-canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.45);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.45,{steps:8});await page.mouse.up();});
      await sleep(Math.max(1,10100-(performance.now()-started)));
      await action('open related Radar and return',async()=>{await page.locator('.asset-radar-awareness').click();await page.getByRole('button',{name:'返回图表',exact:true}).click();},()=>page.locator('.candle-canvas').isVisible());
      await sleep(Math.max(1,15100-(performance.now()-started)));
      await action('show local event history and return',async()=>{await page.locator('.desktop-nav a[href="#radar"]').click();await page.getByRole('group',{name:'事件视图'}).getByRole('button',{name:/历史事件/}).click();await page.locator('.event-history').waitFor();await page.locator('.desktop-nav a[href="#overview"]').click();},()=>page.locator('.candle-canvas').isVisible());
      const remaining=18500-(performance.now()-started);if(remaining>0)await sleep(remaining);
      await action('keyboard after the 15-second refresh',async()=>{await page.locator('.candle-canvas').focus();await page.keyboard.press('ArrowLeft');},()=>page.locator('.candle-canvas').isVisible());
      const elapsedMs=performance.now()-started,longTasks=await page.evaluate(()=>window.__reliabilityLongTasks),requests=live.calls.slice(startCalls),histories=requests.filter(row=>row.kind==='history'&&row.symbol==='BTC-USDT'),quotes=requests.filter(row=>row.kind==='quotes'&&row.symbols.includes('BTC-USDT'));
      const latestTime=await statusValue(page,'走势实际获取');
      report.continuous={wallElapsedMs:+elapsedMs.toFixed(2),browserClock:'resumed; timers advance normally for this scenario',auto:true,motion:'normal',actions,requests,longTaskCount:longTasks.length,maxLongTaskMs:longTasks.length?Math.max(...longTasks.map(task=>task.duration)):0,longTasks,initialTime,latestTime,historySurface:'local event history, including its truthful empty state',caveat:'One bounded local synthetic observation, not FPS, real-network latency, a benchmark or an optimization claim'};
      check('continuous: at least 18 seconds of advancing time with automatic monitoring enabled',elapsedMs>=18000&&await page.getByRole('switch',{name:'自动刷新与提醒',exact:true}).getAttribute('aria-checked')==='true');
      check('continuous: quote cadence produces repeated newer acquisitions during interactions',quotes.length>=3&&quotes.at(-1).epoch>quotes[0].epoch,{quotes});
      check('continuous: selected history refresh executes after its 15-second interval',histories.some(row=>row.epoch>=live.state.realtime.epoch+14000),{histories});
      check('continuous: valid updates reach the visible quote and history time',initialPrice!==await page.locator('.chart-price strong').innerText()&&initialTime!==null&&initialTime!==latestTime,{initialPrice,latestPrice:await page.locator('.chart-price strong').innerText(),initialTime,latestTime});
      check('continuous: navigation preserves the selected candle period',await page.getByRole('tab',{name:'15 分钟',exact:true}).getAttribute('aria-selected')==='true');
      check('continuous: page has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.deepEqual(live.errors,[]);assert.deepEqual(live.external,[]);report.errors.push(...live.errors);
      await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+100));await capture(live,'desktop-continuous','healthy',1440,1000);
    } finally {await live.context.close();current=null;}
    report.warnings=observedWarnings;
  } catch(cause) {
    report.failure={message:String(cause),stack:cause.stack};
    if(current&&!current.page.isClosed())await current.page.screenshot({path:resolve(folder,'failure.png'),animations:'disabled'}).catch(()=>{});
    throw cause;
  } finally {writeFileSync(resolve(folder,'verification.json'),JSON.stringify(report,null,2));await runtime.dispose();}
}

// Optional wall-clock continuation of this harness. Unlike fixtureScenario, this
// creates a normal local visitor and never installs a clock or visibility override.
async function reliabilitySoak({browser,base,output,report}) {
  assert.equal(process.env.RADAR_SYNTHETIC_AUTH,'1');
  const url=new URL(base);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.protocol,'http:');
  const smoke=process.env.RADAR_SOAK_SMOKE_SECONDS===undefined?0:Number(process.env.RADAR_SOAK_SMOKE_SECONDS);
  assert.ok(smoke===0||Number.isInteger(smoke)&&smoke>=1&&smoke<=20,'Smoke must be 1–20 seconds; omit it for the 30-minute soak');
  const build=resolve(process.env.RADAR_BUILD_DIR||'dist'),folder=resolve(output,smoke?'soak-smoke':'soak');mkdirSync(folder,{recursive:true});
  const interval=900000,scope=['BTC-USDT','ETH-USDT','SOL-USDT'],began=Date.now(),started=performance.now(),hardMs=smoke?20000:32*60000,hardEnd=began+hardMs;
  Object.assign(report,{schema:'market-local-soak-v1',identity:'LOCAL SYNTHETIC SIMULATION; production build, synthetic market and bindings; never production PASS',real:false,fixture:true,smoke:!!smoke,status:'RUNNING',startedAt:new Date(began).toISOString(),absoluteHardEnd:new Date(hardEnd).toISOString(),testSourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),buildDirectory:build,buildServerSha256:createHash('sha256').update(readFileSync(resolve(build,'server/index.js'))).digest('hex'),scope,conditions:{clock:'native Date.now and native timers; no clock or visibility overrides',entry:'/from-aether',auto:true,backgroundTabs:false,motion:'normal',displayTimePreference:'UTC',intervalMs:interval,points:96,stocks:'EXCLUDED before dispatch',outbound:'browser external abort + Miniflare outbound denial'},budget:{nonstatic:650,static:60,bodyBytes:20*1024*1024,staticBytes:10*1024*1024,hardMs},nonstatic:0,static:0,bodyBytes:0,staticBytes:0,excludedStock:0,blocked:[],workerOutbound:0,requests:[],history:[],quotes:[],boundaries:[],samples:[],actions:[],screenshots:[],pageerrors:[],consoleCounts:{},pending:0,maxPending:0,notRun:['production provider or proxy health','physical devices','stocks','FPS or all-day memory stability',...(smoke?['30-minute soak','two natural 15-minute boundaries']:[])]});
  let context,page,cdp,runtime,stopping=false,tearingDown=false,readyAt,readyMono,firstChecked=false,secondChecked=false,historicalAnchor=null,firstBoundary;
  const lastHistory=new Map(),activeRequests=new Map(),inflight=new Set();
  const save=()=>writeFileSync(resolve(folder,'verification.json'),JSON.stringify(report,null,2));
  const scrub=value=>String(value).replace(/https?:\/\/\S+/g,'[url]').slice(0,240);
  const stop=reason=>{if(stopping)return;stopping=true;report.stop=reason;report.status='STOPPED';save();void context?.close().catch(()=>{});};
  const timer=setTimeout(()=>stop('HARD_TIME_LIMIT'),hardMs);
  const withinTime=()=>Date.now()<hardEnd&&performance.now()-started<hardMs;
  const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
  function point(symbol,time,now) {
    // Identity is absolute bar time, never a rolling-window index. Completed
    // bars use the final value forever; the current volume advances smoothly.
    const seed=time/interval,scale={'BTC-USDT':60000,'ETH-USDT':3000,'SOL-USDT':150}[symbol],fraction=Math.min(1,Math.max(0,(now-time)/interval));
    const open=scale*(1+.015*Math.sin(seed/17)),close=open+scale*.001*Math.sin(seed/7)*fraction;
    return {time,open,high:Math.max(open,close)+scale*.0003*fraction,low:Math.min(open,close)-scale*.0003*fraction,close,volume:(100+seed%31)*fraction,confirmed:time+interval<=now};
  }
  function syntheticHistory(symbol,range,now) {
    assert.ok(scope.includes(symbol)&&['15m','1d'].includes(range),'Unexpected synthetic history identity');
    const tail=Math.floor(now/interval)*interval,points=Array.from({length:96},(_,i)=>point(symbol,tail-(95-i)*interval,now));
    return {symbol,range,points,currency:'USDT',source:'OKX 欧易',timezone:'UTC',fetchedAt:now,metadata:{intervalMs:interval,bar:'15m',exchange:'OKX',instrument:symbol,marketType:'spot',volumeUnit:'base',bucketTimezone:'UTC',completion:'source',firstAt:points[0].time,lastAt:tail,lastCompleteAt:tail,invalidRows:0,duplicateRows:0,gapCount:0,path:'candles',limitations:['synthetic_fixture']}};
  }
  function syntheticQuote(symbol,now) {
    const p=point(symbol,Math.floor(now/interval)*interval,now);
    return {symbol,name:symbol,currency:'USDT',source:'OKX 欧易',price:p.close,change:p.close-p.open,changePercent:(p.close/p.open-1)*100,previousClose:p.open,high:p.high,low:p.low,volume:p.volume,timestamp:now,fetchedAt:now,session:'open',delayMinutes:0,points:[]};
  }
  async function safeDOM() {
    return page.evaluate(()=>{
      const c=document.querySelector('.candle-canvas'),times={};document.querySelectorAll('.market-data-status dt').forEach(dt=>{if(dt.nextElementSibling?.tagName==='DD')times[dt.textContent]=dt.nextElementSibling.textContent;});
      const p=JSON.parse(localStorage.getItem('market-radar-preferences-v1')||'{}');
      return {browserNow:Date.now(),visible:document.visibilityState,hidden:document.hidden,symbol:document.querySelector('.selected-title h2')?.textContent,price:document.querySelector('.chart-price strong')?.textContent,readout:document.querySelector('.candle-readout')?.textContent,confirmation:document.querySelector('.candle-confirmation')?.getAttribute('data-candle-confirmation'),runtime:document.querySelector('.runtime-summary')?.textContent,footer:document.querySelector('.chart-footer')?.textContent,times,chart:c?Object.fromEntries(['view-start','view-count','first-time','follow-latest','selected-time','interval-ms','timezone'].map(k=>[k,c.getAttribute('data-'+k)])):null,preferences:{auto:p.auto,backgroundTabs:p.backgroundTabs,motionPreference:p.motionPreference,watchlist:p.watchlist},overflow:document.documentElement.scrollWidth>innerWidth+1};
    });
  }
  const anchor=d=>Number(d.chart['first-time'])+(Number(d.chart['view-start'])%1+Number(d.chart['view-count'])-1)*interval;
  async function snap(label){const path=resolve(folder,label+'.png');await page.screenshot({path});report.screenshots.push({label,path,fixture:true,real:false});}
  function recordMarket(data,row) {
    if(row.path==='/api/history') {
      const p=data.points,m=data.metadata,prior=lastHistory.get(data.symbol);
      assert.ok(data.symbol===row.symbol&&data.range===row.range&&data.currency==='USDT'&&m.intervalMs===interval&&p.length===96&&m.limitations.includes('synthetic_fixture'));
      assert.ok(p.every((x,i)=>[x.time,x.open,x.high,x.low,x.close,x.volume].every(Number.isFinite)&&x.low>0&&x.volume>=0&&x.low<=Math.min(x.open,x.close)&&x.high>=Math.max(x.open,x.close)&&x.time%interval===0&&(!i||x.time-p[i-1].time===interval)&&x.confirmed===(i<95)));
      assert.equal(m.lastCompleteAt,p.at(-1).time);
      if(prior){
        assert.ok(data.fetchedAt>=prior.fetchedAt&&p.at(-1).time>=prior.points.at(-1).time,'History time regressed');
        for(const old of prior.points.filter(x=>x.confirmed)){const current=p.find(x=>x.time===old.time);if(current)assert.deepEqual(current,old,'Completed synthetic candle changed');}
        if(p.at(-1).time>prior.points.at(-1).time){
          const old=p.find(x=>x.time===prior.points.at(-1).time),tail=p.at(-1);
          assert.ok(old?.confirmed===true&&tail.confirmed===false&&tail.time-prior.points.at(-1).time===interval,'Invalid rollover');
          assert.deepEqual(p.slice(0,-1).map(x=>x.time),prior.points.slice(1).map(x=>x.time),'Window did not roll by one candle');
          report.boundaries.push({symbol:data.symbol,boundary:tail.time,seenAt:Date.now(),oldBar:old,newBar:tail,lastCompleteAt:m.lastCompleteAt,fixtureConfirmed:true,exactStep:true});
        }
      }
      report.history.push({at:Date.now(),requestAt:row.at,symbol:data.symbol,range:data.range,fetchedAt:data.fetchedAt,count:p.length,firstAt:p[0].time,lastThree:p.slice(-3),confirmedBarsSha256:digest(p.slice(0,-1)),metadata:m});lastHistory.set(data.symbol,data);
    } else {
      assert.equal(data.results.length,row.symbols.length);
      assert.deepEqual(data.results.map(x=>x.symbol),row.symbols);
      assert.ok(data.results.every(x=>scope.includes(x.symbol)&&x.quote.symbol===x.symbol&&Number.isFinite(x.quote.price)&&x.quote.price>0&&Number.isSafeInteger(x.quote.timestamp)&&x.quote.fetchedAt===data.fetchedAt));
      report.quotes.push({at:Date.now(),requestAt:row.at,results:data.results.map(x=>({symbol:x.symbol,price:x.quote.price,timestamp:x.quote.timestamp,fetchedAt:x.quote.fetchedAt}))});
    }
  }
  async function recordResponse(res,row) {
    row.status=res.status();row.finishedAt=Date.now();row.elapsedMs=row.finishedAt-row.at;
    if(row.status>=300&&row.status<400){row.bytes=0;return;}
    const bytes=await res.body();row.bytes=bytes.length;
    if(row.static)report.staticBytes+=bytes.length;else report.bodyBytes+=bytes.length;
    assert.ok(report.bodyBytes<=report.budget.bodyBytes&&report.staticBytes<=report.budget.staticBytes&&bytes.length<=1024*1024,'Response byte limit');
    if(row.market){assert.equal(row.status,200);recordMarket(JSON.parse(bytes.toString()),row);}
    else assert.ok(row.status<400||row.path==='/api/monitor'&&row.status===401,'Unexpected local HTTP failure');
  }
  try {
    runtime=new Miniflare({host:'127.0.0.1',port:Number(url.port),modules:true,scriptPath:resolve(build,'server/index.js'),modulesRoot:resolve(build,'server'),modulesRules:[{type:'ESModule',include:['**/*.js'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{ACCESS_CODE_HASH:createHash('sha256').update('PERFFIXTUREONLY').digest('hex'),ACCESS_SESSION_SECRET:'perf-fixture-only-not-a-production-secret-275'},assets:{directory:resolve(build,'client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},outboundService:()=>{report.workerOutbound++;stop('WORKER_OUTBOUND_DENIED');return new Response('Synthetic soak: outbound denied',{status:503});}});
    await runtime.ready;
    context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',reducedMotion:'no-preference',serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(10000);
    await context.addInitScript(({scope})=>localStorage.setItem('market-radar-preferences-v1',JSON.stringify({watchlist:scope,alerts:[],auto:true,backgroundTabs:false,marketMode:'classic',motionPreference:'normal',displayTimePreference:'UTC'})),{scope});
    page.on('pageerror',e=>{report.pageerrors.push(scrub(e.message));stop('PAGE_ERROR');});
    page.on('console',m=>{if(['warning','error'].includes(m.type())){const key=m.type()+':'+scrub(m.text());report.consoleCounts[key]=(report.consoleCounts[key]??0)+1;}});
    await context.route('**/*',async route=>{
      try {
        const req=route.request(),u=new URL(req.url()),path=u.pathname;
        if(stopping||!withinTime()){await route.abort();stop('HARD_TIME_LIMIT');return;}
        if(u.origin!==url.origin||req.method()!=='GET'){report.blocked.push({path,method:req.method(),reason:'ORIGIN_OR_WRITE_DENIED'});await route.abort();stop('BROWSER_OUTBOUND_OR_WRITE_DENIED');return;}
        const market=['/api/quotes','/api/history'].includes(path),symbols=(u.searchParams.get('symbols')??u.searchParams.get('symbol')??'').split(',').filter(Boolean);
        if(market&&symbols.some(s=>!scope.includes(s))){report.excludedStock++;await route.abort('blockedbyclient');return;}
        const stat=['script','stylesheet','image','font'].includes(req.resourceType());
        if(stat?report.static>=report.budget.static:report.nonstatic>=report.budget.nonstatic){await route.abort();stop('REQUEST_LIMIT');return;}
        let row=activeRequests.get(req);
        if(!row){if(stat)report.static++;else report.nonstatic++;row={at:Date.now(),path,static:stat,market,...(market?{symbol:u.searchParams.get('symbol'),symbols,range:u.searchParams.get('range'),fixture:true}:{})};report.requests.push(row);activeRequests.set(req,row);}
        if(market){report.pending++;report.maxPending=Math.max(report.maxPending,report.pending);assert.ok(symbols.length>0);const now=Date.now(),data=path==='/api/history'?syntheticHistory(row.symbol,row.range,now):{results:symbols.map(symbol=>({symbol,quote:syntheticQuote(symbol,now)})),fetchedAt:now};await route.fulfill({json:data});}
        else {
          // Follow no redirect in Node. Validate Location before the browser can
          // follow it, so even a redirect cannot escape the loopback boundary.
          const response=await route.fetch({maxRedirects:0,maxRetries:0,timeout:10000}),location=response.headers().location;
          if(location)assert.equal(new URL(location,u).origin,url.origin,'Non-local redirect denied');
          await route.fulfill({response});
        }
      } catch(cause){if(!stopping&&!(tearingDown&&/closed|Target.*closed/i.test(cause.message))){report.error=scrub(cause.message);stop('ROUTE_ERROR');}await route.abort().catch(()=>{});}
    });
    // Playwright routes do not run again on a redirect; count the normal local
    // visitor redirect too, and fail closed on an unexpected destination.
    page.on('request',req=>{if(req.redirectedFrom()&&!activeRequests.has(req)){const u=new URL(req.url());if(u.origin!==url.origin){stop('REDIRECT_ORIGIN_DENIED');return;}const row={at:Date.now(),path:u.pathname,static:false,market:false,redirect:true};report.nonstatic++;report.requests.push(row);activeRequests.set(req,row);if(report.nonstatic>report.budget.nonstatic)stop('REDIRECT_REQUEST_LIMIT');}});
    page.on('response',res=>{const row=activeRequests.get(res.request());if(row){const task=recordResponse(res,row).catch(e=>{if(tearingDown&&/closed|Target.*closed|No resource|No data found/i.test(e.message))row.cancelledAtTeardown=true;else if(!stopping){report.error=scrub(e.message);stop('RESPONSE_CHECK_FAILED');}}).finally(()=>inflight.delete(task));inflight.add(task);}});
    const finish=req=>{const row=activeRequests.get(req);if(row?.market)report.pending--;activeRequests.delete(req);};
    page.on('requestfinished',finish);page.on('requestfailed',req=>{const row=activeRequests.get(req);if(row){row.failure=req.failure()?.errorText;if(tearingDown)row.cancelledAtTeardown=true;else if(!stopping)stop('LOCAL_REQUEST_FAILED');}finish(req);});
    await page.goto(url.origin+'/from-aether',{waitUntil:'domcontentloaded',timeout:15000});await page.locator('.candle-canvas').waitFor();
    await page.getByRole('button',{name:'查看以太坊走势',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.selected-title h2')?.textContent==='ETH'&&document.querySelector('.candle-canvas'));
    await page.locator('.candle-canvas').scrollIntoViewIfNeeded();await page.locator('.candle-canvas').focus();await page.keyboard.press('End');await page.mouse.move(5,5);
    await until(()=>scope.every(symbol=>lastHistory.has(symbol)),'Three crypto histories not ready');
    cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');readyAt=Date.now();readyMono=performance.now();
    firstBoundary=(Math.floor(readyAt/interval)+1)*interval;
    Object.assign(report,{readyAt:new Date(readyAt).toISOString(),selectedAsset:'ETH-USDT',targetMs:smoke?smoke*1000:30*60000,expectedBoundaries:[firstBoundary,firstBoundary+interval]});
    // A near-boundary start may need the normal next 15s refresh after minute 30.
    report.targetEnd=smoke?Math.min(readyAt+smoke*1000,hardEnd-500):Math.max(readyAt+report.targetMs,firstBoundary+interval+30000);
    assert.ok(report.targetEnd<hardEnd,'Startup left insufficient room for the observation');
    await snap('start');let nextSample=Date.now(),nextProgress=Date.now();
    while(!stopping){
      const now=Date.now();if(!withinTime()){stop('HARD_TIME_LIMIT');break;}
      const d=await safeDOM();assert.ok(d.visible==='visible'&&!d.hidden&&!d.overflow&&d.symbol==='ETH'&&d.chart?.['interval-ms']===String(interval),'Foreground/chart identity changed');
      assert.ok(Math.abs(d.browserNow-Date.now())<5000,'Browser clock differs from wall clock');assert.deepEqual(d.preferences,{auto:true,backgroundTabs:false,motionPreference:'normal',watchlist:scope});
      if(now>=nextSample||now>=report.targetEnd){const metrics=(await cdp.send('Performance.getMetrics')).metrics;report.samples.push({at:now,elapsedMs:performance.now()-readyMono,...d,requestCount:report.nonstatic,domCounters:await cdp.send('Memory.getDOMCounters'),metrics:Object.fromEntries(metrics.filter(x=>['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents','JSEventListeners','LayoutCount','RecalcStyleCount','TaskDuration'].includes(x.name)).map(x=>[x.name,x.value]))});nextSample=now+20000;}
      const events=report.boundaries.filter(x=>x.symbol==='ETH-USDT');
      if(!smoke&&!firstChecked&&events.some(x=>x.boundary===firstBoundary)){
        const h=lastHistory.get('ETH-USDT');
        if(h.points.at(-1).time===firstBoundary&&d.chart['selected-time']===String(firstBoundary)&&d.chart['follow-latest']==='true'){
          await snap('first-boundary-following');await page.locator('.candle-canvas').focus();await page.keyboard.press('ArrowLeft');await sleep(150);const previous=await safeDOM();await snap('first-boundary-previous-confirmed');
          firstChecked=previous.chart['selected-time']===String(firstBoundary-interval)&&previous.confirmation==='confirmed';report.actions.push({kind:'first_boundary',at:Date.now(),passed:firstChecked,following:d,previous});assert.ok(firstChecked,'First boundary readout failed');await page.keyboard.press('End');await page.mouse.move(5,5);
        }
      }
      if(!smoke&&!firstChecked&&now>firstBoundary+90000)throw Error('First boundary confirmation/UI timeout');
      if(!smoke&&firstChecked&&!historicalAnchor&&now>firstBoundary+180000){
        await page.locator('.candle-canvas').focus();await page.keyboard.press('+');await page.keyboard.press('Shift+ArrowLeft');await page.keyboard.press('Shift+ArrowLeft');await page.mouse.move(5,5);await sleep(200);
        const held=await safeDOM();assert.equal(held.chart['follow-latest'],'false');historicalAnchor={at:Date.now(),end:anchor(held),count:Number(held.chart['view-count']),dom:held};report.actions.push({kind:'hold_history',...historicalAnchor});await snap('held-before-second-boundary');
      }
      if(historicalAnchor&&!secondChecked&&events.some(x=>x.boundary===firstBoundary+interval)){
        const held=await safeDOM(),h=lastHistory.get('ETH-USDT'),boundary=firstBoundary+interval;
        if(h.points.at(-1).time===boundary&&h.points.at(-2).confirmed===true&&h.metadata.lastCompleteAt===boundary){
          const stable=held.chart['follow-latest']==='false'&&Math.abs(anchor(held)-historicalAnchor.end)<1&&Number(held.chart['view-count'])===historicalAnchor.count;await snap('held-after-second-boundary');
          await page.locator('.candle-canvas').focus();await page.keyboard.press('End');await page.mouse.move(5,5);await sleep(200);const latest=await safeDOM();secondChecked=stable&&latest.chart['follow-latest']==='true'&&Number(latest.chart['selected-time'])===boundary;report.actions.push({kind:'second_boundary_history_anchor',at:Date.now(),passed:secondChecked,held,latest,anchorBefore:historicalAnchor.end,anchorAfter:anchor(held)});assert.ok(secondChecked,'Historical viewport jumped or End failed');
        }
      }
      if(!smoke&&!secondChecked&&now>firstBoundary+interval+90000)throw Error('Second boundary confirmation/UI timeout');
      if(now>=nextProgress){save();console.log(JSON.stringify({simulation:true,smoke:!!smoke,progressMinutes:((now-readyAt)/60000).toFixed(1),requests:report.nonstatic,excludedStock:report.excludedStock,history:report.history.length,quotes:report.quotes.length,firstChecked,secondChecked,pending:report.pending}));nextProgress=now+60000;}
      if(now>=report.targetEnd)break;await sleep(Math.min(1000,Math.max(1,report.targetEnd-now)));
    }
    assert.ok(!stopping,report.stop);report.actualForegroundMs=performance.now()-readyMono;
    const progression=scope.map(symbol=>{const h=report.history.filter(x=>x.symbol===symbol),q=report.quotes.flatMap(x=>x.results.filter(x=>x.symbol===symbol));return {symbol,historyCount:h.length,quoteCount:q.length,historyAdvanced:h.at(-1)?.fetchedAt>h[0]?.fetchedAt,quoteTimestampAdvanced:q.at(-1)?.timestamp>q[0]?.timestamp,quoteFetchedAtAdvanced:q.at(-1)?.fetchedAt>q[0]?.fetchedAt};});
    Object.assign(report,{progression,firstBoundaryUiChecked:firstChecked,secondBoundaryUiChecked:secondChecked});
    if(!smoke){assert.ok(report.actualForegroundMs>=30*60000&&firstChecked&&secondChecked);assert.ok(progression.every(x=>x.historyAdvanced&&x.quoteTimestampAdvanced&&x.quoteFetchedAtAdvanced));assert.ok(report.samples.at(-1).times['走势实际获取']!==report.samples[0].times['走势实际获取'],'Visible history time did not advance');}
    assert.equal(report.workerOutbound,0);assert.deepEqual(report.blocked,[]);assert.deepEqual(report.pageerrors,[]);await snap('end');report.status=smoke?'SMOKE_ONLY_COMPLETED':'LOCAL_SIMULATION_COMPLETED';report.checks.push(smoke?'Local synthetic startup only; 30-minute soak NOT RUN':'Local synthetic foreground >=30min, two natural 15m rollovers, history anchor and End verified');
  } catch(cause){report.error??=scrub(cause.message);stop('OBSERVATION_ERROR');throw cause;}
  finally {clearTimeout(timer);tearingDown=true;report.pendingAtTeardown=report.pending;await context?.close().catch(()=>{});await Promise.allSettled([...inflight]);await runtime?.dispose();report.endedAt=new Date().toISOString();report.elapsedMs=performance.now()-started;save();if(report.status==='STOPPED')process.exitCode=1;console.log(JSON.stringify({simulation:true,smoke:!!smoke,status:report.status,stop:report.stop,error:report.error,elapsedMs:report.elapsedMs,requests:report.nonstatic,static:report.static,workerOutbound:report.workerOutbound,report:resolve(folder,'verification.json')}));}
}
