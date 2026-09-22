export type MotionPreference = "system" | "normal" | "reduced";
export const PREFERENCES_KEY = "market-radar-preferences-v1";
export const MOTION_CHANGE_EVENT = "radar-motion-change";

export function normalizeMotionPreference(value: unknown): MotionPreference {
  return value === "normal" || value === "reduced" ? value : "system";
}
export function resolveMotionPreference(preference: MotionPreference, systemReduced: boolean): "normal" | "reduced" {
  return preference === "reduced" || preference === "system" && systemReduced ? "reduced" : "normal";
}

// The same pure rules run before body paint and after hydration. No browser reads at module load.
export const MOTION_BOOTSTRAP = `(()=>{var root=document.documentElement,p='system',storageOK=true;
try{p=(${normalizeMotionPreference.toString()})(JSON.parse(localStorage.getItem('${PREFERENCES_KEY}')||'null')?.motionPreference)}catch(e){storageOK=false}
var reduced=false;try{reduced=matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){}
root.dataset.motionPreference=p;root.dataset.systemMotion=reduced?'reduced':'normal';root.dataset.motion=(${resolveMotionPreference.toString()})(p,reduced);
try{if(storageOK&&!sessionStorage.getItem('radar-brand-seen')&&!location.hash){sessionStorage.setItem('radar-brand-seen','1');if(root.dataset.motion==='reduced')return;
root.dataset.intro='play';var finish=function(){delete root.dataset.intro;['pointerdown','keydown','wheel'].forEach(function(type){window.removeEventListener(type,finish)})};
['pointerdown','keydown','wheel'].forEach(function(type){window.addEventListener(type,finish,{passive:true})});setTimeout(finish,matchMedia('(max-width:600px)').matches?1100:1600)}}catch(e){delete root.dataset.intro}})();`;

let systemQuery: MediaQueryList | undefined;
export function isMotionReduced() { return document.documentElement.dataset.motion === "reduced"; }

export function applyMotionPreference(preference: MotionPreference) {
  const root = document.documentElement;
  const systemReduced = systemQuery?.matches ?? root.dataset.systemMotion === "reduced";
  root.dataset.motionPreference = preference;
  root.dataset.systemMotion = systemReduced ? "reduced" : "normal";
  root.dataset.motion = resolveMotionPreference(preference, systemReduced);
  window.dispatchEvent(new Event(MOTION_CHANGE_EVENT));
}

/** Owned once by MotionExperience. Consumers subscribe to the resolved event, not matchMedia. */
export function startMotionPreference() {
  systemQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const query = systemQuery;
  const update = () => applyMotionPreference(normalizeMotionPreference(document.documentElement.dataset.motionPreference));
  query.addEventListener("change", update);
  update();
  return () => { query.removeEventListener("change", update); if (systemQuery === query) systemQuery = undefined; };
}
