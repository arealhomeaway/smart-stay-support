import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Staff-only: pinned homes + their open work for the dispatch map. */
export const jobMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertStaff } = await import("./vendor.server");
    const { loadJobMap } = await import("./geo.server");
    await assertStaff(context.supabase, context.userId);
    return loadJobMap(context.supabase);
  });

/** Staff-only: look up coordinates for homes that don't have a pin yet. */
export const geocodeProperties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ force: z.boolean().optional() }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { assertStaff } = await import("./vendor.server");
    const { geocodeProperties: run } = await import("./geo.server");
    await assertStaff(context.supabase, context.userId);
    return run(context.supabase, { force: data.force ?? false });
  });
