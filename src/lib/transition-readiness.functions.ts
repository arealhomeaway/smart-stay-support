import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const transitionQueueFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (!staff) throw new Error("You do not have access to the transition queue.");
    const { loadTransitionQueue } = await import("./transition-readiness.server");
    return loadTransitionQueue(context.supabase);
  });
