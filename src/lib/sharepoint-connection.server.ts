/**
 * Server-only storage + identity validation for the ARHA Resolve SharePoint
 * App User Connector.
 *
 * Rules enforced here (not merely documented):
 *  - A connection is only ever stored after Microsoft Graph /me confirms the
 *    signed-in identity is resolve.integration@arealhomeaway.com.
 *  - A mismatched identity is disconnected at the gateway and never stored.
 *  - The lovack_* connection key is encrypted at rest and never leaves the
 *    server.
 */
import {
  callAsAppUser,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import { decryptConnectionKey, encryptConnectionKey } from "@/lib/sharepoint-crypto.server";
import {
  REQUIRED_SHAREPOINT_IDENTITY,
  SHAREPOINT_CONNECTOR_ID,
  SHAREPOINT_GATEWAY_BASE_URL,
} from "@/lib/sharepoint";

type ConnectionRow = {
  connection_key_ciphertext: string;
  connected_identity: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // The table is server-only (service-role grants only) and intentionally not
  // part of the generated browser types.
  return (supabaseAdmin as unknown as {
    from: (table: string) => any;
  });
}

/** Ask Graph who this connection actually belongs to. Requires only User.Read. */
export async function readConnectedIdentity(connectionAPIKey: string): Promise<string | null> {
  const res = await callAsAppUser({
    gatewayBaseUrl: SHAREPOINT_GATEWAY_BASE_URL,
    connectorId: SHAREPOINT_CONNECTOR_ID,
    connectionAPIKey,
    path: "/me?$select=mail,userPrincipalName,displayName",
  });
  if (!res.ok) {
    throw new Error(`Microsoft identity check failed (${res.status}): ${await res.text()}`);
  }
  const me = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return (me.mail ?? me.userPrincipalName ?? null)?.toLowerCase() ?? null;
}

export function isApprovedIdentity(identity: string | null): boolean {
  return identity === REQUIRED_SHAREPOINT_IDENTITY.toLowerCase();
}

/**
 * Complete an authorization: exchange the one-time code, verify the identity,
 * and store only if it is the approved service account.
 */
export async function completeSharePointConnection(userId: string, code: string) {
  const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
    SHAREPOINT_GATEWAY_BASE_URL,
    code,
  );
  if (connectorId !== SHAREPOINT_CONNECTOR_ID) {
    throw new Error("OAuth completion returned the wrong connector");
  }

  let identity: string | null = null;
  try {
    identity = await readConnectedIdentity(connectionAPIKey);
  } catch (error) {
    await safeDisconnect(connectionAPIKey);
    throw error;
  }

  if (!isApprovedIdentity(identity)) {
    // Wrong person signed in — revoke immediately, store nothing.
    await safeDisconnect(connectionAPIKey);
    return {
      ok: false as const,
      identity,
      message: `Signed in as ${identity ?? "an unknown account"}. Only ${REQUIRED_SHAREPOINT_IDENTITY} may hold this connection, so it was revoked and not saved.`,
    };
  }

  const db = await admin();
  const { error } = await db.from("app_user_connections").upsert(
    {
      user_id: userId,
      connector_id: SHAREPOINT_CONNECTOR_ID,
      connection_key_ciphertext: encryptConnectionKey(connectionAPIKey),
      connected_identity: identity,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,connector_id" },
  );
  if (error) throw error;
  return { ok: true as const, identity };
}

/**
 * Load the stored key for a user. Returns null when nothing is stored, and
 * refuses to hand back a key whose recorded identity is not the approved one.
 */
export async function getSharePointConnectionKey(userId: string): Promise<string | null> {
  const db = await admin();
  const { data, error } = await db
    .from("app_user_connections")
    .select("connection_key_ciphertext, connected_identity")
    .eq("user_id", userId)
    .eq("connector_id", SHAREPOINT_CONNECTOR_ID)
    .maybeSingle();
  if (error) throw error;
  const row = data as ConnectionRow | null;
  if (!row) return null;
  if (!isApprovedIdentity(row.connected_identity?.toLowerCase() ?? null)) return null;
  return decryptConnectionKey(row.connection_key_ciphertext);
}

export async function getSharePointConnectionStatus(userId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("app_user_connections")
    .select("connected_identity, updated_at")
    .eq("user_id", userId)
    .eq("connector_id", SHAREPOINT_CONNECTOR_ID)
    .maybeSingle();
  if (error) throw error;
  const row = data as { connected_identity: string | null; updated_at: string } | null;
  return {
    connected: Boolean(row) && isApprovedIdentity(row!.connected_identity?.toLowerCase() ?? null),
    identity: row?.connected_identity ?? null,
    updatedAt: row?.updated_at ?? null,
  };
}

/** Revoke at the gateway and delete the stored row. */
export async function revokeSharePointConnection(userId: string) {
  const key = await loadRawKey(userId);
  if (key) await safeDisconnect(key);
  const db = await admin();
  const { error } = await db
    .from("app_user_connections")
    .delete()
    .eq("user_id", userId)
    .eq("connector_id", SHAREPOINT_CONNECTOR_ID);
  if (error) throw error;
  return { ok: true as const };
}

async function loadRawKey(userId: string): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("app_user_connections")
    .select("connection_key_ciphertext")
    .eq("user_id", userId)
    .eq("connector_id", SHAREPOINT_CONNECTOR_ID)
    .maybeSingle();
  const row = data as { connection_key_ciphertext: string } | null;
  return row ? decryptConnectionKey(row.connection_key_ciphertext) : null;
}

async function safeDisconnect(connectionAPIKey: string) {
  try {
    await disconnectAppUser({
      gatewayBaseUrl: SHAREPOINT_GATEWAY_BASE_URL,
      connectorId: SHAREPOINT_CONNECTOR_ID,
      connectionAPIKey,
    });
  } catch (error) {
    console.error("[sharepoint] gateway disconnect failed", error);
  }
}
