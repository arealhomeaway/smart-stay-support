/**
 * Task kinds (Nov 12 build, Part A): plan step settings, the vendor list for Vendor or team
 * request Tasks, and the values Fill in Resolve Tasks check. Every read and write runs as the
 * caller under existing RLS. The kind columns come from staged file 01; until it is applied the
 * reads report ready: false and nothing is written.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OUTSIDE_DOCUMENT_MAX, OUTSIDE_MESSAGE_MAX, TASK_KINDS, kindSettings, type FillFieldCode, type VendorRow } from "./onboarding-task-kinds";

type Loose = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  rpc: (n: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

const settingsSchema = z
  .object({
    emailTemplateId: z.string().uuid().nullable().optional(),
    trade: z.string().trim().max(80).nullable().optional(),
    fields: z.array(z.string().max(40)).max(12).optional(),
    where: z.enum(["docusign", "houzz_pro", "quickbooks", "email", "text", "other"]).nullable().optional(),
    fallback: z.enum(["outside_resolve", "email"]).nullable().optional(),
    documentName: z.string().trim().max(OUTSIDE_DOCUMENT_MAX).nullable().optional(),
    ownerMessage: z.string().trim().max(OUTSIDE_MESSAGE_MAX).nullable().optional(),
    requireFile: z.boolean().optional(),
  })
  .strict();

/** Step kinds for one plan, plus the onboarding email templates and trades the pickers offer. */
export const readStepKindsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ templateId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const [steps, templates, trades] = await Promise.all([
      db.from("onboarding_template_tasks").select("id, task_kind, kind_settings").eq("template_id", data.templateId),
      db.from("email_templates").select("id, name, contexts").eq("active", true).order("name"),
      db.from("vendor_service_categories").select("label").eq("active", true).order("sort_order"),
    ]);
    const ready = !steps.error;
    const byStep: Record<string, { kind: string; settings: ReturnType<typeof kindSettings> }> = {};
    for (const r of (steps.data ?? []) as { id: string; task_kind: string; kind_settings: unknown }[])
      byStep[r.id] = { kind: r.task_kind, settings: kindSettings(r.kind_settings) };
    const onboardingTemplates = ((templates.data ?? []) as { id: string; name: string; contexts: string[] | null }[])
      .filter((t) => (t.contexts ?? []).some((c) => c === "onboarding_task" || c === "onboarding"))
      .map((t) => ({ id: t.id, name: t.name }));
    return {
      ready,
      byStep,
      emailTemplates: onboardingTemplates,
      trades: ((trades.data ?? []) as { label: string }[]).map((t) => t.label),
    };
  });

/** Saves one step's kind and settings; it reaches new homes when the plan is published. */
export const saveStepKindFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ stepId: z.string().uuid(), kind: z.enum(TASK_KINDS), settings: settingsSchema }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const settings = kindSettings(data.settings);
    const { data: row, error } = await db
      .from("onboarding_template_tasks")
      .update({ task_kind: data.kind, kind_settings: settings })
      .eq("id", data.stepId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error("The kind of Task could not be saved yet.");
    if (!row) throw new Error("You can't change this plan step.");
    return { ok: true as const };
  });

/** The stored kind of one Task, when the column exists. */
export const readTaskKindFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const r = await db.from("onboarding_tasks").select("task_kind, kind_settings").eq("id", data.taskId).maybeSingle();
    if (r.error || !r.data) return { ready: false as const, kind: null, settings: {} };
    return { ready: true as const, kind: String(r.data.task_kind), settings: kindSettings(r.data.kind_settings) };
  });

