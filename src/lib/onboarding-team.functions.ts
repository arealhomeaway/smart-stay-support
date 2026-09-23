/**
 * Onboarding team management: a departmental view over the SAME functional
 * role seats (functional_roles) used everywhere else. No new backend — seats
 * are changed through the existing coverage `setSeatHolder` server function.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assignablePeople } from "@/lib/assignable-people";

export const readOnboardingTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [roles, templates, profiles, userRoles, canEdit] = await Promise.all([
      sb.from("functional_roles").select("code, name, team, current_seat_holder, active, sort_order").order("sort_order"),
      sb.from("onboarding_templates").select("id").eq("is_default", true),
      sb.from("profiles").select("id, full_name, email").order("full_name"),
      sb.from("user_roles").select("user_id, role"),
      sb.rpc("is_supervisor", { _user_id: context.userId }),
    ]);
    if (roles.error) throw new Error(roles.error.message);

    // Roles the published default workflow actually assigns work to.
    const templateIds = (templates.data ?? []).map((t) => t.id);
    let used = new Set<string>();
    if (templateIds.length) {
      const { data } = await sb
        .from("onboarding_template_tasks")
        .select("functional_role")
        .in("template_id", templateIds)
        .eq("is_active", true);
      used = new Set(
        (data ?? []).map((r) => r.functional_role).filter((c): c is string => Boolean(c)),
      );
    }

    // Onboarding team roles, plus any other role the workflow uses except the
    // homeowner (never a staff seat) and Operations leadership seats.
    const relevant = (roles.data ?? []).filter(
      (r) =>
        r.active &&
        (r.team === "onboarding" || (used.has(r.code) && r.code !== "owner" && r.team !== "leadership")),
    );

    const roleMap = new Map<string, string[]>();
    for (const r of userRoles.data ?? []) {
      const list = roleMap.get(r.user_id) ?? [];
      list.push(r.role as string);
      roleMap.set(r.user_id, list);
    }
    const people = assignablePeople(
      (profiles.data ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] })),
    ).map(({ id, full_name, email }) => ({ id, full_name, email }));

    return {
      canEdit: canEdit.data === true,
      people,
      roles: relevant.map((r) => ({
        code: r.code,
        name: r.name,
        holder: r.current_seat_holder,
        required: used.has(r.code),
      })),
    };
  });
