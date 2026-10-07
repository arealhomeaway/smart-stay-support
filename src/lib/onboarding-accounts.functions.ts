/**
 * Onboarding Director account management, limited to Onboarding staff and
 * homeowner accounts. Reuses the existing invite and sign-in mechanisms; never
 * grants admin, manager, Operations, Finance or seat access. Every change is
 * audited under the real staff actor.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { accountScope, DIRECTOR_CREATABLE_ROLES } from "@/lib/onboarding-account-scope";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

async function assertDirectorOrAdmin({ supabase, userId }: Ctx) {
  const [dir, adm] = await Promise.all([
    supabase.rpc("is_onboarding_director", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  if (dir.error || adm.error) throw new Error("Could not verify your access level.");
  if (dir.data !== true && adm.data !== true)
    throw new Error("Only the Onboarding Director can manage Onboarding and homeowner accounts.");
}

async function loadScoped() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { loadTeamAccessDetailed } = await import("./access.server");
  const [people, pools, seats, tasks, projects] = await Promise.all([
    loadTeamAccessDetailed(),
    db.from("functional_role_members").select("user_id, role_code"),
    db.from("functional_roles").select("code, current_seat_holder").not("current_seat_holder", "is", null),
    db.from("onboarding_tasks").select("assigned_to").in("status", ["open", "in_progress", "blocked"]).is("archived_at", null).not("assigned_to", "is", null),
    db.from("onboarding_projects").select("project_manager, utility_manager, role_assignments, status").neq("status", "cancelled"),
  ]);
  const openTasks = new Map<string, number>();
  for (const t of tasks.data ?? []) openTasks.set(t.assigned_to as string, (openTasks.get(t.assigned_to as string) ?? 0) + 1);
  const projectSeats = new Map<string, number>();
  const bump = (id: unknown) => { if (typeof id === "string") projectSeats.set(id, (projectSeats.get(id) ?? 0) + 1); };
  for (const p of projects.data ?? []) {
    if ((p as { status?: string }).status === "complete") continue;
    bump(p.project_manager); bump(p.utility_manager);
    for (const v of Object.values((p.role_assignments ?? {}) as Record<string, unknown>)) bump(v);
  }
  return people
    .filter((p) => p.roles.includes("onboarding") || p.roles.includes("owner"))
    .map((p) => {
      const scope = accountScope({
        roles: p.roles,
        poolCodes: (pools.data ?? []).filter((m) => m.user_id === p.id).map((m) => m.role_code as string),
        seatCodes: (seats.data ?? []).filter((s) => s.current_seat_holder === p.id).map((s) => s.code as string),
      });
      return {
        id: p.id, name: p.full_name, email: p.email, roles: p.roles, state: p.state,
        inScope: scope.inScope, outOfScopeReason: scope.reason,
        openTasks: openTasks.get(p.id) ?? 0, projectAssignments: projectSeats.get(p.id) ?? 0,
      };
    });
}

export const listOnboardingAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertDirectorOrAdmin(context as unknown as Ctx);
    return { people: await loadScoped() };
  });

/** Issue an existing-style invite limited to Onboarding or homeowner access. */
export const createOnboardingAccountInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      role: z.enum(DIRECTOR_CREATABLE_ROLES),
      email: z.string().trim().toLowerCase().email().max(255),
      name: z.string().trim().min(2).max(120),
      sendEmail: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertDirectorOrAdmin(context as unknown as Ctx);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { sendInviteEmail } = await import("./team-invites.server");
    const { writeAudit } = await import("./audit.server");
    const existing = await db.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (existing.data) throw new Error("An account with this email already exists. Use it instead of creating another.");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const part = () => Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    const expires = new Date(Date.now() + 30 * 864e5).toISOString();
    for (let i = 0; i < 5; i++) {
      const code = `${part()}-${part()}`;
      const ins = await db.from("team_invites").insert({
        code, role: data.role, invitee_email: data.email, invitee_name: data.name,
        note: "Issued by the Onboarding Director", expires_at: expires, created_by: context.userId,
      }).select("id, code, expires_at").maybeSingle();
      if (ins.error && ins.error.code === "23505") continue;
      if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "Could not create the invitation.");
      const emailed = data.sendEmail
        ? await sendInviteEmail({ email: data.email, name: data.name, role: data.role, code: ins.data.code, note: "", expiresAt: ins.data.expires_at })
        : false;
      await writeAudit({
        actorId: context.userId, actorLabel: null, action: "user.invite_issued_by_onboarding_director",
        entityType: "team_invite", entityId: ins.data.id, entityLabel: data.email,
        after: { role: data.role, emailed: Boolean(emailed) },
      });
      return { ok: true as const, code: ins.data.code, emailed: Boolean(emailed) };
    }
    throw new Error("Could not generate an invitation. Please try again.");
  });

/** Turn sign-in off or on for an in-scope account. Never deletes the person or their work. */
export const setOnboardingAccountActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean(), reason: z.string().trim().min(3).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertDirectorOrAdmin(context as unknown as Ctx);
    if (data.userId === context.userId) throw new Error("You cannot change your own access.");
    const person = (await loadScoped()).find((p) => p.id === data.userId);
    if (!person) throw new Error("That account is not an Onboarding or homeowner account.");
    if (!person.inScope) throw new Error(person.outOfScopeReason ?? "An administrator manages this account.");
    const { setTeammateActive } = await import("./access.server");
    const { writeAudit } = await import("./audit.server");
    await setTeammateActive(data.userId, data.active);
    await writeAudit({
      actorId: context.userId, actorLabel: null, action: data.active ? "user.reactivated" : "user.disabled",
      entityType: "user", entityId: data.userId, entityLabel: person.email, reason: data.reason,
      before: { active: person.state !== "disabled" },
      after: { active: data.active, open_tasks: person.openTasks, project_assignments: person.projectAssignments },
    });
    return { ok: true as const, openTasks: person.openTasks, projectAssignments: person.projectAssignments };
  });
