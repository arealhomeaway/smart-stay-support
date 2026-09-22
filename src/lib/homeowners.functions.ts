import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Leadership: the homeowner directory across the whole portfolio. */
export const homeownerDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireLeadership, recordOversightAccess } = await import("./oversight-access.server");
    const { loadHomeowners } = await import("./homeowners.server");
    const role = await requireLeadership(
      context.supabase,
      context.userId,
      "The homeowner directory",
    );
    const result = await loadHomeowners(context.supabase);
    await recordOversightAccess({
      actorId: context.userId,
      role,
      action: "homeowner_directory_viewed",
      entityType: "homeowner_directory",
      recordCount: result.rows.length,
    });
    return result;
  });
