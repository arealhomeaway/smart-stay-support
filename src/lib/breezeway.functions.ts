/**
 * Server functions for the Breezeway connection.
 *
 * Thin wrappers only — every one is admin-gated server-side with
 * `assertAdmin`. Hiding the panel in the UI is cosmetic; this is the real gate.
 * Nothing here writes to Breezeway or imports records into Resolve.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/access.server";

export const breezewayStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { getBreezewayStatus } = await import("@/lib/breezeway-status.server");
    return getBreezewayStatus();
  });

/** Authenticates and makes one tiny read. Proves auth only — not sync, not write. */
export const testBreezewayConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runBreezewayConnectionTest } = await import("@/lib/breezeway-status.server");
    return runBreezewayConnectionTest();
  });

/** Read-only property inventory comparison and proposed mappings. */
export const breezewayInventoryReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { buildBreezewayInventoryReport } = await import("@/lib/breezeway-validate.server");
    return buildBreezewayInventoryReport();
  });

/**
 * Pilot only: links ONE Resolve property to ONE Breezeway property.
 * Admin-gated. Writes nothing else — lifecycle stage is never touched.
 */
export const saveBreezewayMapping = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resolveId: string; breezewayId: string }) => {
    const resolveId = String(input?.resolveId ?? "").trim();
    const breezewayId = String(input?.breezewayId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(resolveId)) throw new Error("Invalid Resolve property ID.");
    if (!/^\d+$/.test(breezewayId)) throw new Error("Invalid Breezeway property ID.");
    return { resolveId, breezewayId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { saveBreezewayPropertyMapping } = await import("@/lib/breezeway-pilot.server");
    return saveBreezewayPropertyMapping(data.resolveId, data.breezewayId);
  });

/** Read-only task preview for one mapped property. Imports nothing. */
export const breezewayPilotPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resolveId: string }) => {
    const resolveId = String(input?.resolveId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(resolveId)) throw new Error("Invalid Resolve property ID.");
    return { resolveId };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { buildBreezewayPilotPreview } = await import("@/lib/breezeway-pilot.server");
    return buildBreezewayPilotPreview(data.resolveId);
  });
