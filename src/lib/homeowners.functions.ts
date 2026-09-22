import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Leadership: the homeowner directory across the whole portfolio. */
export const homeownerDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertDirectoryAccess, loadHomeowners } = await import("./homeowners.server");
    await assertDirectoryAccess(context.supabase, context.userId);
    return loadHomeowners(context.supabase);
  });
