import { readFileSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { SYNTHETIC_PILOT_ID } from '../../lib/ai/real-config.ts';

export const NOW = Date.UTC(2026, 9, 22, 12);
const SITE = 'fixture-site', SUBJECT = 'fixture-owner';
export const SCOPE = createHash('sha256').update(JSON.stringify(['ai-scope-v1', SITE, SUBJECT, 1])).digest('hex');

// The complete existing service, D1 implementation and C0 helper run inside workerd.
// Only transport, permissions and pauses are test fixtures; outbound traffic is denied.
const workerSource = `
import {createRealPilotService} from './lib/ai/real-service.ts';
import {createD1ServiceLedger} from './lib/ai/d1-service-ledger.ts';
import {D1ProductBudget} from './lib/ai/d1-budget.ts';
import {DEEPSEEK_AI} from './lib/ai/real-config.ts';
import {fixtureContext} from './lib/ai/fixture.ts';
import {createSelectionCatalog} from './lib/ai/claim-selection.ts';
import {createAIRevalidation} from './worker/ai-authorization.ts';
const NOW=${NOW}, SCOPE=${JSON.stringify(SCOPE)}, SITE=${JSON.stringify(SITE)}, SUBJECT=${JSON.stringify(SUBJECT)};
const config={siteId:SITE,origin:'https://fixture.invalid',symbols:['BTC-USDT']};
const grant={siteId:SITE,subjectId:SUBJECT,revision:1,enabled:true,expiresAt:NOW+3600000,permissions:['invoke','read','manage'],symbols:['BTC-USDT']};
const record={siteId:SITE,subjectId:SUBJECT,grantRevision:1,scope:SCOPE,symbol:'BTC-USDT',expiresAt:NOW+3600000};
let clock=NOW, flags={}, calls=0;const events=[], services=new Map(), cancellations=new Set(), stops=new Set();
const mark=stage=>events.push(stage);
// Native timers keep delayed fixture I/O in its originating request context, as D1
// does; resolving another request's orphan Promise is not a faithful workerd delay.
async function pause(stage){mark(stage);while(flags[stage])await new Promise(resolve=>setTimeout(resolve,5));}
function service(env,slot){
 if(services.has(slot))return services.get(slot);
 const budget=new D1ProductBudget(env.BUDGET),adapter=createD1ServiceLedger(budget,SCOPE);
 const ledger={...adapter,
  async reserve(input){await pause('reserve');if(flags.mismatchedAuthorization)input={...input,batch:{id:'fixture-batch',authorizationId:'other-fixture-authorization',policyVersion:'fixture-v1',snapshotId:input.snapshotId,scopeHash:SCOPE}};const result=await adapter.reserve(input);await pause('reserved');return result;},
  async claim(reservation,input){await pause('claim');if(flags.claimElsewhere)await budget.claim(reservation.id,{now:input.now,scopeHash:SCOPE});const result=await adapter.claim(reservation,input);await pause('claimed');if(flags.lostClaim)throw Error('fixture_lost_claim_response');return result;},
  async settle(id,input){await pause('settle');const result=await adapter.settle(id,input);await pause('settled');if(flags.lostSettlement)throw Error('fixture_lost_settlement_response');return result;},
  async unknown(...args){mark('unknown');return adapter.unknown(...args);},
 };
 const request=new Request(config.origin+'/api/ai',{method:'POST',headers:{origin:config.origin,'content-type':'application/json','oai-authenticated-user-id':SUBJECT},body:'{}'});
 const authorize=createAIRevalidation(request,record,{async get(){await pause('grant');if(flags.authUnavailable)throw Error('fixture_unavailable');return structuredClone(grant);}},config,()=>clock);
 const result=createRealPilotService({kind:'deepseek',async generate(body,signal){calls++;mark('provider');await pause('reply');
   const input=JSON.parse(JSON.parse(body).input[0].content),catalog=createSelectionCatalog(input.context);
   return {status:'completed',json:JSON.stringify({selectedClaimIds:catalog.deterministicBaseline.selectedClaimIds}),
    usage:{inputTokens:1000,outputTokens:100,totalTokens:1100,cachedTokens:0,reasoningTokens:0},
    provider:'deepseek',returnedModel:DEEPSEEK_AI.model,returnedServiceTier:null,responseId:'fixture-response',adapterVersion:DEEPSEEK_AI.adapterVersion,billingProfile:DEEPSEEK_AI.billingProfile};
 }},ledger,{profile:DEEPSEEK_AI,now:()=>clock,timeoutMs:flags.timeoutMs??5000,
   ...(flags.noRevalidation?{}:{async revalidate(phase){await pause(phase);await authorize(phase);}})});
 services.set(slot,result);return result;
}
export default {async fetch(request,env,execution){const command=await request.json();try{
 if(command.action==='configure'){Object.assign(flags,command.flags||{});if(command.grant)Object.assign(grant,command.grant);if(command.now!==undefined)clock=command.now;return Response.json({ok:true});}
 if(command.action==='release'){flags[command.stage]=false;return Response.json({ok:true});}
 if(command.action==='cancel'){cancellations.add(command.id);return Response.json({ok:true});}
 if(command.action==='stop'){stops.add(command.slot||'one');return Response.json({ok:true});}
 if(command.action==='inspect'){let budget;try{budget=await new D1ProductBudget(env.BUDGET).inspect(clock)}catch(error){budget={error:error.message}}return Response.json({calls,events,services:[...services].map(([slot,s])=>{const info=s.inspect();Promise.resolve(info.budget).catch(()=>{});return {slot,active:info.active,cache:info.cache}}),budget});}
 if(command.action==='run'){
   const control=new AbortController(),slot=command.slot||'one';
   // Abort events must originate in the request that owns the listener in workerd.
   const timer=setInterval(()=>{if(cancellations.has(command.id))control.abort();if(stops.has(slot))service(env,slot).stop()},1);
   try {const context=fixtureContext(command.scenario||'upward','BTC-USDT',NOW);if(command.untrusted)context.trust='controlled';
     const result=await service(env,slot).interpret(context,control.signal,command.noExecution?undefined:execution);return Response.json({result});
   }finally{clearInterval(timer);cancellations.delete(command.id);}
 }
 return Response.json({error:'fixture_unknown_action'},{status:400});
 }catch(error){return Response.json({error:error.code||error.message},{status:409});}}};`;

let compiled;
async function script() {
  compiled ??= build({ absWorkingDir: process.cwd(), tsconfigRaw: {}, stdin: { contents: workerSource, resolveDir: process.cwd(), sourcefile: 'production-service-fixture.ts', loader: 'ts' },
    bundle: true, write: false, platform: 'browser', format: 'esm', external: ['node:crypto'] }).then(result => result.outputFiles[0].text);
  return compiled;
}

export async function serviceFixture(t, { enabled = true, legacyNumericConstraints = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'mr-d1-service-'));
  let runtime, db, egress = 0;
  const source = await script();
  const start = async () => {
    runtime = new Miniflare({ d1Persist: directory, workers: ['alpha','beta'].map(name => ({ name, modules: true, script: source,
      compatibilityDate: '2026-05-22', compatibilityFlags: ['nodejs_compat'], d1Databases: { BUDGET: 'fixture-service-budget' },
      outboundService: () => { egress++; return new Response('fixture_network_forbidden', { status: 503 }); } })) });
    db = await runtime.getD1Database('BUDGET', 'alpha');
  };
  t.after(async () => {
    await runtime?.dispose();
    const target = realpathSync(directory);
    if (dirname(target) !== realpathSync(tmpdir()) || !basename(target).startsWith('mr-d1-service-')) throw Error('fixture_cleanup_path');
    rmSync(target, { recursive: true, force: true });
  });
  await start();
  let sql = readFileSync(new URL('../../db/ai-production-budget.sql', import.meta.url), 'utf8');
  if (legacyNumericConstraints) sql = sql.replace(/typeof\(([a-z_]+)\)='integer' AND \1 BETWEEN (0|1) AND 9007199254740991/g, '$1>=$2');
  const statements = sql.replace(/^--.*$/gm, '').split(/;(?=\s*(?:CREATE|INSERT)|\s*$)/).filter(s => s.trim());
  await db.batch(statements.map(statement => db.prepare(statement)));
  await db.batch([
    db.prepare("INSERT INTO metadata VALUES(1,'market-radar-product-budget-v2',2)"),
    db.prepare("INSERT INTO ai_budget_policies VALUES('fixture-policy','pilot',?,'fixture-authorization',?,20,250000000,0,0,NULL)").bind(SYNTHETIC_PILOT_ID, SCOPE),
    db.prepare("UPDATE ai_budget_control SET enabled=?,import_status='verified',import_hash=?,policy_id='fixture-policy' WHERE id=1").bind(Number(enabled), 'e'.repeat(64)),
  ]);
  const invoke = async (command, worker = 'alpha') => {
    const response = await (await runtime.getWorker(worker)).fetch('http://fixture.invalid/', { method: 'POST', body: JSON.stringify(command) });
    return response.json();
  };
  return { invoke, get db() { return db; }, get egress() { return egress; },
    async rows(table = 'requests') { if (!['requests','ai_dispatch_intents','ai_budget_policies'].includes(table)) throw Error('fixture_table');return (await db.prepare('SELECT * FROM '+table+' ORDER BY 1').all()).results; },
    async wait(stage, count = 1, worker = 'alpha') {
      for (let i=0;i<200;i++) { const state=await invoke({action:'inspect'},worker);if (state.events?.filter(s=>s===stage).length>=count) return state;await new Promise(resolve=>setTimeout(resolve,5)); }
      throw Error('fixture_stage_timeout:'+stage);
    },
    async idle(worker = 'alpha') {
      for (let i=0;i<200;i++) { const state=await invoke({action:'inspect'},worker);if (state.services.every(s=>s.active===0)) return state;await new Promise(resolve=>setTimeout(resolve,5)); }
      throw Error('fixture_idle_timeout');
    },
    async restart() { await runtime.dispose(); await start(); },
  };
}
