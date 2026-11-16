/**
 * Applies the automatic Breezeway link (rule in breezeway-auto-link.ts).
 * Runs right after Add a home and once a night with the OwnerRez property
 * refresh. Reads Breezeway's home list only; never writes to Breezeway.
 * Each link is a guarded update (still unlinked and unmapped at save time)
 * plus one change-log entry.
 */
import {
  AUTO_LINK_AUDIT_ACTION,
  AUTO_LINK_NOTE,
  planAutoLinks,
  type AutoLinkHome,
  type AutoLinkProperty,
} from "./breezeway-auto-link";

// Loosely typed so tests can pass a small stand-in for the admin client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };

export type AutoLinkTrigger = "add_home" | "nightly";

export type AutoLinkRunResult = {
  checked: number;
  linked: { propertyId: string; breezewayHomeId: string }[];
  skipped: Record<string, number>;
};

const COLUMNS =
  "id, name, address_line1, is_demo, archived_at, active, ownerrez_property_id, breezeway_property_id, breezeway_mapping_state";

export async function autoLinkBreezewayHomes(
  db: Db,
  options: {
    trigger: AutoLinkTrigger;
    propertyIds?: string[];
    addedBy?: string | null;
    listHomes?: () => Promise<AutoLinkHome[]>;
    now?: Date;
  },
): Promise<AutoLinkRunResult> {
  const { data, error } = await db.from("properties").select(COLUMNS);
  if (error) throw new Error(`Could not read the homes: ${error.message}`);
  const all = (data ?? []) as (AutoLinkProperty & { name: string | null; address_line1: string | null })[];

  const targets = options.propertyIds ? all.filter((p) => options.propertyIds!.includes(p.id)) : all;
  const result: AutoLinkRunResult = { checked: targets.length, linked: [], skipped: {} };
  // Nothing to do: skip the Breezeway read entirely.
  if (!targets.some((p) => !(p.breezeway_property_id ?? "").trim() && (p.breezeway_mapping_state ?? "unmapped") === "unmapped")) {
    for (const d of planAutoLinks(all, [], options.propertyIds)) {
      if (d.action === "skip") result.skipped[d.reason] = (result.skipped[d.reason] ?? 0) + 1;
    }
    return result;
  }

  const listHomes =
    options.listHomes ??
    (async () => (await (await import("./breezeway.server")).listBreezewayProperties()).items);
  const homes = await listHomes();

  const at = (options.now ?? new Date()).toISOString();
  for (const d of planAutoLinks(all, homes, options.propertyIds)) {
    if (d.action === "skip") {
      result.skipped[d.reason] = (result.skipped[d.reason] ?? 0) + 1;
      continue;
    }
    const before = all.find((p) => p.id === d.propertyId)!;
    const { data: saved, error: saveErr } = await db
      .from("properties")
      .update({
        breezeway_property_id: d.breezewayHomeId,
        breezeway_mapping_state: "verified",
        breezeway_mapping_note: AUTO_LINK_NOTE,
        breezeway_mapping_verified_at: at,
      } as never)
      .eq("id", d.propertyId)
      .is("breezeway_property_id", null)
      .eq("breezeway_mapping_state", "unmapped")
      .select("id");
    if (saveErr) {
      console.error("[breezeway-auto-link] save failed:", d.propertyId, saveErr.message);
      result.skipped["save_failed"] = (result.skipped["save_failed"] ?? 0) + 1;
      continue;
    }
    // Someone linked or changed it in the meantime: leave their decision alone.
    if (!saved || saved.length === 0) {
      result.skipped["changed_meanwhile"] = (result.skipped["changed_meanwhile"] ?? 0) + 1;
      continue;
    }
    result.linked.push({ propertyId: d.propertyId, breezewayHomeId: d.breezewayHomeId });
    const { error: auditErr } = await db.from("audit_log").insert({
      actor_id: null,
      actor_label: "Automatic match",
      action: AUTO_LINK_AUDIT_ACTION,
      entity_type: "property",
      entity_id: d.propertyId,
      entity_label: before.address_line1 ?? before.name ?? "Home",
      reason: AUTO_LINK_NOTE,
      before_value: {
        breezeway_property_id: before.breezeway_property_id,
        breezeway_mapping_state: before.breezeway_mapping_state,
      },
      after_value: {
        breezeway_property_id: d.breezewayHomeId,
        breezeway_mapping_state: "verified",
        ownerrez_property_id: d.ownerrezId,
        trigger: options.trigger,
        added_by: options.addedBy ?? null,
        at,
      },
    });
    if (auditErr) console.error("[breezeway-auto-link] change log failed:", d.propertyId, auditErr.message);
  }
  return result;
}

/**
 * Add a home: try the link for the new home, never failing the add. A slow
 * Breezeway read gives up after `timeoutMs`; the nightly pass catches it.
 */
export async function autoLinkAfterAddHome(
  propertyId: string,
  addedBy: string,
  timeoutMs = 10_000,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      autoLinkBreezewayHomes(supabaseAdmin as unknown as Db, { trigger: "add_home", propertyIds: [propertyId], addedBy }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Breezeway did not answer in time.")), timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
  } catch (e) {
    console.error("[breezeway-auto-link] add home pass skipped:", (e as Error).message);
  }
}
