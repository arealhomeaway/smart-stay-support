/**
 * Owner linking server functions. Every access decision is re-checked inside
 * owner-link.server.ts; these are thin, validated wrappers.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const searchOwnerRecordsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ query: z.string().trim().max(120).default("") }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const hub = await import("@/lib/property-hub.server");
    const m = await import("@/lib/owner-link.server");
    const viewer = await hub.loadViewer(context.supabase, context.userId);
    return { owners: await m.searchOwnerRecords(viewer, data.query) };
  });

export const linkPropertyOwnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        propertyId: z.string().uuid(),
        ownerId: z.string().uuid().nullable().default(null),
        newOwner: z
          .object({
            name: z.string().trim().min(2).max(160),
            email: z.string().trim().max(200).nullable().default(null),
            phone: z.string().trim().max(60).nullable().default(null),
            city: z.string().trim().max(120).nullable().default(null),
            state: z.string().trim().max(60).nullable().default(null),
            coOwnerName: z.string().trim().max(160).nullable().default(null),
            coOwnerEmail: z.string().trim().max(200).nullable().default(null),
            coOwnerPhone: z.string().trim().max(60).nullable().default(null),
          })
          .nullable()
          .default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const hub = await import("@/lib/property-hub.server");
    const m = await import("@/lib/owner-link.server");
    const viewer = await hub.loadViewer(context.supabase, context.userId);
    return m.linkPropertyOwner(viewer, data);
  });

/** The homeowner shown on the property and onboarding pages. */
export const readPropertyOwnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ propertyId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const hub = await import("@/lib/property-hub.server");
    const m = await import("@/lib/owner-link.server");
    const viewer = await hub.loadViewer(context.supabase, context.userId);
    return m.readPropertyOwner(viewer, data.propertyId);
  });

export const updateOwnerRecordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        ownerId: z.string().uuid(),
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().max(200).nullable().default(null),
        phone: z.string().trim().max(60).nullable().default(null),
        coOwnerName: z.string().trim().max(160).nullable().default(null),
        coOwnerEmail: z.string().trim().max(200).nullable().default(null),
        coOwnerPhone: z.string().trim().max(60).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const hub = await import("@/lib/property-hub.server");
    const m = await import("@/lib/owner-link.server");
    const viewer = await hub.loadViewer(context.supabase, context.userId);
    return m.updateOwnerRecord(viewer, data);
  });
