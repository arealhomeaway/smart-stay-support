/**
 * Active Owner plan engine: screen rules. Pure functions only, so visibility and
 * graceful degradation are testable without a browser or a database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const NOT_SET_UP = "Not set up yet";

/** True when an error means the staged plan engine tables or functions do not exist yet. */
export function isMissingDbObject(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (["PGRST202", "PGRST205", "42P01", "42883", "3F000"].includes(e.code ?? "")) return true;
  const m = (e.message ?? "").toLowerCase();
  return m.includes("could not find the function") || m.includes("could not find the table") ||
    (m.includes("does not exist") && (m.includes("relation") || m.includes("function")));
}

export type Available<T> = { available: true; data: T } | { available: false };

/** Wraps a query result: missing engine objects become "not available", other errors throw. */
export function unwrap<T>(res: { data: T | null; error: unknown }): Available<T> {
  if (res.error) {
    if (isMissingDbObject(res.error)) return { available: false };
    throw new Error((res.error as { message?: string }).message ?? "Could not load");
  }
  return { available: true, data: res.data as T };
}

export type Who = { isAdmin: boolean; isOnboardingDirector: boolean; isOpsDirector?: boolean; isStaff?: boolean };
export const canEditCardLibrary = (w: Who) => w.isAdmin || w.isOnboardingDirector;
export const canToggleHomeAutomation = canEditCardLibrary;
export const canViewHomePlan = (w: Who) => Boolean(w.isStaff) || canEditCardLibrary(w);
export const canViewContributions = (w: Who) => w.isAdmin || w.isOnboardingDirector || Boolean(w.isOpsDirector);

export type FieldType = "text" | "long_text" | "number" | "date" | "yes_no";
export type OutputField = { key: string; label: string; type: FieldType };
export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "yes_no", label: "Yes or no" },
];

export function parseOutputFields(raw: unknown): OutputField[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((f, i) => {
    if (typeof f === "string") return [{ key: slug(f) || `field_${i + 1}`, label: f, type: "text" as const }];
    if (f && typeof f === "object" && typeof (f as OutputField).label === "string") {
      const o = f as Partial<OutputField>;
      const type = FIELD_TYPES.some((t) => t.value === o.type) ? (o.type as FieldType) : "text";
      return [{ key: o.key || slug(o.label!) || `field_${i + 1}`, label: o.label!, type }];
    }
    return [];
  });
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function addField(fields: OutputField[], label: string, type: FieldType): OutputField[] {
  let key = slug(label) || "field";
  const base = key;
  for (let n = 2; fields.some((f) => f.key === key); n++) key = `${base}_${n}`;
  return [...fields, { key, label, type }];
}
export const removeField = (fields: OutputField[], key: string) => fields.filter((f) => f.key !== key);
export function moveField(fields: OutputField[], key: string, dir: -1 | 1): OutputField[] {
  const i = fields.findIndex((f) => f.key === key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= fields.length) return fields;
  const next = [...fields];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export type LibraryRow = { id: string; code: string; title: string; card_group: string; lane: string; stage_window: string; status: string };
export type CardFilters = { group: string; lane: string; stage: string; status: string; q: string };
export function filterCards<T extends LibraryRow>(rows: T[], f: CardFilters): T[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) =>
    (f.group === "all" || r.card_group === f.group) && (f.lane === "all" || r.lane === f.lane) &&
    (f.stage === "all" || r.stage_window === f.stage) && (f.status === "all" || r.status === f.status) &&
    (!q || r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)));
}

/** Status buttons offered for a card. Retired cards can only go back to Draft. */
export function statusActions(status: string): { to: "released" | "retired" | "draft"; label: string }[] {
  if (status === "draft") return [{ to: "released", label: "Release" }, { to: "retired", label: "Retire" }];
  if (status === "released") return [{ to: "retired", label: "Retire" }, { to: "draft", label: "Back to Draft" }];
  return [{ to: "draft", label: "Back to Draft" }];
}

export const OUTCOME_LABEL: Record<string, string> = {
  skipped_passed: "Skipped, stage passed",
  already_covered: "Already covered",
  locked: "Locked",
  open: "Open",
};

export function previewSummary(outcomes: Record<string, number> | undefined): string {
  const o = outcomes ?? {};
  return ["open", "locked", "already_covered", "skipped_passed"]
    .map((k) => `${o[k] ?? 0} ${OUTCOME_LABEL[k]!.toLowerCase()}`).join(", ");
}

/** Homeowner portal view of one plan card. Locked cards are visible but never actionable. */
export type PortalPlanCard = {
  plan_card_id: string; property_id?: string | null; title: string; opens_text: string; what_text: string; output_fields: unknown;
  join_outcome: string; unlocked_at: string | null; expired_at: string | null; owner_completed_at: string | null;
};
export type PortalView =
  | { kind: "locked"; text: string; actionable: false }
  | { kind: "open"; fields: OutputField[]; actionable: true }
  | { kind: "done"; actionable: false }
  | { kind: "closed"; actionable: false };
export function portalCardView(c: PortalPlanCard): PortalView {
  if (c.owner_completed_at) return { kind: "done", actionable: false };
  if (c.expired_at) return { kind: "closed", actionable: false };
  if (!c.unlocked_at) {
    const what = c.opens_text.trim().replace(/[.\s]+$/, "") || "finish the step before this";
    return { kind: "locked", text: `Coming soon: waiting on ARHA to ${what}`, actionable: false };
  }
  return { kind: "open", fields: parseOutputFields(c.output_fields), actionable: true };
}

