/**
 * The onboarding Task drawer: which of the three kinds a Task is, the due chip,
 * the first lines of its instructions, the steps count, and the one plain line
 * under a grey Complete button.
 *
 * Pure and browser-safe. Presentation only: the release, evidence, approval and
 * Breezeway rules stay with their own modules and the database.
 */
import { isBreezewayWorkOrderStep } from "@/lib/onboarding-breezeway";

export type DrawerKind = "ordinary" | "work_order" | "homeowner";

/** Work order first (by title), then anything that goes to the homeowner, else ordinary. */
export function drawerKind(t: {
  title: string | null | undefined;
  requires_owner_approval?: boolean | null | undefined;
  owner_dependency?: string | null | undefined;
  tags?: readonly string[] | null | undefined;
  hasOwnerItem?: boolean | undefined;
  hasPlanCard?: boolean | undefined;
}): DrawerKind {
  if (isBreezewayWorkOrderStep(t.title)) return "work_order";
  const dep = t.owner_dependency;
  const needsOwner =
    Boolean(t.requires_owner_approval) ||
    (dep != null && dep !== "" && dep !== "none") ||
    (t.tags ?? []).includes("active_owner") ||
    Boolean(t.hasOwnerItem) ||
    Boolean(t.hasPlanCard);
  return needsOwner ? "homeowner" : "ordinary";
}

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

/** "Due today", "Overdue {n} days", or nothing. Finished Tasks show no due chip. */
export function dueChip(dueOn: string | null | undefined, status: string | null | undefined, today: string): string | null {
  if (!dueOn || status === "complete" || status === "carryover") return null;
  const diff = dayNumber(today) - dayNumber(dueOn);
  if (diff === 0) return "Due today";
  if (diff > 0) return `Overdue ${diff} ${diff === 1 ? "day" : "days"}`;
  return null;
}

/** The first lines of the instructions, kept exactly as written (logins included). */
export function firstLines(text: string | null | undefined, lines = 3): { head: string; more: boolean } {
  const all = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!all) return { head: "", more: false };
  // Count only lines with words on them, so a heading and a blank line never use up the preview.
  const parts = all.split("\n");
  let seen = 0;
  let cut = parts.length;
  for (let n = 0; n < parts.length; n++) {
    if (parts[n]!.trim()) seen++;
    if (seen === lines) { cut = n + 1; break; }
  }
  const head = parts.slice(0, cut).join("\n").trim();
  return { head, more: parts.slice(cut).some((l) => l.trim()) };
}

export function stepsDone(steps: { status: string | null }[]): string {
  const done = steps.filter((s) => s.status === "complete").length;
  return `${done} of ${steps.length} done`;
}

export const PROOF_HINT = "Add where the proof is, or attach a file.";
export const WORK_ORDER_HINT = "Completes by itself when Breezeway marks the job done.";
export const SEND_HINT = "Completes when you send it to the homeowner.";

/**
 * The line under a grey Complete button; null when Complete is available.
 * Order: the release rule's own reason first, then the kind's own rule, then proof.
 */
export function completeHint(input: {
  kind: DrawerKind;
  /** Blocked by release (an earlier step, a lock), not by missing proof. */
  releaseBlocked: boolean;
  reason: string | null | undefined;
  /** Proof is required and none is stored yet. */
  evidenceMissing: boolean;
  /** A note of at least 5 characters, or a file. */
  proofOk: boolean;
  /** Waiting on a homeowner decision that has not come back. */
  awaitingOwner: boolean;
}): string | null {
  if (input.releaseBlocked) return input.reason || "This step is not ready yet.";
  if (input.kind === "work_order" && !input.proofOk) return WORK_ORDER_HINT;
  if (input.awaitingOwner) return input.kind === "homeowner" ? SEND_HINT : input.reason || SEND_HINT;
  if (input.evidenceMissing && !input.proofOk) return PROOF_HINT;
  return null;
}

/** Started label after Mark as started. */
export function startedLabel(startedAt: string, fmt: (iso: string) => string): string {
  return `Started · ${fmt(startedAt)}`;
}

/** People a role mention reaches on this home: the role's holder, else everyone in its pool. */
export function mentionIds(role: { assignee: string | null; pool: { id: string }[] } | undefined): string[] {
  if (!role) return [];
  if (role.assignee) return [role.assignee];
  return [...new Set(role.pool.map((p) => p.id))];
}

/** Fix 14: the "Project plan role: …" line is never shown at the start of What to do. */
export function stripPlanRoleLine(detail: string | null | undefined): string {
  return (detail ?? "")
    .split("\n")
    .filter((line) => !/^\s*project plan role\s*:/i.test(line))
    .join("\n")
    .replace(/^\s*\n+/, "");
}