/** Vendors for one home's market and trade; the home's own active vendors first, with their note. */
async function vendorsFor(db: Loose, propertyId: string, trade: string) {
  const { vendorMarketFor } = await import("./vendor-market");
  const { orderVendors } = await import("./onboarding-task-kinds");
  const home = await db.from("properties").select("market, is_demo").eq("id", propertyId).maybeSingle();
  const market = vendorMarketFor(home.data?.market ?? null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const [coverage, homeCoverage] = await Promise.all([
    market
      ? db.from("vendor_market_coverage").select("org_id").eq("market", market).eq("service_category", trade)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("property_vendor_coverage")
      .select("org_id, rate_note, effective_from, effective_to, excluded, coverage_priority")
      .eq("property_id", propertyId)
      .eq("service_category", trade),
  ]);
  const firstChoice = new Map<string, string | null>();
  for (const r of (homeCoverage.data ?? []) as { org_id: string; rate_note: string | null; effective_from: string | null; effective_to: string | null; excluded: boolean | null }[]) {
    if (r.excluded) continue;
    if (r.effective_from && r.effective_from > today) continue;
    if (r.effective_to && r.effective_to < today) continue;
    firstChoice.set(r.org_id, r.rate_note);
  }
  const ids = [...new Set([...((coverage.data ?? []) as { org_id: string }[]).map((r) => r.org_id), ...firstChoice.keys()])];
  if (!ids.length) return { market, isDemo: Boolean(home.data?.is_demo), rows: [] as VendorRow[] };
  const orgs = await db
    .from("vendor_orgs")
    .select("id, legal_name, display_name, primary_contact_name, primary_contact_phone, primary_contact_email, work_order_email, breezeway_person_id, is_active, is_demo")
    .in("id", ids);
  type Org = {
    id: string; legal_name: string | null; display_name: string | null; primary_contact_name: string | null;
    primary_contact_phone: string | null; primary_contact_email: string | null; work_order_email: string | null;
    breezeway_person_id: string | number | null; is_active: boolean | null; is_demo: boolean | null;
  };
  const rows: VendorRow[] = ((orgs.data ?? []) as Org[])
    .filter((o) => o.is_active !== false && Boolean(o.is_demo) === Boolean(home.data?.is_demo))
    .map((o) => ({
      orgId: String(o.id),
      name: String(o.display_name || o.legal_name || "Vendor"),
      contact: o.primary_contact_name ?? null,
      phone: o.primary_contact_phone ?? null,
      email: o.primary_contact_email || o.work_order_email || null,
      usesBreezeway: Boolean(o.breezeway_person_id),
      homeFirstChoice: firstChoice.has(String(o.id)),
      note: firstChoice.get(String(o.id)) ?? null,
    }));
  return { market, isDemo: Boolean(home.data?.is_demo), rows: orderVendors(rows) };
}

/**
 * Vendors for this home's market and the step's trade. The home's own first-choice vendors
 * (active today) show first with their note.
 */
export const taskVendorsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), trade: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const r = await vendorsFor(context.supabase as unknown as Loose, data.propertyId, data.trade);
    return { market: r.market, rows: r.rows };
  });

const centralToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

