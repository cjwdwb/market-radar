import type {Point} from './market';

/** Reuse unchanged bars so React can skip charts on identical upstream snapshots. */
export function reusePoints(previous:Point[]|undefined,incoming:Point[]):Point[]{
  if(!previous)return incoming;
  const fields:(keyof Point)[]=['time','open','high','low','close','volume','confirmed'];
  let same=previous.length===incoming.length;
  const next=incoming.map((point,i)=>{
    const old=previous[i];
    if(old&&fields.every(key=>Object.is(old[key],point[key])))return old;
    same=false;return point;
  });
  return same?previous:next;
}

/** Back off only failing batches; successful providers retain their normal cadence. */
export function retryDelay(failures:number,baseMs:number){
  return Math.min(60_000,baseMs*2**Math.max(0,Math.min(6,failures-1)));
}
