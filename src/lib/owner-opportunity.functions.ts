import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OWNER_ACTION_TYPES } from "./owner-opportunity";

const source = z.enum(["onboarding", "operations"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

/** Can this Onboarding task / Ticket be offered to a homeowner, and was it already? */
export const ownerOpportunityContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ source, sourceId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { opportunityContext } = await import("./owner-opportunity.server");
    return opportunityContext(context.supabase, context.userId, data.source, data.sourceId);
  });

export const offerOwnerOpportunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        source,
        sourceId: z.string().uuid(),
        programId: z.string().uuid(),
        expectedVersion: z.string().uuid(),
        expectedOwnerId: z.string().uuid(),
        expectedSourceUpdatedAt: z.string().datetime({ offset: true }),
        reviewed: z.literal(true),
        title: z.string().trim().min(3).max(200),
        instructions: z.string().trim().min(3).max(2000),
        actionType: z.enum(OWNER_ACTION_TYPES),
        availableFrom: isoDate.nullable().default(null),
        respondBy: isoDate.nullable().default(null),
        staffContext: z.string().trim().max(1000).default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { vagueOpportunityReason } = await import("./owner-opportunity");
    const vague = vagueOpportunityReason(data.title, data.instructions);
    if (vague) throw new Error(vague);
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
      .object({
        opportunityId: z.string().uuid(),
        expectedUpdatedAt: z.string().datetime({ offset: true }),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { closeOpportunity } = await import("./owner-opportunity.server");
    return closeOpportunity(context.supabase, context.userId, data);
  });
