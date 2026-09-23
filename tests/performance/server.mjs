// Local production Worker runtime. Synthetic credentials; no remote bindings or egress.
import {Miniflare} from 'miniflare';
import {resolve} from 'node:path';
import {accessCodeHash} from '../../worker/access-gate.ts';
const root=resolve(process.argv[2]||'dist'),port=Number(process.argv[3]||5290);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid local port');
const runtime=new Miniflare({name:'perf275',host:'127.0.0.1',port,modules:true,scriptPath:resolve(root,'server/index.js'),modulesRoot:resolve(root,'server'),modulesRules:[{type:'ESModule',include:['**/*.js'],fallthrough:true}],compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],bindings:{ACCESS_CODE_HASH:accessCodeHash('perf-fixture-only'),ACCESS_SESSION_SECRET:'perf-fixture-only-not-a-production-secret-275'},assets:{workerName:'perf275',directory:resolve(root,'client'),binding:'ASSETS',routerConfig:{has_user_worker:true,invoke_user_worker_ahead_of_assets:true}},outboundService:()=>new Response('External access disabled in performance runtime',{status:503})});
const deadline=setTimeout(()=>void stop(),20*60_000);
let stopping=false;
async function stop(){if(stopping)return;stopping=true;clearTimeout(deadline);await runtime.dispose();}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
console.log(JSON.stringify({url:String(await runtime.ready),runtime:'local workerd',build:root,egress:'denied',deadlineMinutes:20}));

