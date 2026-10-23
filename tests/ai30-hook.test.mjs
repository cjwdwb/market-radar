import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as contracts from '../lib/ai/contracts.ts';
import * as validation from '../lib/ai/validation.ts';
import {fixtureContext} from '../lib/ai/fixture.ts';
import {fixtureProvider} from '../lib/ai/provider.ts';
import {createInterpretationService} from '../lib/ai/service.ts';

// 转译实际Hook，只替换React容器、同源传输与模块到达时机；校验仍使用真实模块。
const source=readFileSync(new URL('../components/radar/use-interpretation.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:false}}).outputText;
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
async function harness(){
 const now=Date.UTC(2026,9,7,12),result=await createInterpretationService(fixtureProvider(0),{now:()=>now}).interpret(fixtureContext('upward','BTC-USDT',now),'hook-test');
 const slots=[],timers=new Set(),calls=[],effects=[];let finishModules,loadingModules=false,cursor=0,dirty=false,selected='BTC-USDT',handler;
 const delayed=new Promise(resolve=>{finishModules=resolve;});
 const react={
  useState(value){const i=cursor++;slots[i]??={value};return[slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}}];},
  useRef(value){const i=cursor++;slots[i]??={current:value};return slots[i];},useCallback:fn=>fn,
  useLayoutEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,j)=>v!==old.deps[j])){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=fn();});}}
 };
 const require=specifier=>{
  if(specifier==='react')return react;
  if(specifier.endsWith('/limits'))return {AI_LIMITS:contracts.AI_LIMITS};
  if(specifier.endsWith('/contracts'))return contracts;
  if(specifier.endsWith('/validation')){loadingModules=true;return delayed.then(()=>validation);}
  throw new Error(`unexpected module ${specifier}`);
 };
 const hookModule={exports:{}};
 const reply=(_url,options={})=>Response.json(options.method==='POST'?result:{mode:'fixture'});
 new Function('require','module','exports','fetch','setTimeout','clearTimeout',compiled)(require,hookModule,hookModule.exports,
  async(url,options={})=>{calls.push({url,options});return handler?handler(url,options,reply):reply(url,options);},
  fn=>{timers.add(fn);return fn;},fn=>timers.delete(fn));
 const render=(symbol=selected)=>{selected=symbol;let controller;do{dirty=false;cursor=0;controller=hookModule.exports.useInterpretation(symbol);while(effects.length)effects.shift()();}while(dirty);return controller;};
 return {get controller(){return render();},render,calls,setHandler(fn){handler=fn;},finishModules,loading:()=>loadingModules,deadline(){for(const fn of [...timers])fn();},timers};
}

test('3.0A actual Hook timeout releases loading before delayed validation modules, rejects late success and allows retry',async()=>{
 const h=await harness(),first=h.controller.generate();await tick();assert.equal(h.loading(),true);assert.equal(h.controller.phase,'loading');
 h.deadline();await first;assert.equal(h.controller.phase,'error');assert.equal(h.controller.error,'timeout');assert.equal(h.controller.result,null);assert.equal(h.timers.size,0);
 h.finishModules();await tick();assert.equal(h.controller.phase,'error');assert.equal(h.controller.result,null);
 await h.controller.generate();assert.equal(h.controller.phase,'ready');assert.equal(h.controller.result.context.asset.symbol,'BTC-USDT');
});

test('3.0A actual Hook cancellation while modules load completes immediately and rejects late success',async()=>{
 const h=await harness(),pending=h.controller.generate();await tick();assert.equal(h.loading(),true);
 h.controller.cancel();await pending;assert.equal(h.controller.phase,'cancelled');assert.equal(h.controller.error,'cancelled');assert.equal(h.controller.result,null);assert.equal(h.timers.size,0);
 h.finishModules();await tick();assert.equal(h.controller.phase,'cancelled');assert.equal(h.controller.result,null);
});

