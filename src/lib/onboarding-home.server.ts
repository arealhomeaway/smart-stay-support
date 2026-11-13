/**
 * Onboarding Home as the project database (Admin approval Nov 12): the server side.
 *
 * Reads every active, Upcoming and past onboarding home as the signed-in person (RLS applies),
 * resolves each home's team, schedule and the viewer's own counts, and never returns access
 * or wifi notes. Writes go only through caller-authenticated database functions staged in
 * docs/pending/onboarding-home; until they are applied each write refuses, with no separate
 * write path. OwnerRez is read only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { formatPropertyLabel } from "@/lib/property-label";
import { readCountedRows } from "@/lib/read-all-rows";
import { centralToday, daysBetween } from "@/lib/onboarding-board";
import { computedStage, effectiveOwner, scheduleHealth, type PageTask } from "@/lib/onboarding-home-page";
import { FURNISHING_SCOPES, projectScope, splitByScope } from "@/lib/onboarding-scope";
import {
  LEAD_ONLY_REFUSAL,
  lifecycleFor,
  viewerRoles,
  type HomeRow,
  type OwnerRezRow,
  type Person,
  type SavedView,
} from "@/lib/onboarding-home";

type Client = SupabaseClient<Database>;
// Staged tables and functions are not in the generated types until applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = (sb: Client) => sb as unknown as SupabaseClient<any>;

export const PENDING_REFUSAL = "This waits on a database change that is not applied yet. Nothing was saved.";

export function isMissingObject(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (["PGRST202", "PGRST205", "42P01", "42883", "3F000"].includes(e.code ?? "")) return true;
  const m = (e.message ?? "").toLowerCase();
  return m.includes("could not find the function") || m.includes("could not find the table") || (m.includes("does not exist") && (m.includes("relation") || m.includes("function")));
}

export async function viewerAccess(supabase: Client, userId: string) {
  const [staff, admin, director] = await Promise.all([
    supabase.rpc("is_onboarding_staff", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("is_onboarding_director", { _user_id: userId }),
  ]);
  if (staff.error || admin.error || director.error) throw new Error("Could not verify your access level.");
  return { staff: staff.data === true || admin.data === true, isAdmin: admin.data === true, isDirector: director.data === true };
}

/** 3.3: Admin and the Director of Onboarding only, checked as the signed-in person. */
export async function assertLead(supabase: Client, userId: string) {
  const a = await viewerAccess(supabase, userId);
  if (!a.isAdmin && !a.isDirector) throw new Error(LEAD_ONLY_REFUSAL);
  return a;
}

const DESIGN_KEYS = ["design_staging", "lead_designer", "designer"] as const;
const DESIGN_ROLE_CODES = ["design_staging", "lead_designer", "designer"];
const PM_SEATS = new Set(["onboarding_project_manager", "project_manager"]);

type ProjectRow = {
  id: string;
  property_id: string;
  status: string;
  project_status: string | null;
  owner_type: string | null;
  invoice_status: string | null;
  greater_area: string | null;
  committed_handoff_on: string | null;
  target_handoff_on: string | null;
  planned_closing_on: string | null;
  possession_on: string | null;
  project_manager: string | null;
  director: string | null;
  utility_manager: string | null;
  role_assignments: Record<string, string> | null;
  furnishing_scope: string | null;
  modules: string[] | null;
  notes: string | null;
  completed_at: string | null;
  ops_accepted_at: string | null;
  updated_at: string | null;
  is_demo: boolean | null;
};

