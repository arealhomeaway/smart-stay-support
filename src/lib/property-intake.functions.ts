import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** OwnerRez listings annotated with what Resolve already has. Read-only. */
export const searchOwnerRezPropertiesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().max(120).default("") }).parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { assertPropertyStaff, searchOwnerRezCandidates } = await import("./property-intake.server");
    await assertPropertyStaff(context.supabase, context.userId);
    return searchOwnerRezCandidates(context.supabase, data.query);
  });

/** Creates one canonical property from a listing (or links it). Never starts onboarding. */
export const importOwnerRezPropertyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        listingId: z.string().trim().min(1).max(60),
        linkToPropertyId: z.string().uuid().nullable().default(null),
        isDemo: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertPropertyStaff, importOwnerRezProperty } = await import("./property-intake.server");
    await assertPropertyStaff(context.supabase, context.userId);
    return importOwnerRezProperty(context.supabase, context.userId, data);
  });

/** Minimum-information manual creation of the canonical property. */
export const createPropertyManuallyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(160),
        addressLine1: z.string().trim().min(3).max(200),
        unit: z.string().trim().max(40).nullable().default(null),
        city: z.string().trim().min(2).max(80),
        state: z.string().trim().min(2).max(40),
        postalCode: z.string().trim().min(3).max(12),
        market: z.string().trim().max(80).nullable().default(null),
        ownerRecordId: z.string().uuid().nullable().default(null),
        ownerName: z.string().trim().max(160).nullable().default(null),
        ownerEmail: z.string().trim().max(200).nullable().default(null),
        ownerRezPropertyId: z.string().trim().max(60).nullable().default(null),
        isDemo: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertPropertyStaff, createPropertyManually } = await import("./property-intake.server");
    await assertPropertyStaff(context.supabase, context.userId);
    return createPropertyManually(context.supabase, context.userId, data);
  });

/** Reconcile an OwnerRez ID onto an existing property instead of duplicating it. */
export const linkOwnerRezToPropertyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ propertyId: z.string().uuid(), listingId: z.string().trim().min(1).max(60) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { assertPropertyStaff, linkOwnerRezToProperty } = await import("./property-intake.server");
    await assertPropertyStaff(context.supabase, context.userId);
    return linkOwnerRezToProperty(context.supabase, data);
  });
