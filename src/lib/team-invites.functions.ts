import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleSchema = z.enum(["admin", "manager", "onboarding", "tech", "vendor", "owner"]);

/** Admin: every invite code issued for staff and vendors. */
export const listTeamInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./access.server");
    const { loadTeamInvites } = await import("./team-invites.server");
    await assertAdmin(context.supabase, context.userId);
    return { invites: await loadTeamInvites(context.supabase) };
  });

/** Admin: issue a single-use code that grants one role when redeemed. */
export const createTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        role: roleSchema,
        email: z.string().trim().email().max(255).or(z.literal("")).default(""),
        name: z.string().trim().max(120).default(""),
        note: z.string().trim().max(500).default(""),
        expiresInDays: z.number().int().min(1).max(90).default(30),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { createTeamInvite: create } = await import("./team-invites.server");
    return create(context.supabase, context.userId, data);
  });

export const revokeTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ inviteId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { revokeTeamInvite: revoke } = await import("./team-invites.server");
    return revoke(context.supabase, context.userId, data.inviteId);
  });

/** Any signed-in account: redeem a staff or vendor invite code. */
export const redeemTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(4).max(20) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { redeemTeamInvite: redeem } = await import("./team-invites.server");
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    return redeem(context.userId, email, data.code);
  });

/** Admin: email an existing invite code again to the address it was issued to. */
export const emailTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ inviteId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { resendTeamInvite } = await import("./team-invites.server");
    return resendTeamInvite(context.supabase, context.userId, data.inviteId);
  });