export async function loadOnboardingHome(supabase: Client, userId: string, now = new Date()) {
  const access = await viewerAccess(supabase, userId);
  if (!access.staff) throw new Error("Onboarding Home is for the onboarding team.");
  const today = centralToday(now);
  const db = loose(supabase);

  const projectsRes = await readCountedRows<ProjectRow>(
    db
      .from("onboarding_projects")
      .select(
        "id, property_id, status, project_status, owner_type, invoice_status, greater_area, committed_handoff_on, target_handoff_on, planned_closing_on, possession_on, project_manager, director, utility_manager, role_assignments, furnishing_scope, modules, notes, completed_at, ops_accepted_at, updated_at, is_demo",
        { count: "exact" },
      )
      .neq("status", "cancelled")
      .order("created_at")
      .order("id"),
  );
  const projects = projectsRes.data ?? [];
  // A fallen-through contract is closed with its reason; it still shows under past projects.
  const fell = await db
    .from("onboarding_projects")
    .select("id, property_id, status, project_status, owner_type, invoice_status, greater_area, committed_handoff_on, target_handoff_on, planned_closing_on, possession_on, project_manager, director, utility_manager, role_assignments, furnishing_scope, modules, notes, completed_at, ops_accepted_at, updated_at, is_demo")
    .eq("status", "cancelled")
    .eq("project_status", "Contract Fell Through");
  const allProjects: ProjectRow[] = [...projects, ...((fell.data ?? []) as ProjectRow[])];

  const propsRes = await readCountedRows<Record<string, unknown>>(
    db
      .from("properties")
      .select(
        "id, name, address_line1, unit, city, state, postal_code, primary_photo_url, primary_photo_medium_url, lifecycle_status, planned_closing_on, actual_closing_on, market, hoa, breezeway_property_id, ownerrez_property_id, owner_record_id, is_demo, handoff_accepted_at, archived_at",
        { count: "exact" },
      )
      .is("archived_at", null)
      .order("id"),
  );
  const projectByProperty = new Map<string, ProjectRow>();
  for (const p of allProjects) {
    const prior = projectByProperty.get(p.property_id);
    if (!prior || prior.status === "cancelled") projectByProperty.set(p.property_id, p);
  }
  const homes = (propsRes.data ?? []).filter((p) => {
    const life = String(p["lifecycle_status"] ?? "active_operations");
    return projectByProperty.has(String(p["id"])) || (life !== "active_operations" && life !== "offboarded");
  });
  const ids = homes.map((h) => String(h["id"]));

  const inIds = <Q,>(q: Q, col: string): Q =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ids.length ? (q as any).in(col, ids) : (q as any).eq(col, "00000000-0000-0000-0000-000000000000")) as Q;

  const [tasksRes, profiles, follows, messages, needs, labels, owners, stagers, aoLinks, roleMembers, stagingVendors, saved, directorSeat] = await Promise.all([
    readCountedRows<Record<string, unknown>>(
      inIds(
        db
          .from("onboarding_tasks")
          .select("id, property_id, stage, title, status, due_on, assigned_to, assigned_seat, parent_task_id, task_kind, completed_at, template_task_id", { count: "exact" })
          .is("archived_at", null)
          .order("id"),
        "property_id",
      ),
    ),
    readCountedRows<{ id: string; full_name: string | null; email: string | null }>(
      db.from("profiles").select("id, full_name, email", { count: "exact" }).order("id"),
    ),
    db.from("onboarding_follows").select("property_id").eq("user_id", userId),
    inIds(db.from("owner_request_messages").select("property_id, work_item_id, review_id, author_type, event, created_at").order("created_at"), "property_id"),
    supabase.rpc("my_owner_item_needs"),
    inIds(db.from("property_label_assignments").select("property_id, property_labels(name)"), "property_id"),
    db.from("property_owners").select("id, name"),
    db.from("onboarding_project_stagers").select("project_id, vendor_org_id, vendor_orgs(display_name, legal_name)").is("removed_at", null),
    import("./active-owner.server").then((m) => m.activeOwnerLinks(supabase, ids)).catch(() => new Map()),
    db.from("functional_role_members").select("role_code, user_id"),
    db.from("vendor_orgs").select("id, display_name, legal_name, status, primary_contact_phone, primary_contact_email").contains("service_categories", ["Staging"]).order("display_name"),
    db.from("saved_views").select("id, kind, name, filters, view, sort, columns").eq("user_id", userId).eq("page", "onboarding_home").is("archived_at", null).order("name"),
    db.from("functional_roles").select("current_seat_holder").eq("code", "onboarding_director").maybeSingle(),
  ]);

  const nameOf = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name || p.email || "Team member"] as const));
  const person = (id: string | null | undefined): Person | null => (id ? { id, name: nameOf.get(id) ?? "Team member" } : null);
  const followed = new Set(((follows.data ?? []) as { property_id: string }[]).map((f) => f.property_id));
  const labelMap = new Map<string, string[]>();
  for (const l of (labels.data ?? []) as { property_id: string; property_labels: { name?: string } | null }[]) {
    const n = l.property_labels?.name;
    if (n) labelMap.set(l.property_id, [...(labelMap.get(l.property_id) ?? []), n]);
  }
  const ownerName = new Map(((owners.data ?? []) as { id: string; name: string | null }[]).map((o) => [o.id, o.name || null] as const));
  const stagersReady = !stagers.error;
  const stagerMap = new Map<string, Person[]>();
  for (const s of (stagers.data ?? []) as unknown as { project_id: string; vendor_org_id: string; vendor_orgs: { display_name: string | null; legal_name: string | null } | null }[]) {
    stagerMap.set(s.project_id, [...(stagerMap.get(s.project_id) ?? []), { id: s.vendor_org_id, name: s.vendor_orgs?.display_name || s.vendor_orgs?.legal_name || "Stager" }]);
  }

  // Owner replies waiting on staff: a thread whose last word is the homeowner's (status from the last speaker),
  // plus owner items from the viewer's own Tasks the homeowner wrote back on.
  const threads = new Map<string, { property: string; last: string }>();
  for (const m of (messages.data ?? []) as { property_id: string | null; work_item_id: string | null; review_id: string | null; author_type: string; event: string | null }[]) {
    if (!m.property_id) continue;
    const key = m.work_item_id ?? m.review_id;
    if (!key) continue;
    const last = m.event === "resolved" ? "resolved" : m.author_type === "system" ? threads.get(key)?.last ?? "system" : m.author_type;
    threads.set(key, { property: m.property_id, last });
  }
  const waitingByHome = new Map<string, number>();
  for (const t of threads.values()) if (t.last === "homeowner") waitingByHome.set(t.property, (waitingByHome.get(t.property) ?? 0) + 1);
  for (const n of ((needs.data ?? []) as { property_id: string; why: string }[]))
    if (/wrote back/i.test(n.why ?? "")) waitingByHome.set(n.property_id, (waitingByHome.get(n.property_id) ?? 0) + 1);

  const tasksByHome = new Map<string, PageTask[]>();
  for (const t of (tasksRes.data ?? []) as unknown as (PageTask & { property_id: string })[])
    tasksByHome.set(t.property_id, [...(tasksByHome.get(t.property_id) ?? []), t]);

  const in7 = (d: string | null) => Boolean(d && d >= today && daysBetween(today, d) <= 7);
  const rows: HomeRow[] = homes.map((p) => {
    const id = String(p["id"]);
    const project = projectByProperty.get(id) ?? null;
    const designerId = DESIGN_KEYS.map((k) => project?.role_assignments?.[k]).find(Boolean) ?? null;
    const team: HomeRow["team"] = {
      pm: person(project?.project_manager),
      designer: person(designerId),
      utilities: person(project?.utility_manager),
      director: person(project?.director),
      stagers: project ? stagerMap.get(project.id) ?? [] : [],
    };
    const roleHolder = (seat: string | null | undefined) => {
      if (!project || !seat) return null;
      if (PM_SEATS.has(seat)) return project.project_manager;
      if (seat === "utilities") return project.utility_manager;
      if (seat === "onboarding_director" || seat === "director_onboarding") return project.director;
      return project.role_assignments?.[seat] ?? null;
    };
    const raw = (tasksByHome.get(id) ?? []).map((t) => (t.assigned_to || t.status === "complete" ? t : { ...t, assigned_to: roleHolder(t.assigned_seat) }));
    const tasks = splitByScope(raw as never, projectScope(project as never)).inScope as unknown as PageTask[];
    const hasPlan = tasks.length > 0;
    const open = tasks.filter((t) => !["complete", "carryover"].includes(t.status) && !t.parent_task_id);
    const mine = open.filter((t) => effectiveOwner(t, project?.project_manager) === userId);
    const onTeam = viewerRoles(team, userId).length > 0;
    const handedOff = Boolean(p["handoff_accepted_at"]) || Boolean(project?.ops_accepted_at) || (String(p["lifecycle_status"]) === "active_operations" && project?.status === "complete");
    const lifecycle = lifecycleFor({ projectStatus: project?.project_status, status: project?.status, hasPlan, handedOff });
    const committedOn = project?.committed_handoff_on ?? null;
    const estimateOn = project?.target_handoff_on ?? null;
    const actualClosing = (p["actual_closing_on"] as string | null) ?? null;
    const label = formatPropertyLabel(p as never);
    const hoa = p["hoa"] as { present?: unknown } | null;
    const modules = project?.modules ?? [];
    return {
      propertyId: id,
      projectId: project?.id ?? null,
      name: label.primary,
      place: [p["city"], p["state"]].filter(Boolean).join(", "),
      photo: ((p["primary_photo_medium_url"] || p["primary_photo_url"]) as string | null) ?? null,
      activeOwner: aoLinks.has(id) || project?.owner_type === "Active Owner",
      ownerType: project?.owner_type ?? null,
      ownerName: p["owner_record_id"] ? ownerName.get(String(p["owner_record_id"])) ?? null : null,
      status: project?.project_status ?? null,
      invoiceStatus: project?.invoice_status ?? null,
      lifecycle,
      stage: hasPlan ? computedStage(tasks) : 1,
      hasPlan,
      closingOn: actualClosing ?? project?.planned_closing_on ?? ((p["planned_closing_on"] as string | null) ?? null),
      closed: Boolean(actualClosing && actualClosing <= today),
      possessionOn: project?.possession_on ?? null,
      committedOn,
      estimateOn,
      handoffOn: committedOn ?? estimateOn,
      endedOn:
        lifecycle === "handed_off"
          ? ((p["handoff_accepted_at"] as string | null) ?? project?.ops_accepted_at ?? project?.completed_at ?? null)?.slice(0, 10) ?? null
          : lifecycle === "fell_through"
            ? project?.updated_at?.slice(0, 10) ?? null
            : null,
      note: project?.notes ? project.notes.split("\n")[0]!.slice(0, 140) : null,
      schedule: lifecycle === "active" ? scheduleHealth({ tasks, today, estimateOn, committedOn }) : { behind: false, days: 0, label: "On track" },
      team,
      onTeam,
      followed: followed.has(id),
      lateMine: mine.filter((t) => t.due_on && t.due_on < today).length,
      dueWeekMine: mine.filter((t) => in7(t.due_on)).length,
      ownerWaiting: onTeam ? waitingByHome.get(id) ?? 0 : 0,
      market: project?.greater_area ?? ((p["market"] as string | null) ?? null),
      scope: FURNISHING_SCOPES.find((f) => f.value === project?.furnishing_scope)?.label ?? null,
      utilityOption: modules.includes("utilities") ? "Utility setup" : null,
      hoa: hoa?.present === true || hoa?.present === "Yes",
      breezeway: Boolean(p["breezeway_property_id"]),
      labels: labelMap.get(id) ?? [],
      ownerRezId: (p["ownerrez_property_id"] as string | null) ?? null,
      isDemo: Boolean(p["is_demo"]),
    };
  });

  // Pickers for the dashed circles (Director and Admin): people who hold each role, and staging vendors.
  const pool = (codes: string[]) =>
    [...new Set(((roleMembers.data ?? []) as { role_code: string; user_id: string }[]).filter((m) => codes.includes(m.role_code)).map((m) => m.user_id))]
      .map((id) => person(id)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  return {
    today,
    viewer: { userId, isAdmin: access.isAdmin, isDirector: access.isDirector },
    rows,
    pickers: {
      pm: pool(["onboarding_project_manager"]),
      designer: pool(DESIGN_ROLE_CODES),
      utilities: pool(["utilities"]),
      director: pool(["onboarding_director", "director_onboarding"]),
      stager: ((stagingVendors.data ?? []) as { id: string; display_name: string | null; legal_name: string | null }[]).map((v) => ({ id: v.id, name: v.display_name || v.legal_name || "Vendor" })),
    },
    stagersReady,
    directorDefault: person((directorSeat.data as { current_seat_holder?: string | null } | null)?.current_seat_holder ?? null),
    // Null until the staged saved_views table is applied.
    savedViews: saved.error ? null : ((saved.data ?? []) as (SavedView & { kind: string })[]).filter((v) => v.kind === "view").map(({ id, name, filters, view, sort }) => ({ id, name, filters, view, sort })),
    columns: saved.error ? null : ((((saved.data ?? []) as { kind: string; columns: string[] | null }[]).find((v) => v.kind === "columns")?.columns ?? []) as string[]),
  };
}

