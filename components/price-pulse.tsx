"use client";

import { memo, useEffect, useLayoutEffect, useRef } from "react";

/** A brief directional highlight on a real value change, never an interpolated price. */
export const PricePulse = memo(function PricePulse({value, text, identity}:{value:number|undefined;text:string;identity:string}) {
  const previous = useRef({value, identity});
  const halo = useRef<HTMLSpanElement>(null);
  const live = useRef<HTMLSpanElement>(null);
  const reserve = useRef({identity,length:0});
  useLayoutEffect(()=>{
    const element=live.current;if(!element)return;
    if(reserve.current.identity!==identity){element.style.minInlineSize="";reserve.current={identity,length:0};}
    // Tabular digits handle ordinary ticks. Reserve the actual rendered width only when the digit count changes.
    if(reserve.current.length===text.length)return;
    element.style.minInlineSize=`${element.getBoundingClientRect().width}px`;
    reserve.current.length=text.length;
  },[identity,text]);
  useEffect(() => {
    const before = previous.current;
    previous.current = {value, identity};
    if (!halo.current || before.identity !== identity || before.value == null || value == null || before.value === value || document.hidden) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;
    halo.current.style.background = value > before.value ? "var(--market-up)" : "var(--market-down)";
    const animation = halo.current.animate([{opacity:.12},{opacity:0}], {duration:520,easing:"cubic-bezier(.16,1,.3,1)"});
    const stop = () => { if (reduced.matches || document.hidden) animation.cancel(); };
    reduced.addEventListener("change",stop);
    document.addEventListener("visibilitychange",stop);
    return () => { animation.cancel(); reduced.removeEventListener("change",stop); document.removeEventListener("visibilitychange",stop); };
  }, [value, identity]);
  return <span className="live-price" ref={live}><span className="price-halo" ref={halo} aria-hidden="true"/>{text}</span>;
});
