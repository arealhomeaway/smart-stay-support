/**
 * Owner follow-up sync (server-only). Replaces the retired call/text queue.
 *
 * For every home in an active program: compute real behind items, route to
 * the Project Manager (onboarding, Director fallback) or the Active Owner
 * follow-up seat / cover (after handoff), and keep exactly one open My Work
 * follow-up plus one in-app staff notification. No staff email is queued.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  activeOwnerTabPath,
  followUpDecision,
  followUpTitle,
  routeFollowUp,
  type FollowUpTask,
  type OwnerItem,
} from "./owner-behind";

// The follow-up table is staged, not yet in generated types.
type Db = SupabaseClient;

const MISSING = new Set(["42P01", "PGRST205", "PGRST202", "42883"]);
export function followUpsNotReady(error: { code?: string } | null | undefined) {
  return Boolean(error?.code && MISSING.has(error.code));
}

type HomeInput = {
  programId: string;
  propertyId: string;
  ownerName: string | null;
  isDemo: boolean;
  items: OwnerItem[];
};

async function routeFor(db: Db, propertyId: string) {
  const project = await db
    .from("onboarding_projects")
    .select("project_manager, director, ops_accepted_at, status")
    .eq("property_id", propertyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (project.error) throw project.error;
  const p = project.data as { project_manager: string | null; director: string | null; ops_accepted_at: string | null; status: string } | null;
  const inOnboarding = Boolean(p && !p.ops_accepted_at && !["completed", "archived", "cancelled"].includes(p.status));
  let onboardingDirector = p?.director ?? null;
  if (inOnboarding && !p?.project_manager && !onboardingDirector) {
    const d = await db.rpc("seat_holder", { _code: "director_onboarding" });
    onboardingDirector = (d.data as string | null) ?? null;
  }
  let followupSeatHolder: string | null = null;
  let followupCover: string | null = null;
  if (!inOnboarding) {
    const [seat, cover] = await Promise.all([
      db.rpc("seat_holder", { _code: "active_owner_followup" }),
      db.rpc("seat_override_at", { _role_code: "active_owner_followup" }),
    ]);
    followupSeatHolder = (seat.data as string | null) ?? null;
    const c = ((cover.data ?? []) as { kind: string; user_id: string }[]).find((o) => o.kind === "cover");
    followupCover = c?.user_id ?? null;
  }
  return routeFollowUp({
    inOnboarding,
    projectManager: p?.project_manager ?? null,
    onboardingDirector,
    followupSeatHolder,
    followupCover,
  });
}

/** Sync one home. Returns what happened, for job notes and tests. */
export async function syncHomeFollowUp(db: Db, home: HomeInput, now = new Date()) {
  const existing = await db
    .from("owner_followup_tasks")
    .select("id, status, closed_at")
    .eq("property_id", home.propertyId);
  if (followUpsNotReady(existing.error)) return { action: "not_ready" as const };
  if (existing.error) throw existing.error;
  const tasks: FollowUpTask[] = (existing.data ?? []).map((t: { status: string; closed_at: string | null }) => ({
    status: t.status === "open" ? "open" : "closed",
    closedAt: t.closed_at,
  }));
  const decision = followUpDecision(home.items, tasks, now);
  if (decision.action !== "create") return { action: decision.action };

  const route = await routeFor(db, home.propertyId);
  if (!route.assignee) return { action: "no_assignee" as const };
  const title = followUpTitle(home.ownerName, decision.count, route.noProjectManager);
  const link = activeOwnerTabPath(home.propertyId);

  const task = await db
    .from("owner_followup_tasks")
    .insert({
      program_id: home.programId,
      property_id: home.propertyId,
      assigned_to: route.assignee,
      route_reason: route.reason,
      no_project_manager: route.noProjectManager,
      item_count: decision.count,
      title,
      link_path: link,
      is_demo: home.isDemo,
    })
    .select("id")
    .single();
  // The unique open-per-home index turns a concurrent duplicate into a no-op.
  if (task.error?.code === "23505") return { action: "keep" as const };
  if (task.error) throw task.error;

  const note = await db.from("staff_notifications").insert({
    user_id: route.assignee,
    kind: "owner_followup",
    title,
    body: route.noProjectManager
      ? "This home is in onboarding and has no Project Manager on its team."
      : "Open the home's Active Owner section to see what is waiting.",
    entity_type: "owner_followup_task",
    entity_id: (task.data as { id: string }).id,
    link_path: link,
    priority: "p3",
    is_demo: home.isDemo,
    email_status: "skipped",
  });
  if (note.error) throw note.error;
  return { action: "create" as const, assignee: route.assignee, reason: route.reason, title };
}

/** Builds behind inputs per home for one program from current rows only. */
export async function syncProgramFollowUps(db: Db, programId: string, now = new Date()) {
  const [program, homes, reviews, work] = await Promise.all([
    db.from("owner_programs").select("owner_name, is_demo").eq("id", programId).single(),
    db.from("owner_program_properties").select("property_id, added_on").eq("program_id", programId).eq("inclusion_status", "included").order("added_on"),
    db.from("owner_reviews").select("id, property_id, status, respond_by, available_from, created_at, archived_at").eq("program_id", programId).is("archived_at", null),
    db.from("work_items").select("id, property_id, status, due_on, sent_at, responded_at, retired_at").eq("program_id", programId).eq("kind", "opportunity").is("retired_at", null),
  ]);
  for (const r of [program, homes, reviews, work]) if (r.error) throw r.error;
  const homeIds = (homes.data ?? []).map((h: { property_id: string }) => h.property_id);
  if (homeIds.length === 0) return [];
  // Program-wide items belong to the first enrolled home so they count once.
  const homeFor = (pid: string | null) => (pid && homeIds.includes(pid) ? pid : homeIds[0]);
  const byHome = new Map<string, OwnerItem[]>(homeIds.map((id: string) => [id, []]));
  for (const r of (reviews.data ?? []) as { id: string; property_id: string | null; status: string; respond_by: string | null; available_from: string | null; created_at: string; archived_at: string | null }[]) {
    byHome.get(homeFor(r.property_id))!.push({
      id: r.id, source: "review", status: r.status, archivedAt: r.archived_at,
      respondBy: r.respond_by, waitingSince: r.available_from ?? r.created_at,
    });
  }
  for (const w of (work.data ?? []) as { id: string; property_id: string | null; status: string; due_on: string | null; sent_at: string | null; responded_at: string | null; retired_at: string | null }[]) {
    byHome.get(homeFor(w.property_id))!.push({
      id: w.id, source: "work_item", status: w.status, retiredAt: w.retired_at,
      respondBy: w.due_on, waitingSince: w.sent_at, respondedAt: w.responded_at,
    });
  }
  const p = program.data as { owner_name: string | null; is_demo: boolean | null };
  const out = [];
  for (const [propertyId, items] of byHome) {
    out.push(await syncHomeFollowUp(db, { programId, propertyId, ownerName: p.owner_name, isDemo: p.is_demo !== false, items }, now));
  }
  return out;
}
