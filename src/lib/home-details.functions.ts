/**
 * One home's page in its Onboarding view, Part 3 (Admin approval Nov 12): server actions for
 * Home details, Files and Vendors and work. Every call runs as the signed-in teammate; the
 * edit rule in src/lib/home-details.ts is checked here first, then the existing database
 * functions and row level security decide again. Staged functions say "not applied yet".
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canEditDetail, changeNote, type DetailEditKind, type DetailsViewer } from "@/lib/home-details";

const uuid = z.string().uuid();
type Loose = {
  rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (t: string) => any;
};
const loose = (sb: unknown) => {
  const s = sb as Loose & { rpc: Loose["rpc"] };
  return { rpc: s.rpc.bind(s) as Loose["rpc"], from: s.from.bind(s) as Loose["from"] };
};

async function homeProject(db: ReturnType<typeof loose>, propertyId: string) {
  const r = await db.from("onboarding_projects").select("*").eq("property_id", propertyId).neq("status", "cancelled")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (r.data ?? null) as (Record<string, unknown> & { id: string; project_manager: string | null; utility_manager: string | null; role_assignments: Record<string, string> | null; external_refs: Record<string, string> | null }) | null;
}

/** Who the signed-in person is on this home (3.1 edit rule). */
export async function loadDetailsViewer(sb: unknown, uid: string, propertyId: string): Promise<DetailsViewer & { projectId: string | null }> {
  const db = loose(sb);
  const [admin, director, opsDirector, team, project, supervisor] = await Promise.all([
    db.rpc("has_role", { _user_id: uid, _role: "admin" }),
    db.rpc("is_onboarding_director", { _user_id: uid }),
    db.rpc("holds_functional_role", { _user_id: uid, _code: "director_ops" }),
    db.rpc("can_manage_project_team", { _user_id: uid }),
    homeProject(db, propertyId),
    db.rpc("is_supervisor", { _user_id: uid }),
  ]);
  const roles = (project?.role_assignments ?? {}) as Record<string, string>;
  return {
    userId: uid,
    projectId: project?.id ?? null,
    isAdmin: admin.data === true,
    isOnboardingDirector: director.data === true,
    isOperationsDirector: opsDirector.data === true,
    isSupervisor: supervisor.data === true,
    isHomePm: project?.project_manager === uid,
    isHomeDesigner: ["designer", "lead_designer", "design_staging"].some((k) => roles[k] === uid),
    isHomeUtilities: project?.utility_manager === uid || roles["utilities"] === uid,
    canManageTeam: team.data === true,
  };
}

function refuse(kind: DetailEditKind) {
  const who: Record<DetailEditKind, string> = {
    project: "this home's Project Manager, the Director or an Admin",
    dates: "this home's Project Manager, the Director or an Admin",
    committed_set: "this home's Project Manager, the Director or an Admin",
    committed_correct: "the Supervisor or an Admin",
    utilities: "this home's Utilities or Project Manager, the Director or an Admin",
    hoa: "this home's Project Manager or Utilities, the Director or an Admin",
    team_role: "the Director of Onboarding or leadership",
    stagers: "the Director of Onboarding or an Admin",
    owner_record: "the Director or an Admin",
  };
  return new Error(`Only ${who[kind]} can change this.`);
}

export const homeDetailsViewerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid }).parse(d))
  .handler(async ({ context, data }) => loadDetailsViewer(context.supabase, context.userId, data.propertyId));

/** The latest "Changed by" for each field: project history (by label), Home Profile history (by item), stagers. */
export const homeDetailsHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const db = loose(context.supabase);
    const [events, edits] = await Promise.all([
      db.from("onboarding_project_events").select("summary, detail, actor, created_at").eq("property_id", data.propertyId)
        .in("kind", ["project_detail_changed", "project_updated", "stagers_changed"]).order("created_at", { ascending: false }).limit(500),
      db.from("property_profile_edits").select("item_key, edited_by_label, edited_at").eq("property_id", data.propertyId)
        .order("edited_at", { ascending: false }).limit(500),
    ]);
    const evRows = (events.data ?? []) as { summary: string | null; detail: string | null; actor: string | null; created_at: string }[];
    const actorIds = [...new Set(evRows.map((e) => e.actor).filter(Boolean))] as string[];
    const names = actorIds.length
      ? (((await db.from("profiles").select("id, full_name, email").in("id", actorIds)).data ?? []) as { id: string; full_name: string | null; email: string | null }[])
      : [];
    const nameOf = new Map(names.map((p) => [p.id, p.full_name || p.email || null] as const));
    const byNote: Record<string, { by: string | null; at: string }> = {};
    for (const e of evRows) {
      for (const note of [e.summary, e.detail]) {
        if (!note || byNote[note]) continue;
        byNote[note] = { by: e.actor ? nameOf.get(e.actor) ?? null : null, at: e.created_at };
      }
    }
    const byItem: Record<string, { by: string | null; at: string }> = {};
    for (const r of (edits.data ?? []) as { item_key: string; edited_by_label: string | null; edited_at: string }[]) {
      if (!byItem[r.item_key]) byItem[r.item_key] = { by: r.edited_by_label, at: r.edited_at };
    }
    return { byNote, byItem };
  });

