/**
 * Pure rule for linking a Resolve home to Breezeway automatically.
 *
 * A home is linked only when ALL of these hold:
 *   - it is not demo, not archived and not switched off
 *   - it has no Breezeway home yet and its mapping is still "unmapped"
 *     (never a home already linked, excluded by an Admin, or marked for review)
 *   - it carries an OwnerRez number
 *   - exactly one ACTIVE Breezeway home carries that same OwnerRez number
 *   - no other Resolve home already uses that Breezeway home, and no other
 *     home in the same pass claims it
 * Anything else is left untouched for the Admin matching screen. Name or
 * address similarity is never used here.
 */

export const AUTO_LINK_NOTE = "Matched by OwnerRez number.";
export const AUTO_LINK_AUDIT_ACTION = "breezeway_auto_matched";

export type AutoLinkProperty = {
  id: string;
  is_demo: boolean | null;
  archived_at: string | null;
  active: boolean | null;
  ownerrez_property_id: string | null;
  breezeway_property_id: string | null;
  breezeway_mapping_state: string | null;
};

export type AutoLinkHome = {
  id: number | string;
  status: string | null;
  referenceExternalPropertyId: string | null;
};

export type AutoLinkSkip =
  | "not_eligible"
  | "already_linked"
  | "not_unmapped"
  | "no_ownerrez_number"
  | "no_match"
  | "several_matches"
  | "home_taken";

export type AutoLinkDecision =
  | { propertyId: string; action: "link"; breezewayHomeId: string; ownerrezId: string }
  | { propertyId: string; action: "skip"; reason: AutoLinkSkip };

const clean = (v: string | number | null | undefined) => String(v ?? "").trim();

/**
 * Decides, for each target home, whether to link it. `allProperties` is every
 * Resolve home (archived and demo included) so Breezeway homes already in use
 * are never handed to a second home. `targetIds` limits the pass to a few
 * homes (Add a home); omitted means every home.
 */
export function planAutoLinks(
  allProperties: AutoLinkProperty[],
  breezewayHomes: AutoLinkHome[],
  targetIds?: string[],
): AutoLinkDecision[] {
  const held = new Set(allProperties.map((p) => clean(p.breezeway_property_id)).filter(Boolean));

  const byReference = new Map<string, string[]>();
  for (const h of breezewayHomes) {
    if (clean(h.status).toLowerCase() !== "active") continue;
    const ref = clean(h.referenceExternalPropertyId);
    if (!ref) continue;
    byReference.set(ref, [...(byReference.get(ref) ?? []), clean(h.id)]);
  }

  const targets = targetIds
    ? allProperties.filter((p) => targetIds.includes(p.id))
    : allProperties;

  const first: AutoLinkDecision[] = targets.map((p) => {
    if (p.is_demo || p.archived_at || p.active === false) {
      return { propertyId: p.id, action: "skip", reason: "not_eligible" };
    }
    if (clean(p.breezeway_property_id)) return { propertyId: p.id, action: "skip", reason: "already_linked" };
    if ((p.breezeway_mapping_state ?? "unmapped") !== "unmapped") {
      return { propertyId: p.id, action: "skip", reason: "not_unmapped" };
    }
    const ownerrezId = clean(p.ownerrez_property_id);
    if (!ownerrezId) return { propertyId: p.id, action: "skip", reason: "no_ownerrez_number" };
    const matches = byReference.get(ownerrezId) ?? [];
    if (matches.length === 0) return { propertyId: p.id, action: "skip", reason: "no_match" };
    if (matches.length > 1) return { propertyId: p.id, action: "skip", reason: "several_matches" };
    const homeId = matches[0]!;
    if (held.has(homeId)) return { propertyId: p.id, action: "skip", reason: "home_taken" };
    return { propertyId: p.id, action: "link", breezewayHomeId: homeId, ownerrezId };
  });

  // Two homes in one pass reaching the same Breezeway home: link neither.
  const claims = new Map<string, number>();
  for (const d of first) if (d.action === "link") claims.set(d.breezewayHomeId, (claims.get(d.breezewayHomeId) ?? 0) + 1);
  return first.map((d) =>
    d.action === "link" && (claims.get(d.breezewayHomeId) ?? 0) > 1
      ? { propertyId: d.propertyId, action: "skip", reason: "home_taken" }
      : d,
  );
}

/* ------------------------------------------------------------ link notices */

export const LINK_NOTICE_KIND = "breezeway_link_needed";
export const LINK_NOTICE_PATH = "/integrations";

/** Why a home could not link itself, in plain words. Only these reasons tell anyone. */
const NOTICE_REASON: Partial<Record<AutoLinkSkip | "save_failed", string>> = {
  no_ownerrez_number: "It has no OwnerRez number, so Resolve could not find it in Breezeway.",
  no_match: "No active Breezeway home has its OwnerRez number yet.",
  several_matches: "More than one Breezeway home has its OwnerRez number.",
  home_taken: "Its Breezeway home is already linked to another home in Resolve.",
  save_failed: "The Breezeway link could not be saved.",
};

/**
 * The notice for a home that could not link itself, or null when nobody
 * needs telling (demo, archived, already linked, excluded by an Admin,
 * already marked for review, or changed by someone in the meantime).
 */
export function linkNoticeFor(
  reason: string,
  homeLabel: string,
): { title: string; body: string } | null {
  const why = NOTICE_REASON[reason as AutoLinkSkip | "save_failed"];
  if (!why) return null;
  return {
    title: `Breezeway link needed: ${homeLabel}`,
    body: `${homeLabel} could not link to Breezeway by itself. ${why} Match it before anyone sends a work order.`,
  };
}
