/**
 * Lead offers — the Availability Finder ↔ Leads link.
 *
 * A lead is ARHA's mid-term direct-booking request: who asked (all optional),
 * the stay they need, and the homes offered to them. Every offer is a
 * lead_properties row with the quote total snapshot taken at the moment it
 * was shown. Pure helpers only; writes go through lead-offers.functions.ts.
 */

import type { LeadRow, LeadUpdate } from "./lead-types";
import type { LeadLossReason } from "./leads";

export type LeadOfferOutcome = "waiting" | "declined" | "accepted";

/** A lead_properties row, including the offer columns added by the staged v2 SQL. */
export type LeadOffer = {
  id: string;
  lead_id: string;
  property_id: string;
  note: string | null;
  presented_at: string | null;
  added_by: string | null;
  created_at: string;
  quote_total: number | null;
  quote_currency: string | null;
  outcome: LeadOfferOutcome | null;
  outcome_reason: string | null;
  outcome_at: string | null;
  outcome_by: string | null;
};

/** The finder search carried onto the lead, so "Choose another property" can replay it. */
export type LeadStaySearch = {
  location: string;
  checkIn: string;
  checkOut: string;
  guests?: number | undefined;
  dogs?: number | undefined;
  cats?: number | undefined;
  minBedrooms?: number | undefined;
  inquirySourceId?: string | undefined;
};

/** Who-details: every field optional, editable later. */
export type LeadWhoDetails = {
  organization?: string | undefined;
  contactName?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
};

export type LeadOutcome = "open" | "booked" | "lost";

export const LEAD_OUTCOME_LABELS: Record<LeadOutcome, string> = {
  open: "Open",
  booked: "Booked",
  lost: "Lost",
};

/** The one outcome the list and workspace show; the old stages stay stored underneath. */
export function leadOutcome(lead: Pick<LeadRow, "stage">): LeadOutcome {
  if (lead.stage === "converted") return "booked";
  if (lead.stage === "lost") return "lost";
  return "open";
}

export const OFFER_OUTCOME_LABELS: Record<LeadOfferOutcome, string> = {
  waiting: "Waiting",
  declined: "Declined",
  accepted: "Accepted",
};

/** Rows written before the offer columns existed read as still waiting. */
export function offerOutcome(offer: LeadOffer): LeadOfferOutcome {
  return offer.outcome ?? "waiting";
}

/** Most recently offered first. */
export function sortOffers<T extends LeadOffer>(offers: T[]): T[] {
  return [...offers].sort((a, b) =>
    (b.presented_at ?? b.created_at).localeCompare(a.presented_at ?? a.created_at));
}

export function lastOffer<T extends LeadOffer>(offers: T[]): T | null {
  return sortOffers(offers)[0] ?? null;
}

/** Every home ever offered on this lead, whatever the outcome — never offered twice. */
export function offeredPropertyIds(offers: LeadOffer[]): string[] {
  return [...new Set(offers.map((offer) => offer.property_id))];
}

/** The offer still waiting on an answer, if there is one. */
export function waitingOffer<T extends LeadOffer>(offers: T[]): T | null {
  return sortOffers(offers).find((offer) => offerOutcome(offer) === "waiting") ?? null;
}

function blank(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

function nightsBetween(checkIn: string, checkOut: string): number | null {
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 86400000);
}

/**
 * The leads row for a finder-created lead. Who-details are all skippable, so
 * contact_name stays null until someone fills it in (the staged SQL makes it
 * nullable); the list shows "Not recorded yet" until then.
 */
export function buildLeadInsertForOffer(search: LeadStaySearch, who: LeadWhoDetails, userId: string) {
  const dogs = search.dogs ?? 0;
  const cats = search.cats ?? 0;
  return {
    contact_name: blank(who.contactName),
    company: blank(who.organization),
    phone: blank(who.phone),
    email: blank(who.email),
    preferred_channel: null,
    source: "direct" as const,
    source_detail: {},
    market: search.location,
    search_region: search.location,
    desired_move_in: search.checkIn,
    desired_check_out: search.checkOut,
    length_of_stay_days: nightsBetween(search.checkIn, search.checkOut),
    bedrooms: search.minBedrooms && search.minBedrooms > 0 ? search.minBedrooms : null,
    guests: search.guests && search.guests > 0 ? search.guests : null,
    dogs: dogs > 0 ? dogs : null,
    cats: cats > 0 ? cats : null,
    pets: dogs + cats > 0,
    date_flexible: null,
    budget_monthly: null,
    requirements: null,
    inquiry_source_id: search.inquirySourceId ?? null,
    stage: "new" as const,
    assigned_to: userId,
    created_by: userId,
  };
}