/** The newest live onboarding project for a home, every column (the staged inspection date included once applied). */
async function homeProject(db: Loose, propertyId: string) {
  const r = await db.from("onboarding_projects").select("*").eq("property_id", propertyId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (r.data ?? null) as (Record<string, unknown> & { id: string }) | null;
}

/** The home's live default cleaner (primary Turnover Cleaning coverage), with the vendor's name. */
async function readDefaultCleaner(db: Loose, propertyId: string) {
  const { liveDefaultCleaner, DEFAULT_CLEANER_TRADE } = await import("./onboarding-task-kinds");
  const rows = await db
    .from("property_vendor_coverage")
    .select("id, org_id, service_category, coverage_priority, effective_from, effective_to, excluded, created_at")
    .eq("property_id", propertyId)
    .eq("service_category", DEFAULT_CLEANER_TRADE)
    .order("created_at", { ascending: false });
  const live = liveDefaultCleaner(((rows.data ?? []) as import("./onboarding-task-kinds").CoverageRow[]), centralToday());
  if (!live) return null;
  const org = await db.from("vendor_orgs").select("display_name, legal_name").eq("id", live.org_id).maybeSingle();
  return { orgId: String(live.org_id), name: String(org.data?.display_name || org.data?.legal_name || "Vendor") };
}

/**
 * Fill in Resolve: which of the step's fields already have a value on the home or project.
 * Read only; the values are edited in place in the drawer with the same saves as Home info.
 */
export const fillInValuesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), fields: z.array(z.string().max(40)).max(12) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const [home, projectRow] = await Promise.all([
      db.from("properties").select("planned_closing_on, access, access_notes, wifi_notes, utilities").eq("id", data.propertyId).maybeSingle(),
      homeProject(db, data.propertyId),
    ]);
    const projectId = projectRow?.id ?? null;
    const [budget, cleaner] = await Promise.all([
      projectId ? db.from("onboarding_budgets").select("id").eq("project_id", projectId).limit(1) : Promise.resolve({ data: [] }),
      data.fields.includes("default_cleaner") ? readDefaultCleaner(db, data.propertyId) : Promise.resolve(null),
    ]);
    type Home = { planned_closing_on?: unknown; access?: unknown; access_notes?: unknown; wifi_notes?: unknown; utilities?: unknown };
    const h = (home.data ?? {}) as Home;
    const p = (projectRow ?? {}) as Record<string, unknown>;
    const refs = (p["external_refs"] ?? {}) as Record<string, unknown>;
    const has = (v: unknown) => v !== null && v !== undefined && String(typeof v === "object" ? JSON.stringify(v) : v).replace(/[{}[\]"]/g, "").trim() !== "";
    const filled: Partial<Record<FillFieldCode, boolean | null>> = {
      closing_date: has(h.planned_closing_on) || has(p["planned_closing_on"]),
      target_handoff: has(p["target_handoff_on"]) || has(p["committed_handoff_on"]),
      access_plan: has(h.access) || has(h.access_notes),
      budget: ((budget as { data: unknown[] | null }).data ?? []).length > 0,
      wifi: has(h.wifi_notes),
      team_roles: has(p["project_manager"]) || has(p["role_assignments"]),
      // Item 1: the verified address is the one typed on Home info (General Info), not the listing address.
      verified_address: has(refs["verified_address"]),
      utility_accounts: has(h.utilities),
      // Item 1: inspection date lives on the project (staged file 01); null until that column exists.
      inspection_date: projectRow && "inspection_on" in projectRow ? has(projectRow["inspection_on"]) : null,
      default_cleaner: Boolean(cleaner),
    };
    const out: Record<string, boolean | null> = {};
    for (const f of data.fields) out[f] = (filled as Record<string, boolean | null | undefined>)[f] ?? null;
    return { filled: out };
  });

/** Item 1: the values Fill in Resolve edits in place, with the people allowed to change the cleaner. */
export const fillInDetailsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), withCleaners: z.boolean().default(false) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const { DEFAULT_CLEANER_TRADE } = await import("./onboarding-task-kinds");
    const [projectRow, cleaner, vendorEditor, options] = await Promise.all([
      homeProject(db, data.propertyId),
      readDefaultCleaner(db, data.propertyId),
      db.rpc("can_edit_vendors", { _user_id: context.userId }),
      data.withCleaners ? vendorsFor(db, data.propertyId, DEFAULT_CLEANER_TRADE) : Promise.resolve(null),
    ]);
    const refs = ((projectRow?.["external_refs"] ?? {}) as Record<string, string>);
    return {
      projectId: projectRow?.id ?? null,
      targetHandoffOn: (projectRow?.["target_handoff_on"] as string | null | undefined) ?? null,
      inspectionReady: Boolean(projectRow && "inspection_on" in projectRow),
      inspectionOn: (projectRow?.["inspection_on"] as string | null | undefined) ?? null,
      externalRefs: refs,
      verifiedAddress: refs["verified_address"] ?? null,
      defaultCleaner: cleaner,
      cleanerOptions: (options?.rows ?? []).map((r) => ({ orgId: r.orgId, name: r.name, homeFirstChoice: r.homeFirstChoice })),
      market: options?.market ?? null,
      canSetCleaner: vendorEditor.data === true,
    };
  });

/**
 * Item 1: set a home's default cleaner. Operations keeps a home's cleaner as its primary
 * Turnover Cleaning vendor coverage row, written under the existing vendor-coverage rule
 * (can_edit_vendors). A previous default is ended yesterday (Central), never deleted.
 */
