/**
 * Onboarding Home as the project database (Admin approval Nov 12): server functions.
 * Every write is checked here as the signed-in person and again in the database.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FILTER_KEYS, HOME_VIEWS, OPTIONAL_COLUMNS } from "@/lib/onboarding-home";

const DESIGNER_ROLE = "lead_designer";
const ROLE_CODE = { pm: "onboarding_project_manager", designer: DESIGNER_ROLE, utilities: "utilities" } as const;

export const getOnboardingHomeFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOnboardingHome } = await import("./onboarding-home.server");
    return loadOnboardingHome(context.supabase, context.userId);
  });

export const notInResolveYetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadNotInResolveYet } = await import("./onboarding-home.server");
    return loadNotInResolveYet(context.supabase, context.userId);
  });

/** 2.6 Not an onboarding home: hides it from the list with a reason; logged in the database. */
export const dismissOwnerRezListingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ listingId: z.string().trim().min(1).max(60), name: z.string().trim().max(200).default(""), reason: z.string().trim().min(3).max(500) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { assertLead, callStaged } = await import("./onboarding-home.server");
    await assertLead(context.supabase, context.userId);
    return callStaged<{ ok: true }>(context.supabase, "dismiss_ownerrez_listing", { _listing_id: data.listingId, _name: data.name, _reason: data.reason });
  });

/** 2.5 / 3.1 Not under contract yet: one home, no plan, no Tasks; the contact and note are a project note. */
export const addUpcomingHomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        addressLine1: z.string().trim().min(3).max(200),
        unit: z.string().trim().max(40).nullable().default(null),
        city: z.string().trim().min(2).max(80),
        state: z.string().trim().min(2).max(40),
        postalCode: z.string().trim().max(12).nullable().default(null),
        expectedClosing: z.string().date().nullable().default(null),
        contact: z.string().trim().min(2).max(300),
        note: z.string().trim().max(2000).nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    // Fix Nov 12: everyone on the onboarding team may add a home, the same rule as every other Add a home.
    const { assertCanAddHome } = await import("./property-intake.server");
    await assertCanAddHome(context.supabase, context.userId);
    const { callStaged } = await import("./onboarding-home.server");
    return callStaged<{ ok: true; property_id: string; project_id: string }>(context.supabase, "add_upcoming_onboarding_home", {
      _request_id: data.requestId,
      _address_line1: data.addressLine1,
      _unit: data.unit,
      _city: data.city,
      _state: data.state,
      _postal_code: data.postalCode,
      _expected_closing: data.expectedClosing,
      _contact: data.contact,
      _note: data.note,
    });
  });

/** 2.5 Under contract: the Upcoming project becomes active so the plan can be built on it. */
export const startUpcomingHomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertLead, callStaged } = await import("./onboarding-home.server");
    await assertLead(context.supabase, context.userId);
    return callStaged<{ ok: true }>(context.supabase, "start_upcoming_onboarding_home", { _project_id: data.projectId });
  });

/** 2.5 Contract fell through: a short reason; moves it to past projects; who and when are kept. */
export const contractFellThroughFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid(), reason: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertLead, callStaged } = await import("./onboarding-home.server");
    await assertLead(context.supabase, context.userId);
    return callStaged<{ ok: true }>(context.supabase, "mark_contract_fell_through", { _project_id: data.projectId, _reason: data.reason });
  });

/**
 * 1.4 Assign from a dashed circle (Director, Admin): the existing audited Project Team function.
 * Returns the person it replaced, so Undo puts them back through the same function.
 */
export const assignFromListFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), role: z.enum(["pm", "designer", "utilities"]), userId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { assertLead } = await import("./onboarding-home.server");
    await assertLead(context.supabase, context.userId);
    const { data: before, error: readError } = await context.supabase
      .from("onboarding_projects")
      .select("project_manager, utility_manager, role_assignments")
      .eq("id", data.projectId)
      .maybeSingle();
    if (readError || !before) throw new Error("That onboarding project was not found.");
    const assignments = (before.role_assignments ?? {}) as Record<string, string>;
    const previous =
      data.role === "pm" ? before.project_manager : data.role === "utilities" ? before.utility_manager : assignments[DESIGNER_ROLE] ?? null;
    type TeamRpc = (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as TeamRpc;
    const r = await rpc("set_onboarding_project_role", {
      _project_id: data.projectId,
      _role_code: ROLE_CODE[data.role],
      _user_id: data.userId,
      _reassign_pending: data.role === "pm",
    });
    if (r.error) throw new Error(r.error.message);
    return { ok: true as const, previous: previous ?? null };
  });

/** 3.2 Stagers are vendors: the full list for one project (Director, Admin), through the staged function. */
export const setProjectStagersFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid(), vendorIds: z.array(z.string().uuid()).max(10) }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertLead, callStaged } = await import("./onboarding-home.server");
    await assertLead(context.supabase, context.userId);
    return callStaged<{ ok: true; added: number; removed: number }>(context.supabase, "set_onboarding_project_stagers", {
      _project_id: data.projectId,
      _vendor_ids: data.vendorIds,
    });
  });

/** 1.3 Add to my homes / Remove from my homes: the person's own follow list. */
export const followHomeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ propertyId: z.string().uuid(), follow: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const sb = context.supabase;
    if (data.follow) {
      const { error } = await sb.from("onboarding_follows").upsert({ user_id: context.userId, property_id: data.propertyId }, { onConflict: "user_id,property_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("onboarding_follows").delete().eq("user_id", context.userId).eq("property_id", data.propertyId);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

const viewShape = z.object({
  filters: z.record(z.string(), z.string().max(120)).refine((f) => Object.keys(f).every((k) => (FILTER_KEYS as readonly string[]).includes(k) || ["q", "tab", "scope", "tile"].includes(k)), "Unknown filter."),
  view: z.enum(HOME_VIEWS.map((v) => v.value) as [string, ...string[]]),
  sort: z.string().max(40).nullable().default(null),
});

/** 2.2 Save this view: for that person only (the staged saved_views table, own rows under RLS). */
export const saveHomeViewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => viewShape.extend({ name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    const { callStaged } = await import("./onboarding-home.server");
    return callStaged<{ ok: true; id: string }>(context.supabase, "save_onboarding_home_view", {
      _name: data.name,
      _filters: data.filters,
      _view: data.view,
      _sort: data.sort,
    });
  });

/** Removes a saved view from the Views menu (kept, never deleted). */
export const archiveHomeViewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { callStaged } = await import("./onboarding-home.server");
    return callStaged<{ ok: true }>(context.supabase, "archive_onboarding_home_view", { _id: data.id });
  });

/** 2.3 Columns: the person's own choice of extra columns. */
export const saveHomeColumnsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ columns: z.array(z.enum(OPTIONAL_COLUMNS.map((c) => c.key) as [string, ...string[]])).max(OPTIONAL_COLUMNS.length) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { callStaged } = await import("./onboarding-home.server");
    return callStaged<{ ok: true }>(context.supabase, "save_onboarding_home_columns", { _columns: data.columns });
  });
