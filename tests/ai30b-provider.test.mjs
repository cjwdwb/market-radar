import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ProductBudget } from '../lib/ai/product-budget.mjs';
import { REAL_AI, SYNTHETIC_PILOT_ID } from '../lib/ai/real-config.ts';
import { fixtureContext } from '../lib/ai/fixture.ts';
import { projectProviderContext } from '../lib/ai/context.ts';
import { synthesisCatalog, validateSynthesis, SYNTHESIS_JSON_SCHEMA } from '../lib/ai/real-output.ts';
import { createOpenAIProvider, buildResponsesRequest, parseResponses } from '../lib/ai/openai-provider.ts';
import { createRealPilotService } from '../lib/ai/real-service.ts';
const NOW=Date.UTC(2026,9,8,12), context=(s='upward',symbol='BTC-USDT')=>fixtureContext(s,symbol,NOW), safe=c=>projectProviderContext(c);
function selected(c){const catalog=synthesisCatalog(c),summary=[catalog.find(s=>s.evidenceRefs.length===2&&s.evidenceRefs.includes('medium.direction'))??catalog.find(s=>s.evidenceRefs.includes('short.direction'))??catalog[0]];
 return {summary,primaryEvidenceRefs:summary[0].evidenceRefs,conflictRefs:c.evidence.filter(e=>e.kind==='alignment'&&e.availability==='available'&&e.classification==='mixed').map(e=>e.id),limitationRefs:c.evidence.filter(e=>e.availability!=='available').map(e=>e.id)};
}
function response(json=JSON.stringify(selected(safe(context()))),changes={}){return {id:'resp_unit_test',model:'gpt-6-luna',service_tier:'default',status:'completed',output:[{type:'reasoning'},{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:json}]}],usage:{input_tokens:1500,output_tokens:300,total_tokens:1800,input_tokens_details:{cached_tokens:0},output_tokens_details:{reasoning_tokens:0}},...changes};}
const ledger=()=>{const path=join(mkdtempSync(join(tmpdir(),'mr-ai-budget-')),'budget.sqlite');return {path,budget:new ProductBudget(path,{initialize:true})};};

