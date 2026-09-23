// Isolated correctness supplement: deliberately delayed/rejected File.text, NOT performance evidence.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,fixture,archive,pause} from './fixture.mjs';
const label=process.argv[2]||'candidate',out=`outputs/perf275/${label}`,base=process.env.RADAR_PERF_URL||'http://127.0.0.1:5290';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true}),app=await fixture(browser,base,{intro:false,probe:false}),p=app.page,report={identity:'fixture correctness only; File.text fault injection',checks:[],errors:app.errors};const deadline=setTimeout(()=>void browser.close(),120000);
try{
 await p.addInitScript(()=>{const original=File.prototype.text;File.prototype.text=async function(){if(this.name==='reject.json')throw Error('Fixture read failure');if(this.name.startsWith('slow'))await new Promise(r=>setTimeout(r,1000));return original.call(this);};});
 await p.goto(base+'/#radar',{waitUntil:'networkidle'});const panel=p.locator('.macro-timeline'),input=panel.locator('input[type=file]');await panel.locator(':scope > summary').click();
 const a=await archive(200,true,'Accepted'),b=await archive(7,false,'Replacement');await input.setInputFiles(a.file);await panel.locator('.macro-view').waitFor();await panel.getByRole('button',{name:'下一页',exact:true}).click();
 const snapshot=()=>panel.evaluate(el=>({id:el.querySelector('.macro-view')?.getAttribute('data-view-id'),status:el.querySelector('.macro-view [role=status]')?.textContent,dates:[...el.querySelectorAll('input[type=date]')].map(e=>e.value),links:[...el.querySelectorAll('.macro-records a')].map(e=>e.getAttribute('href'))}));
 const accepted=await snapshot();
 for(const file of [{name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')},{name:'oversize.json',mimeType:'application/json',buffer:Buffer.alloc(1048577)},{...a.file,name:'reject.json'}]){
  await input.setInputFiles(file);await panel.locator('[role=alert]').waitFor();assert.deepEqual(await snapshot(),accepted);report.checks.push(`${file.name}: accepted dataset, dates, page, links preserved with error`);
 }
 await input.setInputFiles([]);assert.deepEqual(await snapshot(),accepted);report.checks.push('empty selection preserves current dataset');
 await input.setInputFiles({...a.file,name:'slow-A.json'});await panel.getByText('正在检查归档…',{exact:true}).waitFor();assert.deepEqual(await snapshot(),accepted);
 await input.setInputFiles(b.file);await p.waitForFunction(id=>document.querySelector('.macro-view')?.getAttribute('data-view-id')===id,b.view.viewId);await pause(1100);assert.equal((await snapshot()).id,b.view.viewId);assert.match((await snapshot()).status,/第 1\/2 页/);report.checks.push('slow A superseded by B: only B commits; valid replacement resets page');
 await input.setInputFiles({...a.file,name:'slow-C.json'});await input.setInputFiles({name:'invalid-newest.json',mimeType:'application/json',buffer:Buffer.from('{}')});await panel.locator('[role=alert]').waitFor();await pause(1100);assert.equal((await snapshot()).id,b.view.viewId);report.checks.push('newer invalid operation blocks late valid completion, keeps last accepted B');
 assert.deepEqual(app.errors,[]);report.apiRequests=app.requests;await p.screenshot({path:`${out}/import-race.png`});
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;}finally{clearTimeout(deadline);await app.context.close();await browser.close();fs.writeFileSync(`${out}/import-check.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