/* -------------------------------------------------- Not in Resolve yet */

/**
 * 2.6: OwnerRez homes with no Resolve property, or a Resolve property with no onboarding project,
 * that are not live in Operations and were not dismissed. Live read on page open; the hourly pass
 * keeps the staged cache table filled for the added-to-OwnerRez date.
 */
export async function loadNotInResolveYet(supabase: Client, userId: string): Promise<{ ok: true; rows: OwnerRezRow[] } | { ok: false; error: string }> {
  await assertLead(supabase, userId);
  const { listListings, OwnerRezError } = await import("./ownerrez.server");
  let listings;
  try {
    listings = await listListings();
  } catch (err) {
    return { ok: false, error: err instanceof OwnerRezError ? err.message : "Could not reach OwnerRez." };
  }
  const db = loose(supabase);
  const [props, projects, dismissed, cache] = await Promise.all([
    db.from("properties").select("id, ownerrez_property_id, lifecycle_status").is("archived_at", null).not("ownerrez_property_id", "is", null),
    db.from("onboarding_projects").select("property_id, status"),
    db.from("ownerrez_listing_dismissals").select("listing_id").is("restored_at", null),
    db.from("ownerrez_listing_cache").select("listing_id, added_on"),
  ]);
  if (props.error || projects.error) return { ok: false, error: "Could not read the homes in Resolve." };
  const byListing = new Map(((props.data ?? []) as { id: string; ownerrez_property_id: string; lifecycle_status: string | null }[]).map((p) => [String(p.ownerrez_property_id), p] as const));
  const withProject = new Set(((projects.data ?? []) as { property_id: string }[]).map((p) => p.property_id));
  const hidden = new Set(((dismissed.data ?? []) as { listing_id: string }[]).map((d) => d.listing_id));
  const added = new Map(((cache.data ?? []) as { listing_id: string; added_on: string | null }[]).map((c) => [c.listing_id, c.added_on] as const));
  const rows: OwnerRezRow[] = [];
  for (const l of listings) {
    const listingId = String(l.id);
    if (hidden.has(listingId)) continue;
    const home = byListing.get(listingId);
    if (home && (withProject.has(home.id) || (home.lifecycle_status ?? "active_operations") === "active_operations" || home.lifecycle_status === "offboarded")) continue;
    const created = (l as { created_utc?: string; created?: string }).created_utc ?? (l as { created?: string }).created ?? null;
    rows.push({
      listingId,
      name: String(l.name ?? "").trim() || `OwnerRez ${listingId}`,
      place: [l.address?.city, l.address?.state].filter(Boolean).join(", "),
      addedOn: added.get(listingId) ?? (created ? String(created).slice(0, 10) : null),
      propertyId: home?.id ?? null,
    });
  }
  return { ok: true, rows: rows.sort((a, b) => (b.addedOn ?? "").localeCompare(a.addedOn ?? "") || a.name.localeCompare(b.name)) };
}

