/**
 * The demo lens flag, readable without the React context.
 *
 * `DemoProvider` owns entering and leaving demo mode. Some low-level hooks —
 * `useRole` in particular — need to know whether the current preview is the
 * safe demo environment (where working the scenarios is the whole point) or an
 * ordinary read-only role preview (where nothing may change). Both read the
 * same session flag, so the two can never disagree.
 */
export const DEMO_FLAG_KEY = "resolve.demo-mode";
export const DEMO_FLAG_EVENT = "resolve:demo-mode";

export function readDemoFlag(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(DEMO_FLAG_KEY) === "1";
}

export function writeDemoFlag(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) window.sessionStorage.setItem(DEMO_FLAG_KEY, "1");
  else window.sessionStorage.removeItem(DEMO_FLAG_KEY);
  window.dispatchEvent(new Event(DEMO_FLAG_EVENT));
}

/* ---------------------------------------------------------------- seats */

/**
 * The operational seat a Platform Owner is previewing, when the permission
 * role alone does not describe the job. Director of Operations and Operations
 * Supervisor share the same permission role but see different work.
 */
export const PREVIEW_SEAT_KEY = "resolve.preview-seat";
export const PREVIEW_SEAT_EVENT = "resolve:preview-seat";

export type PreviewSeat = "director_ops" | "ops_supervisor";

export function readPreviewSeat(): PreviewSeat | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(PREVIEW_SEAT_KEY);
  return value === "director_ops" || value === "ops_supervisor" ? value : null;
}

export function writePreviewSeat(seat: PreviewSeat | null) {
  if (typeof window === "undefined") return;
  if (seat) window.sessionStorage.setItem(PREVIEW_SEAT_KEY, seat);
  else window.sessionStorage.removeItem(PREVIEW_SEAT_KEY);
  window.dispatchEvent(new Event(PREVIEW_SEAT_EVENT));
}

export const PREVIEW_SEAT_LABEL: Record<PreviewSeat, string> = {
  director_ops: "Director of Operations",
  ops_supervisor: "Operations Supervisor",
};
