import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Supervisor-only: ticket volume, SLA, timing medians and contributor credit. */
export const opsAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        windowDays: z.number().int().min(1).max(365).optional(),
        demo: z.boolean().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { assertSupervisor } = await import("./vendors.server");
    const { loadOpsAnalytics } = await import("./ops-analytics.server");
    await assertSupervisor(context.supabase, context.userId);
    return loadOpsAnalytics(context.supabase, {
      windowDays: data.windowDays ?? 30,
      demo: data.demo ?? false,
    });
  });
