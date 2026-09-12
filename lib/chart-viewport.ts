export type ChartWindow={start:number;count:number};
export type ChartView={count:number|null;endTime:number|null};
type Timed={time:number};
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

export function boundWindow(length:number,start:number,count:number):ChartWindow{
  const size=length?clamp(Math.round(count),Math.min(16,length),length):0;
  return {start:clamp(start,0,Math.max(0,length-size)),count:size};
}
function indexAtTime(points:Timed[],time:number){
  let lo=0,hi=points.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].time<=time)lo=mid;else hi=mid-1;}
  const next=points[lo+1];
  return lo+(next?clamp((time-points[lo].time)/(next.time-points[lo].time),0,1):0);
}
export function resolveWindow(points:Timed[],view:ChartView,defaultCount:number):ChartWindow{
  if(!points.length)return {start:0,count:0};
  const count=view.count??defaultCount;
  const end=view.endTime===null?points.length:indexAtTime(points,view.endTime)+1;
  return boundWindow(points.length,end-Math.min(count,points.length),count);
}
export function rememberWindow(points:Timed[],window:ChartWindow):ChartView{
  const range=boundWindow(points.length,window.start,window.count);
  if(!points.length||range.start+range.count>=points.length-0.0001)return {count:range.count,endTime:null};
  const index=range.start+range.count-1,lower=Math.floor(index),fraction=index-lower;
  return {count:range.count,endTime:points[lower].time+fraction*(points[lower+1].time-points[lower].time)};
}
export function zoomWindow(length:number,window:ChartWindow,count:number,anchor=.5):ChartWindow{
  const size=boundWindow(length,0,count).count;
  return boundWindow(length,window.start+clamp(anchor,0,1)*(window.count-size),size);
}
