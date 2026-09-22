// Portable public metadata contract; no network, filesystem, user preferences or financial calculations.
export const VIEW_LIMIT=1048576;
export const SOURCE='fed-board:monetary-v1';
export const ATTRIBUTION='Source: Board of Governors of the Federal Reserve System';
export const RIGHTS='https://www.federalreserve.gov/disclaimer.htm';
const DAY=86400000,START=Date.parse('2026-09-01T00:00:00Z');
const fail=()=>{throw Error('归档格式或校验不符合要求，请重新导出公开视图。');};
const keys=(v,expected)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k));
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const link=v=>typeof v==='string'&&/^https:\/\/www\.federalreserve\.gov\/newsevents\/pressreleases\/monetary\d{8}[a-z]\.htm$/.test(v);
export async function viewDigest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function parseFedView(text,now){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>VIEW_LIMIT||!integer(now,1))fail();
  let value;try{value=JSON.parse(text);}catch{fail();}
  if(!keys(value,['format','source','attribution','rightsUrl','identity','vintage','readRevision','exportedAt','range','coverage','records','viewId'])||value.format!=='fed-monetary-view-v1'||value.source!==SOURCE||value.attribution!==ATTRIBUTION||value.rightsUrl!==RIGHTS||value.identity!=='reconstructed'||value.vintage!=='current'||!integer(value.readRevision)||!integer(value.exportedAt,START,now+60000))fail();
  const {range,coverage,records}=value;
  if(!keys(range,['from','cutoff'])||!integer(range.from,START)||!integer(range.cutoff,range.from+1,value.exportedAt)||range.cutoff-range.from>31*DAY)fail();
  if(!keys(coverage,['status','expectedCount','limitation'])||coverage.status!=='endpoint_snapshot'||coverage.expectedCount!==null||coverage.limitation!=='Not a complete historical or point-in-time collection')fail();
  if(!Array.isArray(records)||records.length>200||!hash(value.viewId))fail();
  const ids=new Set();
  for(const r of records){
    if(!keys(r,['id','title','url','publishedAt','publicationPrecision','firstReceivedAt','versionReceivedAt','version','contentHash'])||!link(r.url)||r.id!==r.url||ids.has(r.id)||typeof r.title!=='string'||!r.title.trim()||r.title.length>500||/[<>\x00-\x1f]/.test(r.title)||!['minute','second'].includes(r.publicationPrecision)||!integer(r.publishedAt,range.from,range.cutoff-1)||r.publishedAt%1000||r.publicationPrecision==='minute'&&r.publishedAt%60000||!integer(r.firstReceivedAt,r.publishedAt,value.exportedAt)||!integer(r.versionReceivedAt,r.firstReceivedAt,value.exportedAt)||!integer(r.version,1,value.readRevision)||!hash(r.contentHash))fail();
    ids.add(r.id);
  }
  const {viewId,...body}=value;if(await viewDigest(body)!==viewId)fail();
  // The digest is an integrity check, not an official signature or authenticity guarantee.
  Object.freeze(range);Object.freeze(coverage);records.forEach(Object.freeze);Object.freeze(records);return Object.freeze(value);
}
export function queryFedView(view,{from,to,page=0}){
  if(!integer(from,view.range.from,view.range.cutoff-1)||!integer(to,from+1,view.range.cutoff)||to-from>31*DAY||!integer(page,0,39))throw Error('请选择归档范围内的有效 UTC 日期。');
  const rows=view.records.filter(row=>row.publishedAt>=from&&row.publishedAt<to).sort((a,b)=>b.publishedAt-a.publishedAt||a.id.localeCompare(b.id));
  const pages=Math.max(1,Math.ceil(rows.length/5));if(page>=pages)throw Error('页码已失效，请重新查询。');
  return {viewId:view.viewId,readRevision:view.readRevision,total:rows.length,page,pages,records:rows.slice(page*5,page*5+5)};
}
