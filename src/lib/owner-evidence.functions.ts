/**
 * Server functions for optional participation evidence (photos, receipts).
 * Thin wrappers — every check lives in owner-evidence.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const beginParticipationEvidenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      programId: string;
      uploadKey: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/owner-evidence.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return m.beginParticipationEvidence(context.supabase, supabaseAdmin, context.userId, data);
  });

export const participationEvidenceUrlFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entryId: string; download?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/owner-evidence.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return m.participationEvidenceUrl(
      context.supabase,
      supabaseAdmin,
      data.entryId,
      data.download ?? false,
    );
  });