const saveInput = z.discriminatedUnion("target", [
  z.object({ target: z.literal("choice"), propertyId: uuid, field: z.enum(["owner_type", "project_status", "pma_status", "invoice_status", "greater_area"]), value: z.string().trim().max(200).nullable() }),
  z.object({ target: z.literal("committed"), propertyId: uuid, value: z.string().date() }),
  z.object({ target: z.literal("staged"), propertyId: uuid, field: z.enum(["telegram_url", "loa_status"]), value: z.string().trim().max(300).nullable() }),
  z.object({ target: z.literal("ref"), propertyId: uuid, key: z.enum(["zillow_url", "property_folder", "purchase_agreement", "verified_address", "builder", "ccrs_reviewed_on", "ccrs_note"]), label: z.string().max(80), section: z.enum(["project", "hoa"]), value: z.string().trim().max(300).nullable() }),
  z.object({ target: z.literal("date"), propertyId: uuid, field: z.enum(["possessionOn", "targetHandoffOn", "inspectionOn"]), label: z.string().max(80), value: z.string().date().nullable() }),
  z.object({ target: z.literal("profile"), propertyId: uuid, section: z.enum(["utilities", "hoa"]), card: z.string().max(120), changes: z.array(z.record(z.string(), z.unknown())).min(1).max(1) }),
]);

/** One field saved from Home details, through the existing write path for that field. */
export const saveHomeDetailFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveInput.parse(d))
  .handler(async ({ context, data }) => {
    const viewer = await loadDetailsViewer(context.supabase, context.userId, data.propertyId);
    const kind: DetailEditKind =
      data.target === "profile" ? data.section : data.target === "ref" ? data.section : data.target === "date" ? "dates" : data.target === "committed" ? "committed_set" : "project";
    if (!canEditDetail(viewer, kind)) throw refuse(kind);
    const db = loose(context.supabase);
    if (data.target === "profile") {
      const { error } = await db.rpc("save_home_profile_card", { _property_id: data.propertyId, _card: data.card, _changes: data.changes });
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    if (!viewer.projectId) throw new Error("This home has no onboarding project yet.");
    if (data.target === "choice") {
      const { error } = await db.rpc("save_onboarding_project_details", { _project_id: viewer.projectId, _patch: { [data.field]: data.value } });
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    if (data.target === "committed") {
      // Set once; a correction goes through correct_committed_handoff_date (Supervisor or Admin, register O3).
      const { error } = await db.rpc("save_onboarding_project_details", { _project_id: viewer.projectId, _patch: { committed_handoff_on: data.value } });
      if (error) throw new Error(error.message);
      return { ok: true as const };
    }
    if (data.target === "staged") {
      const { callStaged } = await import("./onboarding-home.server");
      await callStaged(context.supabase as never, "save_home_detail_field", { _project_id: viewer.projectId, _field: data.field, _value: data.value });
      return { ok: true as const };
    }
    const { updateProject } = await import("./onboarding-project.server");
    if (data.target === "ref") {
      const project = await homeProject(db, data.propertyId);
      const refs = { ...((project?.external_refs ?? {}) as Record<string, string>) };
      if (data.value) refs[data.key] = data.value;
      else delete refs[data.key];
      await updateProject(context.supabase as never, context.userId, { projectId: viewer.projectId, externalRefs: refs, reason: changeNote(data.label) });
      return { ok: true as const };
    }
    await updateProject(context.supabase as never, context.userId, { projectId: viewer.projectId, [data.field]: data.value, reason: changeNote(data.label) });
    return { ok: true as const };
  });

/** 3.2 File a document into a folder (staged move_home_file; never Other). */
export const moveHomeFileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: uuid, category: z.string().min(2).max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    const { callStaged } = await import("./onboarding-home.server");
    return callStaged<{ ok: true; changed: boolean }>(context.supabase as never, "move_home_file", { _document_id: data.documentId, _category: data.category });
  });

