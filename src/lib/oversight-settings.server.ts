import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readAlertConfig, type OversightAlertConfig } from "./oversight-alerts";
import { writeAudit } from "./audit.server";

type Client = SupabaseClient<Database>;
const KEY = "owner_oversight_alerts";

/** The thresholds supervisors chose for program follow-up alerts. */
export async function loadAlertConfig(supabase: Client): Promise<OversightAlertConfig> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  if (error) throw error;
  return readAlertConfig(data?.value ?? null);
}

export async function saveAlertConfig(
  supabase: Client,
  userId: string,
  role: string,
  input: unknown,
): Promise<OversightAlertConfig> {
  const config = readAlertConfig(input);
  const previous = await supabase.from("app_settings").select("value").eq("key", KEY).maybeSingle();
  if (previous.error) throw previous.error;
  const { error } = await supabase.from("app_settings").upsert({
    key: KEY,
    value: config,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  await writeAudit({
    actorId: userId,
    actorLabel: role,
    action: "oversight_alerts_configured",
    entityType: "app_setting",
    entityId: KEY,
    entityLabel: "Active Owner oversight alerts",
    before: previous.data?.value ?? null,
    after: config,
  });
  return config;
}

export type AccessLogQuery = {
  actor?: string | undefined;
  role?: string | undefined;
  target?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  limit?: number | undefined;
};

/** The audit trail of who read program-wide homeowner data. */
export async function loadAccessLog(query: AccessLogQuery) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin
    .from("audit_log")
    .select(
      "id, actor_id, actor_label, action, entity_type, entity_id, entity_label, reason, created_at",
    )
    .in("action", [
      "oversight_viewed",
      "homeowner_directory_viewed",
      "oversight_alerts_configured",
      "oversight_access_log_viewed",
    ])
    .order("created_at", { ascending: false })
    .limit(Math.min(query.limit ?? 200, 500));

  if (query.role) q = q.eq("actor_label", query.role);
  if (query.target) q = q.ilike("entity_type", `%${query.target}%`);
  if (query.from) q = q.gte("created_at", query.from);
  if (query.to) q = q.lte("created_at", query.to);

  const { data, error } = await q;
  if (error) throw error;

  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const profiles = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const p of profiles.data ?? [])
      names.set(p.id, p.full_name || p.email || "Unknown person");
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    actor: row.actor_id ? (names.get(row.actor_id) ?? "Unknown person") : "System",
    role: row.actor_label ?? "unknown",
    action: row.action,
    target: row.entity_type,
    targetLabel: row.entity_label,
    at: row.created_at,
  }));

  const term = query.actor?.trim().toLowerCase();
  return term ? rows.filter((r) => r.actor.toLowerCase().includes(term)) : rows;
}
