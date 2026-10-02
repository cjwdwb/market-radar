// Synthetic, explicitly generated sample. Never queries a provider or reads private data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageDigest, parseHistoryPackage } from '../lib/history/package.ts';

export async function createHistoryExample(generatedAt) {
  const from=Date.parse('2026-09-01T00:00:00Z'),intervalMs=300000,count=302,cutoff=from+count*intervalMs;
  if(!Number.isSafeInteger(generatedAt)||generatedAt<cutoff)throw Error('INVALID_GENERATION_TIME');
  const body={format:'history-package-v1',identity:'fixture',vintage:'current_vintage',source:'fixture:history28-example',asset:{id:'fixture:us:EXAMPLE:USD',market:'us',venue:'TEST',providerId:'fixture:EXAMPLE',currency:'USD',adjustment:'raw'},intervalMs,sessionEvidence:'fixture_only',readRevision:1,range:{from,cutoff},exportedAt:generatedAt,coverage:'not_verified',
    bars:Array.from({length:count},(_,i)=>{const close=100*1.0002**i;return {time:from+i*intervalMs,open:close,high:close+.01,low:close-.01,close,volume:null,version:1,receivedAt:generatedAt};})};
  return parseHistoryPackage(JSON.stringify({...body,digest:await packageDigest(body)}),generatedAt);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const file=resolve(dirname(fileURLToPath(import.meta.url)),'../public/examples/history28-fixture.json');
  const example=await createHistoryExample(Date.now());mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(example,null,2)+'\n');
  console.log(JSON.stringify({identity:example.identity,bars:example.bars.length,generatedAt:example.exportedAt,digest:example.digest}));
}
