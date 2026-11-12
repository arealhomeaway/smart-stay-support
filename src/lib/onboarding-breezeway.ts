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
  return /^\s*(draft\s+)?work order\s*:/i.test(title ?? "");
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
  not_linked: "Not sent yet",
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

/** The Task title without "Work order:" or "Draft work order:". */
export function stripWorkOrderPrefix(title: string | null | undefined): string {
  return String(title ?? "").replace(/^\s*(draft\s+)?work order\s*:\s*/i, "").trim();
}

/**
 * Item 37: the Breezeway Title default. The chosen template's name; before a
 * template is chosen, the Task title without its work order prefix.
 */
export function breezewayTitleDefault(taskTitle: string | null | undefined, templateName?: string | null): string {
  return (templateName ?? "").trim() || stripWorkOrderPrefix(taskTitle);
}

/**
 * Item 37: a new template replaces the title only while it still reads the last
 * default, so a title the user typed is kept.
 */
export function nextBreezewayTitle(current: string, previousDefault: string, nextDefault: string): string {
  return current.trim() === previousDefault.trim() ? nextDefault : current;
}

const HEADING = /^\s*[A-Z][A-Za-z ]{1,30}:\s*$/;

/**
 * Item 36: the Breezeway Description default is the step's short summary only:
 * the "About this step" text, else the first sentence of the step description.
 * Never the full About this step / Instructions text.
 */
export function breezewayStepSummary(detail: string | null | undefined, description?: string | null): string {
  const text = String(detail ?? "").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /^\s*about this step\s*:/i.test(l));
  if (at >= 0) {
    const out: string[] = [];
    const inline = lines[at]!.replace(/^\s*about this step\s*:\s*/i, "").trim();
    if (inline) out.push(inline);
    for (let n = at + 1; n < lines.length; n++) {
      const l = lines[n]!;
      if (!l.trim()) { if (out.length) break; continue; }
      if (HEADING.test(l)) break;
      out.push(l.trim());
    }
    if (out.length) return out.join(" ");
  }
  return firstSentence(text) || firstSentence(description);
}

function firstSentence(text: string | null | undefined): string {
  const line = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !HEADING.test(l));
  if (!line) return "";
  const body = line.replace(/^(\d+[.)]|[-*\u2022])\s+/, "");
  const m = body.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1]! : body).trim();
}
