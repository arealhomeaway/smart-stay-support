/**
 * Notion → Resolve property mirror (server-only, read-only for now).
 *
 * Notion stays the source of truth for property master information. This
 * mirrors those rows into Resolve so permissions, relationships, workflows and
 * reporting work against one immutable Resolve property id. Nothing is written
 * back to Notion yet, and nothing is silently overwritten: when Resolve and
 * Notion disagree on a field Resolve people can edit, we record a conflict for
 * a person to settle.
 */

import { NOTION_SOURCES } from "@/lib/notion";
import { NotionError, plainProperties, queryDatabase } from "@/lib/notion.server";

const FIELD_MAP: Record<string, string[]> = {
  name: ["property", "property name", "name", "listing", "home", "title"],
  address_line1: ["address", "street address", "address line 1", "street"],
  city: ["city"],
  state: ["state", "region"],
  postal_code: ["zip", "zip code", "postal code"],
  onboarding_stage: ["stage", "onboarding stage", "status", "phase"],
  onboarding_owner: ["owner", "responsible", "assignee", "onboarding owner", "point person"],
};

/** Fields Resolve people may edit locally — a difference here becomes a conflict. */
const CONFLICT_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "Property name" },
  { key: "address_line1", label: "Street address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postal_code", label: "Zip code" },
  { key: "onboarding_stage", label: "Onboarding stage" },
];

function pick(flat: Record<string, string>, candidates: string[]) {
  const lower = new Map(Object.entries(flat).map(([k, v]) => [k.toLowerCase().trim(), v]));
  for (const candidate of candidates) {
    const hit = lower.get(candidate);
    if (hit) return hit.trim();
  }
  for (const [k, v] of lower) {
    if (candidates.some((c) => k.includes(c)) && v) return v.trim();
  }
  return null;
}

export type NotionSyncResult = {
  sourceKey: string;
  ok: boolean;
  scanned: number;
  created: number;
  updated: number;
  conflicts: number;
  error: string | null;
};

export async function syncNotionProperties(sourceKey: string, actorId: string): Promise<NotionSyncResult> {
  const source = NOTION_SOURCES.find((s) => s.key === sourceKey);
  if (!source) throw new Error("Unknown Notion source.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result: NotionSyncResult = {
    sourceKey,
    ok: false,
    scanned: 0,
    created: 0,
    updated: 0,
    conflicts: 0,
    error: null,
  };

  const startEvent = await supabaseAdmin
    .from("integration_events")
    .insert({
      system: "notion",
      direction: "inbound",
      entity_type: "property",
      external_id: source.id,
      operation: `sync:${sourceKey}`,
      status: "running",
      attempts: 1,
    })
    .select("id")
    .single();
  const eventId = startEvent.data?.id ?? null;

  try {
    const pages = await queryDatabase(source.id);
    result.scanned = pages.length;

    for (const page of pages) {
      const notionId = String(page["id"] ?? "").replace(/-/g, "");
      if (!notionId) continue;
      const flat = plainProperties(page);
      const incoming: Record<string, string | null> = {};
      for (const [column, candidates] of Object.entries(FIELD_MAP)) {
        incoming[column] = pick(flat, candidates);
      }
      const name = incoming["name"] || pick(flat, ["title"]) || "Untitled Notion property";

      const link = await supabaseAdmin
        .from("external_links")
        .select("id, entity_id")
        .eq("system", "notion")
        .eq("entity_type", "property")
        .eq("external_id", notionId)
        .maybeSingle();

      let propertyId = link.data?.entity_id ?? null;

      if (!propertyId) {
        // Never create a duplicate: match an existing Resolve home by name first.
        const existing = await supabaseAdmin
          .from("properties")
          .select("id")
          .ilike("name", name)
          .limit(1)
          .maybeSingle();
        if (existing.data?.id) {
          propertyId = existing.data.id;
        } else {
          const created = await supabaseAdmin
            .from("properties")
            .insert({
              name,
              address_line1: incoming["address_line1"],
              city: incoming["city"],
              state: incoming["state"],
              postal_code: incoming["postal_code"],
              onboarding_stage: incoming["onboarding_stage"],
              onboarding_owner: incoming["onboarding_owner"],
              lifecycle_status: "onboarding",
            })
            .select("id")
            .single();
          if (created.error) throw created.error;
          propertyId = created.data.id;
          result.created += 1;
        }
        await supabaseAdmin.from("external_links").upsert(
          {
            entity_type: "property",
            entity_id: propertyId,
            system: "notion",
            external_id: notionId,
            external_url: (page["url"] as string | null) ?? null,
            external_parent_id: source.id,
            last_synced_at: new Date().toISOString(),
            last_sync_status: "ok",
          },
          { onConflict: "entity_type,entity_id,system" },
        );
      } else {
        const current = await supabaseAdmin
          .from("properties")
          .select("id, name, address_line1, city, state, postal_code, onboarding_stage, onboarding_owner")
          .eq("id", propertyId)
          .maybeSingle();
        if (!current.data) continue;

        const patch: Record<string, string | null> = {};
        for (const field of CONFLICT_FIELDS) {
          const notionValue = field.key === "name" ? name : incoming[field.key];
          const localValue = (current.data as Record<string, unknown>)[field.key] as string | null;
          if (!notionValue) continue;
          if ((localValue ?? "") === notionValue) continue;
          if (!localValue) {
            patch[field.key] = notionValue;
            continue;
          }
          // Both sides have a value and they disagree — ask a person.
          const conflict = await supabaseAdmin.from("field_conflicts").upsert(
            {
              entity_type: "property",
              entity_id: propertyId,
              system: "notion",
              field_key: field.key,
              field_label: field.label,
              resolve_value: localValue,
              external_value: notionValue,
              status: "open",
            },
            { onConflict: "entity_type,entity_id,system,field_key", ignoreDuplicates: true },
          );
          if (!conflict.error) result.conflicts += 1;
        }
        if (incoming["onboarding_owner"] && !current.data.onboarding_owner) {
          patch["onboarding_owner"] = incoming["onboarding_owner"];
        }
        if (Object.keys(patch).length > 0) {
          await supabaseAdmin.from("properties").update(patch).eq("id", propertyId);
          result.updated += 1;
        }
        await supabaseAdmin
          .from("external_links")
          .update({
            last_synced_at: new Date().toISOString(),
            last_sync_status: "ok",
            last_error: null,
            external_url: (page["url"] as string | null) ?? null,
          })
          .eq("id", link.data!.id);
      }
    }

    result.ok = true;
    if (eventId) {
      await supabaseAdmin
        .from("integration_events")
        .update({
          status: "succeeded",
          resolved_at: new Date().toISOString(),
          resolved_by: actorId,
          request_payload: {
            scanned: result.scanned,
            created: result.created,
            updated: result.updated,
            conflicts: result.conflicts,
          },
        })
        .eq("id", eventId);
    }
    return result;
  } catch (error) {
    const message =
      error instanceof NotionError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Sync failed.";
    result.error = message;
    if (eventId) {
      await supabaseAdmin
        .from("integration_events")
        .update({
          status: "failed",
          error_message: message,
          next_attempt_at: new Date(Date.now() + 10 * 60_000).toISOString(),
        })
        .eq("id", eventId);
    }
    return result;
  }
}
