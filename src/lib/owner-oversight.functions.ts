import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Leadership: the whole Active Owner program on one screen.
 *
 * Separate from the program admin function so the access rule and the audit
 * entry for program-wide reads live in one place.
 */
export const ownerOversight = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ demo: z.boolean().optional() })
      .optional()
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { requireLeadership, recordOversightAccess } = await import("./oversight-access.server");
    const { loadPrograms } = await import("./owner-program.server");
    const role = await requireLeadership(
      context.supabase,
      context.userId,
      "Active Owner program oversight",
    );
    const result = await loadPrograms(context.supabase, data?.demo === true);
    await recordOversightAccess({
      actorId: context.userId,
      role,
      action: "oversight_viewed",
      entityType: "owner_program_oversight",
      recordCount: result.rows.length,
    });
    return result;
  });
