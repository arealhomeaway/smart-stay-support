/**
 * Onboarding team management: a departmental view over the SAME functional
 * role architecture used everywhere else.
 *  - Onboarding Director: the single `functional_roles` seat.
 *  - Project Managers / Utilities / Design & Staging: pools
 *    (`functional_role_members`). The seat holder stays the default router and
 *    follows the pool (first member) automatically.
 *  - Each property's Primary Project Manager lives on `onboarding_projects`,
 *    and PM Tasks route to that person, never to one global PM.
 * Property Coordinator is owned by Operations and is never shown here.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assignablePeople } from "@/lib/assignable-people";

const POOL_ROLES = ["onboarding_project_manager", "utilities", "design_staging"] as const;
const OPERATIONS_OWNED = new Set(["property_coordinator", "owner"]);

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

async function canManageTeam({ supabase, userId }: Ctx) {
  const [sup, dir] = await Promise.all([
    supabase.rpc("is_supervisor", { _user_id: userId }),
    supabase.rpc("is_onboarding_director", { _user_id: userId }),
  ]);
  return sup.data === true || dir.data === true;
}

async function assertCanManage(ctx: Ctx) {
  if (!(await canManageTeam(ctx)))
    throw new Error("Only the Onboarding Director or leadership can change the Onboarding team.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Keep the role's default seat pointed at a current pool member. */
async function syncSeatToPool(roleCode: string) {
  const db = await admin();
  const [{ data: role }, { data: members }] = await Promise.all([
    db.from("functional_roles").select("current_seat_holder").eq("code", roleCode).maybeSingle(),
    db
      .from("functional_role_members")
      .select("user_id, profiles:user_id(full_name, email)")
      .eq("role_code", roleCode)
      .order("created_at"),
  ]);
  const list = (members ?? []) as unknown as {
    user_id: string;
    profiles: { full_name: string | null; email: string | null } | null;
  }[];
  const holder = role?.current_seat_holder ?? null;
  if (holder && list.some((m) => m.user_id === holder)) return;
  const next = list[0] ?? null;
  await db
    .from("functional_roles")
    .update({
      current_seat_holder: next?.user_id ?? null,
      current_seat_name: next ? (next.profiles?.full_name ?? next.profiles?.email ?? null) : null,
    })
    .eq("code", roleCode);
}

export const readOnboardingTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [roles, members, templates, profiles, userRoles, projects, properties, canEdit] =
      await Promise.all([
        sb.from("functional_roles").select("code, name, team, current_seat_holder, active, sort_order").order("sort_order"),
        sb.from("functional_role_members").select("role_code, user_id"),
        sb.from("onboarding_templates").select("id").eq("is_default", true),
        sb.from("profiles").select("id, full_name, email").order("full_name"),
        sb.from("user_roles").select("user_id, role"),
        sb
          .from("onboarding_projects")
          .select("id, property_id, project_manager, status, is_demo")
          .in("status", ["planning", "active", "handoff"]),
        sb.from("properties").select("id, name"),
        canManageTeam(context as unknown as Ctx),
      ]);
    if (roles.error) throw new Error(roles.error.message);

    const templateIds = (templates.data ?? []).map((t) => t.id);
    let used = new Set<string>();
    if (templateIds.length) {
      const { data } = await sb
        .from("onboarding_template_tasks")
        .select("functional_role")
        .in("template_id", templateIds)
        .eq("is_active", true);
      used = new Set((data ?? []).map((r) => r.functional_role).filter((c): c is string => Boolean(c)));
    }

    const roleMap = new Map<string, string[]>();
    for (const r of userRoles.data ?? []) {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role as string]);
    }
    const people = assignablePeople(
      (profiles.data ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] })),
    ).map(({ id, full_name, email }) => ({ id, full_name, email }));

    const all = roles.data ?? [];
    const director = all.find((r) => r.code === "onboarding_director");
    // Pools: the three core ones, plus any other Onboarding-team role the
    // workflow uses. Operations-owned roles never appear.
    const poolCodes = all
      .filter(
        (r) =>
          r.active &&
          !OPERATIONS_OWNED.has(r.code) &&
          r.code !== "onboarding_director" &&
          ((POOL_ROLES as readonly string[]).includes(r.code) ||
            (r.team === "onboarding" && used.has(r.code))),
      )
      .map((r) => r.code);

    const pools = poolCodes.map((code) => {
      const r = all.find((x) => x.code === code)!;
      return {
        code,
        name: code === "onboarding_project_manager" ? "Project Managers" : r.name,
        members: (members.data ?? []).filter((m) => m.role_code === code).map((m) => m.user_id),
        required: used.has(code),
      };
    });

    const propName = new Map((properties.data ?? []).map((p) => [p.id, p.name as string]));
    return {
      canEdit,
      people,
      director: {
        holder: director?.current_seat_holder ?? null,
        required: true,
      },
      pools,
      projects: (projects.data ?? [])
        .filter((p) => !p.is_demo)
        .map((p) => ({
          id: p.id,
          propertyName: propName.get(p.property_id) ?? "Home",
          projectManager: p.project_manager,
        }))
        .sort((a, b) => a.propertyName.localeCompare(b.propertyName)),
    };
  });

