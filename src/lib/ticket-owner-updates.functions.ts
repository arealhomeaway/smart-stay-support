import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reviewedTicketRequestTypeSchema } from "./owner-ticket-intent";

export const ticketOwnerUpdates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ ticketId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { loadTicketOwnerUpdates } = await import("./ticket-owner-updates.server");
    return loadTicketOwnerUpdates(context.supabase, context.userId, data.ticketId);
  });

export const saveTicketOwnerUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        expectedTicketUpdatedAt: z.string().datetime({ offset: true }),
        expectedRevision: z.number().int().min(0),
        expectedOwnerId: z.string().uuid(),
        issue: z.string().trim().min(10).max(2000),
        workPerformed: z.string().trim().min(10).max(3000),
        outcome: z.string().trim().max(2000),
        ownerRequestType: reviewedTicketRequestTypeSchema,
        ownerRequestWhy: z.string().trim().min(10).max(1000),
        reviewed: z.literal(true),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.rpc("save_ticket_owner_update", {
      _ticket_id: data.ticketId,
      _actor_id: context.userId,
      _expected_ticket_updated_at: data.expectedTicketUpdatedAt,
      _expected_revision: data.expectedRevision,
      _expected_owner_id: data.expectedOwnerId,
      _issue: data.issue,
      _work_performed: data.workPerformed,
      _outcome: data.outcome,
      _reviewed: data.reviewed,
      _owner_request_type: data.ownerRequestType,
      _owner_request_why: data.ownerRequestWhy,
    });
    if (result.error) throw result.error;
    return { id: result.data };
  });
