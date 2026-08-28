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
