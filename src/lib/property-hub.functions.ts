/**
 * Property Hub server functions. Thin wrappers — every access decision lives
 * in property-hub.server.ts and is re-checked on each call.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPropertyHubFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { propertyId: string }) => input)
  .handler(async ({ data, context }) => {
    const m = await import("@/lib/property-hub.server");
    const viewer = await m.loadViewer(context.supabase, context.userId);
    return m.loadPropertyHub(viewer, data.propertyId);
  });