/** The offer row, with the quote total snapshot exactly as shown at the time. */
export function buildOfferInsert(
  leadId: string,
  propertyId: string,
  quote: { total: number | null; currency: string | null },
  userId: string,
  now = new Date(),
) {
  return {
    lead_id: leadId,
    property_id: propertyId,
    presented_at: now.toISOString(),
    added_by: userId,
    quote_total: quote.total,
    quote_currency: quote.currency,
    outcome: "waiting" as const,
  };
}

/** Declined always carries a reason; accepted never does. */
export function validateOfferDecision(decision: "declined" | "accepted", reason: string | undefined): string | null {
  if (decision === "declined" && !blank(reason)) return "Give the reason this home was declined.";
  return null;
}

/** Accepting an offer books the lead on that home. */
export function acceptOfferLeadPatch(offer: LeadOffer, userId: string, now = new Date()): LeadUpdate {
  return {
    stage: "converted",
    converted_at: now.toISOString(),
    converted_by: userId,
    converted_property_id: offer.property_id,
  };
}

/** Lost always carries a reason; "Other" also needs a note. */
export function validateLeadLost(reason: LeadLossReason | "", note: string | undefined): string | null {
  if (!reason) return "Choose a reason.";
  if (reason === "other" && !blank(note)) return "A note is required for Other.";
  return null;
}

/** The finder search replayed from the lead, with the lead attached. */
export function finderSearchFromLead(lead: LeadRow) {
  const region = (lead as LeadRow & { search_region?: string | null }).search_region ?? lead.market ?? "";
  const extra = lead as LeadRow & {
    desired_check_out?: string | null;
    guests?: number | null;
    dogs?: number | null;
    cats?: number | null;
    inquiry_source_id?: string | null;
  };
  return {
    checkIn: lead.desired_move_in ?? undefined,
    checkOut: extra.desired_check_out ?? undefined,
    location: region || undefined,
    guests: extra.guests ?? undefined,
    dogs: extra.dogs ?? undefined,
    cats: extra.cats ?? undefined,
    minBedrooms: lead.bedrooms ?? undefined,
    inquirySourceId: extra.inquiry_source_id ?? undefined,
    leadId: lead.id,
  };
}

/** List column: "Dec 1 → Dec 31" or a dash when the stay is not recorded. */
export function stayDatesLabel(lead: LeadRow): string {
  const extra = lead as LeadRow & { desired_check_out?: string | null };
  if (!lead.desired_move_in) return "Not set";
  const start = new Date(`${lead.desired_move_in}T00:00:00Z`);
  const from = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (!extra.desired_check_out) return `from ${from}`;
  const end = new Date(`${extra.desired_check_out}T00:00:00Z`);
  return `${from} to ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** List column: "4 guests · 1 dog, 2 cats", falling back to the old pets flag. */
export function guestsPetsLabel(lead: LeadRow): string {
  const extra = lead as LeadRow & { guests?: number | null; dogs?: number | null; cats?: number | null };
  const parts: string[] = [];
  if (extra.guests) parts.push(`${extra.guests} guest${extra.guests === 1 ? "" : "s"}`);
  const dogs = extra.dogs ?? 0;
  const cats = extra.cats ?? 0;
  if (dogs) parts.push(`${dogs} dog${dogs === 1 ? "" : "s"}`);
  if (cats) parts.push(`${cats} cat${cats === 1 ? "" : "s"}`);
  if (!dogs && !cats && lead.pets) parts.push("pets");
  return parts.length ? parts.join(" · ") : "None";
}

export function leadRegion(lead: LeadRow): string {
  return (lead as LeadRow & { search_region?: string | null }).search_region ?? lead.market ?? "Not set";
}

/** The follow-up date the coordinator set, if any. */
export function leadFollowUpDate(lead: LeadRow): string | null {
  return (lead as LeadRow & { next_follow_up_on?: string | null }).next_follow_up_on ?? null;
}

/** "Follow-up due" filter: the set date has arrived, or the derived clock says overdue/today. */
export function followUpDue(lead: LeadRow, now = new Date()): boolean {
  const setDate = leadFollowUpDate(lead);
  if (setDate) {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return setDate <= today;
  }
  return false;
}
