import { FED, isFedConfig, fedLink } from './source-policy.mjs';
const instances=new WeakSet();
const error=(code,extras={})=>Object.assign(new Error(code),extras);
function plain(value){
  const decoded=value.trim().replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/,'$1').replace(/&(#\d+|#x[\da-f]+|amp|lt|gt|quot|apos);/gi,(_,entity)=>{
    if(entity[0]==='#'){const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));if(!Number.isSafeInteger(n)||n<32||n>0x10ffff)throw error('INVALID_XML_TEXT');return String.fromCodePoint(n);}
    return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[entity.toLowerCase()];
  });
  if(/[<>\x00-\x1f]/.test(decoded)||/&(?:#|[a-z]+);/i.test(decoded))throw error('INVALID_XML_TEXT');return decoded;
}
function rssItems(xml){
  const root={name:'document',children:[],text:''},stack=[root];let position=0,nodes=0;
  const tokens=/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?xml\s[^?]*\?>|<\/?[A-Za-z][\w:.-]*(?:\s[^<>]*?)?\s*\/?>|[^<]+/g;
  for(const match of xml.matchAll(tokens)){
    if(match.index!==position)throw error('INVALID_XML_STRUCTURE');position+=match[0].length;const token=match[0],current=stack.at(-1);
    if(token.startsWith('<!--')){if(token.slice(4,-3).includes('--'))throw error('INVALID_XML_COMMENT');continue;}
    if(token.startsWith('<?')){if(position!==token.length||root.children.length)throw error('INVALID_XML_STRUCTURE');continue;}
    if(token.startsWith('<![CDATA[')){if(stack.length===1)throw error('INVALID_XML_STRUCTURE');current.text+=token.slice(9,-3);continue;}
    if(token.startsWith('</')){const name=token.slice(2,-1).trim();if(stack.length===1||current.name!==name)throw error('INVALID_XML_STRUCTURE');stack.pop();continue;}
    if(token.startsWith('<')){
      const name=/^<([\w:.-]+)/.exec(token)[1],attributes=token.slice(name.length+1).replace(/\/?\s*>$/,'');
      // Only simple quoted attributes are supported; fail closed on malformed XML.
      if(attributes.replace(/\s+[\w:.-]+\s*=\s*(?:"[^"<>]*"|'[^'<>]*')/g,'').trim())throw error('INVALID_XML_STRUCTURE');
      const child={name,children:[],text:'',attributes};current.children.push(child);if(++nodes>1000||stack.length>8)throw error('INVALID_XML_STRUCTURE');
      if(!token.endsWith('/>'))stack.push(child);continue;
    }
    if(stack.length===1&&token.trim())throw error('INVALID_XML_STRUCTURE');current.text+=token;
  }
  if(position!==xml.length||stack.length!==1||root.children.length!==1)throw error('INVALID_XML_STRUCTURE');
  const rss=root.children[0];if(rss.name!=='rss'||!/\bversion\s*=\s*["']2\.0["']/.test(rss.attributes)||rss.children.length!==1||rss.children[0].name!=='channel')throw error('INVALID_RSS');
  const channel=rss.children[0];if(rss.text.trim()||channel.text.trim())throw error('INVALID_XML_STRUCTURE');
  return channel.children.filter(node=>node.name==='item');
}
// Strict subset of the reviewed RSS2 profile; no DTD, entities, HTML or arbitrary link resolution.
export function parseFedFeed(xml,config){
  if(!isFedConfig(config)||typeof xml!=='string'||Buffer.byteLength(xml)>FED.limits.pageBytes||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<rss\b[^>]*version=["']2\.0["']/.test(xml)||!/<\/rss>\s*$/.test(xml))throw error('INVALID_RSS');
  const blocks=rssItems(xml);
  if(blocks.length>50)throw error('INVALID_RSS');
  const records=[],seen=new Set();let excluded=0;
  for(const item of blocks){
    if(item.text.trim())throw error('INVALID_XML_STRUCTURE');
    const field=name=>{const values=item.children.filter(node=>node.name===name);if(values.length!==1||values[0].children.length)throw error('INVALID_RSS_FIELD');return plain(values[0].text);};
    const title=field('title'),url=field('link'),id=field('guid'),date=field('pubDate'),category=field('category');
    if(!fedLink(url)||id!==url||seen.has(id)||!title||title.length>500||category!=='Monetary Policy'||!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(date))throw error('INVALID_RSS_ITEM');
    // RSS permits an unpadded day. Normalize only that spelling; retain strict
    // weekday/calendar/time validation instead of accepting Date.parse rollover.
    const canonicalDate=date.replace(/^([A-Za-z]{3}, )(\d)( )/,(_,prefix,digit,suffix)=>prefix+'0'+digit+suffix);
    seen.add(id);const at=Date.parse(date);if(!Number.isFinite(at)||new Date(at).toUTCString()!==canonicalDate)throw error('INVALID_RSS_DATE');
    if(at<config.from||at>=config.cutoff){excluded++;continue;}
    records.push({asset:FED.asset.id,kind:'information',occurredAt:at,payload:{sourceRecordId:id,title,publisher:FED.attribution,url,publication:{precision:at%60000===0?'minute':'second',at,date:null,timezone:'UTC'},informationType:'macro'}});
  }
  return {records,nextCursor:null,traversalDone:true,endpointItems:blocks.length,excludedOutOfRange:excluded};
}
export function createFedAdapter({fetchImpl=globalThis.fetch,capture}={}){
  let lastRead;
  const adapter={identity:'reconstructed',source:FED.source,get lastRead(){return lastRead;},async page({cursor,config,signal}){
    if(cursor!==null||!isFedConfig(config))throw error('INVALID_SOURCE_REQUEST');
    const response=await fetchImpl(FED.endpoint,{method:'GET',redirect:'error',credentials:'omit',signal,headers:{Accept:'application/rss+xml, application/xml, text/xml'}});
    if(!response.ok){
      const raw=response.headers.get('retry-after');const delay=raw===null?undefined:/^\d+$/.test(raw)?Number(raw)*1000:Math.max(0,Date.parse(raw)-Date.now());
      await response.body?.cancel();throw error('SOURCE_HTTP_FAILURE',{status:response.status,retryAfterMs:delay});
    }
    if(!/^(application\/(rss\+)?xml|text\/xml)(;|$)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw error('SOURCE_CONTENT_TYPE');}
    const reader=response.body?.getReader();if(!reader)throw error('SOURCE_EMPTY_BODY');
    let bytes=0;const chunks=[];
    try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>config.limits.pageBytes)throw error('SOURCE_BYTE_LIMIT',{bytes});chunks.push(value);}}
    catch(e){await reader.cancel().catch(()=>{});throw Object.assign(e,{bytes});}
    const all=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length;}
    try{const text=new TextDecoder('utf-8',{fatal:true}).decode(all),receivedAt=Date.now();await capture?.({source:FED.source,endpoint:FED.endpoint,receivedAt,bytes,text});const page=parseFedFeed(text,config);lastRead=Object.freeze({endpointItems:page.endpointItems,excludedOutOfRange:page.excludedOutOfRange,inRange:page.records.length,bytes,receivedAt});return {...page,bytes};}catch(e){lastRead=Object.freeze({bytes,error:e.message});throw Object.assign(e,{bytes});}
  }};
  instances.add(adapter);return adapter;
}
export const approvedFedAdapter=adapter=>instances.has(adapter);