for(const [scenario,symbol] of [['upward','BTC-USDT'],['mixed','BTC-USDT'],['relative_unavailable','ETH-USDT'],['rms_lower','BTC-USDT'],['transition_available','BTC-USDT'],['no_signals','BTC-USDT'],['information_absent','BTC-USDT'],['stale','BTC-USDT'],['partial','NVDA'],['minute_unavailable','BTC-USDT']])test(`3.0B v2 fixed contract: ${scenario}`,()=>{
 const c=safe(context(scenario,symbol)),before=JSON.stringify(c),output=selected(c);assert.deepEqual(validateSynthesis(JSON.stringify(output),c),output);assert.equal(JSON.stringify(c),before);
});
test('3.0B fixed Luna Standard/none request and complete schema/input cost',()=>{
 const request=buildResponsesRequest(safe(context())),body=JSON.parse(request.body);
 assert.equal(body.model,'gpt-6-luna');assert.equal(body.service_tier,'default');assert.deepEqual(body.reasoning,{effort:'none'});assert.equal(body.store,false);assert.equal(body.stream,false);assert.equal(body.max_output_tokens,2048);
 for(const key of ['tools','background','conversation','previous_response_id','temperature'])assert.equal(key in body,false);
 assert.equal(body.text.format.strict,true);assert.deepEqual(body.text.format.schema,SYNTHESIS_JSON_SCHEMA);
 assert.equal(request.maximumInputTokens,Buffer.byteLength(request.body)+2048);assert.equal(request.maximumBaseNano,request.maximumInputTokens*125+2048*500);
 assert.ok(request.maximumInputTokens<=REAL_AI.inputBytes+2048);
});
test('3.0B bounded synthesis rejects extra prose, false numeric values, references and omitted conflicts/limits',()=>{
 const c=safe(context('mixed')),output=selected(c);
 for(const text of ['因为新闻利好，预计上涨','低波动代表低风险','上涨70%','窗口偏上；未见异常所以市场平静'])assert.throws(()=>validateSynthesis(JSON.stringify({...output,summary:[{...output.summary[0],text}]}),c),/unsupported_claim/);
 assert.throws(()=>validateSynthesis(JSON.stringify({...output,summary:[{...output.summary[0],evidenceRefs:['quote']}]}),c),/unsupported_claim/);
 assert.throws(()=>validateSynthesis(JSON.stringify({...output,limitationRefs:[]}),c),/missing_limitation/);
 if(output.conflictRefs.length)assert.throws(()=>validateSynthesis(JSON.stringify({...output,conflictRefs:[]}),c),/missing_conflict/);
 assert.throws(()=>validateSynthesis(JSON.stringify({...output,summary:[synthesisCatalog(c)[0]],primaryEvidenceRefs:['quote']}),c),/missing_conflict/);
 assert.throws(()=>validateSynthesis(JSON.stringify({...output,probability:.7}),c),/invalid_output/);
});
test('3.0B parses all output items, refusal, incomplete, missing/invalid usage, model mismatch and duplicate text',()=>{
 assert.equal(parseResponses(response()).status,'completed');
 assert.equal(parseResponses(response('',{status:'incomplete',incomplete_details:{reason:'max_output_tokens'}})).status,'incomplete');
 assert.equal(parseResponses(response('',{output:[{type:'message',role:'assistant',status:'completed',content:[{type:'refusal',refusal:'test'}]}]})).status,'refusal');
 for(const usage of [undefined,{}, {input_tokens:-1,output_tokens:2},{input_tokens:1,output_tokens:2,total_tokens:4},{input_tokens:1,output_tokens:2,input_tokens_details:{cached_tokens:2}}])assert.equal(parseResponses(response('',{usage})).usage,null);
 assert.equal(parseResponses(response('',{model:'gpt-6-astra'})).status,'model_mismatch');
 const two=response();two.output.push(two.output[1]);assert.equal(parseResponses(two).status,'invalid_response');
 assert.equal(parseResponses(response('',{output:[]})).status,'invalid_response');
 assert.equal(parseResponses(response('',{output:[{type:'function_call'}]})).status,'invalid_response');
});
test('3.0B HTTP failures and response bounds never expose headers/body or retry',async()=>{
 for(const status of [401,403,429,500]){let calls=0;const provider=createOpenAIProvider('synthetic-unit-secret',async(url,opts)=>{calls++;assert.equal(url,REAL_AI.endpoint);assert.equal(opts.redirect,'error');return new Response('synthetic-unit-secret reflected data',{status});});
  await assert.rejects(provider.generate('{}',new AbortController().signal),e=>!e.message.includes('secret')&&e.code.startsWith('provider_')||e.code==='rate_limited');assert.equal(calls,1);}
 const p=createOpenAIProvider('unit-only',async()=>new Response('x'.repeat(REAL_AI.responseBytes+1)));await assert.rejects(p.generate('{}',new AbortController().signal),/response_limit/);
 const malformed=createOpenAIProvider('unit-only',async()=>new Response('{'));await assert.rejects(malformed.generate('{}',new AbortController().signal),/invalid_response/);
});
test('3.0B missing/corrupt/deleted ledger fails closed and cannot be silently reinitialized',()=>{
 const dir=mkdtempSync(join(tmpdir(),'mr-ai-missing-')),path=join(dir,'x.sqlite');assert.throws(()=>new ProductBudget(path),/budget_unavailable/);
 const a=new ProductBudget(path,{initialize:true});a.reserve({now:NOW,pilot:SYNTHETIC_PILOT_ID,maximumNano:10000});a.close();
 unlinkSync(path);assert.throws(()=>new ProductBudget(path,{initialize:true}),/budget_unavailable/);
 writeFileSync(path,'corrupt');assert.throws(()=>new ProductBudget(path,{initialize:true}),/budget_unavailable|file is not a database/);
});
test('3.0B atomic reservation survives process restart, global concurrency and UTC month/pilot caps',()=>{
 const {path,budget}=ledger();const r=budget.reserve({now:NOW,pilot:SYNTHETIC_PILOT_ID,maximumNano:15000000});assert.throws(()=>budget.reserve({now:NOW,pilot:'other-task',maximumNano:1}),/busy/);budget.close();
 const script=`import {ProductBudget} from './lib/ai/product-budget.mjs';const b=new ProductBudget(${JSON.stringify(path)});console.log(JSON.stringify(b.inspect(${NOW},${JSON.stringify(SYNTHETIC_PILOT_ID)})));b.close();`;
 const child=spawnSync(process.execPath,['--experimental-strip-types','--import',pathToFileURL(resolve('tests/register-types.mjs')).href,'--input-type=module','-e',script],{cwd:process.cwd(),encoding:'utf8',windowsHide:true});assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).monthly.reserved,15000000);
 const reopened=new ProductBudget(path);reopened.unknown(r.id,NOW,'timeout');assert.equal(reopened.inspect(NOW,SYNTHETIC_PILOT_ID).monthly.reserved,15000000);
 for(let i=1;i<16;i++){const v=reopened.reserve({now:NOW,pilot:SYNTHETIC_PILOT_ID,maximumNano:15000000});reopened.unknown(v.id,NOW,'timeout');}
 assert.throws(()=>reopened.reserve({now:NOW,pilot:SYNTHETIC_PILOT_ID,maximumNano:15000000}),/budget_exhausted/);
 assert.equal(reopened.inspect(Date.UTC(2026,10,1),SYNTHETIC_PILOT_ID).monthly.occupied,0);assert.throws(()=>reopened.reserve({now:Date.UTC(2026,10,1),pilot:SYNTHETIC_PILOT_ID,maximumNano:15000000}),/budget_exhausted/);reopened.close();
});
test('3.0B pilot request cap and monthly project cap cannot reset through task/symbol/env',()=>{
 const {budget}=ledger();for(let i=0;i<20;i++){const r=budget.reserve({now:NOW,pilot:SYNTHETIC_PILOT_ID,maximumNano:100});budget.unknown(r.id,NOW);}assert.throws(()=>budget.reserve({now:NOW,pilot:SYNTHETIC_PILOT_ID,maximumNano:100}),/budget_exhausted/);
 // 不同任务仍进入同一月账本，最多$7派发；保留$1不作可消费金额。
 for(let i=0;i<27;i++){const r=budget.reserve({now:NOW,pilot:`batch-${i}`,maximumNano:250000000});budget.unknown(r.id,NOW);}
 assert.throws(()=>{const r=budget.reserve({now:NOW,pilot:'last-batch',maximumNano:250000000});budget.unknown(r.id,NOW);},/budget_exhausted/);budget.close();
});
test('3.0B usage settlement is idempotent; failure costs count; unknown reservation not refunded',()=>{
 const {budget}=ledger(),r=budget.reserve({now:NOW,pilot:SYNTHETIC_PILOT_ID,maximumNano:10000}),entry={now:NOW,usageCostNano:2000,usage:{inputTokens:1,outputTokens:2},outcome:'validation_failed'};
 assert.equal(budget.settle(r.id,entry),4000);assert.equal(budget.settle(r.id,entry),4000);assert.throws(()=>budget.settle(r.id,{...entry,usageCostNano:3000}),/settlement_conflict/);budget.unknown(r.id,NOW);assert.equal(budget.inspect(NOW,SYNTHETIC_PILOT_ID).monthly.occupied,4000);budget.close();
});
test('3.0B validated real identity, cache and concurrent subscribers retain one charge',async()=>{
 const {budget}=ledger();let calls=0;let release;const wait=new Promise(r=>release=r);const provider={generate:async()=>{calls++;await wait;return parseResponses(response());}};
 const service=createRealPilotService(provider,budget,{now:()=>NOW}),c=context(),a=new AbortController(),b=new AbortController();const first=service.interpret(c,a.signal),second=service.interpret(c,b.signal);a.abort();await assert.rejects(first,/cancelled/);release();const result=await second;assert.equal(calls,1);assert.equal(result.provider,'openai');assert.equal(result.inputIdentity,'synthetic');assert.equal(result.usageIdentity,'provider_reported');assert.equal(result.billedCost,null);
 const cached=await service.interpret(c);assert.equal(cached.cacheHit,true);assert.equal(cached.generatedAt,result.generatedAt);assert.equal(budget.inspect(NOW,SYNTHETIC_PILOT_ID).pilot.calls,1);service.stop();budget.close();
});
test('3.0B timeout retains unknown cost and stops cache/new dispatch',async()=>{
 const {budget}=ledger();const provider={generate:async()=>new Promise(()=>{})};const service=createRealPilotService(provider,budget,{now:()=>NOW,timeoutMs:5});await assert.rejects(service.interpret(context()),/timeout/);const view=budget.inspect(NOW,SYNTHETIC_PILOT_ID);assert.ok(view.monthly.reserved>0);assert.equal(view.monthly.settled,0);service.stop();await assert.rejects(service.interpret(context()),/disabled/);budget.close();
});
test('3.0B last subscriber cancels shared task but keeps unknown reservation',async()=>{
 const {budget}=ledger();let aborted=0;const provider={generate:async(body,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted++;reject(new Error('transport ended'));},{once:true}))};
 const service=createRealPilotService(provider,budget,{now:()=>NOW}),a=new AbortController(),b=new AbortController();const first=service.interpret(context(),a.signal),second=service.interpret(context(),b.signal);await Promise.resolve();a.abort();await assert.rejects(first,/cancelled/);assert.equal(aborted,0);b.abort();await assert.rejects(second,/cancelled/);await new Promise(r=>setTimeout(r,1));assert.equal(aborted,1);assert.ok(budget.inspect(NOW,SYNTHETIC_PILOT_ID).monthly.reserved>0);assert.equal(service.inspect().active,0);service.stop();budget.close();
});
test('3.0B versioned synthesis keeps v1 unit and asset checks',()=>{
 const c=safe(context()),output=selected(c),wrong=structuredClone(c);wrong.evidence.find(e=>e.id==='short.direction').metrics[0].unit='USD';assert.throws(()=>validateSynthesis(JSON.stringify(output),wrong),/unsupported_claim/);
 const asset=structuredClone(c);asset.evidence[0].symbol='ETH-USDT';assert.throws(()=>validateSynthesis(JSON.stringify(output),asset),/evidence_mismatch/);
});
test('3.0B successful HTTP with invalid output/unknown usage never returns trusted interpretation',async()=>{
 for(const reply of [parseResponses(response('bad-json')),parseResponses(response('',{usage:null})),parseResponses(response('',{status:'incomplete'}))]){
  const {budget}=ledger();const s=createRealPilotService({generate:async()=>reply},budget,{now:()=>NOW});await assert.rejects(s.interpret(context()));const v=budget.inspect(NOW,SYNTHETIC_PILOT_ID);assert.ok(v.monthly.occupied>0);assert.equal(s.inspect().cache,0);s.stop();budget.close();
 }
});
test('3.0B unknown returned model or processing tier cannot settle at Luna price or release reserve',async()=>{
 for(const changes of [{model:'gpt-6-astra'},{service_tier:'priority'},{service_tier:undefined}]){
  const {budget}=ledger();const s=createRealPilotService({generate:async()=>parseResponses(response('',changes))},budget,{now:()=>NOW});await assert.rejects(s.interpret(context()),/model_mismatch|billing_identity_unknown/);const v=budget.inspect(NOW,SYNTHETIC_PILOT_ID);assert.ok(v.monthly.reserved>0);assert.equal(v.monthly.settled,0);assert.equal(s.inspect().cache,0);s.stop();budget.close();
 }
});
test('3.0B real market/client forged fixture admission and stale contexts do not dispatch',async()=>{
 const {budget}=ledger();let calls=0;const s=createRealPilotService({generate:async()=>{calls++;return parseResponses(response());}},budget,{now:()=>NOW});
 for(const c of [{...context(),trust:'controlled'},{...context(),trust:'client_declared'},context('stale'),{...context(),capturedAt:NOW-60000}])await assert.rejects(s.interpret(c));assert.equal(calls,0);assert.equal(budget.inspect(NOW,SYNTHETIC_PILOT_ID).pilot.calls,0);s.stop();budget.close();
});
