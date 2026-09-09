import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const files=['lib/market.ts','lib/okx.ts','lib/market-data.ts','monitor/worker.mjs'];
const code=files.map(path=>{
  let source=readFileSync(path,'utf8').replace(/^import .*?;\r?\n/gm,'');
  if(path.endsWith('.ts'))source=stripTypeScriptTypes(source);
  return source.replace(/\bexport (?=(?:async )?function|const|let)/g,'');
}).join('\n');
mkdirSync('outputs',{recursive:true});writeFileSync('outputs/monitor.mjs',code);