export type HomeFileRow = {
  id: string;
  title: string | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  category: string | null;
  entity_type: string;
  entity_id: string;
  task_title: string | null;
  uploaded_at: string | null;
  uploaded_by_name: string | null;
  visibility: string;
  owner_recipient_id: string | null;
};

/** 3.2 Every stored file on the home: the home's own files and its Tasks' files. */
export const homeFilesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const db = loose(context.supabase);
    const docs = await db.from("documents")
      .select("id, title, original_filename, mime_type, size_bytes, category, entity_type, entity_id, uploaded_at, created_at, uploaded_by, visibility, owner_recipient_id")
      .eq("property_id", data.propertyId).in("entity_type", ["property", "onboarding_task"])
      .eq("upload_status", "stored").is("archived_at", null).is("deleted_at", null)
      .order("created_at", { ascending: false }).limit(1000);
    if (docs.error) throw new Error(docs.error.message);
    const rows = (docs.data ?? []) as (Omit<HomeFileRow, "task_title" | "uploaded_by_name"> & { uploaded_by: string | null; created_at: string })[];
    const people = [...new Set(rows.map((r) => r.uploaded_by).filter(Boolean))] as string[];
    const tasks = [...new Set(rows.filter((r) => r.entity_type === "onboarding_task").map((r) => r.entity_id))];
    const [names, taskRows] = await Promise.all([
      people.length ? db.from("profiles").select("id, full_name, email").in("id", people) : Promise.resolve({ data: [] }),
      tasks.length ? db.from("onboarding_tasks").select("id, title").in("id", tasks) : Promise.resolve({ data: [] }),
    ]);
    const nameOf = new Map(((names.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((p) => [p.id, p.full_name || p.email || null] as const));
    const taskOf = new Map(((taskRows.data ?? []) as { id: string; title: string }[]).map((t) => [t.id, t.title] as const));
    return rows.map((r): HomeFileRow => ({
      id: r.id, title: r.title, original_filename: r.original_filename, mime_type: r.mime_type, size_bytes: r.size_bytes,
      category: r.category, entity_type: r.entity_type, entity_id: r.entity_id,
      task_title: r.entity_type === "onboarding_task" ? taskOf.get(r.entity_id) ?? null : null,
      uploaded_at: r.uploaded_at ?? r.created_at, uploaded_by_name: r.uploaded_by ? nameOf.get(r.uploaded_by) ?? null : null,
      visibility: r.visibility, owner_recipient_id: r.owner_recipient_id,
    }));
  });

export type HomeVendor = {
  orgId: string;
  name: string;
  trades: string[];
  priority: number | null;
  phone: string | null;
  email: string | null;
  preferred: "call" | "text" | "email" | null;
  stager: boolean;
  forThisHome: boolean;
};

/** Notion's imported Option ranking: the rank, else the lowest "Option N" in its preference. */
export function legacyOption(legacy: Record<string, unknown> | null | undefined): number | null {
  const rank = Number((legacy ?? {})["Legacy preference rank"]);
  if (Number.isInteger(rank) && rank > 0) return rank;
  const pref = String((legacy ?? {})["Notion: preference"] ?? "");
  const found = [...pref.matchAll(/Option\s+(\d+)/gi)].map((m) => Number(m[1])).filter((n) => n > 0);
  return found.length ? Math.min(...found) : null;
}

