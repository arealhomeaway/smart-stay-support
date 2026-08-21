/** Append-only audit trail (server-only). Nothing here ever updates or deletes. */

export type AuditEntry = {
  actorId: string;
  actorLabel?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
};

export async function writeAudit(entry: AuditEntry) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("audit_log").insert({
    actor_id: entry.actorId,
    actor_label: entry.actorLabel ?? null,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    entity_label: entry.entityLabel ?? null,
    reason: entry.reason ?? null,
    before_value: (entry.before ?? null) as never,
    after_value: (entry.after ?? null) as never,
  });
  // An audit write must never silently vanish, but it must not break the action
  // either — surface it in the server log for follow-up.
  if (error) console.error("[audit] failed to record", entry.action, error.message);
}

export async function loadAuditLog(limit = 200) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("audit_log")
    .select("id, actor_id, actor_label, action, entity_type, entity_id, entity_label, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const actorIds = [...new Set((data ?? []).map((r) => r.actor_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const profiles = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", actorIds);
    for (const p of profiles.data ?? []) names.set(p.id, p.full_name || p.email || "Unknown");
  }

  return (data ?? []).map((row) => ({
    ...row,
    actor: row.actor_label ?? (row.actor_id ? (names.get(row.actor_id) ?? "Unknown") : "System"),
  }));
}
