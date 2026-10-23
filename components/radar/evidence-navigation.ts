import { isMotionReduced } from "@/lib/motion-preference";

export const evidenceId = (scope: string, id: string) => `${scope}-evidence-${encodeURIComponent(id)}`;
const labels: Record<string, string> = {
  "short.direction": "短窗方向结构", "short.volatility": "短窗 RMS 波动",
  "medium.direction": "中窗方向结构", "medium.volatility": "中窗 RMS 波动",
  "short.relative": "短窗相对表现", "quote": "报价与时效",
};
export const evidenceLabel = (id: string) => labels[id] ?? id;

// Only DOM anchors live here. No file content, Context or persistent browser storage.
const origins = new WeakMap<HTMLElement, { trigger: HTMLElement; scrollY: number }>();
function reveal(target: HTMLElement) {
  target.dispatchEvent(new CustomEvent("radar-history-reveal", { bubbles: true }));
  let parent: HTMLElement | null = target;
  while (parent) {
    if (parent.tagName === "DETAILS") (parent as HTMLDetailsElement).open = true;
    parent = parent.parentElement;
  }
}
function focusVisible(target: HTMLElement, scrollY?: number) {
  const identity = target.id;
  reveal(target);
  // One layout frame follows disclosure opening / local-section activation.
  requestAnimationFrame(() => {
    if (!target.isConnected || target.id !== identity || target.closest("[hidden]")) return;
    target.focus({ preventScroll: true });
    const behavior = isMotionReduced() ? "instant" : "smooth";
    if (scrollY !== undefined) window.scrollTo({ top: scrollY, behavior });
    else target.scrollIntoView({ block: "start", behavior });
  });
}
export function visitEvidence(scope: string, id: string, trigger: HTMLElement) {
  const target = document.getElementById(evidenceId(scope, id));
  if (!target) return;
  origins.set(target, { trigger, scrollY: window.scrollY });
  focusVisible(target);
}
export function returnToCitation(scope: string, id: string) {
  const target = document.getElementById(evidenceId(scope, id));
  const origin = target && origins.get(target);
  if (origin?.trigger.isConnected && !origin.trigger.closest("[hidden]")) focusVisible(origin.trigger, origin.scrollY);
  else {
    // Never recreate a replaced result or find another panel with the same evidence ID.
    const heading = document.getElementById(`${scope}-heading`);
    if (heading) focusVisible(heading);
  }
}