/** Hourly on the existing five-minute job: refresh the staged OwnerRez cache. Skips quietly until it is applied. */
export async function runOwnerRezListingCache(admin: Client, now = new Date()) {
  const db = loose(admin);
  const last = await db.from("ownerrez_listing_cache").select("checked_at").order("checked_at", { ascending: false }).limit(1);
  if (last.error) return { skipped: true, reason: isMissingObject(last.error) ? "not_applied" : "read_failed" };
  const at = (last.data?.[0] as { checked_at?: string } | undefined)?.checked_at;
  if (at && now.getTime() - Date.parse(at) < 55 * 60_000) return { skipped: true, reason: "hourly" };
  const { listListings } = await import("./ownerrez.server");
  const listings = await listListings();
  const stamp = now.toISOString();
  const rows = listings.map((l) => {
    const created = (l as { created_utc?: string }).created_utc ?? null;
    return { listing_id: String(l.id), name: String(l.name ?? ""), city: l.address?.city ?? null, state: l.address?.state ?? null, added_on: created ? String(created).slice(0, 10) : null, checked_at: stamp };
  });
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from("ownerrez_listing_cache").upsert(rows.slice(i, i + 200), { onConflict: "listing_id", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
  }
  return { ok: true, listings: rows.length };
}

/* ---------------------------------------------------------------- writes */

type Rpc = (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;

/** Calls a staged, caller-authenticated database function; refuses plainly until it is applied. */
export async function callStaged<T>(supabase: Client, name: string, args: Record<string, unknown>): Promise<T> {
  const rpc = supabase.rpc.bind(supabase) as unknown as Rpc;
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(isMissingObject(error) ? PENDING_REFUSAL : error.message);
  return data as T;
}
