/**
 * Cross-property Utilities & Accounts loader (server-only).
 *
 * Reads existing records only: utility accounts for homes still in onboarding,
 * the credential each account is linked to (label and username only — never a
 * secret), meter assets and utility documents.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { isTestRecord } from "@/lib/test-data";
import {
  buildUtilityBoard,
  type BoardAccount,
  type BoardCredential,
  type BoardDocument,
  type BoardMeter,
  type BoardProperty,
} from "@/lib/onboarding-utilities";

/** Homes still moving toward Operations — the utility manager's working set. */
const IN_FLIGHT = ["onboarding", "paused", "handoff_requested", "handoff_corrections"];

export async function loadUtilitiesBoard(supabase: SupabaseClient<Database>) {
  const properties = await supabase
    .from("properties")
    .select("id, name, nickname, city, state, lifecycle_status, is_demo")
    .in("lifecycle_status", IN_FLIGHT)
    .limit(300);
  if (properties.error) throw properties.error;

  const rows = (properties.data ?? []) as BoardProperty[];
  const ids = rows.map((p) => p.id);
  if (ids.length === 0) return [];

  const [accounts, credentials, assets, documents] = await Promise.all([
    supabase
      .from("utility_accounts")
      .select(
        "id, property_id, utility_type, provider, account_label, status, responsible, credential_id, service_start_on, notes",
      )
      .in("property_id", ids),
    supabase
      .from("property_credentials")
      .select("id, label, username, instructions")
      .in("property_id", ids)
      .eq("active", true),
    supabase
      .from("property_assets")
      .select("id, property_id, name, kind, location")
      .in("property_id", ids)
      .is("archived_at", null),
    supabase
      .from("documents")
      .select("id, property_id, title, uploaded_at")
      .in("property_id", ids)
      .is("archived_at", null)
      .is("deleted_at", null)
      .limit(500),
  ]);
  if (accounts.error) throw accounts.error;
  if (credentials.error) throw credentials.error;
  if (assets.error) throw assets.error;
  if (documents.error) throw documents.error;

  return buildUtilityBoard({
    properties: rows,
    accounts: (accounts.data ?? []) as BoardAccount[],
    credentials: (credentials.data ?? []) as BoardCredential[],
    meters: (assets.data ?? []) as BoardMeter[],
    documents: (documents.data ?? []) as BoardDocument[],
    testIds: rows.filter((p) => isTestRecord(p.name) || isTestRecord(p.nickname)).map((p) => p.id),
  });
}
