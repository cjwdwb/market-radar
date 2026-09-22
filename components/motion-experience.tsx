"use client";

import { useEffect } from "react";
import { activeSection } from "@/lib/navigation-section";
import { isMotionReduced, MOTION_CHANGE_EVENT, startMotionPreference } from "@/lib/motion-preference";

/** One controller for presentation only; quote and chart updates never enter this loop. */
export function MotionExperience() {
  useEffect(() => {
    const root = document.documentElement;
    const stopMotionPreference = startMotionPreference();
    const precise = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px)");
    const animations = new Set<Animation>();
    const opening = document.querySelector(".brand-opening");
    let introTimer = 0;
    const finishIntro = () => {
      if (root.dataset.intro) delete root.dataset.intro;
      clearTimeout(introTimer);
      window.removeEventListener("pointerdown", cancelIntro);
      window.removeEventListener("keydown", cancelIntro);
      window.removeEventListener("wheel", cancelIntro);
    };
    const cancelIntro = () => finishIntro();
    if (root.dataset.intro) {
      introTimer = window.setTimeout(finishIntro, 1600);
      window.addEventListener("pointerdown", cancelIntro, { passive: true });
      window.addEventListener("keydown", cancelIntro);
      window.addEventListener("wheel", cancelIntro, { passive: true });
    }
    const openingFinished = (event: Event) => { if(event.target===opening) finishIntro(); };
    opening?.addEventListener("animationend",openingFinished);

    // Follow the visible viewport when a phone keyboard opens, without a continuous frame loop.
    const visual = window.visualViewport;
    let viewportFrame = 0, previousHeight = -1, previousTop = -1;
    const updateViewport = () => {
      viewportFrame = 0;
      const height = Math.round(visual?.height ?? innerHeight), top = Math.round(visual?.offsetTop ?? 0);
      if(height!==previousHeight){root.style.setProperty("--radar-viewport-height",`${height}px`);previousHeight=height;}
      if(top!==previousTop){root.style.setProperty("--radar-viewport-top",`${top}px`);previousTop=top;}
    };
    const queueViewport = () => {if(!viewportFrame)viewportFrame=requestAnimationFrame(updateViewport);};
    visual?.addEventListener("resize",queueViewport);
    visual?.addEventListener("scroll",queueViewport);
    window.addEventListener("resize",queueViewport);
    updateViewport();

    // Never hide pending sections: failed JS, rapid scrolling and keyboard focus stay usable.
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (isMotionReduced() || root.dataset.intro) continue;
        const animation = entry.target.animate(
          [{ opacity: .65, transform: `translateY(${precise.matches ? 8 : 3}px)` }, { opacity: 1, transform: "translateY(0)" }],
          { duration: precise.matches ? 380 : 220, easing: "cubic-bezier(.16,1,.3,1)" }
        );
        animations.add(animation);
        animation.onfinish = () => { animations.delete(animation); layoutChanged(); };
      }
    }, { threshold: .08 });
    document.querySelectorAll(".watch-panel .panel-heading,.right-column .panel,.footnote").forEach(el => observer.observe(el));

    const header = document.querySelector<HTMLElement>(".topbar");
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".desktop-nav a:not([data-product-nav]),.mobile-dock a:not([data-product-nav])"));
    const sections = ["price-chart", "watchlist", "price-alerts"].map(id => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    let frame = 0;
    let activeId = "";
    let previousScrolled: boolean | undefined;
    let geometryDirty = true;
    let pageHeight = 0;
    let positions: { id: string; top: number; bottom: number }[] = [];
    let magneticFrame = 0;
    let magneticX = 0, magneticY = 0;
    let magneticBounds: DOMRect | null = null;
    const cta = document.querySelector<HTMLElement>("[data-magnetic]");
    const updateScroll = () => {
      frame = 0;
      const pageY = scrollY;
      const hash = location.hash.slice(1);
      // Read geometry together, only when layout changes. Ordinary scrolling uses cached document coordinates.
      if (geometryDirty) {
        positions = sections.flatMap(section => {
          const rect = section.getBoundingClientRect();
          return rect.width && rect.height ? [{ id: section.id, top: rect.top + pageY, bottom: rect.bottom + pageY }] : [];
        });
        pageHeight = document.documentElement.scrollHeight;
        geometryDirty = false;
      }
      const id = activeSection(positions.map(section => ({...section, top: section.top - pageY, bottom: section.bottom - pageY})), hash, pageY, innerHeight, pageY + innerHeight >= pageHeight - 8);
      const scrolled = pageY > 24;
      if (header && scrolled !== previousScrolled) { header.dataset.scrolled = String(scrolled); previousScrolled = scrolled; }
      if (id === activeId) return;
      activeId = id;
      for (const link of links) {
        const current = link.hash === `#${id}`;
        if (current) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    };
    const scroll = () => { magneticBounds = null; if (!frame) frame = requestAnimationFrame(updateScroll); };
    const layoutChanged = () => { geometryDirty = true; scroll(); };
    const resizeObserver = new ResizeObserver(layoutChanged);
    resizeObserver.observe(document.body);
    sections.forEach(section => resizeObserver.observe(section));
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", layoutChanged, { passive: true });
    window.addEventListener("hashchange", scroll);
    updateScroll();

    const resetMagnet = () => {
      cancelAnimationFrame(magneticFrame); magneticFrame = 0;
      magneticBounds = null;
      cta?.style.removeProperty("translate");
    };
    const moveMagnet = (event: PointerEvent) => {
      if (!cta || isMotionReduced() || !precise.matches || event.pointerType !== "mouse") return;
      magneticX = event.clientX; magneticY = event.clientY;
      if (!magneticFrame) magneticFrame = requestAnimationFrame(() => {
        magneticFrame = 0;
        const box = magneticBounds ?? (magneticBounds = cta.getBoundingClientRect());
        const x = Math.max(-2, Math.min(2, (magneticX - box.left - box.width / 2) * .035));
        const y = Math.max(-2, Math.min(2, (magneticY - box.top - box.height / 2) * .06));
        cta.style.translate = `${x}px ${y}px`;
      });
    };
    cta?.addEventListener("pointermove", moveMagnet);
    cta?.addEventListener("pointerleave", resetMagnet);
    cta?.addEventListener("blur", resetMagnet);
    const preferencesChanged = () => {
      resetMagnet();
      if (isMotionReduced()) { finishIntro(); animations.forEach(animation => animation.cancel()); animations.clear(); }
    };
    window.addEventListener(MOTION_CHANGE_EVENT, preferencesChanged);
    precise.addEventListener("change", preferencesChanged);
    preferencesChanged();

    return () => {
      clearTimeout(introTimer); finishIntro(); observer.disconnect(); resizeObserver.disconnect();
      opening?.removeEventListener("animationend",openingFinished);
      cancelAnimationFrame(viewportFrame);
      visual?.removeEventListener("resize",queueViewport);
      visual?.removeEventListener("scroll",queueViewport);
      window.removeEventListener("resize",queueViewport);
      root.style.removeProperty("--radar-viewport-height");root.style.removeProperty("--radar-viewport-top");
      animations.forEach(animation => animation.cancel());
      cancelAnimationFrame(frame); resetMagnet();
      window.removeEventListener("pointerdown", cancelIntro);
      window.removeEventListener("keydown", cancelIntro);
      window.removeEventListener("wheel", cancelIntro);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", layoutChanged);
      window.removeEventListener("hashchange", scroll);
      cta?.removeEventListener("pointermove", moveMagnet);
      cta?.removeEventListener("pointerleave", resetMagnet);
      cta?.removeEventListener("blur", resetMagnet);
      window.removeEventListener(MOTION_CHANGE_EVENT, preferencesChanged);
      stopMotionPreference();
      precise.removeEventListener("change", preferencesChanged);
    };
  }, []);

  return <div className="brand-opening" aria-hidden="true" style={{ display: "none" }}>
    <div className="opening-signature"><img src="/brand-light-v2.png" alt="" width={100} height={86}/><span>MARKET RADAR</span><i/></div>
  </div>;
}
