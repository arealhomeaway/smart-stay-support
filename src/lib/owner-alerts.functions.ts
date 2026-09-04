import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Urgent homeowner contacts waiting on a teammate to text or call. */
export const ownerContactAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadContactAlerts } = await import("./owner-alerts.server");
    return loadContactAlerts(context.supabase, context.userId);
  });

export const resolveOwnerContactAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().trim().max(500).default("") }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { markContactAlertHandled } = await import("./owner-alerts.server");
    return markContactAlertHandled(context.supabase, context.userId, data);
  });
