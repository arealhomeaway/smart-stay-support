import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ownerApprovalPublicationContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ approvalId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { loadOwnerApprovalPublicationContext } = await import("./owner-approval.server");
    return loadOwnerApprovalPublicationContext(context.supabase, data.approvalId);
  });
export const publishOwnerApprovalSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        approvalId: z.string().uuid(),
        expectedUpdatedAt: z.string().datetime({ offset: true }),
        expectedRevision: z.number().int().nonnegative(),
        expectedOwnerId: z.string().uuid(),
        expectedProgramId: z.string().uuid(),
        expectedRecipientId: z.string().uuid(),
        title: z.string().trim().min(5).max(180),
        detail: z.string().trim().min(20).max(4000),
        reviewed: z.literal(true),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { publishOwnerApproval } = await import("./owner-approval.server");
    return publishOwnerApproval(context.supabase, data);
  });
