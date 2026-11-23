/**
 * Active Owner enrollment is automatic on every path (Admin, Nov 23). Server only.
 *
 * autoEnrollHome is the one place every path goes through: Add property, Owner Type saves,
 * Start onboarding and scope changes, a saved email or closing date, and the 5 minute check.
 * It runs the existing one-step enrollment (enrollFully). Whoever saved is the person recorded;
 * their role does not matter. It never creates a second program, never removes or archives
 * anything, and every missing detail or failure becomes a Needs you now item, never silence.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutoEnrollmentInput, EnrollmentReceipt } from "./active-owner-enrollment";
import {
  MODULE_FROM_OWNER_TYPE,
  OWNER_TYPE_FROM_MODULE,
  SETUP_ITEM_TITLE,
  autoEnrollHistoryLine,
  enrollmentState,
  labelSync,
  plainSetupReason,
  safetyNetAction,
  setupItemLink,
  type AutoEnrollSource,
  type LinkRow,
  type SetupItemKind,
} from "./active-owner-auto-enroll";
import { enrollmentClosingDate } from "./owner-type-enrollment";

type Db = SupabaseClient;
type Row = Record<string, unknown>;
const MISSING = new Set(["42P01", "PGRST205", "PGRST202", "42883"]);
const isMissing = (e: { code?: string } | null | undefined) => Boolean(e?.code && MISSING.has(e.code));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AutoEnrollOutcome =
  | { kind: "enrolled"; email: string; welcomeHeld: boolean; receipt?: EnrollmentReceipt }
  | { kind: "enrolled_no_email"; receipt?: EnrollmentReceipt }
  | { kind: "waiting_closing"; receipt?: EnrollmentReceipt }
  | { kind: "already_enrolled" }
  | { kind: "skipped"; reason: "demo" | "archived" | "not_found" }
  | { kind: "needs_attention"; detail: string; receipt?: EnrollmentReceipt };

export type AutoEnrollInput = {
  propertyId: string;
  /** The person who saved; null only for the 5 minute check (then the Director of Onboarding seat runs it). */
  actorId: string | null;
  source: AutoEnrollSource;
  /** The caller's own signed-in client. Used only when they may enroll and every detail is there. */
  actorClient?: SupabaseClient | null;
  overrides?: { ownerName?: string | null; ownerEmail?: string | null; closingDate?: string | null; notes?: string | null };
};

type Route = { assignee: string | null; reason: string; noProjectManager: boolean };
type OwnerRezOwner = { sourceId: string; name?: string | null | undefined; email?: string | null | undefined; phone?: string | null | undefined };

export type AutoEnrollDeps = {
  enroll: (actor: { id: string; client: SupabaseClient | null }, input: AutoEnrollmentInput) => Promise<EnrollmentReceipt>;
  mayEnrollAsSelf: (client: SupabaseClient, userId: string, isDemo: boolean) => Promise<boolean>;
  ownerRezOwner: (listingId: string) => Promise<OwnerRezOwner | null>;
  resolveOwnerRecord: (input: { fromOwnerRez: OwnerRezOwner | null; typed: { name?: string | null; email?: string | null } }) => Promise<string | null>;
  route: (propertyId: string) => Promise<Route>;
  seatHolder: (code: string) => Promise<string | null>;
  newId: () => string;
  now: () => Date;
};

/** The existing enrollment step, run on the server as the given staff member (ao-auto-enroll wrapper). */
export function systemActor(db: Db, actorId: string): SupabaseClient {
  return {
    rpc: (fn: string, args: Record<string, unknown>) => {
      if (fn !== "active_owner_enrollment_step") throw new Error("Only enrollment steps run here.");
      return db.rpc("active_owner_auto_enrollment_step" as never, { _actor_id: actorId, ...args } as never);
    },
  } as unknown as SupabaseClient;
}

