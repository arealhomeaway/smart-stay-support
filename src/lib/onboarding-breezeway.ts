/**
 * Breezeway work orders on onboarding steps (Kati ticket 67).
 *
 * The only work orders are work orders IN Breezeway; Resolve creates no
 * internal work order. A step whose title starts with "Work order:" carries a
 * Breezeway section: a tentative date, who it is assigned to (a Breezeway
 * person or left unassigned), and the Breezeway task it is linked to.
 * Pure and browser-safe; the database action save_onboarding_task_breezeway
 * repeats the parsing rule.
 */
export const ONBOARDING_BREEZEWAY_SEND_FLAG = "onboarding_breezeway_send";

export function isBreezewayWorkOrderStep(title: string | null | undefined): boolean {
  return /^\s*work order\s*:/i.test(title ?? "");
}

/** Setup steps that show the home's Breezeway property link from the mirror. */
export function showsBreezewayHomeLink(title: string | null | undefined): boolean {
  return /^\s*set up the breezeway (property profile|and yale integration)/i.test(title ?? "");
}

export type BreezewayRef = { ok: true; taskId: number; url: string | null } | { ok: false; error: string };

export const BREEZEWAY_REF_ERROR = "Paste the Breezeway task number, or its link from app.breezeway.io.";

/** A pasted task number or app.breezeway.io link, read the same way the database reads it. */
export function parseBreezewayRef(input: string | null | undefined): BreezewayRef | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (/^#?\d{1,15}$/.test(raw)) return { ok: true, taskId: Number(raw.replace("#", "")), url: null };
  const match = /^https:\/\/app\.breezeway\.io\/\S*?\btasks?\/(\d{1,15})\b/i.exec(raw);
  if (match) return { ok: true, taskId: Number(match[1]), url: raw };
  return { ok: false, error: BREEZEWAY_REF_ERROR };
}

export function breezewayTaskUrl(taskId: number | string): string {
  return `https://app.breezeway.io/task/${taskId}`;
}

export type BreezewayConnection = "not_linked" | "waiting_for_sync" | "connected";

/** Connected only once the linked task is seen in the Breezeway mirror. */
export function breezewayConnection(input: {
  breezewayTaskId: number | null | undefined;
  mirrored: boolean;
}): BreezewayConnection {
  if (!input.breezewayTaskId) return "not_linked";
  return input.mirrored ? "connected" : "waiting_for_sync";
}

export const CONNECTION_LABEL: Record<BreezewayConnection, string> = {
  not_linked: "Not linked to Breezeway yet",
  waiting_for_sync: "Linked. Waiting for the Breezeway sync",
  connected: "Connected to Breezeway",
};

/** Why Send to Breezeway cannot run, or null when it may. The switch is checked first. */
export function sendToBreezewayRefusal(input: {
  switchOn: boolean;
  homeEligible: boolean;
  homeReason?: string | null;
  tentativeDate: string | null | undefined;
  alreadyLinked: boolean;
}): string | null {
  if (!input.switchOn) return "Sending to Breezeway from onboarding is switched off. Create the work order in Breezeway, then paste its number here.";
  if (input.alreadyLinked) return "This task is already linked to a Breezeway work order.";
  if (!input.homeEligible) return input.homeReason || "This home is not verified in Breezeway yet.";
  if (!input.tentativeDate) return "Pick a tentative date first.";
  return null;
}

/** One send per task: the request key never changes for a task. */
export function onboardingSendRequestKey(taskId: string): string {
  return `onboarding-task-${taskId}`;
}
