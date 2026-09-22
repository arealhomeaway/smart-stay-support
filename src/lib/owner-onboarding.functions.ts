import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Onboarding items waiting on the homeowner, plus their track progress. */
export const ownerOnboardingActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        /** Set only when staff walk the homeowner experience read-only. */
        programId: z.string().uuid().nullable().default(null),
        preview: z.boolean().default(false),
      })
      .default({ programId: null, preview: false })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const m = await import("./owner-onboarding.server");
    if (data.preview) {
      if (!data.programId) return { inOnboarding: false, preview: true, pending: [], decided: [], homes: [] };
      return m.loadOwnerOnboardingPreview(context.supabase, context.userId, data.programId);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { findOwnerProgram } = await import("./owner-program-reader.server");
    const program = await findOwnerProgram(context.supabase, context.userId);
    return m.loadOwnerOnboarding(
      context.supabase,
      context.userId,
      supabaseAdmin,
      program?.id ?? null,
    );
  });
