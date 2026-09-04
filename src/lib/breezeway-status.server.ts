/**
 * Breezeway connection status + test (server-only).
 *
 * "API connected" and "Sync enabled" are deliberately separate. A passing
 * authentication test says nothing about synchronization or write access:
 * no webhook subscription exists and the breezeway_bridge flag stays off.
 */
import type { BreezewayConnectionStatus } from "./breezeway";
import { BREEZEWAY_PROVIDER } from "./breezeway";
import {
  BreezewayError,
  breezewayCredentialsPresent,
  breezewayIdentityProbe,
  recordBreezewayCheck,
} from "./breezeway.server";

async function readRow() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("integration_tokens")
    .select("last_check_at, last_check_ok, last_error, company_label")
    .eq("provider", BREEZEWAY_PROVIDER)
    .maybeSingle();
  return data;
}

/** True only when the Breezeway bridge flag is on. It is off for launch. */
async function syncEnabled() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("feature_flags")
    .select("enabled")
    .eq("key", "breezeway_bridge")
    .maybeSingle();
  return Boolean(data?.enabled);
}

export async function getBreezewayStatus(): Promise<BreezewayConnectionStatus> {
  const row = await readRow();
  return {
    credentialsConfigured: breezewayCredentialsPresent(),
    apiConnected: row?.last_check_ok === true,
    syncEnabled: await syncEnabled(),
    connectedCompany: row?.company_label ?? null,
    lastCheckAt: row?.last_check_at ?? null,
    lastCheckOk: row?.last_check_ok ?? null,
    lastError: row?.last_error ?? null,
    writeAccessTested: false,
  };
}

export async function runBreezewayConnectionTest(): Promise<
  BreezewayConnectionStatus & { message: string }
> {
  if (!breezewayCredentialsPresent()) {
    const status = await getBreezewayStatus();
    return {
      ...status,
      message:
        "Breezeway credentials are not saved yet. Add BREEZEWAY_CLIENT_ID and BREEZEWAY_CLIENT_SECRET.",
    };
  }

  try {
    const probe = await breezewayIdentityProbe();
    const company =
      probe.companyName ??
      (probe.companyId != null ? `Company ${probe.companyId}` : "Unknown company");
    await recordBreezewayCheck(true, company, null);
    return {
      ...(await getBreezewayStatus()),
      message: `Authenticated. ${probe.totalProperties} properties visible to this key.`,
    };
  } catch (error) {
    const message =
      error instanceof BreezewayError
        ? error.message
        : "Breezeway connection test failed. Check the saved credentials.";
    await recordBreezewayCheck(false, null, message);
    return { ...(await getBreezewayStatus()), message };
  }
}
