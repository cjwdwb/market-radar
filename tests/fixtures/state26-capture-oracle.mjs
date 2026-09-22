// Reproduce: node --experimental-strip-types --import ./tests/register-types.mjs
// tests/fixtures/state26-capture-oracle.mjs <clean-baseline-checkout>
// Refuses a changed baseline. Never imports candidate code for expected values.
import { execFileSync } from 'node:child_process';
import { resolve,join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { BASELINE_SHA,canonical,legacyCases,legacyResult } from './state26-fixtures.mjs';
const baseline=resolve(process.argv[2]??'../market-radar-state26-baseline');
const git=(...args)=>execFileSync('git',args,{cwd:baseline,encoding:'utf8'}).trim();
if(git('rev-parse','HEAD')!==BASELINE_SHA||git('status','--porcelain'))throw Error('Oracle capture requires the exact clean fixed baseline.');
const load=path=>import(pathToFileURL(join(baseline,path)).href);
const api={...await load('lib/radar/asset-state.ts'),...await load('lib/radar/engine.ts'),...await load('lib/radar/intelligence.ts'),...await load('lib/radar/types.ts')};
const cases=legacyCases().map(row=>{
  const output=legacyResult(api,row),json=JSON.stringify(canonical(output));
  return {name:row.name,sha256:createHash('sha256').update(json).digest('hex')};
});
const result={baseline:BASELINE_SHA,algorithm:'SHA-256 over UTF-8 JSON.stringify(recursively key-sorted full exported outputs); array order preserved',exports:['buildAssetState','radarCoverage','scanRadar (initial, repeated, expired)','buildRadarIntelligence'],cases};
writeFileSync(new URL('./state26-legacy-oracle.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(`Captured ${cases.length} legacy cases exclusively from ${BASELINE_SHA}`);
