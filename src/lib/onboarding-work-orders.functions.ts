import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOnboardingWorkOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { loadOnboardingWorkOrders } = await import("./onboarding-work-orders.server");
    return loadOnboardingWorkOrders(context.supabase, context.userId, data.propertyId);
  });