/** Required: every field must have a value. Numbers must be numbers. */
export function validateSubmission(fields: OutputField[], values: Record<string, string>): string | null {
  for (const f of fields) {
    const v = (values[f.key] ?? "").trim();
    if (!v) return `Please fill in ${f.label}`;
    if (f.type === "number" && !Number.isFinite(Number(v))) return `${f.label} must be a number`;
  }
  return null;
}
export function submissionValues(fields: OutputField[], values: Record<string, string>): Record<string, string | number | boolean> {
  return Object.fromEntries(fields.map((f) => {
    const v = (values[f.key] ?? "").trim();
    return [f.key, f.type === "number" ? Number(v) : f.type === "yes_no" ? v === "yes" : v];
  }));
}

export function paceSentence(weeklyNeeded: number, endLabel: string): string {
  return `About ${weeklyNeeded} hours a week to reach 100 by ${endLabel}`;
}

/** Task drawer: verify badge shows only when the linked plan card was completed by the homeowner. */
export function showVerifyBadge(planCard: { owner_completed_at: string | null } | null | undefined): boolean {
  return Boolean(planCard?.owner_completed_at);
}

export type ContributionRow = { id: string; planCardId?: string; card: string; cardCode: string; home: string; member: string; submittedAt: string; values: Record<string, unknown> };
export function filterContributions(rows: ContributionRow[], f: { card: string; home: string; from: string; to: string; q: string; planCard?: string }) {
  const q = f.q.trim().toLowerCase();
  return rows.filter((r) =>
    (!f.planCard || r.planCardId === f.planCard) && (f.card === "all" || r.cardCode === f.card) && (f.home === "all" || r.home === f.home) &&
    (!f.from || r.submittedAt.slice(0, 10) >= f.from) && (!f.to || r.submittedAt.slice(0, 10) <= f.to) &&
    (!q || [r.card, r.cardCode, r.home, r.member, JSON.stringify(r.values)].some((s) => s.toLowerCase().includes(q))));
}

export const PAGE_SIZE = 1000;
/** Reads every page (no row cap). Missing engine objects become "not available". */
export async function fetchAllPages<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<Available<T[]>> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const r = unwrap<T[]>(await page(from, from + PAGE_SIZE - 1));
    if (!r.available) return r;
    const rows = r.data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) return { available: true, data: out };
  }
}

export function contributionCount(shown: number, total: number) {
  return shown === total ? `${total} ${total === 1 ? "answer" : "answers"}` : `Showing ${shown} of ${total} answers`;
}

/** True only when the error says ao_process_clocks itself is not installed. */
export function isClocksFunctionMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string; details?: string; hint?: string };
  const m = `${e.message ?? ""}`.toLowerCase();
  const namesIt = /\bao_process_clocks\b/.test(m);
  if (e.code === "PGRST202") return namesIt && m.includes("could not find the function");
  if (e.code === "42883") return namesIt && /function\s+(public\.)?ao_process_clocks\s*\(/.test(m) && m.includes("does not exist");
  return false;
}

/** 5-minute job part: runs the timed reminders/expiries; silently skipped until the function exists. */
export async function runAoClocksGuarded(db: Pick<SupabaseClient, "rpc">) {
  const res = await db.rpc("ao_process_clocks" as never, {} as never);
  if (res.error) {
    // Only a missing clock function is "not set up yet"; anything else inside it is a job error.
    if (isClocksFunctionMissing(res.error)) return { skipped: true as const };
    throw new Error((res.error as { message?: string }).message ?? "Plan clocks failed");
  }
  return { skipped: false as const, result: res.data };
}

/** Plan cards grouped under each home, homes in the same order as the owner's other items. */
export function groupPlanByHome<T extends { property_id?: string | null }>(
  cards: T[],
  homes: { propertyId: string; name: string }[],
): { propertyId: string | null; name: string; cards: T[] }[] {
  const order = new Map(homes.map((h, i) => [h.propertyId, i]));
  const groups = new Map<string, { propertyId: string | null; name: string; cards: T[] }>();
  for (const c of cards) {
    const id = c.property_id ?? null;
    const key = id ?? "";
    const g = groups.get(key) ?? { propertyId: id, name: homes.find((h) => h.propertyId === id)?.name ?? "Your home", cards: [] };
    g.cards.push(c);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) =>
    (order.get(a.propertyId ?? "") ?? 999) - (order.get(b.propertyId ?? "") ?? 999) || a.name.localeCompare(b.name));
}

/** Only a missing daily email function means "not set up yet"; anything else is a job error. */
export function isOwnerEmailRunMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  const m = `${e.message ?? ""}`.toLowerCase();
  if (!/\bao_owner_email_run\b/.test(m)) return false;
  return (e.code === "PGRST202" && m.includes("could not find the function")) || (e.code === "42883" && m.includes("does not exist"));
}

/** Five minute job step: plan is ready emails, then the one daily email at the set time. */
export async function runAoOwnerEmailGuarded(db: Pick<SupabaseClient, "rpc">) {
  const res = await db.rpc("ao_owner_email_run" as never, {} as never);
  if (res.error) {
    if (isOwnerEmailRunMissing(res.error)) return { skipped: true as const };
    throw new Error((res.error as { message?: string }).message ?? "Daily homeowner email failed");
  }
  return { skipped: false as const, result: res.data };
}
