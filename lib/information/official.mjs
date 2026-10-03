// 只保存官方发布的事实元数据；不复制正文、创作性标题或个人资料。
import {viewDigest} from './fed-view.mjs';
export const OFFICIAL_LIMIT=128*1024;
export const OFFICIAL_SOURCES=Object.freeze([
 {id:'bitcoin-core',repo:'bitcoin/bitcoin',name:'Bitcoin Core',category:'crypto',symbols:['BTC-USDT','BTC-USD'],license:'MIT',licenseFile:'COPYING'},
 {id:'go-ethereum',repo:'ethereum/go-ethereum',name:'Ethereum · Geth',category:'crypto',symbols:['ETH-USDT','ETH-USD'],license:'项目许可，见原文',licenseFile:'COPYING'},
 {id:'agave',repo:'anza-xyz/agave',name:'Solana · Agave（Anza）',category:'crypto',symbols:['SOL-USDT','SOL-USD'],license:'Apache-2.0',licenseFile:'LICENSE'},
 {id:'nvidia-driver',repo:'NVIDIA/open-gpu-kernel-modules',name:'NVIDIA 开源GPU驱动',category:'company',symbols:['NVDA'],license:'MIT / GPL-2.0',licenseFile:'COPYING'},
 {id:'powertoys',repo:'microsoft/PowerToys',name:'Microsoft PowerToys',category:'company',symbols:['MSFT'],license:'MIT',licenseFile:'LICENSE'},
].map(s=>Object.freeze({...s,symbols:Object.freeze(s.symbols),url:`https://github.com/${s.repo}`,rightsUrl:`https://github.com/${s.repo}/blob/HEAD/${s.licenseFile}`})));
export const officialSource=id=>OFFICIAL_SOURCES.find(s=>s.id===id);
const fail=()=>{throw Error('官方资料格式或来源校验失败。');};
const integer=(v,min=1,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const exact=(v,ks)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validateOfficialFact(r,sourceId,receivedAt){
 const source=officialSource(sourceId);
 if(!source||!integer(receivedAt)||!exact(r,['id','tag','url','publishedAt','sourceUpdatedAt','prerelease'])||!integer(r.id)||typeof r.tag!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/.test(r.tag)||r.url!==`${source.url}/releases/tag/${encodeURIComponent(r.tag)}`||!integer(r.publishedAt,1,receivedAt)||!integer(r.sourceUpdatedAt,r.publishedAt,receivedAt)||typeof r.prerelease!=='boolean')fail();
 return r;
}
export function normalizeReleases(sourceId,input,receivedAt){
 if(!officialSource(sourceId)||!Array.isArray(input)||input.length>5)fail();const seen=new Set();
 return input.map(raw=>{
  if(!raw||raw.draft!==false||typeof raw.published_at!=='string'||typeof raw.updated_at!=='string')fail();
  const r=validateOfficialFact({id:raw.id,tag:raw.tag_name,url:raw.html_url,publishedAt:Date.parse(raw.published_at),sourceUpdatedAt:Date.parse(raw.updated_at),prerelease:raw.prerelease},sourceId,receivedAt);
  if(new Date(r.publishedAt).toISOString()!==raw.published_at.replace(/Z$/,'.000Z')||new Date(r.sourceUpdatedAt).toISOString()!==raw.updated_at.replace(/Z$/,'.000Z')||seen.has(r.id))fail();seen.add(r.id);return r;
 });
}
export async function parseOfficialView(text,now){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>OFFICIAL_LIMIT||!integer(now))fail();let v;try{v=JSON.parse(text);}catch{fail();}
 if(!exact(v,['format','identity','vintage','exportedAt','sources','viewId'])||v.format!=='official-information-v1'||v.identity!=='reconstructed'||v.vintage!=='current'||!integer(v.exportedAt,1,now+60000)||!Array.isArray(v.sources)||v.sources.length!==OFFICIAL_SOURCES.length||!hash(v.viewId))fail();
 const seen=new Set();
 for(const s of v.sources){
  if(!exact(s,['sourceId','snapshotId','checkedAt','receiptBasis','records'])||!officialSource(s.sourceId)||seen.has(s.sourceId)||!Array.isArray(s.records)||s.records.length>5)fail();seen.add(s.sourceId);
  if(s.snapshotId===null){if(s.checkedAt!==null||s.receiptBasis!==null||s.records.length)fail();continue;}
  if(!['reviewed_capture_mtime','response_completed'].includes(s.receiptBasis))fail();
  if(!hash(s.snapshotId)||!integer(s.checkedAt,1,v.exportedAt))fail();const ids=new Set();
  for(const row of s.records){
   if(!exact(row,['fact','version','contentHash','firstSavedAt','versionSavedAt'])||!integer(row.version)||!hash(row.contentHash)||!integer(row.firstSavedAt,row.fact?.publishedAt,v.exportedAt)||!integer(row.versionSavedAt,row.firstSavedAt,v.exportedAt))fail();
   validateOfficialFact(row.fact,s.sourceId,s.checkedAt);if(ids.has(row.fact.id)||await viewDigest(row.fact)!==row.contentHash)fail();ids.add(row.fact.id);
  }
  if(await viewDigest({sourceId:s.sourceId,checkedAt:s.checkedAt,receiptBasis:s.receiptBasis,hashes:s.records.map(row=>row.contentHash)})!==s.snapshotId)fail();
 }
 const {viewId,...body}=v;if(await viewDigest(body)!==viewId)fail();return v;
}
export function queryOfficialView(view,{symbol,category='all',page=0}={}){
 if(!['all','crypto','company'].includes(category)||!Number.isInteger(page)||page<0||page>4)fail();
 const sources=view.sources.filter(s=>{const c=officialSource(s.sourceId);return (!symbol||c.symbols.includes(symbol))&&(category==='all'||c.category===category);});
 const rows=sources.flatMap(s=>s.records.map(r=>({...r,sourceId:s.sourceId,checkedAt:s.checkedAt}))).sort((a,b)=>b.fact.publishedAt-a.fact.publishedAt||a.sourceId.localeCompare(b.sourceId)||b.fact.id-a.fact.id);
 const pages=Math.max(1,Math.ceil(rows.length/5));if(page>=pages)fail();return {records:rows.slice(page*5,page*5+5),total:rows.length,pages,covered:sources.length>0,collected:sources.some(s=>s.snapshotId!==null)};
}
