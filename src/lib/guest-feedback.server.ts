import { formatPropertyLabel } from "@/lib/property-label";
/**
 * Server-only Guest Feedback helpers: signed survey tokens, OwnerRez stay
 * lookup, review ingestion and the automatic follow-up Ticket.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { FEEDBACK_WORK_TYPE, REVIEW_FOLLOWUP_START_KEY, SURVEY_VALID_DAYS, needsFollowUp, normalizeName, readReviewFollowUpStart, reviewImportDecision, surveyWindowOpen } from "./guest-feedback";

type Admin = SupabaseClient<Database>;

/* ---------------- Tokens ---------------- */

export type SurveyStay = {
  /** OwnerRez booking id, or a synthetic id for demo stays. */
  b: string;
  p: string; // property id
  g: string | null; // guest name
  gid: string | null;
  a: string | null; // arrival yyyy-mm-dd
  d: string; // departure yyyy-mm-dd
  ch: string | null; // booking platform
  demo: boolean;
  exp: number; // epoch seconds
};

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

async function hmac(data: string) {
  const secret = process.env["GUEST_SURVEY_SECRET"];
  if (!secret) throw new Error("Survey links are not configured.");
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function signSurveyToken(stay: Omit<SurveyStay, "exp">): Promise<string> {
  const exp = Math.floor(new Date(`${stay.d}T00:00:00Z`).getTime() / 1000) + (SURVEY_VALID_DAYS + 1) * 86400;
  const body = b64url(enc.encode(JSON.stringify({ ...stay, exp })));
  return `${body}.${await hmac(body)}`;
}

export async function verifySurveyToken(token: string): Promise<SurveyStay | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = await hmac(body);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const stay = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SurveyStay;
    if (!stay.exp || stay.exp * 1000 < Date.now()) return null;
    return stay;
  } catch {
    return null;
  }
}

/* ---------------- OwnerRez stay lookup ---------------- */

type OrBooking = {
  id: number;
  property_id: number;
  arrival?: string;
  departure?: string;
  status?: string;
  is_block?: boolean;
  listing_site?: string | null;
  platform_reservation_number?: string | null;
  guest_id?: number;
  guest?: { id?: number; first_name?: string; last_name?: string } | null;
};

async function linkedHomes(admin: Admin) {
  const { data } = await admin
    .from("properties")
    .select("id, ownerrez_property_id")
    .not("ownerrez_property_id", "is", null);
  return new Map((data ?? []).map((p) => [String(p.ownerrez_property_id), p.id] as const));
}

function toStay(b: OrBooking, propertyId: string): Omit<SurveyStay, "exp"> {
  const name = [b.guest?.first_name, b.guest?.last_name].filter(Boolean).join(" ") || null;
  return {
    b: String(b.id),
    p: propertyId,
    g: name,
    gid: b.guest_id == null ? null : String(b.guest_id),
    a: b.arrival?.slice(0, 10) ?? null,
    d: (b.departure ?? "").slice(0, 10),
    ch: b.listing_site ?? null,
    demo: false,
  };
}

const live = (b: OrBooking) => !b.is_block && (b.status ?? "active").toLowerCase() !== "cancelled";

/**
 * Finds exactly one finished stay by guest last name + checkout date.
 * Anything other than one match is refused rather than guessed.
 */
export async function findStayByNameAndCheckout(
  admin: Admin,
  lastName: string,
  checkout: string,
): Promise<{ ok: true; stay: Omit<SurveyStay, "exp"> } | { ok: false; reason: "not_found" | "ambiguous" | "expired" }> {
  if (!surveyWindowOpen(checkout)) return { ok: false, reason: "expired" };
  const homes = await linkedHomes(admin);
  if (homes.size === 0) return { ok: false, reason: "not_found" };
  const { ownerRezGet } = await import("./ownerrez.server");
  const ids = [...homes.keys()];
  const matches: OrBooking[] = [];
  for (let i = 0; i < ids.length; i += 40) {
    const data = await ownerRezGet<{ items?: OrBooking[] }>("/bookings", {
      property_ids: ids.slice(i, i + 40).join(","),
      from: checkout,
      to: checkout,
      limit: "100",
      include_guest: "true",
    });
    for (const b of data.items ?? []) {
      if (!live(b) || b.departure?.slice(0, 10) !== checkout) continue;
      if (normalizeName(b.guest?.last_name) === normalizeName(lastName)) matches.push(b);
    }
  }
  if (matches.length === 0) return { ok: false, reason: "not_found" };
  if (matches.length > 1) return { ok: false, reason: "ambiguous" };
  const b = matches[0]!;
  return { ok: true, stay: toStay(b, homes.get(String(b.property_id))!) };
}

