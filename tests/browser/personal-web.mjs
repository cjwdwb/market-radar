import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { personalHistoryFixture } from '../fixtures/personal-history.mjs';

export async function personalWebChecks({browser,fixture,base,output,report,legacyHistoryChecks}) {
 const url=new URL(base);if(url.hostname!=='127.0.0.1'||process.env.RADAR_SYNTHETIC_AUTH!=='1')throw Error('loopback synthetic auth required');
 const runtime=new Miniflare({host:'127.0.0.1',port:Number(url.port),modules:true,scriptPath:resolve('dist/server/index.js'),modulesRoot:resolve('dist/server'),modulesRules:[{type:'ESModule',include:['**/*.js'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  bindings:{ACCESS_CODE_HASH:createHash('sha256').update('PERFFIXTUREONLY').digest('hex'),ACCESS_SESSION_SECRET:'perf-fixture-only-not-a-production-secret-275'},
  assets:{directory:resolve('dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},outboundService:()=>new Response('isolated test',{status:503})});
 await runtime.ready;report.identity='synthetic browser file fixtures; local production build; no real model';report.modelRequests=0;
 try{
 for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740],['landscape',844,390]]){
  const app=await fixture(browser,{os:name==='narrow'?'reduce':'no-preference'}),p=app.page,posts=[],external=[];
  p.on('request',r=>{if(r.method()!=='GET')posts.push(r.url());});
  await p.route('**/*',r=>{if(new URL(r.request().url()).origin!==url.origin){external.push(r.request().url());return r.abort();}return r.fallback();});
  try{
   await p.setViewportSize({width,height});await p.goto(base+'/#price-chart',{waitUntil:'networkidle'});await p.getByRole('tab',{name:'1 周',exact:true}).click();const symbol=await p.locator('.selected-title h2').innerText();
   await p.evaluate(()=>{location.hash='radar';});await p.locator('.history-workspace>summary').click();await p.getByRole('group',{name:'历史工作区导航'}).getByRole('button',{name:'已保存解释',exact:true}).click();const panel=p.locator('#personal-history-ai'),input=panel.getByLabel('选择解释文件'),result=panel.getByRole('region',{name:'个人历史解释结果'});
   const dto=personalHistoryFixture(),file=value=>({name:'synthetic-personal.json',mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});
   await input.setInputFiles(file(dto));await result.waitFor();assert.match(await result.innerText(),/未向服务端验证/);assert.equal(await panel.locator('details[open]').count(),0);
   await result.evaluate(e=>{e.scrollIntoView({block:'start',behavior:'instant'});window.scrollBy({top:-90,behavior:'instant'});});await p.screenshot({path:`${output}/personal-web-${name}.png`});
   await result.getByRole('button',{name:/查看依据 ·/}).first().click();await result.getByRole('button',{name:'查看短窗方向结构依据',exact:true}).first().focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.activeElement.id.endsWith('-evidence-short.direction'));assert.match(await p.evaluate(()=>document.activeElement.id),/personal-.*-evidence-short.direction/);
   await panel.getByText('同一快照：程序摘要与模型选择',{exact:true}).click();assert.equal(await panel.getByRole('region',{name:'B 模型选择'}).count(),1);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await input.setInputFiles(file('{invalid'));await panel.getByRole('status').waitFor();assert.match(await panel.getByRole('status').innerText(),/上次读取/);assert.equal(await result.count(),1);
   await input.setInputFiles(file(' '.repeat(65537)));await p.waitForFunction(()=>document.querySelector('#personal-history-ai')?.textContent.includes('64KiB'));
   await input.setInputFiles(file(dto));await panel.getByRole('link',{name:'返回实时图表'}).click();assert.equal(await p.locator('.selected-title h2').innerText(),symbol);assert.equal(await p.getByRole('tab',{name:'1 周',exact:true}).getAttribute('aria-selected'),'true');
   await p.evaluate(()=>{location.hash='radar';});await panel.scrollIntoViewIfNeeded();
   if(name==='desktop'){
    const xss=structuredClone(dto);xss.modelSelection.sentences[0].text='<img src=https://example.com/private onerror=alert(1)>';
    await input.setInputFiles(file(xss));await p.waitForFunction(()=>document.querySelector('#personal-history-ai')?.textContent.includes('<img src='));assert.equal(await result.locator('img').count(),0);
    await p.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){await new Promise(r=>setTimeout(r,200));return original.call(this);};});
    await input.setInputFiles(file(dto));await panel.getByRole('button',{name:'取消读取'}).click();await p.waitForTimeout(250);assert.match(await panel.getByRole('status').innerText(),/取消/);assert.match(await result.innerText(),/<img src=/);
    const newer=personalHistoryFixture(1789371900000);await input.setInputFiles(file(dto));await input.setInputFiles(file(newer));await p.waitForTimeout(300);assert.match(await result.innerText(),/2026-09-14 07:45:00 UTC/);
    const expired=personalHistoryFixture(1785000000000);await input.setInputFiles(file(expired));await p.waitForTimeout(300);assert.equal(await result.count(),0);assert.match(await panel.getByRole('status').innerText(),/复核/);
   }
   await input.setInputFiles(file(dto));await result.waitFor();await panel.getByRole('button',{name:'清除本页记录'}).click();assert.equal(await result.count(),0);
   await input.setInputFiles(file(dto));await result.waitFor();assert.equal(await p.evaluate(id=>Object.values(localStorage).some(v=>v.includes(id))||Object.values(sessionStorage).some(v=>v.includes(id)),dto.catalogId),false);
   await p.reload({waitUntil:'networkidle'});await p.locator('.history-workspace>summary').click();await p.getByRole('group',{name:'历史工作区导航'}).getByRole('button',{name:'已保存解释',exact:true}).click();assert.equal(await result.count(),0);assert.deepEqual(posts,[]);assert.deepEqual(external,[]);assert.deepEqual(app.errors,[]);
   report.viewports.push({name,width,height});report.checks.push(`${name}: local file, unverified provenance label, evidence keyboard, A/B/C, bad/oversize rejection, old result label, clear/reload privacy, no POST/external traffic, same asset/week return`);
  }finally{await app.context.close();}
 }
 if(process.env.RADAR_PERSONAL_FILE_PATH){
  const bytes=readFileSync(process.env.RADAR_PERSONAL_FILE_PATH);assert.ok(bytes.length<=65536);const app=await fixture(browser),p=app.page,posts=[];p.on('request',r=>{if(r.method()!=='GET')posts.push(r.url());});
  try{await p.goto(base+'/#radar',{waitUntil:'networkidle'});await p.locator('.history-workspace>summary').click();await p.getByRole('group',{name:'历史工作区导航'}).getByRole('button',{name:'已保存解释',exact:true}).click();const panel=p.locator('#personal-history-ai');await panel.getByLabel('选择解释文件').setInputFiles({name:'personal.json',mimeType:'application/json',buffer:bytes});await panel.getByRole('region',{name:'个人历史解释结果'}).waitFor();assert.match(await panel.innerText(),/2026-10-22 00:00:00 UTC/);assert.deepEqual(posts,[]);assert.deepEqual(app.errors,[]);report.privateLocalCapture='PASS: existing real saved BTC interpretation imported locally; no upload/model call; not CI fixture';}finally{await app.context.close();}
 }
 await legacyHistoryChecks();
 }finally{await runtime.dispose();}
}