export const setDefaultCleanerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), orgId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const { assertVendorEditor } = await import("./vendors.server");
    await assertVendorEditor(context.supabase as never, context.userId);
    const { DEFAULT_CLEANER_TRADE } = await import("./onboarding-task-kinds");
    const [home, org, current] = await Promise.all([
      db.from("properties").select("is_demo").eq("id", data.propertyId).maybeSingle(),
      db.from("vendor_orgs").select("id, display_name, legal_name, is_active, is_demo").eq("id", data.orgId).maybeSingle(),
      readDefaultCleaner(db, data.propertyId),
    ]);
    if (!home.data) throw new Error("That home could not be found.");
    const o = org.data as { display_name: string | null; legal_name: string | null; is_active: boolean | null; is_demo: boolean | null } | null;
    if (!o || o.is_active === false) throw new Error("Choose an active cleaning vendor.");
    if (Boolean(o.is_demo) !== Boolean(home.data.is_demo)) throw new Error("Choose a cleaning vendor for this home.");
    if (current?.orgId === data.orgId) return { ok: true as const, unchanged: true };
    const today = centralToday();
    const yesterday = new Date(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    const ended = await db
      .from("property_vendor_coverage")
      .update({ effective_to: yesterday })
      .eq("property_id", data.propertyId)
      .eq("service_category", DEFAULT_CLEANER_TRADE)
      .eq("coverage_priority", "primary")
      .or(`effective_to.is.null,effective_to.gte.${today}`);
    if (ended.error) throw new Error("The default cleaner could not be changed.");
    const added = await db.from("property_vendor_coverage").insert({
      org_id: data.orgId,
      property_id: data.propertyId,
      service_category: DEFAULT_CLEANER_TRADE,
      coverage_priority: "primary",
      last_verified_at: new Date().toISOString(),
      created_by: context.userId,
    });
    if (added.error) throw new Error("The default cleaner could not be saved.");
    const name = o.display_name || o.legal_name || "a cleaning vendor";
    await db.from("property_activity_log").insert({
      property_id: data.propertyId,
      category: "cleaner",
      what_happened: `Default cleaner set to ${name}`,
      outcome: current ? `Replaces ${current.name}.` : "Set from an onboarding Task.",
      is_demo: Boolean(home.data.is_demo),
    });
    return { ok: true as const, unchanged: false };
  });

/** Item 9: who reviews an Approval Task with no step review (staged file 02); ready: false until applied. */
export const approvalReviewerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Loose["rpc"];
    const r = await rpc("approval_task_reviewer", { _task_id: data.taskId });
    if (r.error) return { ready: false as const, reviewerId: null };
    return { ready: true as const, reviewerId: (r.data as string | null) ?? null };
  });

/** Item 9: Send back with a required note (reopens or notifies the Show files from steps). */
export const approvalSendBackFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid(), note: z.string().trim().min(5, "Write what needs to change.").max(2000) }).parse(d))
  .handler(async ({ context, data }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as Loose["rpc"];
    const r = await rpc("approval_task_send_back", { _task_id: data.taskId, _note: data.note });
    if (r.error) throw new Error(r.error.message || "This could not be sent back.");
    return r.data as { reopened: string[]; notified: number };
  });

/**
 * Fix 21: the comment @ picker offers every onboarding role (Director of Onboarding included)
 * with the people who hold it, plus people by name. Fix 13: names for comment authors.
 */
export const mentionDirectoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as Loose;
    const staff = await db.rpc("is_staff", { _user_id: context.userId });
    if (staff.error || staff.data !== true) throw new Error("Staff access is required.");
    const { roleLabel } = await import("./v2-workflow.functions");
    const [roles, members, profiles] = await Promise.all([
      db.from("functional_roles").select("code, team, active, sort_order").eq("team", "onboarding").eq("active", true).order("sort_order"),
      db.from("functional_role_members").select("role_code, user_id"),
      db.from("profiles").select("id, full_name, email"),
    ]);
    const memberRows = (members.data ?? []) as { role_code: string; user_id: string }[];
    const people = ((profiles.data ?? []) as { id: string; full_name: string | null; email: string | null }[]).filter((p) => p.full_name || p.email);
    const onboardingIds = new Set<string>();
    const roleRows = ((roles.data ?? []) as { code: string }[]).map((r) => {
      const ids = [...new Set(memberRows.filter((m) => m.role_code === r.code).map((m) => m.user_id))];
      ids.forEach((id) => onboardingIds.add(id));
      return { code: r.code, name: roleLabel(r.code), userIds: ids };
    });
    return {
      roles: roleRows,
      people: people
        .filter((p) => onboardingIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.full_name || p.email || "" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      names: Object.fromEntries(people.map((p) => [p.id, p.full_name || p.email || ""])),
    };
  });
