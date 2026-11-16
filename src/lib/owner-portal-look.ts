/**
 * Homeowner portal look (approved mockup, Nov 16): the four Opportunity groups by card code, the
 * hours shown on a completed card, and the order cards show in. Pure and browser-safe.
 * Presentation only: no card rule, deadline, unlock or hours math changes here.
 */
import { shortDate } from "@/lib/owner-opportunity-board";

export type PortalGroupId = "marketing" | "research" | "home_care" | "guest";

export const PORTAL_GROUPS: readonly { id: PortalGroupId; label: string; codes: readonly string[] }[] = [
  { id: "marketing", label: "Marketing and social", codes: ["P07", "P08", "P12", "P13", "P14", "P15", "P19", "P20"] },
  // P09 and N16 added by the Admin, Nov 16.
  { id: "research", label: "Research and relationships", codes: ["N05", "N06", "N07", "N08", "N09", "N12", "P10", "P16", "P17", "P18", "P09", "N16"] },
  { id: "home_care", label: "Home care", codes: ["N01", "N02", "N03", "N04", "N11", "N13", "P05"] },
  // N15, N17 and P11 added by the Admin, Nov 16.
  { id: "guest", label: "Guest experience", codes: ["N14", "A33", "N10", "A52", "N15", "N17", "P11"] },
];

/** Type label colors, from the mockup. */
export const PORTAL_GROUP_TONE: Record<PortalGroupId, string> = {
  marketing: "bg-portal-marketing text-portal-marketing-ink",
  research: "bg-portal-research text-portal-research-ink",
  home_care: "bg-portal-homecare text-portal-homecare-ink",
  guest: "bg-portal-guest text-portal-guest-ink",
};

/** Which group a card code sits in; null when the mockup names no group for it. */
export function portalGroupFor(code: string | null | undefined): PortalGroupId | null {
  const c = (code ?? "").trim().toUpperCase();
  if (!c) return null;
  return PORTAL_GROUPS.find((g) => g.codes.includes(c))?.id ?? null;
}

/**
 * Older Library Opportunities have no card code; the Admin placed them by their library template (Nov 16).
 * "Review your property's guest journey" sits in Guest experience.
 */
export const PORTAL_GROUP_BY_LIBRARY_TEMPLATE: Readonly<Record<string, PortalGroupId>> = {
  "6256028b-d625-4f74-8753-a414e72e018d": "guest",
};

/** An item's group: by card code first, then by its library template; null shows it at the end of All. */
export function portalGroupForItem(item: { cardCode?: string | null; libraryTemplateId?: string | null }): PortalGroupId | null {
  return portalGroupFor(item.cardCode) ?? (item.libraryTemplateId ? PORTAL_GROUP_BY_LIBRARY_TEMPLATE[item.libraryTemplateId] ?? null : null);
}

export function portalGroupLabel(id: PortalGroupId): string {
  return PORTAL_GROUPS.find((g) => g.id === id)?.label ?? "";
}

/** The portal home page shows this many Opportunities for you. */
export const HOME_OPPORTUNITIES_VISIBLE = 6;

/** Newest opened first; never-opened items last, then by title. */
export function newestOpenedFirst<T extends { sentAt: string | null; title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const x = a.sentAt ?? "";
    const y = b.sentAt ?? "";
    if (x !== y) return x === "" ? 1 : y === "" ? -1 : y.localeCompare(x);
    return a.title.localeCompare(b.title);
  });
}

/** Completed newest first. */
export function newestCompletedFirst<T extends { completedAt?: string | null; title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const x = a.completedAt ?? "";
    const y = b.completedAt ?? "";
    if (x !== y) return x === "" ? 1 : y === "" ? -1 : y.localeCompare(x);
    return a.title.localeCompare(b.title);
  });
}

export type HourEntry = {
  minutes: number;
  activity: string | null;
  review_id?: string | null;
  superseded?: boolean;
  propertyIds: string[];
  entry_date?: string | null;
};

/**
 * The hours logged for one card, read from the owner's existing entries: an entry anchored to the
 * card's owner item, or an entry whose activity is the card's title (what "Log hours for this" fills
 * in) on the same home. Superseded entries never count.
 */
export function entriesForCard(entries: HourEntry[], card: { title: string; reviewId: string | null; propertyIds: string[] }): HourEntry[] {
  const title = card.title.trim().toLowerCase();
  return entries.filter((e) => {
    if (e.superseded) return false;
    if (card.reviewId && e.review_id === card.reviewId) return true;
    if ((e.activity ?? "").trim().toLowerCase() !== title) return false;
    if (card.propertyIds.length === 0 || e.propertyIds.length === 0) return true;
    return e.propertyIds.some((p) => card.propertyIds.includes(p));
  });
}

export function hoursFromMinutes(minutes: number): string {
  const h = Math.round((minutes / 60) * 10) / 10;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

/** "Completed Nov 14 · 2.5 hrs logged". */
export function completedLine(completedAt: string | null | undefined, minutes: number): string {
  const day = shortDate(completedAt ?? null);
  return `${day ? `Completed ${day}` : "Completed"} · ${hoursFromMinutes(minutes)} hrs logged`;
}

/**
 * "Opens when ..." on a Coming soon card, from the card's existing opens text:
 * "Locked until ARHA uploads the floor plan" reads "ARHA uploads the floor plan".
 */
export function portalOpensWhen(text: string | null | undefined): string {
  let t = (text ?? "").trim().replace(/[.\s]+$/, "");
  const after = /\bunlocks when\s+(.+)$/i.exec(t);
  if (after) t = after[1]!;
  else t = t.replace(/^locked until\s+/i, "");
  if (!t || /^open on day one/i.test(t)) return "our team finishes its part";
  return /^(ARHA|I|Owner)\b/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
}
