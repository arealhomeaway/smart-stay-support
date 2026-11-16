/**
 * Applies the automatic Breezeway link (rule in breezeway-auto-link.ts).
 * Runs right after Add a home and once a night with the OwnerRez property
 * refresh. Reads Breezeway's home list only; never writes to Breezeway.
 * Each link is a guarded update (still unlinked and unmapped at save time)
 * plus one change-log entry.
 */
import { formatPropertyLabel } from "./property-label";
import {
  AUTO_LINK_AUDIT_ACTION,
  AUTO_LINK_NOTE,
  LINK_NOTICE_KIND,
  LINK_NOTICE_PATH,
  linkNoticeFor,
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
  /** Homes an Admin was told about in this pass (new notices only). */
  notified: string[];
};

const COLUMNS =
  "id, name, nickname, address_line1, unit, city, state, postal_code, is_demo, archived_at, active, ownerrez_property_id, breezeway_property_id, breezeway_mapping_state";

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
  const all = (data ?? []) as (AutoLinkProperty & {
    name: string | null;
    address_line1: string | null;
    unit?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
  })[];

  const targets = options.propertyIds ? all.filter((p) => options.propertyIds!.includes(p.id)) : all;
  const result: AutoLinkRunResult = { checked: targets.length, linked: [], skipped: {}, notified: [] };
  const cannotLink: { propertyId: string; reason: string }[] = [];
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
      cannotLink.push({ propertyId: d.propertyId, reason: d.reason });
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
      cannotLink.push({ propertyId: d.propertyId, reason: "save_failed" });
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

  result.notified = await noticeHomesThatCannotLink(db, cannotLink, all);
  return result;
}

/**
 * In-app notice to every Admin naming each home that could not link itself.
 * One notice per home and reason: a home already reported for the same reason
 * is not reported again each night. Never emailed. A notice failure is logged
 * and never stops the pass.
 */
async function noticeHomesThatCannotLink(
  db: Db,
  items: { propertyId: string; reason: string }[],
  all: { id: string; name: string | null; address_line1: string | null }[],
): Promise<string[]> {
  const notices = items
    .map((i) => {
      const home = all.find((p) => p.id === i.propertyId);
      const notice = home ? linkNoticeFor(i.reason, formatPropertyLabel(home).primary) : null;
      return notice ? { propertyId: i.propertyId, ...notice } : null;
    })
    .filter((n): n is { propertyId: string; title: string; body: string } => n !== null);
  if (!notices.length) return [];
  try {
    const { data: sent, error: sentErr } = await db
      .from("staff_notifications")
      .select("entity_id, body")
      .eq("kind", LINK_NOTICE_KIND)
      .in("entity_id", notices.map((n) => n.propertyId))
      .is("retracted_at", null);
    if (sentErr) throw new Error(sentErr.message);
    const already = new Set(((sent ?? []) as { entity_id: string; body: string }[]).map((r) => `${r.entity_id}|${r.body}`));
    const fresh = notices.filter((n) => !already.has(`${n.propertyId}|${n.body}`));
    if (!fresh.length) return [];

    const { data: admins, error: adminErr } = await db.from("user_roles").select("user_id").eq("role", "admin");
    if (adminErr) throw new Error(adminErr.message);
    const adminIds = [...new Set(((admins ?? []) as { user_id: string }[]).map((r) => r.user_id))];
    if (!adminIds.length) return [];

    const { error: insertErr } = await db.from("staff_notifications").insert(
      fresh.flatMap((n) =>
        adminIds.map((user_id) => ({
          user_id,
          kind: LINK_NOTICE_KIND,
          title: n.title,
          body: n.body,
          entity_type: "property",
          entity_id: n.propertyId,
          link_path: LINK_NOTICE_PATH,
          priority: "high",
        })),
      ),
    );
    if (insertErr) throw new Error(insertErr.message);
    return fresh.map((n) => n.propertyId);
  } catch (e) {
    console.error("[breezeway-auto-link] notice failed:", (e as Error).message);
    return [];
  }
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