test('explicit capability discovery deduplicates pending and known GETs without generation or symbol resets',async()=>{
 const h=await harness();let release;
 h.setHandler(()=>new Promise(resolve=>{release=resolve;}));
 assert.equal(h.controller.mode,'unknown');assert.equal(h.calls.length,0);
 const pending=h.controller.discover();assert.equal(h.controller.discovering,true);assert.equal(h.controller.phase,'loading');
 await h.controller.discover();assert.equal(h.calls.length,1);
 release(Response.json({mode:'fixture'}));await pending;
 assert.equal(h.controller.mode,'fixture');assert.equal(h.controller.phase,'idle');assert.equal(h.controller.discovering,false);assert.equal(h.controller.result,null);
 await h.controller.discover();h.render('ETH-USDT');await h.controller.discover();
 assert.equal(h.controller.mode,'fixture');assert.equal(h.controller.symbol,'ETH-USDT');assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].url,'/api/interpretation');assert.equal(h.calls[0].options.method,undefined);assert.equal(h.calls[0].options.cache,'no-store');assert.equal(h.calls[0].options.body,undefined);assert.equal(h.timers.size,0);
});

test('failed capability discovery remains retryable and unknown modes fail closed without POST',async()=>{
 const h=await harness();h.setHandler(()=>{throw Error('offline');});
 await h.controller.discover();assert.equal(h.controller.mode,'unknown');assert.equal(h.controller.phase,'error');assert.equal(h.controller.error,'network_error');assert.equal(h.controller.discovering,false);
 for(const mode of ['future-provider',null,undefined]){
  h.setHandler(()=>Response.json({mode}));await h.controller.discover();
  assert.equal(h.controller.mode,'unknown');assert.equal(h.controller.error,'invalid_output');assert.equal(h.controller.result,null);assert.equal(h.controller.discovering,false);
 }
 h.setHandler(()=>Response.json({mode:'unconfigured'}));await h.controller.discover();
 assert.equal(h.controller.mode,'unconfigured');assert.equal(h.controller.phase,'idle');assert.equal(h.controller.error,'');
 const count=h.calls.length;await h.controller.discover();assert.equal(h.calls.length,count);assert.equal(h.calls.some(c=>c.options.method==='POST'),false);assert.equal(h.timers.size,0);
});

test('manual generation rechecks capability after discovery and cannot dispatch a revoked fixture mode',async()=>{
 const h=await harness();await h.controller.discover();assert.equal(h.calls.length,1);
 h.setHandler(()=>Response.json({mode:'unconfigured'}));await h.controller.generate();
 assert.equal(h.calls.length,2);assert.equal(h.calls.some(c=>c.options.method==='POST'),false);assert.equal(h.controller.error,'provider_not_configured');assert.equal(h.controller.result,null);
 h.setHandler((_url,options,reply)=>reply(_url,options));h.finishModules();await h.controller.generate('upward');
 assert.deepEqual(h.calls.slice(2).map(c=>c.options.method??'GET'),['GET','POST']);assert.deepEqual(JSON.parse(h.calls.at(-1).options.body),{symbol:'BTC-USDT',scenario:'upward'});
 assert.equal(h.controller.phase,'ready');assert.equal(h.controller.result.context.asset.symbol,'BTC-USDT');
});

test('cancelled discovery rejects its late capability response, shares the flight guard, and permits retry',async()=>{
 const h=await harness();let release;
 h.setHandler(()=>new Promise(resolve=>{release=resolve;}));
 const pending=h.controller.discover();await h.controller.generate();assert.equal(h.calls.length,1);
 h.controller.cancel();await pending;
 assert.equal(h.controller.phase,'cancelled');assert.equal(h.controller.error,'cancelled');assert.equal(h.controller.mode,'unknown');assert.equal(h.timers.size,0);
 release(Response.json({mode:'fixture'}));await tick();assert.equal(h.controller.mode,'unknown');assert.equal(h.controller.result,null);
 h.setHandler(()=>Response.json({mode:'fixture'}));await h.controller.discover();
 assert.equal(h.controller.mode,'fixture');assert.equal(h.controller.phase,'idle');assert.equal(h.controller.discovering,false);
 assert.equal(h.calls.length,2);assert.equal(h.calls.some(c=>c.options.method==='POST'),false);
});

test('private capability discovery exposes a blocked reason without sessions, snapshots or generation',async()=>{
 for(const reason of ['data_permission_unavailable','unexpected-service-detail']){
  const h=await harness();h.setHandler(()=>Response.json({mode:'private_real',admission:'blocked',reason}));
  await h.controller.discover();assert.equal(h.controller.mode,'private_real');assert.equal(h.controller.gate,'blocked');assert.equal(h.controller.error,'data_permission_unavailable');
  assert.equal(h.controller.phase,'idle');assert.equal(h.controller.connected,false);assert.equal(h.controller.result,null);
  await h.controller.discover();assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.method,undefined);
 }
});