/**
 * Resolves a channel confirmation code placed in the link by the checkout
 * email. Only the channel's own code is accepted (never OwnerRez's
 * sequential booking number), and only for stays inside the survey window.
 */
export async function findStayByConfirmation(
  admin: Admin,
  code: string,
): Promise<Omit<SurveyStay, "exp"> | null> {
  const clean = code.trim();
  if (!/^[A-Za-z0-9-]{6,40}$/.test(clean) || /^\d{1,9}$/.test(clean)) return null;
  const homes = await linkedHomes(admin);
  if (homes.size === 0) return null;
  const { ownerRezGet } = await import("./ownerrez.server");
  const now = new Date();
  const from = new Date(now.getTime() - (SURVEY_VALID_DAYS + 1) * 86400000).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const ids = [...homes.keys()];
  for (let i = 0; i < ids.length; i += 40) {
    const data = await ownerRezGet<{ items?: OrBooking[] }>("/bookings", {
      property_ids: ids.slice(i, i + 40).join(","),
      from,
      to,
      limit: "200",
      include_guest: "true",
    });
    const hit = (data.items ?? []).find(
      (b) => live(b) && (b.platform_reservation_number ?? "").toLowerCase() === clean.toLowerCase(),
    );
    if (hit && hit.departure && surveyWindowOpen(hit.departure.slice(0, 10)))
      return toStay(hit, homes.get(String(hit.property_id))!);
  }
  return null;
}

/* ---------------- Follow-up Ticket ---------------- */

export type FeedbackRow = Database["public"]["Tables"]["guest_feedback"]["Row"];

/**
 * Creates the Guest Feedback Follow-Up Ticket for one sub-5-star record.
 * Idempotent: a record that already has a Ticket is left alone.
 * Normal routing applies (lands in the Team Queue). Completed stay → prior
 * guest, no active-stay cadence.
 */
export async function createFollowUpTicket(admin: Admin, fb: FeedbackRow): Promise<string | null> {
  if (fb.ticket_id || !needsFollowUp(fb.rating) || !fb.property_id) return fb.ticket_id ?? null;
  const { data: wt } = await admin.from("work_types").select("id, default_priority").eq("name", FEEDBACK_WORK_TYPE).maybeSingle();
  const kind = fb.feedback_type === "internal_survey" ? "Guest Survey" : `${fb.booking_platform ?? "External"} review`;
  const { data: ticket, error } = await admin
    .from("tickets")
    .insert({
      record_type: "active_task",
      title: `Guest feedback follow-up — ${fb.rating}★ ${kind}`,
      description: fb.summary ? fb.summary.slice(0, 1000) : `${fb.rating}-star ${kind} needs a follow-up with the prior guest.`,
      property_id: fb.property_id,
      work_type_id: wt?.id ?? null,
      priority: (wt?.default_priority as string | undefined) ?? "p3",
      category: "guest",
      entry_kind: "ops",
      initiator_type: "guest",
      guest_in_residence: false,
      active_stay_impact: "no",
      guest_comm_required: "yes",
      issue_reservation_relation: "prior",
      ownerrez_booking_id: fb.reservation_match === "matched" ? fb.ownerrez_booking_id : null,
      reservation_guest_name: fb.guest_name,
      reservation_arrival: fb.stay_start,
      reservation_departure: fb.stay_end,
      reservation_channel: fb.booking_platform,
      guest_feedback_id: fb.id,
      is_demo: fb.is_demo,
    } as never)
    .select("id")
    .single();
  if (error || !ticket) {
    console.error("feedback follow-up ticket failed", error?.message);
    return null;
  }
  const id = (ticket as { id: string }).id;
  await admin.from("guest_feedback").update({ ticket_id: id, follow_up_required: true, follow_up_status: "open" }).eq("id", fb.id);
  return id;
}

/* ---------------- Review ingestion ---------------- */

export type ReviewInput = {
  source_review_id: string;
  listing_site: string | null;
  ownerrez_property_id: string | null;
  property_id?: string | null;
  booking_id: string | null;
  guest_id: string | null;
  guest_name: string | null;
  stars: number | null;
  body: string | null;
  response: string | null;
  date: string | null;
  url: string | null;
  stay_start?: string | null;
  stay_end?: string | null;
  is_demo?: boolean;
};