export const addRolePoolMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ roleCode: z.string().min(2).max(60), userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context as unknown as Ctx);
    if (OPERATIONS_OWNED.has(data.roleCode) || data.roleCode === "onboarding_director")
      throw new Error("That role is not managed from the Onboarding team.");
    const db = await admin();
    const { error } = await db
      .from("functional_role_members")
      .upsert(
        { role_code: data.roleCode, user_id: data.userId, added_by: context.userId },
        { onConflict: "role_code,user_id" },
      );
    if (error) throw new Error(error.message);
    await syncSeatToPool(data.roleCode);
    return { ok: true as const };
  });

export const removeRolePoolMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ roleCode: z.string().min(2).max(60), userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context as unknown as Ctx);
    const db = await admin();
    const { error } = await db
      .from("functional_role_members")
      .delete()
      .eq("role_code", data.roleCode)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await syncSeatToPool(data.roleCode);
    return { ok: true as const };
  });

/** Set the Onboarding Director seat (single person). */
export const setOnboardingDirector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context as unknown as Ctx);
    const db = await admin();
    let name: string | null = null;
    if (data.userId) {
      const { data: p } = await db.from("profiles").select("full_name, email").eq("id", data.userId).maybeSingle();
      if (!p) throw new Error("That person does not have a Resolve account yet.");
      name = p.full_name ?? p.email;
    }
    const { error } = await db
      .from("functional_roles")
      .update({ current_seat_holder: data.userId, current_seat_name: name })
      .eq("code", "onboarding_director");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Change a property's Primary Project Manager. Optionally moves that home's
 * pending Project Manager Tasks to the new PM.
 */
export const setProjectPrimaryPM = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        userId: z.string().uuid().nullable(),
        reassignPending: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanManage(context as unknown as Ctx);
    const db = await admin();
    const { data: project } = await db
      .from("onboarding_projects")
      .select("id, property_id, project_manager")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("That onboarding project was not found.");
    const { error } = await db
      .from("onboarding_projects")
      .update({ project_manager: data.userId })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);

    let moved = 0;
    if (data.reassignPending) {
      const { data: rows, error: e2 } = await db
        .from("onboarding_tasks")
        .update({ assigned_to: data.userId })
        .eq("property_id", project.property_id)
        .eq("assigned_seat", "onboarding_project_manager")
        .in("status", ["open", "in_progress", "blocked"])
        .select("id");
      if (e2) throw new Error(e2.message);
      moved = rows?.length ?? 0;
    }
    await db.from("audit_log").insert({
      actor_id: context.userId,
      action: "onboarding.primary_pm_changed",
      entity_type: "onboarding_project",
      entity_id: data.projectId,
      before: { project_manager: project.project_manager },
      after: { project_manager: data.userId, reassigned_tasks: moved },
    } as never);
    return { ok: true as const, moved };
  });

/** The Director (or leadership) takes any Onboarding Task directly. */
export const takeOnboardingTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: task } = await db
      .from("onboarding_tasks")
      .select("property_id")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) throw new Error("That Task was not found.");
    const { onboardingTaskAccess } = await import("./onboarding-task-access.server");
    const access = await onboardingTaskAccess(context.supabase, context.userId, task.property_id, null);
    if (!access.canManage) throw new Error("Only the Director or this home's lead can take this Task.");
    const { error } = await db
      .from("onboarding_tasks")
      .update({ assigned_to: context.userId })
      .eq("id", data.taskId)
      .neq("status", "complete");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
