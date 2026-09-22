import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Who the homeowner talks to right now, resolved from the home's assignments. */
export const ownerContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        programId: z.string().uuid().nullable().default(null),
        preview: z.boolean().default(false),
      })
      .default({ programId: null, preview: false })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadOwnerContacts } = await import("./owner-contacts.server");
    if (data.preview) {
      // Staff walking the homeowner experience: only a Platform Owner may.
      const { assertAdmin } = await import("./access.server");
      await assertAdmin(context.supabase, context.userId);
      return loadOwnerContacts(context.supabase, supabaseAdmin, null, data.programId);
    }
    const { findOwnerProgram } = await import("./owner-program-reader.server");
    const program = await findOwnerProgram(context.supabase, context.userId);
    return loadOwnerContacts(
      context.supabase,
      supabaseAdmin,
      context.userId,
      program?.id ?? null,
    );
  });