export function realAutoEnrollDeps(db: Db): AutoEnrollDeps {
  return {
    enroll: async (actor, input) => {
      const { enrollFully } = await import("./active-owner-enrollment.server");
      return enrollFully(db, actor.client ?? systemActor(db, actor.id), actor.id, input);
    },
    mayEnrollAsSelf: async (client, userId, isDemo) => {
      const m = await import("./owner-welcome.functions");
      const ctx = { supabase: client, userId };
      return (await m.isActiveOwnerAuthority(ctx)) && (await m.mayActOnRecord(ctx, isDemo));
    },
    ownerRezOwner: async (listingId) => (await import("./property-intake.server")).ownerRezOwner(listingId),
    resolveOwnerRecord: async (input) => (await import("./property-intake.server")).resolveOwnerRecord(db as never, input),
    route: async (propertyId) => (await import("./owner-followups.server")).routeFor(db, propertyId),
    seatHolder: async (code) => {
      const r = await db.rpc("seat_holder" as never, { _code: code } as never);
      return (r.data as string | null) ?? null;
    },
    newId: () => crypto.randomUUID(),
    now: () => new Date(),
  };
}

// ------------------------------------------------------------------ setup items
type OpenItem = { id: string; kind: SetupItemKind; request_id: string | null; request_input: Row | null; attempts: number; last_attempt_at: string | null };

async function readOpenItems(db: Db, propertyId: string): Promise<OpenItem[] | null> {
  const r = await db
    .from("active_owner_setup_items" as never)
    .select("id, kind, request_id, request_input, attempts, last_attempt_at")
    .eq("property_id", propertyId)
    .eq("status", "open");
  if (isMissing(r.error)) return null;
  if (r.error) throw new Error("Could not read Active Owner setup items.");
  return (r.data ?? []) as unknown as OpenItem[];
}

async function ensureItem(
  db: Db,
  deps: AutoEnrollDeps,
  items: OpenItem[] | null,
  p: { propertyId: string; kind: SetupItemKind; detail?: string | null; source: AutoEnrollSource; actorId: string | null; isDemo: boolean; requestId?: string | null | undefined; requestInput?: Row | null | undefined; attempted?: boolean },
) {
  if (items === null) return; // staged table not there yet
  const now = deps.now().toISOString();
  const existing = items.find((i) => i.kind === p.kind);
  if (existing) {
    const patch: Row = { updated_at: now, detail: p.detail ?? null };
    if (p.attempted) { patch["attempts"] = existing.attempts + 1; patch["last_attempt_at"] = now; }
    if (p.requestId !== undefined) { patch["request_id"] = p.requestId; patch["request_input"] = p.requestInput ?? null; }
    const u = await db.from("active_owner_setup_items" as never).update(patch as never).eq("id", existing.id);
    if (u.error) throw new Error("Could not update the Active Owner setup item.");
    return;
  }
  let audience: "person" | "director_and_admin" = "director_and_admin";
  let assignee: string | null = null;
  let reason: string | null = null;
  if (p.kind !== "needs_attention") {
    const r = await deps.route(p.propertyId);
    if (r.assignee) { audience = "person"; assignee = r.assignee; reason = r.reason; }
  }
  const ins = await db.from("active_owner_setup_items" as never).insert({
    property_id: p.propertyId, kind: p.kind, audience, assigned_to: assignee, route_reason: reason,
    title: SETUP_ITEM_TITLE[p.kind], detail: p.detail ?? null, link_path: setupItemLink(p.kind, p.propertyId),
    source: p.source, actor_id: p.actorId, request_id: p.requestId ?? null, request_input: p.requestInput ?? null,
    attempts: p.attempted ? 1 : 0, last_attempt_at: p.attempted ? now : null, is_demo: p.isDemo,
  } as never);
  if (ins.error && ins.error.code !== "23505") throw new Error("Could not save the Active Owner setup item.");
}

