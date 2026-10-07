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
 const states=[],timers=new Set();let finishModules,loadingModules=false;
 const delayed=new Promise(resolve=>{finishModules=resolve;});
 const react={useState(value){const i=states.length;states.push(value);return[value,next=>{states[i]=next;}];},useRef:value=>({current:value}),useCallback:fn=>fn,useLayoutEffect:fn=>{fn();}};
 const require=specifier=>{
  if(specifier==='react')return react;
  if(specifier.endsWith('/limits'))return {AI_LIMITS:contracts.AI_LIMITS};
  if(specifier.endsWith('/contracts'))return contracts;
  if(specifier.endsWith('/validation')){loadingModules=true;return delayed.then(()=>validation);}
  throw new Error(`unexpected module ${specifier}`);
 };
 const hookModule={exports:{}};
 new Function('require','module','exports','fetch','setTimeout','clearTimeout',compiled)(require,hookModule,hookModule.exports,
  async(_url,options={})=>new Response(JSON.stringify(options.method==='POST'?result:{mode:'fixture'})),
  fn=>{timers.add(fn);return fn;},fn=>timers.delete(fn));
 const controller=hookModule.exports.useInterpretation('BTC-USDT');
 return {controller,states,finishModules,loading:()=>loadingModules,deadline(){for(const fn of [...timers])fn();},timers};
}

test('3.0A actual Hook timeout releases loading before delayed validation modules, rejects late success and allows retry',async()=>{
 const h=await harness(),first=h.controller.generate();await tick();assert.equal(h.loading(),true);assert.equal(h.states[0],'loading');
 h.deadline();await first;assert.equal(h.states[0],'error');assert.equal(h.states[1],'timeout');assert.equal(h.states[2],null);assert.equal(h.timers.size,0);
 h.finishModules();await tick();assert.equal(h.states[0],'error');assert.equal(h.states[2],null);
 await h.controller.generate();assert.equal(h.states[0],'ready');assert.equal(h.states[2].context.asset.symbol,'BTC-USDT');
});

test('3.0A actual Hook cancellation while modules load completes immediately and rejects late success',async()=>{
 const h=await harness(),pending=h.controller.generate();await tick();assert.equal(h.loading(),true);
 h.controller.cancel();await pending;assert.equal(h.states[0],'cancelled');assert.equal(h.states[1],'cancelled');assert.equal(h.states[2],null);assert.equal(h.timers.size,0);
 h.finishModules();await tick();assert.equal(h.states[0],'cancelled');assert.equal(h.states[2],null);
});
