/**
 * Homeowner portal look (approved mockup, Nov 16): the four Opportunity groups by card code, the
 * hours shown on a completed card, and the order cards show in. Pure and browser-safe.
 * Presentation only: no card rule, deadline, unlock or hours math changes here.
 */
import { shortDate } from "@/lib/owner-opportunity-board";

export type PortalGroupId = "marketing" | "research" | "home_care" | "guest";

export const PORTAL_GROUPS: readonly { id: PortalGroupId; label: string; codes: readonly string[] }[] = [
  { id: "marketing", label: "Marketing and social", codes: ["P07", "P08", "P12", "P13", "P14", "P15", "P19", "P20"] },
  { id: "research", label: "Research and relationships", codes: ["N05", "N06", "N07", "N08", "N09", "N12", "P10", "P16", "P17", "P18"] },
  { id: "home_care", label: "Home care", codes: ["N01", "N02", "N03", "N04", "N11", "N13", "P05"] },
  { id: "guest", label: "Guest experience", codes: ["N14", "A33", "N10", "A52"] },
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
