/**
 * Co-owner logins for an Active Owner program (staff side) and portal attribution.
 * Authority (Onboarding Director or Admin) is decided again inside every database function.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isActiveOwnerAuthority } from "./owner-welcome.functions";
import { CO_OWNERS_NOT_READY, isMissingFunction } from "./co-owners.server";
import type { AttributionRow } from "./co-owner-attribution";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };
const programInput = z.object({ programId: z.string().uuid() });

export type ProgramHomeowner = { userId: string; role: "primary" | "co_owner"; name: string | null; email: string | null };

export const listProgramHomeowners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => programInput.parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    const r = await ctx.supabase.rpc("read_program_homeowners" as never, { _program_id: data.programId } as never);
    if (isMissingFunction(r.error)) return { ready: false as const, homeowners: [] as ProgramHomeowner[] };
    if (r.error) throw new Error(r.error.message);
    const rows = (r.data ?? []) as unknown as { user_id: string; role: string; full_name: string | null; email: string | null }[];
    return {
      ready: true as const,
      homeowners: rows.map((x) => ({ userId: x.user_id, role: x.role === "primary" ? "primary" : "co_owner", name: x.full_name, email: x.email }) as ProgramHomeowner),
    };
  });

export const addProgramCoOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ programId: z.string().uuid(), name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(255) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    // Refuse before any login work, so an unauthorized caller creates nothing.
    if (!(await isActiveOwnerAuthority(ctx)))
      throw new Error("Only the Onboarding Director or an Admin can add a co-owner.");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { addCoOwner } = await import("./co-owners.server");
    return addCoOwner(db, ctx.supabase, data);
  });

export const removeProgramCoOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ programId: z.string().uuid(), userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    const r = await ctx.supabase.rpc("remove_program_co_owner" as never, { _program_id: data.programId, _user_id: data.userId } as never);
    if (isMissingFunction(r.error)) throw new Error(CO_OWNERS_NOT_READY);
    if (r.error) throw new Error(r.error.message);
    return { removed: true };
  });

/** Portal: who logged each hour entry and who answered. Empty until 05 is applied. */
export const programAttribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => programInput.parse(d))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    const r = await ctx.supabase.rpc("read_program_attribution" as never, { _program_id: data.programId } as never);
    if (r.error) return { rows: [] as AttributionRow[] };
    return { rows: (r.data ?? []) as unknown as AttributionRow[] };
  });
