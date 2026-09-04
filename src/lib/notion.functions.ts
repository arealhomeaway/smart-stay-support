import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NotionProbe, SyncStatusRow } from "@/lib/notion";

async function assertSupervisor(context: { supabase: { rpc: Function }; userId: string }) {
  const { data } = await (context.supabase as any).rpc("is_supervisor", {
    _user_id: context.userId,
  });
  if (!data) throw new Error("Only supervisors and platform owners can manage integrations.");
}

export const getNotionOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSupervisor(context as never);
    const { probeNotionSources } = await import("@/lib/notion.server");

    let sources: NotionProbe[] = [];
    let connectionError: string | null = null;
    try {
      sources = await probeNotionSources();
    } catch (error) {
      connectionError = error instanceof Error ? error.message : "Notion is unavailable.";
    }

    const supabase = context.supabase;
    const [events, conflicts, links] = await Promise.all([
      supabase
        .from("integration_events")
        .select("id, system, operation, status, error_message, created_at, next_attempt_at")
        .eq("system", "notion")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("field_conflicts")
        .select("id, entity_id, field_key, field_label, resolve_value, external_value, detected_at")
        .eq("system", "notion")
        .eq("status", "open")
        .order("detected_at", { ascending: false })
        .limit(50),
      supabase
        .from("external_links")
        .select("last_synced_at, last_sync_status")
        .eq("system", "notion"),
    ]);

    const rows = links.data ?? [];
    const lastSuccessAt =
      rows
        .map((r) => r.last_synced_at)
        .filter((v): v is string => Boolean(v))
        .sort()
        .at(-1) ?? null;

    const status: SyncStatusRow = {
      system: "notion",
      lastSuccessAt,
      pending: rows.filter((r) => r.last_sync_status === "pending").length,
      failed: (events.data ?? []).filter((e) => e.status === "failed").length,
      conflicts: (conflicts.data ?? []).length,
    };

    return {
      connectionError,
      sources,
      status,
      events: events.data ?? [],
      conflicts: conflicts.data ?? [],
      mirroredCount: rows.length,
    };
  });

export const runNotionPropertySync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceKey: string }) => {
    if (!input?.sourceKey) throw new Error("Pick a Notion source to sync.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSupervisor(context as never);
    const { syncNotionProperties } = await import("@/lib/notion-sync.server");
    return syncNotionProperties(data.sourceKey, context.userId);
  });

export const resolveNotionConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conflictId: string; choice: "resolve" | "notion" }) => {
    if (!input?.conflictId) throw new Error("Missing conflict.");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertSupervisor(context as never);
    const supabase = context.supabase;
    const { data: conflict, error } = await supabase
      .from("field_conflicts")
      .select("id, entity_type, entity_id, field_key, resolve_value, external_value")
      .eq("id", data.conflictId)
      .single();
    if (error || !conflict) throw new Error("That conflict is no longer open.");

    const finalValue = data.choice === "notion" ? conflict.external_value : conflict.resolve_value;

    if (data.choice === "notion" && conflict.entity_type === "property") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("properties")
        .update({ [conflict.field_key]: finalValue } as never)
        .eq("id", conflict.entity_id);
    }

    await supabase
      .from("field_conflicts")
      .update({
        status: "resolved",
        chosen_source: data.choice,
        final_value: finalValue,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", conflict.id);

    return { ok: true, finalValue };
  });
