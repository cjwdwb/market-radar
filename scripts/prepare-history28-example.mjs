// Synthetic, explicitly generated sample. Never queries a provider or reads private data.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageDigest, parseHistoryPackage } from '../lib/history/package.ts';

export async function createHistoryExample(generatedAt) {
  const from=Date.parse('2026-09-01T00:00:00Z'),intervalMs=300000,count=302,cutoff=from+count*intervalMs;
  if(!Number.isSafeInteger(generatedAt)||generatedAt<cutoff)throw Error('INVALID_GENERATION_TIME');
  // 演示专用：精确有理数复利，USD按1e-8单位四舍五入（正数半数向上）。
  // 避免不同V8的浮点幂运算末位漂移；真实报价、通用parser和研究数学不做round。
  const scale=100000000n,spread=1000000n;
  let numerator=100n*scale,denominator=1n;
  const bars=Array.from({length:count},(_,i)=>{
    const units=(2n*numerator+denominator)/(2n*denominator),close=Number(units)/Number(scale);
    const bar={time:from+i*intervalMs,open:close,high:Number(units+spread)/Number(scale),low:Number(units-spread)/Number(scale),close,volume:null,version:1,receivedAt:generatedAt};
    numerator*=10002n;denominator*=10000n;
    return bar;
  });
  const body={format:'history-package-v1',identity:'fixture',vintage:'current_vintage',source:'fixture:history28-example',asset:{id:'fixture:us:EXAMPLE:USD',market:'us',venue:'TEST',providerId:'fixture:EXAMPLE',currency:'USD',adjustment:'raw'},intervalMs,sessionEvidence:'fixture_only',readRevision:1,range:{from,cutoff},exportedAt:generatedAt,coverage:'not_verified',
    bars};
  return parseHistoryPackage(JSON.stringify({...body,digest:await packageDigest(body)}),generatedAt);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const file=resolve(dirname(fileURLToPath(import.meta.url)),'../public/examples/history28-fixture.json');
  const example=await createHistoryExample(Date.now());mkdirSync(dirname(file),{recursive:true});writeFileSync(file,JSON.stringify(example,null,2)+'\n');
  console.log(JSON.stringify({identity:example.identity,bars:example.bars.length,generatedAt:example.exportedAt,digest:example.digest}));
}
