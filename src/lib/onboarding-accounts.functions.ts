/**
 * Onboarding Director account management, limited to Onboarding staff and
 * homeowner accounts. Creates accounts directly (no invite code) with the existing sign-in; never
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

/**
 * Directly create an Onboarding staff or homeowner sign-in account (no invite
 * code). Refuses any email that already has an account, so nobody is ever
 * duplicated. The account starts with an unknown random password; the person
 * signs in by setting their own password (optional setup email, or "Forgot
 * password" on the sign-in page). Homeowners are then linked on the Active
 * Owner program with "Link homeowner account".
 */
export const createOnboardingAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      role: z.enum(DIRECTOR_CREATABLE_ROLES),
      email: z.string().trim().toLowerCase().email().max(255),
      name: z.string().trim().min(2).max(120),
      sendSetupEmail: z.boolean().default(false),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertDirectorOrAdmin(context as unknown as Ctx);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { applyRole } = await import("./access.server");
    const { writeAudit } = await import("./audit.server");
    const existing = await db.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    if (existing.data) throw new Error("An account with this email already exists. Select it instead of creating another.");
    const { data: created, error } = await db.auth.admin.createUser({
      email: data.email,
      password: crypto.randomUUID() + crypto.randomUUID(),
      email_confirm: true,
      user_metadata: { full_name: data.name },
    });
    if (error || !created.user) {
      if (/already|registered|exists/i.test(error?.message ?? ""))
        throw new Error("An account with this email already exists. Select it instead of creating another.");
      throw new Error("Could not create the account. Please try again.");
    }
    await applyRole(created.user.id, data.role);
    // Reserved test domains never receive mail.
    const testAddress = /@(resolve-test\.invalid|[^@]+\.(invalid|test|example))$/i.test(data.email);
    let setupEmail: "sent" | "not_requested" | "skipped_test_address" | "failed" = "not_requested";
    if (data.sendSetupEmail && testAddress) setupEmail = "skipped_test_address";
    else if (data.sendSetupEmail) {
      const { getRequest } = await import("@tanstack/react-start/server");
      const req = getRequest();
      const origin = req?.headers.get("origin") || (req ? new URL(req.url).origin : "");
      const { createClient } = await import("@supabase/supabase-js");
      const pub = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const r = await pub.auth.resetPasswordForEmail(data.email, { redirectTo: `${origin}/reset-password` });
      setupEmail = r.error ? "failed" : "sent";
    }
    await writeAudit({
      actorId: context.userId, actorLabel: null, action: "user.created_by_onboarding_director",
      entityType: "user", entityId: created.user.id, entityLabel: data.email,
      after: { role: data.role, method: "direct_staff_creation", setup_email: setupEmail },
    });
    return { ok: true as const, userId: created.user.id, setupEmail };
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
