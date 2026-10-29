import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatPropertyLabel } from "./property-label";

/** Which inbound feeds are connected right now. */
export const getInboundStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return {
      ownerrez: Boolean(process.env["OWNERREZ_USERNAME"] && process.env["OWNERREZ_ACCESS_TOKEN"]),
    };
  });

/** The most recent tickets that arrived from an outside system. */
export const listImportedMatters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tickets")
      .select(
        "id, ref, title, priority, status, external_source, external_id, external_status, external_synced_at, property_id, properties(name, address_line1, unit, city, state, postal_code)",
      )
      .not("external_source", "is", null)
      .eq("is_demo", false)
      .is("archived_at", null)
      .order("external_synced_at", { ascending: false })
      .limit(25);
    if (error) return { ok: false as const, error: error.message, data: [] };
    return { ok: true as const, data: (data ?? []).map(row => ({ ...row, properties: row.properties ? { ...row.properties, name: formatPropertyLabel(row.properties).primary } : null })) };
  });
