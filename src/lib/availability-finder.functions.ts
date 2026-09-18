import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const searchInput = z.object({
  checkIn: z.string().max(10), checkOut: z.string().max(10), location: z.string().max(240),
});

export const searchAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchInput.parse(input))
  .handler(async ({ context, data }) => {
    const { assertFinderAccess, findAvailableProperties } = await import("./availability-finder.server");
    await assertFinderAccess(context.supabase, context.userId);
    return findAvailableProperties(context.supabase, data);
  });

export const downloadAvailabilityOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchInput.extend({ propertyIds: z.array(z.string().uuid()).min(1).max(20) }).parse(input))
  .handler(async ({ context, data }) => {
    const { assertFinderAccess, findAvailableProperties, verifySelectedPublicListings } = await import("./availability-finder.server");
    const { propertyOptionsPdf } = await import("./availability-options-pdf");
    await assertFinderAccess(context.supabase, context.userId);
    const fresh = await findAvailableProperties(context.supabase, data);
    const byId = new Map(fresh.results.map((row) => [row.id, row]));
    const selected = data.propertyIds.map((id) => byId.get(id));
    if (selected.some((row) => !row || row.status === "unavailable" || !row.bookingUrl))
      throw new Error("A selected property is no longer eligible for a client-facing package.");
    const links = await verifySelectedPublicListings(context.supabase, data.propertyIds);
    if (links.some((link) => !link.active || byId.get(link.id)?.bookingUrl !== link.url))
      throw new Error("A selected property has no active verified public listing link. Correct it in OwnerRez before export.");
    const bytes = await propertyOptionsPdf(selected as NonNullable<(typeof selected)[number]>[], data);
    return { filename: "ARHA-Property-Options.pdf", mime: "application/pdf", base64: Buffer.from(bytes).toString("base64") };
  });
