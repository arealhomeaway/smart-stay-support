import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applyRole,
  assertAdmin,
  assertNotSelfDemotion,
  loadTeamAccess,
  resetTeammatePassword,
} from "./access.server";

export const listTeamAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return { people: await loadTeamAccess() };
  });

export const setTeamRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "manager", "onboarding", "tech", "vendor", "owner"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    await assertNotSelfDemotion(context.userId, data.userId, data.role);
    return applyRole(data.userId, data.role);
  });

export const setTeamPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    return resetTeammatePassword(data.userId);
  });

const ROLE_ENUM = z.enum(["admin", "manager", "onboarding", "tech", "vendor", "owner"]);
const PRIVILEGED = new Set(["admin", "manager"]);

async function actorLabel(supabase: { from: (t: "profiles") => any }, userId: string) {
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
  return (data?.full_name || data?.email || null) as string | null;
}

export const listTeamAccessDetailed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { loadTeamAccessDetailed } = await import("./access.server");
    return { people: await loadTeamAccessDetailed() };
  });

/** Admin-only edit of an EXISTING person. Never creates accounts or invites. */
export const updateTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        firstName: z.string().max(80),
        lastName: z.string().max(80),
        displayName: z.string().trim().min(2).max(120),
        role: ROLE_ENUM,
        active: z.boolean(),
        confirmPrivilege: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { writeAudit } = await import("./audit.server");
    const { loadTeamAccessDetailed, updateTeammateProfile, setTeammateActive } = await import(
      "./access.server"
    );
    const person = (await loadTeamAccessDetailed()).find((p) => p.id === data.userId);
    if (!person) throw new Error("That person could not be found.");
    const label = await actorLabel(context.supabase, context.userId);
    const entity = { entityType: "user", entityId: data.userId, entityLabel: person.email };
    const changes: string[] = [];

    // Role — uses the existing permission model; broadening needs explicit confirmation.
    const { primaryRole } = await import("./permissions");
    const currentRole = primaryRole(person.roles as never);
    if (data.role !== currentRole) {
      if (PRIVILEGED.has(data.role) && !data.confirmPrivilege) {
        throw new Error(`Granting ${data.role} access needs explicit confirmation.`);
      }
      await assertNotSelfDemotion(context.userId, data.userId, data.role);
      await applyRole(data.userId, data.role);
      await writeAudit({ actorId: context.userId, actorLabel: label, action: "user.role_changed", ...entity, before: { role: currentRole, roles: person.roles }, after: { role: data.role } });
      changes.push("role");
    }

    const fields = { first_name: data.firstName.trim() || null, last_name: data.lastName.trim() || null, full_name: data.displayName.trim() };
    const prev = { first_name: person.first_name, last_name: person.last_name, full_name: person.full_name };
    const changedFields = (Object.keys(fields) as (keyof typeof fields)[]).filter((k) => (fields[k] ?? null) !== (prev[k] ?? null));
    if (changedFields.length) {
      await updateTeammateProfile(data.userId, { firstName: data.firstName, lastName: data.lastName, displayName: data.displayName });
      await writeAudit({
        actorId: context.userId, actorLabel: label, action: "user.profile_updated", ...entity,
        before: Object.fromEntries(changedFields.map((k) => [k, prev[k]])),
        after: Object.fromEntries(changedFields.map((k) => [k, fields[k]])),
      });
      changes.push("profile");
    }

    const wasActive = person.state !== "disabled";
    if (data.active !== wasActive) {
      if (!data.active && data.userId === context.userId) throw new Error("You cannot disable your own access.");
      await setTeammateActive(data.userId, data.active);
      await writeAudit({ actorId: context.userId, actorLabel: label, action: data.active ? "user.reactivated" : "user.disabled", ...entity, before: { active: wasActive }, after: { active: data.active } });
      changes.push("status");
    }
    return { ok: true as const, changes };
  });