/** 3.3 Vendors for the home: its market's vendors, vendors set on the home, and its stagers. */
export const homeVendorsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const db = loose(context.supabase);
    const { vendorMarketFor } = await import("./vendor-market");
    const home = await db.from("properties").select("market, is_demo").eq("id", data.propertyId).maybeSingle();
    const project = await homeProject(db, data.propertyId);
    const market = vendorMarketFor((project?.greater_area as string | null) ?? home.data?.market ?? null);
    const [coverage, homeCoverage, stagers] = await Promise.all([
      market ? db.from("vendor_market_coverage").select("org_id, service_category").eq("market", market) : Promise.resolve({ data: [] }),
      db.from("property_vendor_coverage").select("org_id, service_category, excluded").eq("property_id", data.propertyId),
      project ? db.from("onboarding_project_stagers").select("vendor_org_id").eq("project_id", project.id).is("removed_at", null) : Promise.resolve({ data: [] }),
    ]);
    const trades = new Map<string, Set<string>>();
    const onHome = new Set<string>();
    for (const r of (coverage.data ?? []) as { org_id: string; service_category: string }[]) trades.set(r.org_id, (trades.get(r.org_id) ?? new Set()).add(r.service_category));
    for (const r of (homeCoverage.data ?? []) as { org_id: string; service_category: string; excluded: boolean | null }[]) {
      if (r.excluded) continue;
      onHome.add(r.org_id);
      trades.set(r.org_id, (trades.get(r.org_id) ?? new Set()).add(r.service_category));
    }
    const stagerIds = new Set(((stagers.data ?? []) as { vendor_org_id: string }[]).map((s) => s.vendor_org_id));
    const ids = [...new Set([...trades.keys(), ...stagerIds])];
    if (!ids.length) return { market, vendors: [] as HomeVendor[] };
    // preferred_contact is staged; read it when present and never guess it.
    let orgs = await db.from("vendor_orgs").select("id, display_name, legal_name, primary_contact_phone, primary_contact_email, service_categories, legacy_fields, is_active, is_demo, preferred_contact").in("id", ids);
    if (orgs.error) orgs = await db.from("vendor_orgs").select("id, display_name, legal_name, primary_contact_phone, primary_contact_email, service_categories, legacy_fields, is_active, is_demo").in("id", ids);
    if (orgs.error) throw new Error(orgs.error.message);
    type Org = { id: string; display_name: string | null; legal_name: string | null; primary_contact_phone: string | null; primary_contact_email: string | null; service_categories: string[] | null; legacy_fields: Record<string, unknown> | null; is_active: boolean | null; is_demo: boolean | null; preferred_contact?: string | null };
    const vendors = ((orgs.data ?? []) as Org[])
      .filter((o) => o.is_active !== false && Boolean(o.is_demo) === Boolean(home.data?.is_demo))
      .map((o): HomeVendor => ({
        orgId: o.id,
        name: o.display_name || o.legal_name || "Vendor",
        trades: [...(trades.get(o.id) ?? new Set(stagerIds.has(o.id) ? ["Staging"] : (o.service_categories ?? [])))],
        priority: legacyOption(o.legacy_fields),
        phone: o.primary_contact_phone,
        email: o.primary_contact_email,
        preferred: o.preferred_contact === "call" || o.preferred_contact === "text" || o.preferred_contact === "email" ? o.preferred_contact : null,
        stager: stagerIds.has(o.id),
        forThisHome: onHome.has(o.id) || stagerIds.has(o.id),
      }));
    return { market, vendors };
  });

export type HomeBreezewayRow = { id: string; taskId: string; name: string; status: string | null; scheduledDate: string | null; assignees: string[]; done: boolean; url: string };

/** 3.3 The home's Breezeway work orders as synced (read only; nothing is sent). */
export const homeBreezewayWorkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: uuid }).parse(d))
  .handler(async ({ context, data }) => {
    const db = loose(context.supabase);
    const { breezewayTaskLink } = await import("./breezeway-bridge");
    const r = await db.from("breezeway_work_orders").select("id, breezeway_task_id, name, status, stage, scheduled_date, finished_at, assignees, report_url")
      .eq("property_id", data.propertyId).order("scheduled_date", { ascending: false, nullsFirst: false }).limit(300);
    if (r.error) throw new Error(r.error.message);
    return ((r.data ?? []) as { id: string; breezeway_task_id: string | number; name: string | null; status: string | null; stage: string | null; scheduled_date: string | null; finished_at: string | null; assignees: unknown; report_url: string | null }[])
      .map((w): HomeBreezewayRow => {
        const status = w.stage || w.status;
        return {
          id: w.id,
          taskId: String(w.breezeway_task_id),
          name: w.name || "Breezeway work order",
          status,
          scheduledDate: w.scheduled_date,
          assignees: Array.isArray(w.assignees) ? (w.assignees as { name?: string | null }[]).map((a) => (typeof a === "string" ? a : a?.name ?? "")).filter(Boolean) : [],
          done: Boolean(w.finished_at) || /finished|closed|complete|approved/i.test(String(status ?? "")),
          url: breezewayTaskLink(w.breezeway_task_id, w.report_url),
        };
      });
  });
