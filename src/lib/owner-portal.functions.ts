import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

/** The signed-in homeowner's whole hub: program, matters, reviews, alerts. */
export const ownerHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOwnerHome } = await import("./owner-portal.server");
    return loadOwnerHome(context.supabase, context.userId);
  });

/** Read-only sample program so a Platform Owner can preview the homeowner hub. */
export const ownerHomePreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadOwnerHomePreview } = await import("./owner-portal.server");
    return loadOwnerHomePreview(context.supabase, context.userId);
  });




export const markOwnerAlertsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { markAlertsRead } = await import("./owner-portal.server");
    return markAlertsRead(context.supabase, data.ids);
  });

export const saveOwnerAlertPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.boolean(),
        smsP1: z.boolean(),
        push: z.boolean(),
        phone: z.string().trim().max(32).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { saveAlertPreferences } = await import("./owner-portal.server");
    return saveAlertPreferences(context.supabase, context.userId, data);
  });

export const logOwnerParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid(),
        phase: z.enum(["onboarding", "ongoing"]),
        entryDate: isoDate,
        // Always typed in by the homeowner — never prefilled or suggested.
        minutes: z.number().int().min(1).max(1440),
        activity: z.string().trim().min(3).max(500),
        activityCategory: z.string().trim().max(80).default(""),
        output: z.string().trim().max(1000).default(""),
        comments: z.string().trim().max(1000).default(""),
        attachmentPath: z.string().trim().max(400).nullable().default(null),
        reviewId: z.string().uuid().nullable().default(null),
        ticketId: z.string().uuid().nullable().default(null),
        propertyIds: z.array(z.string().uuid()).max(25).default([]),
        confirmed: z.literal(true, {
          message: "Please confirm the entry reflects the time you personally spent.",
        }),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { logOwnerTime } = await import("./owner-portal.server");
    return logOwnerTime(context.supabase, context.userId, data);
  });

export const answerOwnerReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        reviewId: z.string().uuid(),
        decision: z.string().trim().min(1).max(60),
        response: z.string().trim().max(2000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { respondToReview } = await import("./owner-portal.server");
    return respondToReview(context.supabase, context.userId, data);
  });


/** Links a brand-new account to the program its invite code belongs to. */
export const redeemInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ code: z.string().trim().min(4).max(20) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { redeemOwnerInvite } = await import("./owner-portal.server");
    const email = (context.claims as { email?: string } | null)?.email ?? null;
    return redeemOwnerInvite(supabaseAdmin, context.userId, email, data.code);
  });
