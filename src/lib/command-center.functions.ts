import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Executive Command Center. Platform Owners and Supervisors only. */
export const getCommandCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        days: z.number().int().min(7).max(365).default(30),
        market: z.string().max(40).nullable().default(null),
        propertyId: z.string().uuid().nullable().default(null),
        priority: z.enum(["p1", "p2", "p3"]).nullable().default(null),
        team: z.string().max(60).nullable().default(null),
        vendorId: z.string().uuid().nullable().default(null),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { data: allowed, error } = await context.supabase.rpc("is_supervisor", {
      _user_id: context.userId,
    });
    if (error || !allowed) throw new Error("The command center is limited to leadership.");
    const { loadCommandCenter } = await import("./command-center.server");
    return loadCommandCenter(context.supabase, data);
  });
