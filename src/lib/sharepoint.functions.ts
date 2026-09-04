/**
 * Server functions for the ARHA Resolve SharePoint connection.
 *
 * Thin wrappers only — all logic lives in *.server.ts modules.
 * Every function here is admin-only: `assertAdmin` runs server-side on
 * initiation, inspection, callback/exchange, status and revoke. Hiding the
 * button is only cosmetic; this is the real gate.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/access.server";
import {
  buildSharePointAuthorization,
  completeSharePointConnection,
  getSharePointConnectionStatus,
  inspectSharePointAuthorizationRequest,
  revokeSharePointConnection,
} from "@/lib/sharepoint-connection.server";

/** Mints a consent URL and returns it to the admin's browser. Admin-only. */
export const startSharePointConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { authorizationUrl } = await buildSharePointAuthorization(context.userId);
    return { authorizationUrl };
  });

/**
 * Generates the same authorization request and returns ONLY non-secret
 * parameters (client id, tenant, redirect URI, decoded scopes). The full URL,
 * OAuth state and any code are never returned or logged.
 */
export const inspectSharePointAuthRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return inspectSharePointAuthorizationRequest(context.userId);
  });

export const completeSharePointConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    return completeSharePointConnection(context.userId, data.code);
  });

export const sharePointConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return getSharePointConnectionStatus(context.userId);
  });

export const revokeSharePointConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return revokeSharePointConnection(context.userId);
  });

/** Read-only (GET only) access-scope validation using the saved connection. */
export const validateSharePointAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { runSharePointReadOnlyValidation } = await import("@/lib/sharepoint-validate.server");
    return runSharePointReadOnlyValidation(context.userId);
  });
