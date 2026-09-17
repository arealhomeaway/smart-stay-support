import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const setOnboardingPolicyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        version: z.string().trim().min(1).max(120),
        supervisorApprovalThreshold: z.number().min(0).max(1000000),
        ownerApprovalThreshold: z.number().min(0).max(1000000),
        reason: z.string().trim().min(5).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setOnboardingPolicy } = await import("./onboarding-policy.server");
    return setOnboardingPolicy(context.supabase, context.userId, data);
  });
