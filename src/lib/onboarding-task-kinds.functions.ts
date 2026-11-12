/**
 * Task kinds (Nov 12 build, Part A): plan step settings, the vendor list for Vendor or team
 * request Tasks, and the values Fill in Resolve Tasks check. Every read and write runs as the
 * caller under existing RLS. The kind columns come from staged file 01; until it is applied the
 * reads report ready: false and nothing is written.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TASK_KINDS, kindSettings, type FillFieldCode, type VendorRow } from "./onboarding-task-kinds";

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

/**
 * Vendors for this home's market and the step's trade. The home's own first-choice vendors
 * (active today) show first with their note.
 */
export const taskVendorsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), trade: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const { vendorMarketFor } = await import("./vendor-market");
    const { orderVendors } = await import("./onboarding-task-kinds");
    const home = await db.from("properties").select("market, is_demo").eq("id", data.propertyId).maybeSingle();
    const market = vendorMarketFor(home.data?.market ?? null);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    const [coverage, homeCoverage] = await Promise.all([
      market
        ? db.from("vendor_market_coverage").select("org_id").eq("market", market).eq("service_category", data.trade)
        : Promise.resolve({ data: [], error: null }),
      db
        .from("property_vendor_coverage")
        .select("org_id, rate_note, effective_from, effective_to, excluded, coverage_priority")
        .eq("property_id", data.propertyId)
        .eq("service_category", data.trade),
    ]);
    const firstChoice = new Map<string, string | null>();
    for (const r of (homeCoverage.data ?? []) as { org_id: string; rate_note: string | null; effective_from: string | null; effective_to: string | null; excluded: boolean | null }[]) {
      if (r.excluded) continue;
      if (r.effective_from && r.effective_from > today) continue;
      if (r.effective_to && r.effective_to < today) continue;
      firstChoice.set(r.org_id, r.rate_note);
    }
    const ids = [...new Set([...((coverage.data ?? []) as { org_id: string }[]).map((r) => r.org_id), ...firstChoice.keys()])];
    if (!ids.length) return { market, rows: [] as VendorRow[] };
    const orgs = await db
      .from("vendor_orgs")
      .select("id, legal_name, display_name, primary_contact_name, primary_contact_phone, primary_contact_email, work_order_email, breezeway_person_id, is_active, is_demo")
      .in("id", ids);
    const rows: VendorRow[] = ((orgs.data ?? []) as Record<string, unknown>[])
      .filter((o) => o.is_active !== false && Boolean(o.is_demo) === Boolean(home.data?.is_demo))
      .map((o) => ({
        orgId: String(o.id),
        name: String(o.display_name || o.legal_name || "Vendor"),
        contact: (o.primary_contact_name as string | null) ?? null,
        phone: (o.primary_contact_phone as string | null) ?? null,
        email: ((o.primary_contact_email || o.work_order_email) as string | null) ?? null,
        usesBreezeway: Boolean(o.breezeway_person_id),
        homeFirstChoice: firstChoice.has(String(o.id)),
        note: firstChoice.get(String(o.id)) ?? null,
      }));
    return { market, rows: orderVendors(rows) };
  });

/**
 * Fill in Resolve: which of the step's fields already have a value on the home or project.
 * Read only; the values are edited in the same home panels the home page shows.
 */
export const fillInValuesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), fields: z.array(z.string().max(40)).max(12) }).parse(d))
  .handler(async ({ context, data }) => {
    const db = context.supabase as unknown as Loose;
    const [home, project, budget, team] = await Promise.all([
      db.from("properties").select("planned_closing_on, access, access_notes, wifi_notes, utilities, address_line1, formatted_address").eq("id", data.propertyId).maybeSingle(),
      db.from("onboarding_projects").select("id, target_handoff_on, committed_handoff_on, planned_closing_on, utility_manager").eq("property_id", data.propertyId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("onboarding_budgets").select("id").eq("property_id", data.propertyId).limit(1),
      db.from("onboarding_projects").select("project_manager").eq("property_id", data.propertyId).neq("status", "cancelled").limit(1).maybeSingle(),
    ]);
    const h = (home.data ?? {}) as Record<string, unknown>;
    const p = (project.data ?? {}) as Record<string, unknown>;
    const has = (v: unknown) => v !== null && v !== undefined && String(typeof v === "object" ? JSON.stringify(v) : v).replace(/[{}[\]"]/g, "").trim() !== "";
    const filled: Partial<Record<FillFieldCode, boolean | null>> = {
      closing_date: has(h.planned_closing_on) || has(p.planned_closing_on),
      target_handoff: has(p.target_handoff_on) || has(p.committed_handoff_on),
      access_plan: has(h.access) || has(h.access_notes),
      budget: (budget.data ?? []).length > 0,
      wifi: has(h.wifi_notes),
      team_roles: has((team.data as Record<string, unknown> | null)?.project_manager),
      verified_address: has(h.formatted_address) || has(h.address_line1),
      utility_accounts: has(h.utilities),
      // No home or project field holds these yet; they cannot be filled in Resolve.
      inspection_date: null,
      default_cleaner: null,
    };
    const out: Record<string, boolean | null> = {};
    for (const f of data.fields) out[f] = (filled as Record<string, boolean | null | undefined>)[f] ?? null;
    return { filled: out };
  });
