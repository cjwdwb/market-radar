"use client";
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {boundWindow,clamp,rememberWindow,resolveWindow,zoomWindow,type ChartView,type ChartWindow} from '@/lib/chart-viewport';

type Position={x:number;y:number};
type Gesture={window:ChartWindow;center:number;distance:number;anchor:number;plotWidth:number;bounds:DOMRect|undefined};

export function useChartViewport(points:{time:number}[],width:number){
  const [view,setView]=useState<ChartView>({count:null,endTime:null});
  const [dragging,setDragging]=useState(false);
  const svg=useRef<SVGSVGElement>(null);
  const contacts=useRef(new Map<number,Position>()),gesture=useRef<Gesture|null>(null);
  const tapStart=useRef<(Position&{id:number})|null>(null),lastTap=useRef<(Position&{at:number})|null>(null);
  const pending=useRef<ChartView|null>(null),frame=useRef<number|null>(null);
  const window=resolveWindow(points,view,width<600?40:60);
  const current=useRef(window);current.current=window;
  const left=12,right=width<600?78:100,plot=width-left-right;
  function commit(next:ChartWindow){
    const bounded=boundWindow(points.length,next.start,next.count);current.current=bounded;
    pending.current=rememberWindow(points,bounded);
    if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;const next=pending.current;if(next)setView(prev=>prev.count===next.count&&prev.endTime===next.endTime?prev:next);});
  }
  function ratio(clientX:number,rect=svg.current?.getBoundingClientRect()){return rect?clamp(((clientX-rect.left)/rect.width*width-left)/plot,0,1):.5;}
  function begin(){
    const list=[...contacts.current.values()];if(!list.length){gesture.current=null;return;}
    const center=list.length>1?(list[0].x+list[1].x)/2:list[0].x;
    const bounds=svg.current?.getBoundingClientRect();
    gesture.current={window:{...current.current},center,distance:list.length>1?Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y):0,anchor:ratio(center,bounds),plotWidth:(bounds?.width??width)*plot/width,bounds};
  }
  function pointerDown(e:ReactPointerEvent<SVGSVGElement>){
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);
    contacts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});begin();setDragging(true);
    tapStart.current=e.pointerType==='touch'&&contacts.current.size===1?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
  }
  function pointerMove(e:ReactPointerEvent<SVGSVGElement>){
    if(!contacts.current.has(e.pointerId))return false;
    contacts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(tapStart.current&&Math.hypot(e.clientX-tapStart.current.x,e.clientY-tapStart.current.y)>8)tapStart.current=null;
    const base=gesture.current,list=[...contacts.current.values()];if(!base)return true;
    if(list.length>1&&base.distance>0){
      const center=(list[0].x+list[1].x)/2,distance=Math.max(1,Math.hypot(list[0].x-list[1].x,list[0].y-list[1].y));
      const count=boundWindow(points.length,0,base.window.count*base.distance/distance).count;
      commit({start:base.window.start+base.anchor*base.window.count-ratio(center,base.bounds)*count,count});
    }else{
      commit({start:base.window.start-(list[0].x-base.center)/base.plotWidth*base.window.count,count:base.window.count});
    }
    return true;
  }
  function pointerUp(e:ReactPointerEvent<SVGSVGElement>){
    const tap=e.type==='pointerup'&&tapStart.current?.id===e.pointerId?tapStart.current:null;
    tapStart.current=null;
    contacts.current.delete(e.pointerId);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    begin();setDragging(contacts.current.size>0);
    if(tap){const previous=lastTap.current,at=Date.now();if(previous&&at-previous.at<350&&Math.hypot(tap.x-previous.x,tap.y-previous.y)<24){lastTap.current=null;reset();}else lastTap.current={...tap,at};}
  }
  const wheel=useRef<(e:WheelEvent)=>void>(()=>{});
  wheel.current=e=>{
    if(!points.length)return;e.preventDefault();
    if(!e.ctrlKey&&Math.abs(e.deltaX)>Math.abs(e.deltaY)){commit({...current.current,start:current.current.start+e.deltaX/plot*current.current.count});return;}
    const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?354:1);
    if(!delta)return;
    const previous=current.current;
    commit(zoomWindow(points.length,previous,previous.count*Math.exp(clamp(delta,-240,240)*.003),ratio(e.clientX)));
  };
  useEffect(()=>{
    const el=svg.current;if(!el)return;
    const handler=(e:WheelEvent)=>wheel.current(e);el.addEventListener('wheel',handler,{passive:false});
    return()=>el.removeEventListener('wheel',handler);
  },[points.length>0]);
  useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
  function reset(){
    if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;pending.current=null;
    contacts.current.clear();gesture.current=null;tapStart.current=null;lastTap.current=null;setDragging(false);setView({count:null,endTime:null});
  }
  return {svg,window,dragging,following:view.endTime===null,pointerDown,pointerMove,pointerUp,reset,
    zoom:(delta:number)=>commit(zoomWindow(points.length,current.current,current.current.count+delta,view.endTime===null?1:.5)),
    pan:(bars:number)=>commit({...current.current,start:current.current.start+bars}),
    latest:()=>commit({start:points.length-current.current.count,count:current.current.count})};
}
