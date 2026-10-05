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

/**
 * Whether the current user may operate the demo environment at all — a
 * Platform Owner (admin). Pure and role-only: it never depends on the demo
 * environment being seeded, on any RPC, or on the demo flag itself, so
 * admin detection can never get stuck behind a seed-related failure or a
 * slow/one-shot network call.
 */
export function canOperateDemo(actualRoles: readonly string[], demoFinanceTester = false): boolean {
  // Admins, plus synthetic Finance accounts the database has designated (audited allowlist).
  return actualRoles.includes("admin") || demoFinanceTester === true;
}

/**
 * Whether the demo lens is actually on: the viewer may operate the demo
 * environment and has flipped the session flag on. Demo mode deliberately
 * does NOT require stepping into a persona — a Platform Owner demos the
 * portals their own permissions already grant them. Also independent of
 * whether demo data has ever been seeded.
 */
export function resolveDemoMode(input: {
  canDemo: boolean;
  flag: boolean;
  /** Legacy input, no longer part of the rule. */
  hasPreviewIdentity?: boolean;
}): boolean {
  return input.canDemo && input.flag;
}

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

/**
 * The one label every preview-identity surface must show — the seat when
 * one was chosen (so "Director of Operations" reads as itself, not as
 * "Supervisor", the permission role it happens to share), else the plain
 * role label, else the viewer's real label. Use this everywhere a Platform
 * Owner's current identity is displayed (role badges, sign-out controls,
 * greetings) instead of re-deriving the fallback chain locally.
 */
/**
 * True when a ticket already loaded into memory no longer belongs under the
 * current demo lens — toggling demo mode while this exact ticket stays open
 * doesn't by itself trigger the filtered query to refetch, so a page can't
 * rely on the query alone to notice the record no longer qualifies. Compare
 * the loaded record's own flag directly instead.
 */
export function ticketDemoMismatch(loadedTicketIsDemo: boolean | null, demoMode: boolean): boolean {
  return loadedTicketIsDemo !== null && loadedTicketIsDemo !== demoMode;
}

export function previewIdentityLabel(input: {
  previewing: boolean;
  previewSeat: PreviewSeat | null;
  previewRoleLabel: string | null;
  actualLabel: string;
}): string {
  if (!input.previewing) return input.actualLabel;
  if (input.previewSeat) return PREVIEW_SEAT_LABEL[input.previewSeat];
  return input.previewRoleLabel ?? input.actualLabel;
}
