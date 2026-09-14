import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOnboardingDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const [approvals, accounting] = await Promise.all([
      context.supabase
        .from("approvals")
        .select("id,title,onboarding_delivery_attempt")
        .eq("property_id", data.propertyId)
        .not("onboarding_delivery_attempt", "is", null)
        .is("owner_email_sent_at", null),
      context.supabase
        .from("financial_requests")
        .select("id,title,onboarding_delivery_attempt")
        .eq("property_id", data.propertyId)
        .not("onboarding_delivery_attempt", "is", null)
        .is("accounting_sent_at", null),
    ]);
    if (approvals.error) throw approvals.error;
    if (accounting.error) throw accounting.error;
    return [
      ...approvals.data.map((row) => ({ ...row, kind: "approval" as const })),
      ...accounting.data.map((row) => ({ ...row, kind: "accounting" as const })),
    ];
  });

export const reconcileOnboardingDeliveryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        kind: z.enum(["approval", "accounting"]),
        recordId: z.string().uuid(),
        attemptId: z.string().uuid(),
        delivered: z.boolean(),
        note: z.string().trim().min(10).max(2000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const result = await context.supabase.rpc("reconcile_onboarding_delivery", {
      _kind: data.kind,
      _record_id: data.recordId,
      _attempt_id: data.attemptId,
      _delivered: data.delivered,
      _note: data.note,
    });
    if (result.error) throw result.error;
    return { ok: true };
  });
