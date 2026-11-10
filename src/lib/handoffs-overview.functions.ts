import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The read only Handoffs page (register A1, A16; Emily, Nov 9). Reads with the
 * caller's own access (existing database rules) and writes nothing.
 * Operations leadership and Admin only, the same people the page rule lets in.
 */
export const readHandoffsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { formatPropertyLabel } = await import("./property-label");
    const { handoffOverviewRow, handoffsShown, readyByRole, sortHandoffs } = await import("./handoffs-overview");
    type Standard = import("./handoffs-overview").HandoffStandard;
    type Project = import("./handoffs-overview").HandoffProjectRow & { ready_for_ops_by: string | null };

    const me = await sb.from("user_roles").select("role").eq("user_id", context.userId);
    if (me.error) throw new Error("Could not verify your access level.");
    const myRoles = (me.data ?? []).map((r) => String(r.role));
    if (!myRoles.some((r) => r === "admin" || r === "manager")) throw new Error("Handoffs are for Operations leadership.");

    const projects = await sb
      .from("onboarding_projects")
      .select("id, property_id, handoff_state, status, target_handoff_on, ready_for_ops_at, ready_for_ops_by, is_demo")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    if (projects.error) throw new Error(projects.error.message);
    // One project per home: the newest, like the home's own handoff tab.
    const latest = new Map<string, Project>();
    for (const p of (projects.data ?? []) as Project[]) if (!latest.has(p.property_id)) latest.set(p.property_id, p);
    const list = [...latest.values()];
    if (!list.length) return { rows: [] };

    const homes = await sb
      .from("properties")
      .select("id, name, address_line1, unit, city, state, postal_code, lifecycle_status")
      .in("id", list.map((p) => p.property_id));
    if (homes.error) throw new Error(homes.error.message);
    const homeById = new Map((homes.data ?? []).map((h) => [h.id, h]));

    const markers = [...new Set(list.map((p) => p.ready_for_ops_by).filter((v): v is string => Boolean(v)))];
    const roleOf = new Map<string, string>();
    await Promise.all(
      markers.map(async (uid) => {
        const [held, admin] = await Promise.all([
          sb.from("functional_roles").select("code").eq("current_seat_holder", uid),
          sb.rpc("has_role", { _user_id: uid, _role: "admin" }),
        ]);
        roleOf.set(uid, readyByRole({ isAdmin: admin.data === true, roleCodes: (held.data ?? []).map((r) => r.code) }));
      }),
    );

    const rpc = sb.rpc.bind(sb) as unknown as (
      n: string,
      a: object,
    ) => Promise<{ data: Standard | null; error: { message: string } | null }>;
    const standards = await Promise.all(
      list.map(async (p) => {
        const r = await rpc("read_home_handoff_standard", { _property_id: p.property_id });
        return r.error ? null : r.data;
      }),
    );

    // Build 9 F4: the Standard plan's handoff steps, matched to each home's own Tasks by step.
    const { HANDOFF_PLAN_STAGES, handoffTaskLines } = await import("./handoffs-overview");
    const { usDate } = await import("./dates");
    const plan = await sb.from("onboarding_templates").select("id").eq("key", "arha_onboarding_standard").maybeSingle();
    const steps = plan.data
      ? await sb
          .from("onboarding_template_tasks")
          .select("id, title, stage, sort_order")
          .eq("template_id", plan.data.id)
          .eq("is_active", true)
          .in("stage", [...HANDOFF_PLAN_STAGES])
      : { data: [], error: null };
    const planSteps = steps.error ? [] : (steps.data ?? []);

    const rows = list.map((p, i) => {
      const h = homeById.get(p.property_id);
      const row = handoffOverviewRow({
        project: p,
        home: formatPropertyLabel(h ?? null),
        lifecycleStatus: h?.lifecycle_status ?? null,
        readyBy: p.ready_for_ops_by ? (roleOf.get(p.ready_for_ops_by) ?? null) : null,
        standard: standards[i] ?? null,
      });
      return {
        ...row,
        handoffTasks:
          p.handoff_state === "accepted"
            ? { tracked: true, open: [], notTracked: [] }
            : handoffTaskLines(planSteps, standards[i]?.tasks ?? [], usDate),
      };
    });
    const byId = new Map(list.map((p) => [p.id, p]));
    return { rows: sortHandoffs(handoffsShown(rows, (id) => byId.get(id))) };
  });
