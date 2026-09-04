import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Supervisor-only: participation metrics across every live owner program. */
export const ownerAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ demo: z.boolean().optional() }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { assertSupervisor } = await import("./owner-program.server");
    const { loadOwnerAnalytics } = await import("./owner-analytics.server");
    await assertSupervisor(context.supabase, context.userId);
    return loadOwnerAnalytics(context.supabase, { demo: data.demo ?? false });
  });