async function closeItems(db: Db, deps: AutoEnrollDeps, items: OpenItem[] | null, kinds: SetupItemKind[], reason: string) {
  if (!items) return;
  const ids = items.filter((i) => kinds.includes(i.kind)).map((i) => i.id);
  if (ids.length === 0) return;
  const now = deps.now().toISOString();
  const u = await db
    .from("active_owner_setup_items" as never)
    .update({ status: "closed", closed_at: now, updated_at: now, close_reason: reason } as never)
    .in("id", ids);
  if (u.error) throw new Error("Could not clear the Active Owner setup item.");
}

// ------------------------------------------------------------------ history
async function saverName(db: Db, id: string | null) {
  if (!id) return null;
  const r = await db.from("profiles").select("full_name, email").eq("id", id).maybeSingle();
  const p = r.data as { full_name: string | null; email: string | null } | null;
  return p?.full_name?.trim() || p?.email || null;
}

async function recordHistory(
  db: Db,
  p: { projectId: string | null; propertyId: string; isDemo: boolean; actorId: string | null; source: AutoEnrollSource; summary: string; outcome: string; programId: string | null },
) {
  if (p.projectId) {
    const e = await db.from("onboarding_project_events").insert({
      project_id: p.projectId, property_id: p.propertyId, kind: "active_owner_auto_enrolled", summary: p.summary,
      detail: null, actor: p.actorId, is_demo: p.isDemo,
    } as never);
    if (e.error) throw new Error("Could not record the enrollment in History.");
  }
  const a = await db.from("audit_log").insert({
    actor_id: p.actorId,
    actor_label: p.source === "five_minute_check" ? "5 minute check" : null,
    action: "active_owner.auto_enrolled",
    entity_type: "property",
    entity_id: p.propertyId,
    reason: p.summary,
    after_value: { source: p.source, outcome: p.outcome, programId: p.programId },
  } as never);
  if (a.error) throw new Error("Could not record the enrollment in the audit log.");
}

/** Same enrollment details as a saved attempt (key order does not matter). */
export function sameInput(saved: Row, next: Row) {
  return Object.keys(next).every((k) => JSON.stringify(saved[k] ?? null) === JSON.stringify(next[k] ?? null));
}

// ------------------------------------------------------------------ the one path
type Home = { id: string; name: string | null; owner_record_id: string | null; planned_closing_on: string | null; actual_closing_on: string | null; is_demo: boolean | null; archived_at: string | null; ownerrez_property_id: string | null };
type Project = { id: string; owner_type: string | null; modules: string[] | null; planned_closing_on: string | null };

async function loadLinks(db: Db, propertyId: string): Promise<LinkRow[]> {
  const r = await db
    .from("owner_program_properties")
    .select("inclusion_status, owner_programs(status, archived_at, owner_user_id)")
    .eq("property_id", propertyId);
  if (r.error) throw new Error("Could not check this home's Active Owner program.");
  return ((r.data ?? []) as unknown as { inclusion_status: string; owner_programs: unknown }[]).map((l) => {
    const j = l.owner_programs as LinkRow["program"] | LinkRow["program"][] | null;
    return { inclusion_status: l.inclusion_status, program: Array.isArray(j) ? (j[0] ?? null) : j };
  });
}

/**
 * Keep the Owner Type label and the module in step (setting either sets the other), with a History line.
 * Written as the person who saved (project changes need a signed-in onboarding account, by database rule).
 * Never blocks enrollment: a label that cannot be matched is logged and the enrollment still runs.
 */
