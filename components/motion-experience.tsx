"use client";

import { useEffect } from "react";
import { activeSection } from "@/lib/navigation-section";

/** One controller for presentation only; quote and chart updates never enter this loop. */
export function MotionExperience() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const precise = matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px)");
    const animations = new Set<Animation>();
    const finishIntro = () => { delete root.dataset.intro; };
    const introTimer = window.setTimeout(finishIntro, 1900);
    const cancelIntro = () => finishIntro();
    window.addEventListener("pointerdown", cancelIntro, { passive: true });
    window.addEventListener("keydown", cancelIntro);
    window.addEventListener("wheel", cancelIntro, { passive: true });

    // Never hide pending sections: failed JS, rapid scrolling and keyboard focus stay usable.
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (reduced.matches || root.dataset.intro) continue;
        const animation = entry.target.animate(
          [{ opacity: .65, transform: `translateY(${precise.matches ? 8 : 3}px)` }, { opacity: 1, transform: "translateY(0)" }],
          { duration: precise.matches ? 480 : 240, easing: "cubic-bezier(.16,1,.3,1)" }
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      }
    }, { threshold: .08 });
    document.querySelectorAll(".watch-panel .panel-heading,.right-column .panel,.footnote").forEach(el => observer.observe(el));

    const header = document.querySelector<HTMLElement>(".topbar");
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(".desktop-nav a,.mobile-dock a"));
    const sections = ["price-chart", "watchlist", "price-alerts"].map(id => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    let frame = 0;
    let activeId = "";
    let magneticFrame = 0;
    let magneticX = 0, magneticY = 0;
    const cta = document.querySelector<HTMLElement>("[data-magnetic]");
    const updateScroll = () => {
      frame = 0;
      if (header) header.dataset.scrolled = String(scrollY > 24);
      const hash = location.hash.slice(1);
      const positions = sections.filter(section => section.getClientRects().length).map(section => {
        const rect = section.getBoundingClientRect();
        return { id: section.id, top: rect.top, bottom: rect.bottom };
      });
      const id = activeSection(positions, hash, scrollY, innerHeight, scrollY + innerHeight >= document.documentElement.scrollHeight - 8);
      if (id === activeId) return;
      activeId = id;
      for (const link of links) {
        const current = link.hash === `#${id}`;
        if (current) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      }
    };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(updateScroll); };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll, { passive: true });
    window.addEventListener("hashchange", scroll);
    updateScroll();

    const resetMagnet = () => {
      cancelAnimationFrame(magneticFrame); magneticFrame = 0;
      cta?.style.removeProperty("translate");
    };
    const moveMagnet = (event: PointerEvent) => {
      if (!cta || reduced.matches || !precise.matches || event.pointerType !== "mouse") return;
      const box = cta.getBoundingClientRect();
      magneticX = Math.max(-2, Math.min(2, (event.clientX - box.left - box.width / 2) * .035));
      magneticY = Math.max(-2, Math.min(2, (event.clientY - box.top - box.height / 2) * .06));
      if (!magneticFrame) magneticFrame = requestAnimationFrame(() => {
        magneticFrame = 0;
        cta.style.translate = `${magneticX}px ${magneticY}px`;
      });
    };
    cta?.addEventListener("pointermove", moveMagnet);
    cta?.addEventListener("pointerleave", resetMagnet);
    cta?.addEventListener("blur", resetMagnet);
    const preferencesChanged = () => {
      resetMagnet();
      if (reduced.matches) { finishIntro(); animations.forEach(animation => animation.cancel()); animations.clear(); }
    };
    reduced.addEventListener("change", preferencesChanged);
    precise.addEventListener("change", preferencesChanged);

    return () => {
      clearTimeout(introTimer); finishIntro(); observer.disconnect();
      animations.forEach(animation => animation.cancel());
      cancelAnimationFrame(frame); resetMagnet();
      window.removeEventListener("pointerdown", cancelIntro);
      window.removeEventListener("keydown", cancelIntro);
      window.removeEventListener("wheel", cancelIntro);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
      window.removeEventListener("hashchange", scroll);
      cta?.removeEventListener("pointermove", moveMagnet);
      cta?.removeEventListener("pointerleave", resetMagnet);
      cta?.removeEventListener("blur", resetMagnet);
      reduced.removeEventListener("change", preferencesChanged);
      precise.removeEventListener("change", preferencesChanged);
    };
  }, []);

  return <div className="brand-opening" aria-hidden="true" style={{ display: "none" }}>
    <div className="opening-signature"><img src="/brand.svg" alt="" width={100} height={86}/><span>MARKET RADAR</span><i/></div>
  </div>;
}
