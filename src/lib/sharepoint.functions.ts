/**
 * Server functions for the ARHA Resolve SharePoint connection.
 *
 * Thin wrappers only — all logic lives in *.server.ts modules.
 * Authorization is invoked in `startSharePointConnect` below, and that is the
 * ONLY place a consent URL is ever minted.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeAppUserOAuth } from "@/integrations/lovable/appUserConnector";
import {
  SHAREPOINT_CONNECTOR_ID,
  SHAREPOINT_GATEWAY_BASE_URL,
  SHAREPOINT_SCOPES,
} from "@/lib/sharepoint";
import {
  completeSharePointConnection,
  getSharePointConnectionStatus,
  revokeSharePointConnection,
} from "@/lib/sharepoint-connection.server";

export const startSharePointConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientAPIKey = process.env['MICROSOFT_SHAREPOINT_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientAPIKey) {
      throw new Error("MICROSOFT_SHAREPOINT_APP_USER_CONNECTOR_CLIENT_API_KEY is not set");
    }
    const request = getRequest();
    if (!request) throw new Error("OAuth must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/sharepoint/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    ).toString();

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: SHAREPOINT_GATEWAY_BASE_URL,
      connectorId: SHAREPOINT_CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      credentialsConfiguration: { scopes: [...SHAREPOINT_SCOPES] },
    });
    return { authorizationUrl };
  });

export const completeSharePointConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => input)
  .handler(async ({ data, context }) => completeSharePointConnection(context.userId, data.code));

export const sharePointConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => getSharePointConnectionStatus(context.userId));

export const revokeSharePointConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => revokeSharePointConnection(context.userId));