async function syncLabel(db: Db, writer: SupabaseClient | null, project: Project, propertyId: string, isDemo: boolean, actorId: string | null) {
  const s = labelSync(project);
  if (!s.addModule && !s.setOwnerType) return;
  if (!writer) return; // the 5 minute check has no signed-in person; it enrolls without changing the label
  const patch: Row = {};
  if (s.addModule) patch["modules"] = s.modules;
  if (s.setOwnerType) patch["owner_type"] = "Active Owner";
  let error: unknown = null;
  try {
    const u = await writer.from("onboarding_projects").update(patch as never).eq("id", project.id);
    error = u.error;
  } catch (e) {
    error = e;
  }
  if (error) {
    console.error("Active Owner label sync skipped", error);
    return;
  }
  const lines: string[] = [];
  if (s.addModule) lines.push(MODULE_FROM_OWNER_TYPE);
  if (s.setOwnerType) lines.push(OWNER_TYPE_FROM_MODULE);
  const e = await db.from("onboarding_project_events").insert({
    project_id: project.id, property_id: propertyId, kind: s.addModule ? "scope_changed" : "project_updated",
    summary: s.addModule ? "Project scope updated." : "Project details updated.",
    detail: lines.join(" "), actor: actorId, is_demo: isDemo,
  } as never);
  if (e.error) throw new Error("Could not record the Active Owner setting in History.");
}

