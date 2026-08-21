import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Which inbound feeds are connected right now. */
export const getInboundStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      ownerrez: Boolean(process.env["OWNERREZ_USERNAME"] && process.env["OWNERREZ_ACCESS_TOKEN"]),
    };
  });

/**
 * Pulls tasks that were created in OwnerRez into the matters
 * queue, and refreshes the status of ones already imported.
 */
export const runInboundSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { source?: "ownerrez" | "all" }) => ({
    source: input?.source ?? "all",
  }))
  .handler(async ({ context }) => {
    const { syncOwnerRezInbound } = await import("./inbound.server");
    const results = [await syncOwnerRezInbound(context.supabase, context.userId)];
    return { results };
  });

/** The most recent matters that arrived from an outside system. */
export const listImportedMatters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tickets")
      .select(
        "id, ref, title, priority, status, external_source, external_id, external_status, external_synced_at, property_id, properties(name)",
      )
      .not("external_source", "is", null)
      .order("external_synced_at", { ascending: false })
      .limit(25);
    if (error) return { ok: false as const, error: error.message, data: [] };
    return { ok: true as const, data: data ?? [] };
  });
