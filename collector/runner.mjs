import { canonical } from './store.mjs';
import { isFedConfig } from './source-policy.mjs';
import { approvedFedAdapter } from './fed-source.mjs';

function waitDelay(ms,signal,sleep){
  return new Promise((resolve,reject)=>{
    let timer;
    const finish=(error)=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);if(error)reject(error);else resolve();};
    const abort=()=>finish(Error('REQUEST_CANCELLED'));
    signal?.addEventListener('abort',abort,{once:true});
    if(signal?.aborted){abort();return;}
    timer=setTimeout(()=>finish(),ms);
    if(sleep)Promise.resolve().then(()=>sleep(ms)).then(()=>finish(),finish);
  });
}
/** Manual bounded executor. Only fixture capabilities and the reviewed Board adapter are admitted. */
export async function runBatch(args){
  await executeBatch(args);
  // Read after the executor's finally block releases its lease, never return a stale in-flight snapshot.
  return args.store.requireRun(args.owner,args.runId);
}
async function executeBatch({store,owner,runId,adapter,now=Date.now,sleep,signal}) {
  const initial=store.requireRun(owner,runId);
  if(!(initial.config.identity==='fixture'&&adapter?.identity==='fixture'||isFedConfig(initial.config)&&approvedFedAdapter(adapter))||adapter.source!==initial.config.source||typeof adapter.page!=='function')throw Error('FIXTURE_ADAPTER_REQUIRED');
  if(initial.status!=='ready')return initial;
  let ownedLease=null;
  const stop=reason=>store.stopRun(owner,runId,reason,ownedLease);
  while(true){
    if(signal?.aborted)return stop('cancelled');
    const run=store.requireRun(owner,runId),c=run.config;
    const reserved=store.reserveRequest(owner,runId,now());
    if(!reserved.ok)return store.requireRun(owner,runId);
    ownedLease=reserved.leaseToken;
    const controller=new AbortController();
    const remaining=c.createdAt+c.limits.durationMs-now();
    let timer,abort;
    try{
      const interruption=new Promise((_,reject)=>{
        timer=setTimeout(()=>{controller.abort();reject(Error('REQUEST_TIMEOUT'));},Math.max(1,Math.min(reserved.leaseUntil-now(),remaining)));
        abort=()=>{controller.abort();reject(Error('REQUEST_CANCELLED'));};
        signal?.addEventListener('abort',abort,{once:true});
        if(signal?.aborted)abort();
      });
      const page=await Promise.race([Promise.resolve().then(()=>adapter.page({cursor:run.cursor,config:c,signal:controller.signal})),interruption]);
      // Count normalized response bytes even if a test adapter understates its transport size.
      let serialized;try{serialized=canonical(page);}catch{
        // No parseable byte size: consume a conservative page allowance, never zero-cost rejection.
        const charge=Number.isSafeInteger(page?.bytes)&&page.bytes>0?page.bytes:c.limits.pageBytes;
        if(!store.chargeBytes(owner,runId,charge,ownedLease))return store.requireRun(owner,runId);
        return stop('invalid_page');
      }
      const measured=Buffer.byteLength(serialized);
      const receivedBytes=Number.isSafeInteger(page?.bytes)&&page.bytes>=0?Math.max(measured,page.bytes):measured;
      if(!store.chargeBytes(owner,runId,receivedBytes,ownedLease))return store.requireRun(owner,runId);
      if(store.requireRun(owner,runId).lease_token!==ownedLease)return store.requireRun(owner,runId);
      if(signal?.aborted)return stop('cancelled');
      if(now()>=c.createdAt+c.limits.durationMs)return stop('budget_time');
      if(!page||!Array.isArray(page.records)||!page.records.length&&!page.traversalDone)return stop('invalid_page');
      try{
        const committed=store.commitPage(owner,runId,{expectedCursor:run.cursor,nextCursor:page.nextCursor,records:page.records,receivedAt:now(),traversalDone:page.traversalDone,leaseToken:reserved.leaseToken});
        if(committed.traversalDone)return store.requireRun(owner,runId);
      }catch(e){
        if(['FENCED_REQUEST','CHECKPOINT_CONFLICT'].includes(e.message))return store.requireRun(owner,runId);
        const reason=['NO_PROGRESS','REPEATED_PAGE','CURSOR_CYCLE'].includes(e.message)?'no_progress':e.message==='BYTE_BUDGET'?'budget_bytes':e.message==='WRITE_BUDGET'?'budget_writes':e.message==='PAGE_BUDGET'?'budget_pages':e.message==='RUN_DEADLINE'?'budget_time':'invalid_page';
        return stop(reason);
      }
    }catch(error){
      if(Number.isSafeInteger(error.bytes)&&error.bytes>0&&!store.chargeBytes(owner,runId,error.bytes,ownedLease))return store.requireRun(owner,runId);
      if(store.requireRun(owner,runId).lease_token!==ownedLease)return store.requireRun(owner,runId);
      if(signal?.aborted||error.message==='REQUEST_CANCELLED')return stop('cancelled');
      if(error.message==='REQUEST_TIMEOUT')return stop('timeout');
      if(![429,500,502,503,504].includes(error.status))return stop('adapter_failure');
      const delay=Number.isFinite(error.retryAfterMs)&&error.retryAfterMs>=0?Math.ceil(error.retryAfterMs):250*2**(reserved.attempt-1);
      const notBefore=now()+delay;
      if(!Number.isSafeInteger(notBefore))return stop('retry_after');
      store.deferRetry(owner,runId,reserved.leaseToken,notBefore);
      if(reserved.attempt>=3)return stop('retry_exhausted');
      if(delay>=c.createdAt+c.limits.durationMs-now())return stop('retry_after');
      // All retries reuse frozen run/cursor and reserve another request after waiting.
      clearTimeout(timer);
      try{await waitDelay(delay,signal,sleep);}catch{return stop('cancelled');}
    }finally{
      clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort);
      store.releaseRequest(owner,runId,reserved.leaseToken);
      ownedLease=null;
    }
  }
}
