import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOnboardingBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { loadBudget } = await import("./onboarding-budget.server");
    return loadBudget(context.supabase, context.userId, data.propertyId);
  });

export const setApprovedBudgetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        amount: z.number().min(0).max(10_000_000).nullable(),
        basis: z.string().trim().max(200).nullable().default(null),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { setApprovedBudget } = await import("./onboarding-budget.server");
    return setApprovedBudget(context.supabase, context.userId, data);
  });

export const saveBudgetLineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        lineId: z.string().uuid().nullable().default(null),
        category: z.enum(["staging", "furniture", "contractor", "supplies", "other"]),
        label: z.string().trim().min(2).max(160),
        vendor: z.string().trim().max(120).nullable().default(null),
        estimatedAmount: z.number().min(0).max(10_000_000),
        committedAmount: z.number().min(0).max(10_000_000).nullable().default(null),
        actualAmount: z.number().min(0).max(10_000_000).nullable().default(null),
        status: z.enum(["planned", "committed", "invoiced", "paid", "cancelled"]),
        note: z.string().trim().max(1000).nullable().default(null),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveBudgetLine } = await import("./onboarding-budget.server");
    return saveBudgetLine(context.supabase, context.userId, data);
  });