/**
 * Stores reviews once each (by source + review id). Only newly stored
 * sub-5-star reviews create follow-up work, so repeated syncs are silent.
 */
export async function loadReviewFollowUpStart(admin: Admin): Promise<string | null> {
  const { data } = await admin.from("app_settings").select("value").eq("key", REVIEW_FOLLOWUP_START_KEY).maybeSingle();
  return readReviewFollowUpStart(data?.value ?? null);
}

export async function ingestReviews(admin: Admin, items: ReviewInput[]) {
  const homes = await linkedHomes(admin);
  const startDate = await loadReviewFollowUpStart(admin);
  let historical = 0;
  let imported = 0;
  let duplicates = 0;
  let ticketsCreated = 0;
  for (const r of items) {
    const propertyId = r.property_id ?? (r.ownerrez_property_id ? homes.get(r.ownerrez_property_id) ?? null : null);
    const { data, error } = await admin
      .from("guest_feedback")
      .insert({
        feedback_type: "external_review",
        source: "ownerrez",
        source_review_id: r.source_review_id,
        property_id: propertyId,
        ownerrez_booking_id: r.booking_id,
        reservation_match: r.booking_id ? "matched" : "unmatched",
        guest_id: r.guest_id,
        guest_name: r.guest_name,
        reviewer_display_name: r.guest_name,
        rating: r.stars && r.stars >= 1 && r.stars <= 5 ? Math.round(r.stars) : null,
        summary: r.body,
        response_text: r.response,
        source_url: r.url,
        submitted_at: r.date ?? new Date().toISOString(),
        booking_platform: r.listing_site,
        stay_start: r.stay_start ?? null,
        stay_end: r.stay_end ?? null,
        is_demo: r.is_demo ?? false,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") duplicates++;
      else console.error("review import failed", error.message);
      continue;
    }
    imported++;
    // Only reviews published on/after the start date can open follow-up work;
    // replays of older reviews are always history-only.
    const decision = reviewImportDecision(data.rating, r.date, startDate);
    if (decision === "historical") historical++;
    else if (decision === "follow_up" && (await createFollowUpTicket(admin, data))) ticketsCreated++;
  }
  await enrichReviewReservations(admin);
  return { imported, duplicates, ticketsCreated, historical, startDate };
}

/**
 * Fills reservation context on reviews from their already-matched OwnerRez
 * booking. Read-only upstream; never touches reviewer_display_name, rating,
 * follow-up state or Tickets. Re-running refreshes the same fields.
 */
export async function enrichReviewReservations(admin: Admin, opts: { all?: boolean } = {}) {
  const { ownerRezGet } = await import("./ownerrez.server");
  let q = admin
    .from("guest_feedback")
    .select("id, ownerrez_booking_id")
    .eq("feedback_type", "external_review")
    .eq("source", "ownerrez")
    .eq("is_demo", false)
    .not("ownerrez_booking_id", "is", null);
  if (!opts.all) q = q.is("reservation_enriched_at", null);
  const { data: rows } = await q.limit(2000);
  let enriched = 0;
  const failed: string[] = [];
  for (const r of rows ?? []) {
    if (!/^\d+$/.test(r.ownerrez_booking_id ?? "")) { failed.push(r.id); continue; }
    try {
      const b = await ownerRezGet<OrBooking>(`/bookings/${r.ownerrez_booking_id}`);
      const first = b.guest?.first_name?.trim() || null;
      const last = b.guest?.last_name?.trim() || null;
      const { error } = await admin
        .from("guest_feedback")
        .update({
          stay_start: b.arrival?.slice(0, 10) ?? null,
          stay_end: b.departure?.slice(0, 10) ?? null,
          ...(b.listing_site ? { booking_platform: b.listing_site } : {}),
          ...(b.guest_id == null ? {} : { guest_id: String(b.guest_id) }),
          reservation_confirmation: b.platform_reservation_number ?? null,
          reservation_guest_first_name: first,
          reservation_guest_last_name: last,
          reservation_guest_name: [first, last].filter(Boolean).join(" ") || null,
          reservation_enriched_at: new Date().toISOString(),
        })
        .eq("id", r.id);
      if (error) failed.push(r.id);
      else enriched++;
    } catch {
      failed.push(r.id);
    }
  }
  return { checked: rows?.length ?? 0, enriched, failed };
}

/** Reads OwnerRez reviews for linked homes, newest first, and maps them. */
export async function fetchOwnerRezReviews(admin: Admin, sinceDays = 60): Promise<ReviewInput[]> {
  const { ownerRezGet } = await import("./ownerrez.server");
  type OrReview = {
    id: number; booking_id?: number | null; property_id?: number | null; guest_id?: number | null;
    display_name?: string | null; stars?: number | null; body?: string | null; response?: string | null;
    date?: string | null; listing_site?: string | null; reviewer?: string | null;
  };
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const out: ReviewInput[] = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const data = await ownerRezGet<{ items?: OrReview[] }>("/reviews", { limit: "100", offset: String(offset), since_utc: since });
    const items = data.items ?? [];
    for (const r of items) {
      if (r.reviewer && r.reviewer !== "guest") continue; // host reviews of guests are not guest feedback
      out.push({
        source_review_id: String(r.id),
        listing_site: r.listing_site ?? null,
        ownerrez_property_id: r.property_id == null ? null : String(r.property_id),
        booking_id: r.booking_id == null ? null : String(r.booking_id),
        guest_id: r.guest_id == null ? null : String(r.guest_id),
        guest_name: r.display_name ?? null,
        stars: r.stars ?? null,
        body: r.body ?? null,
        response: r.response ?? null,
        date: r.date ?? null,
        url: null, // OwnerRez does not provide a link to the review itself
      });
    }
    if (items.length < 100) break;
    offset += 100;
  }
  void admin;
  return out;
}