export async function autoEnrollHome(db: Db, input: AutoEnrollInput, deps: AutoEnrollDeps = realAutoEnrollDeps(db)): Promise<AutoEnrollOutcome> {
  const { propertyId, source } = input;
  const homeRead = await db
    .from("properties")
    .select("id, name, owner_record_id, planned_closing_on, actual_closing_on, is_demo, archived_at, ownerrez_property_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (homeRead.error) return { kind: "needs_attention", detail: "This home could not be read." };
  const home = homeRead.data as Home | null;
  if (!home) return { kind: "skipped", reason: "not_found" };
  if (home.archived_at) return { kind: "skipped", reason: "archived" };
  const isDemo = home.is_demo === true;
  if (source === "five_minute_check" && isDemo) return { kind: "skipped", reason: "demo" };

  const projectRead = await db
    .from("onboarding_projects")
    .select("id, owner_type, modules, planned_closing_on")
    .eq("property_id", propertyId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const project = (projectRead.data as Project | null) ?? null;
  const items = await readOpenItems(db, propertyId);
  let actorId = input.actorId;
  const fail = async (detail: string, extra: { requestId?: string | null; requestInput?: Row | null; receipt?: EnrollmentReceipt; attempted?: boolean } = {}) => {
    const plain = plainSetupReason(detail);
    await ensureItem(db, deps, items, { propertyId, kind: "needs_attention", detail: plain, source, actorId, isDemo, requestId: extra.requestId, requestInput: extra.requestInput, attempted: extra.attempted ?? true });
    return { kind: "needs_attention" as const, detail: plain, ...(extra.receipt ? { receipt: extra.receipt } : {}) };
  };

  try {
    const links = await loadLinks(db, propertyId);
    const state = enrollmentState(links);
    // 1d. Label and module in step on every save. The 5 minute check never touches an enrolled home.
    if (project && source !== "five_minute_check") await syncLabel(db, input.actorClient ?? null, project, propertyId, isDemo, actorId);
    if (state === "complete") {
      await closeItems(db, deps, items, ["add_email", "add_closing", "needs_attention"], "enrolled");
      return { kind: "already_enrolled" };
    }
    if (state === "set_aside") {
      return await fail("This home's Active Owner program was closed or the home was removed from it. Review it before it is set up again.", { attempted: false });
    }

    // 3b. No owner record: create or reuse one, same rules as Add property.
    let ownerRecordId = home.owner_record_id;
    if (!ownerRecordId) {
      const typed = { name: input.overrides?.ownerName ?? null, email: input.overrides?.ownerEmail ?? null };
      const fromOwnerRez = home.ownerrez_property_id ? await deps.ownerRezOwner(home.ownerrez_property_id) : null;
      ownerRecordId = await deps.resolveOwnerRecord({ fromOwnerRez, typed });
      if (!ownerRecordId) return await fail("Add the homeowner to this home.", { attempted: false });
      const link = await db.from("properties").update({ owner_record_id: ownerRecordId } as never).eq("id", propertyId).is("owner_record_id", null);
      if (link.error) return await fail("The homeowner record could not be linked to this home.");
      if (project) {
        await db.from("onboarding_project_events").insert({
          project_id: project.id, property_id: propertyId, kind: "project_updated", summary: "Homeowner linked for Active Owner setup.",
          detail: null, actor: actorId, is_demo: isDemo,
        } as never);
      }
    }
    const ownerRead = await db.from("property_owners").select("id, name, email, active").eq("id", ownerRecordId).maybeSingle();
    const owner = ownerRead.data as { id: string; name: string | null; email: string | null; active: boolean } | null;
    if (!owner?.active) return await fail("This home's homeowner record is not active.", { attempted: false });

    const name = (input.overrides?.ownerName?.trim() || owner.name?.trim() || "");
    if (name.length < 2) return await fail("Add the homeowner's name.", { attempted: false });
    const typedEmail = (input.overrides?.ownerEmail ?? "").trim().toLowerCase();
    const savedEmail = (owner.email ?? "").trim().toLowerCase();
    const email = EMAIL.test(typedEmail) ? typedEmail : EMAIL.test(savedEmail) ? savedEmail : "";
    const closingDate =
      enrollmentClosingDate({
        actualClosingOn: home.actual_closing_on,
        projectPlannedClosingOn: project?.planned_closing_on ?? null,
        propertyPlannedClosingOn: home.planned_closing_on,
      }) ?? input.overrides?.closingDate ?? null;

    // Live without a login and still no email: nothing to do but keep the item.
    if (state === "live_no_login" && !email) {
      await ensureItem(db, deps, items, { propertyId, kind: "add_email", source, actorId, isDemo });
      await closeItems(db, deps, items, ["add_closing", "needs_attention"], "enrolled");
      return { kind: "enrolled_no_email" };
    }

    // Who the enrollment is recorded as. The 5 minute check runs as the Director of Onboarding seat.
    if (!actorId) actorId = await deps.seatHolder("director_onboarding");
    if (!actorId) return await fail("No Director of Onboarding is set, so Active Owner setup is waiting.");

    const programs = await db
      .from("owner_programs")
      .select("onboarding_lead, operations_lead, internal_notes")
      .eq("owner_record_id", owner.id)
      .eq("is_demo", isDemo)
      .is("archived_at", null)
      .not("status", "in", "(closed,completed,complete)");
    const existing = ((programs.data ?? []) as { onboarding_lead: string | null; operations_lead: string | null; internal_notes: string | null }[])[0] ?? null;
    const base = {
      propertyId, ownerRecordId: owner.id, name, email, closingDate, reason: "",
      onboardingLead: existing?.onboarding_lead ?? null, operationsLead: existing?.operations_lead ?? null,
      notes: (input.overrides?.notes ?? existing?.internal_notes ?? "").slice(0, 4000),
    };
    // A retry with the same details resumes the same run; changed details start a new one.
    const prior = items?.find((i) => i.request_id && i.request_input && sameInput(i.request_input, base));
    const requestId = prior?.request_id ?? deps.newId();
    const enrollInput: AutoEnrollmentInput = { requestId, ...base };

    const complete = Boolean(email && closingDate);
    const useOwnClient = Boolean(complete && input.actorClient && input.actorId && (await deps.mayEnrollAsSelf(input.actorClient, input.actorId, isDemo)));
    const receipt = await deps.enroll({ id: actorId, client: useOwnClient ? input.actorClient ?? null : null }, enrollInput);
    const failed = receipt.steps.find((s) => s.status === "failed");
    const who = await saverName(db, input.actorId);

    if (!receipt.complete && failed?.key === "closing" && !closingDate) {
      // 3c. No closing date: program and home linked (and login when the email exists); goes live once the date is saved.
      await ensureItem(db, deps, items, { propertyId, kind: "add_closing", source, actorId, isDemo, requestId: null, requestInput: null });
      if (!email) await ensureItem(db, deps, items, { propertyId, kind: "add_email", source, actorId, isDemo });
      await closeItems(db, deps, items, ["needs_attention"], "waiting for the closing date");
      await recordHistory(db, { projectId: project?.id ?? null, propertyId, isDemo, actorId: input.actorId, source, summary: `${autoEnrollHistoryLine(source, who)}. Waiting for the closing date.`, outcome: "waiting_closing", programId: receipt.programId });
      return { kind: "waiting_closing", receipt };
    }
    if (!receipt.complete) {
      return await fail(failed?.detail ?? "Active Owner setup did not finish.", { requestId, requestInput: enrollInput as unknown as Row, receipt });
    }

    await closeItems(db, deps, items, ["add_closing", "needs_attention"], "enrolled");
    if (!email) {
      await ensureItem(db, deps, items, { propertyId, kind: "add_email", source, actorId, isDemo });
    } else {
      await closeItems(db, deps, items, ["add_email"], "enrolled");
    }
    await recordHistory(db, { projectId: project?.id ?? null, propertyId, isDemo, actorId: input.actorId, source, summary: autoEnrollHistoryLine(source, who), outcome: email ? "enrolled" : "enrolled_no_email", programId: receipt.programId });
    return email ? { kind: "enrolled", email, welcomeHeld: receipt.welcomeHeld, receipt } : { kind: "enrolled_no_email", receipt };
  } catch (e) {
    try {
      return await fail(e instanceof Error ? e.message : "Active Owner setup did not finish.");
    } catch {
      return { kind: "needs_attention", detail: plainSetupReason(e instanceof Error ? e.message : null) };
    }
  }
}

// ------------------------------------------------------------------ the 5 minute check
export type SafetyNetSummary = { checked: number; enrolled: number; finished: number; flagged: number; closed: number; skipped: number; notReady?: boolean };

/** Cap per run so one pass can never hold up the rest of the five-minute job. */
export const SAFETY_NET_MAX_PER_RUN = 10;

/**
 * Finds every non-demo, non-archived home labelled Active Owner (Owner Type or module)
 * and enrolls the ones with no live program. Fully enrolled homes are never touched.
 * Safe to run every 5 minutes forever. Never throws.
 */
export async function runActiveOwnerSafetyNet(db: Db, deps: AutoEnrollDeps = realAutoEnrollDeps(db)): Promise<SafetyNetSummary> {
  const out: SafetyNetSummary = { checked: 0, enrolled: 0, finished: 0, flagged: 0, closed: 0, skipped: 0 };
  try {
    const probe = await db.from("active_owner_setup_items" as never).select("id").limit(1);
    if (isMissing(probe.error)) return { ...out, notReady: true };
    const projects = await db
      .from("onboarding_projects")
      .select("property_id, owner_type, modules, planned_closing_on, is_demo")
      .neq("status", "cancelled")
      .or('owner_type.eq."Active Owner",modules.cs.{active_owner}');
    if (projects.error) return out;
    const rows = (projects.data ?? []) as { property_id: string; owner_type: string | null; modules: string[] | null; planned_closing_on: string | null; is_demo: boolean | null }[];
    const ids = [...new Set(rows.filter((r) => r.is_demo !== true).map((r) => r.property_id))];
    if (ids.length === 0) return out;
    const [homes, links, open] = await Promise.all([
      db.from("properties").select("id, name, is_demo, archived_at, owner_record_id, planned_closing_on, actual_closing_on").in("id", ids),
      db.from("owner_program_properties").select("property_id, inclusion_status, owner_programs(status, archived_at, owner_user_id)").in("property_id", ids),
      db.from("active_owner_setup_items" as never).select("property_id, kind, last_attempt_at").eq("status", "open").in("property_id", ids),
    ]);
    if (homes.error || links.error || open.error) return out;
    const ownerIds = [...new Set(((homes.data ?? []) as { owner_record_id: string | null }[]).map((h) => h.owner_record_id).filter((x): x is string => Boolean(x)))];
    const owners = ownerIds.length ? await db.from("property_owners").select("id, email").in("id", ownerIds) : { data: [], error: null };
    const emailOf = new Map(((owners.data ?? []) as { id: string; email: string | null }[]).map((o) => [o.id, EMAIL.test((o.email ?? "").trim())]));
    let acted = 0;
    for (const h of (homes.data ?? []) as { id: string; name: string | null; is_demo: boolean | null; archived_at: string | null; owner_record_id: string | null; planned_closing_on: string | null; actual_closing_on: string | null }[]) {
      out.checked++;
      const project = rows.find((r) => r.property_id === h.id);
      const homeLinks: LinkRow[] = ((links.data ?? []) as unknown as { property_id: string; inclusion_status: string; owner_programs: unknown }[])
        .filter((l) => l.property_id === h.id)
        .map((l) => {
          const j = l.owner_programs as LinkRow["program"] | LinkRow["program"][] | null;
          return { inclusion_status: l.inclusion_status, program: Array.isArray(j) ? (j[0] ?? null) : j };
        });
      const action = safetyNetAction({
        propertyId: h.id, name: h.name, isDemo: h.is_demo === true, archived: Boolean(h.archived_at),
        ownerType: project?.owner_type ?? null, modules: project?.modules ?? null,
        state: enrollmentState(homeLinks),
        hasEmail: h.owner_record_id ? emailOf.get(h.owner_record_id) === true : false,
        hasClosing: Boolean(h.actual_closing_on ?? project?.planned_closing_on ?? h.planned_closing_on),
        openItems: ((open.data ?? []) as unknown as { property_id: string; kind: SetupItemKind; last_attempt_at: string | null }[])
          .filter((i) => i.property_id === h.id).map((i) => ({ kind: i.kind, lastAttemptAt: i.last_attempt_at })),
      }, deps.now());
      if (action === "skip") { out.skipped++; continue; }
      if (acted >= SAFETY_NET_MAX_PER_RUN) { out.skipped++; continue; }
      acted++;
      const result = await autoEnrollHome(db, { propertyId: h.id, actorId: null, source: "five_minute_check" }, deps);
      if (action === "close_items") out.closed++;
      else if (result.kind === "enrolled" || result.kind === "enrolled_no_email" || result.kind === "waiting_closing") {
        if (action === "finish") out.finished++; else out.enrolled++;
      } else if (result.kind === "needs_attention") out.flagged++;
      else out.skipped++;
    }
    return out;
  } catch (e) {
    console.error("active owner safety net", e);
    return out;
  }
}

/**
 * A homeowner email was saved: finish Active Owner setup (login and welcome) on every
 * home of this owner that is waiting for it. Never throws; the 5 minute check also retries.
 */
export async function finishAfterEmailSaved(db: Db, ownerId: string, actorId: string, actorClient: SupabaseClient | null, deps: AutoEnrollDeps = realAutoEnrollDeps(db)) {
  try {
    const homes = await db.from("properties").select("id").eq("owner_record_id", ownerId).is("archived_at", null);
    const ids = ((homes.data ?? []) as { id: string }[]).map((h) => h.id);
    if (ids.length === 0) return [];
    const waiting = await db.from("active_owner_setup_items" as never).select("property_id").eq("status", "open").eq("kind", "add_email").in("property_id", ids);
    if (waiting.error) return [];
    const targets = [...new Set(((waiting.data ?? []) as unknown as { property_id: string }[]).map((r) => r.property_id))];
    const out: AutoEnrollOutcome[] = [];
    for (const propertyId of targets) out.push(await autoEnrollHome(db, { propertyId, actorId, source: "email_added", actorClient }, deps));
    return out;
  } catch (e) {
    console.error("finish Active Owner setup after email", e);
    return [];
  }
}
