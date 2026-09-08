/** Browser execution eligibility; does not guarantee the browser will run timers. */
export function canMonitor(enabled:boolean, visible:boolean, allowBackground:boolean, online:boolean):boolean {
  return enabled && online && (visible || allowBackground);
}