/* ---------------- Review import preview (read-only) ---------------- */

export type ReviewPreviewRow = {
  source_review_id: string;
  platform: string | null;
  rating: number | null;
  ownerrez_property_id: string | null;
  property_id: string | null;
  property_name: string | null;
  booking_id: string | null;
  guest_name: string | null;
  date: string | null;
  outcome: "duplicate" | "historical" | "follow_up" | "no_follow_up" | "unmatched_property";
};

/**
 * Dry run of the review import: reads OwnerRez and Resolve, writes nothing,
 * creates no Tickets. Reports what a real sync would do for each review.
 */
export async function previewReviewImport(admin: Admin, items: ReviewInput[]) {
  const homes = await linkedHomes(admin);
  const startDate = await loadReviewFollowUpStart(admin);
  const ids = items.map((r) => r.source_review_id);
  const existing = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin
      .from("guest_feedback")
      .select("source_review_id")
      .eq("source", "ownerrez")
      .in("source_review_id", ids.slice(i, i + 200));
    for (const r of data ?? []) if (r.source_review_id) existing.add(r.source_review_id);
  }
  const propIds = [...new Set(homes.values())];
  const { data: props } = propIds.length
    ? await admin.from("properties").select("id, name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id").in("id", propIds)
    : { data: [] as { id: string; name: string }[] };
  const names = new Map((props ?? []).map((p) => [p.id, formatPropertyLabel(p).primary] as const));
  const rows: ReviewPreviewRow[] = items.map((r) => {
    const property_id = r.ownerrez_property_id ? homes.get(r.ownerrez_property_id) ?? null : null;
    const rating = r.stars && r.stars >= 1 && r.stars <= 5 ? Math.round(r.stars) : null;
    const outcome: ReviewPreviewRow["outcome"] = existing.has(r.source_review_id)
      ? "duplicate"
      : !property_id
        ? "unmatched_property"
        : reviewImportDecision(rating, r.date, startDate);
    return {
      source_review_id: r.source_review_id,
      platform: r.listing_site,
      rating,
      ownerrez_property_id: r.ownerrez_property_id,
      property_id,
      property_name: property_id ? names.get(property_id) ?? null : null,
      booking_id: r.booking_id,
      guest_name: r.guest_name,
      date: r.date,
      outcome,
    };
  });
  const count = (o: ReviewPreviewRow["outcome"]) => rows.filter((r) => r.outcome === o).length;
  return {
    available: rows.length,
    startDate,
    duplicates: count("duplicate"),
    historical: count("historical"),
    wouldCreateFollowUp: count("follow_up"),
    wouldImportNoFollowUp: count("no_follow_up"),
    unmatchedProperty: count("unmatched_property"),
    noReservation: rows.filter((r) => !r.booking_id).length,
    rows,
  };
}
