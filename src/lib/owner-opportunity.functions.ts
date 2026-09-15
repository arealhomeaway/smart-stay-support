import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUPPORTED_OWNER_ACTION_TYPES } from "./owner-opportunity";

const source = z.enum(["onboarding", "operations"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

/** Can this Onboarding task / Ticket be offered to a homeowner, and was it already? */
export const ownerOpportunityContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ source, sourceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { opportunityContext } = await import("./owner-opportunity.server");
    return opportunityContext(context.supabase, data.source, data.sourceId);
  });

export const offerOwnerOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        source,
        sourceId: z.string().uuid(),
        title: z.string().trim().min(3).max(200),
        instructions: z.string().trim().min(3).max(2000),
        actionType: z.enum(SUPPORTED_OWNER_ACTION_TYPES),
        availableFrom: isoDate.nullable().default(null),
        respondBy: isoDate.nullable().default(null),
        staffContext: z.string().trim().max(1000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { offerToOwner } = await import("./owner-opportunity.server");
    return offerToOwner(context.supabase, context.userId, {
      ...data,
      availableFrom: data.availableFrom ? `${data.availableFrom}T00:00:00Z` : null,
    });
  });

export const closeOwnerOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ opportunityId: z.string().uuid(), reason: z.string().trim().max(500).default("") })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { closeOpportunity } = await import("./owner-opportunity.server");
    return closeOpportunity(context.supabase, context.userId, data);
  });
