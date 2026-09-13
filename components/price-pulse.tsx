"use client";

import { memo, useEffect, useRef } from "react";

/** A brief directional highlight on a real value change, never an interpolated price. */
export const PricePulse = memo(function PricePulse({value, text, identity}:{value:number|undefined;text:string;identity:string}) {
  const previous = useRef({value, identity});
  const halo = useRef<HTMLSpanElement>(null);
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
  return <span className="live-price"><span className="price-halo" ref={halo} aria-hidden="true"/>{text}</span>;
});
