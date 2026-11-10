/**
 * Direct Bookings server actions. Every write goes through a caller-
 * authenticated database function that checks role and state itself
 * (docs/pending/direct-bookings/ and docs/pending/direct-bookings-fix/).
 * The copy list, the Active Owner check and the rate check are enforced here
 * before anything is sent, and repeated by the staged database functions.
 * Until a staged change is applied the screens keep working without the
 * fields it adds.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { formatPropertyLabel } from "@/lib/property-label";
import {
  rankHomes,
  readSettings,
  rentFor,
  stepOf,
  homeTag,
  approvalRequired,
  directorMayApprove,
  validateNotBooked,
  SEARCH_DISTANCES,
  isMissingColumn,
  homeDirectBookings,
  homeStartIds,
  ccRecipients,
  isActiveOwnerHome,
  stayDates,
  centralDate,
  availableFrom,
  looksLikePartnerApproval,
  longDate,
  DB_COPY,
  type HomeBookingRow,
  type HomeCandidate,
  searchFailureMessage,
} from "./direct-bookings";
import { NO_REPLY_WARNING, isNoReplyAddress, portalLinkFrom, portalNote, usableReplyAddress } from "./portal-requests";

type Client = SupabaseClient<Database>;
// The staged functions and columns are not in the generated types yet.
type Loose = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }> };
const loose = (db: Client) => db as unknown as Loose;

function notReady(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (isMissingColumn(error) || error.code === "PGRST202" || error.code === "42883" || /Could not find the function/i.test(error.message ?? "")));
}

const NOT_READY = "Direct Bookings is still being set up. Use Leads for now.";
const STEP_NOT_READY = "This step is still being set up. Ask the Operations Supervisor.";

async function assertStaff(db: Client, userId: string) {
  const { data } = await db.rpc("is_internal_staff", { _user_id: userId });
  if (data !== true) throw new Error("Direct Bookings are for ARHA staff only.");
}

async function holds(db: Client, userId: string, code: string) {
  const { data, error } = await loose(db).rpc("holds_functional_role", { _user_id: userId, _code: code });
  return !error && data === true;
}

async function loadSettings(db: Client) {
  const { data } = await db.from("app_settings").select("value").eq("key", "direct_booking_settings").maybeSingle();
  return readSettings(data?.value);
}

const BASE_FIELDS =
  "id, kind, subject, partner_name, contact_name, company, email, phone, source, source_detail, market, search_region, desired_move_in, desired_check_out, bedrooms, min_bathrooms, guests, dogs, cats, requirements, inquiry_source_id, owned_by, started_at, reply_to, reply_cc, reply_subject, reply_body, offered_property_ids, reply_sent_at, reply_sent_by, reply_sent_via, last_follow_up_at, outcome, outcome_at, booked_property_id, booked_move_in, not_booked_reason, not_booked_note, is_demo, created_at";
/** Added by docs/pending/direct-bookings-fix/01; read only when present. */
const FIX_FIELDS = "asap, stay_length, preferred_bedrooms, near_address, distance_wanted, follow_up_due_at, partner_approved_at, partner_approved_note";
/** Added by docs/pending/direct-bookings-overnight/01; read only when present. */
const NIGHT_FIELDS = "overnight_until, morning_alerted_at";
/** Added by docs/pending/portal-requests/01; read only when present. */
const PORTAL_FIELDS = "portal_link, reply_method, portal_answered_at, portal_answered_by, portal_answer_note";

export type DirectBookingRow = {
  id: string;
  subject: string | null;
  partner_name: string | null;
  contact_name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  source_detail: Record<string, string | number | boolean | null> | null;
  search_region: string | null;
  market: string | null;
  desired_move_in: string | null;
  desired_check_out: string | null;
  bedrooms: number | null;
  min_bathrooms: number | null;
  guests: number | null;
  dogs: number | null;
  cats: number | null;
  requirements: string | null;
  inquiry_source_id: string | null;
  owned_by: string | null;
  started_at: string | null;
  reply_to: string | null;
  reply_cc: string[] | null;
  reply_subject: string | null;
  reply_body: string | null;
  offered_property_ids: string[] | null;
  reply_sent_at: string | null;
  reply_sent_by: string | null;
  reply_sent_via: string | null;
  last_follow_up_at: string | null;
  outcome: string | null;
  outcome_at: string | null;
  booked_property_id: string | null;
  booked_move_in: string | null;
  not_booked_reason: string | null;
  not_booked_note: string | null;
  is_demo: boolean;
  created_at: string;
  asap?: boolean | null;
  stay_length?: string | null;
  preferred_bedrooms?: number | null;
  near_address?: string | null;
  distance_wanted?: string | null;
  follow_up_due_at?: string | null;
  partner_approved_at?: string | null;
  partner_approved_note?: string | null;
  overnight_until?: string | null;
  morning_alerted_at?: string | null;
  portal_link?: string | null;
  reply_method?: "email" | "portal" | null;
  portal_answered_at?: string | null;
  portal_answered_by?: string | null;
  portal_answer_note?: string | null;
};

/** Reads requests with the new fields, or without them while the staged change is not applied. */
async function selectLeads(
  db: Client,
  build: (cols: string) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
) {
  const portal = await build(`${BASE_FIELDS}, ${FIX_FIELDS}, ${NIGHT_FIELDS}, ${PORTAL_FIELDS}`);
  if (!(portal.error && isMissingColumn(portal.error))) return { ...portal, fieldsReady: !portal.error };
  const night = await build(`${BASE_FIELDS}, ${FIX_FIELDS}, ${NIGHT_FIELDS}`);
  if (!(night.error && isMissingColumn(night.error))) return { ...night, fieldsReady: !night.error };
  const full = await build(`${BASE_FIELDS}, ${FIX_FIELDS}`);
  if (full.error && isMissingColumn(full.error)) return { ...(await build(BASE_FIELDS)), fieldsReady: false };
  return { ...full, fieldsReady: !full.error };
}

/**
 * The copy list for every reply and follow-up: the people holding the
 * Operations Supervisor or Director of Operations role, never a COO holder.
 * Nothing typed on screen is used.
 */
async function ccEmails(db: Client) {
  const codes = ["ops_supervisor", "director_ops", "coo"];
  const [{ data: roles }, { data: members }] = await Promise.all([
    db.from("functional_roles").select("code, current_seat_holder, active").in("code", codes),
    db.from("functional_role_members").select("role_code, user_id").in("role_code", codes),
  ]);
  const rolesOf = new Map<string, Set<string>>();
  const add = (user: string | null | undefined, code: string) => {
    if (!user) return;
    if (!rolesOf.has(user)) rolesOf.set(user, new Set());
    rolesOf.get(user)!.add(code);
  };
  for (const r of roles ?? []) if (r.active !== false) add(r.current_seat_holder, r.code);
  for (const m of members ?? []) add(m.user_id, m.role_code);
  if (!rolesOf.size) return [] as string[];
  const { data: people } = await db.from("profiles").select("id, email").in("id", [...rolesOf.keys()]);
  return ccRecipients((people ?? []).map((p) => ({ email: p.email, roles: [...(rolesOf.get(p.id) ?? [])] })));
}

/** Which of these homes are Active Owner homes (in the program, or 7D MAX). Same rule as the search. */
async function activeOwnerIds(db: Client, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const [{ data: homes, error: e1 }, { data: inProgram, error: e2 }] = await Promise.all([
    db.from("properties").select("id, name").in("id", ids),
    db.from("owner_program_properties").select("property_id").in("property_id", ids).is("archived_at", null),
  ]);
  if (e1 || e2) throw new Error("We could not check the homes. Try again.");
  const program = new Set((inProgram ?? []).map((o) => o.property_id));
  return new Set((homes ?? []).filter((h) => isActiveOwnerHome(h.name, program.has(h.id))).map((h) => h.id));
}

async function assertNoActiveOwner(db: Client, ids: string[]) {
  if ((await activeOwnerIds(db, ids)).size) throw new Error(DB_COPY.activeOwnerRefused);
}

// ============= Reads =============

export const listDirectBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ demo: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);
    const past = await db
      .from("leads")
      .select("id, contact_name, company, source, stage, desired_move_in, created_at, lost_reason, converted_at")
      .eq("is_demo", data.demo)
      .order("created_at", { ascending: false })
      .limit(200);
    const current = await selectLeads(db, (cols) =>
      db
        .from("leads")
        .select(cols as never)
        .eq("is_demo", data.demo)
        .eq("kind" as never, "direct_booking" as never)
        .order("created_at", { ascending: false })
        .limit(200),
    );
    const [isSupervisor, isDirector, settings] = await Promise.all([
      holds(db, context.userId, "ops_supervisor"),
      holds(db, context.userId, "director_ops"),
      loadSettings(db),
    ]);
    if (current.error && notReady(current.error)) {
      return { ready: false as const, requests: [], pending: [] as string[], pendingApprovals: [], past: past.data ?? [], isSupervisor, isDirector, settings };
    }
    if (current.error) throw new Error(current.error.message);
    const rows = (current.data ?? []) as unknown as DirectBookingRow[];
    const approvals = await (db as unknown as Client)
      .from("direct_booking_approvals" as never)
      .select("lead_id, requested_at")
      .is("decision" as never, null);
    const pendingApprovals = ((approvals.data ?? []) as { lead_id: string; requested_at: string }[]).filter((a) => rows.some((r) => r.id === a.lead_id));
    // Earlier leads stay readable, under Booked and Not booked.
    const pastRows = (past.data ?? []).filter((p) => !rows.some((r) => r.id === p.id));
    return {
      ready: true as const,
      requests: rows,
      pending: pendingApprovals.map((a) => a.lead_id),
      pendingApprovals,
      past: pastRows,
      isSupervisor,
      isDirector,
      settings,
    };
  });

export const getDirectBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);
    const read = await selectLeads(db, (cols) => db.from("leads").select(cols as never).eq("id", data.id).maybeSingle());
    if (read.error && notReady(read.error)) return { ready: false as const };
    if (read.error) throw new Error(read.error.message);
    if (!read.data) throw new Error("This request was not found.");
    const lead = read.data as unknown as DirectBookingRow;
    // Never show a link whose host is not on the partner list.
    lead.portal_link = portalLinkFrom(lead.portal_link);
    const settings = await loadSettings(db);
    const { data: approvalRows } = await (db as unknown as Client)
      .from("direct_booking_approvals" as never)
      .select("id, requested_by, requested_at, escalated_at, decision, decided_by, decided_at, decided_as, note, reply")
      .eq("lead_id" as never, data.id as never)
      .order("requested_at" as never, { ascending: false });
    const approvals = (approvalRows ?? []) as unknown as {
      id: string; requested_by: string; requested_at: string; escalated_at: string | null;
      decision: string | null; decided_by: string | null; decided_at: string | null; decided_as: string | null; note: string | null;
      reply: { portal?: boolean } | null;
    }[];
    const pending = approvals.find((a) => a.decision === null) ?? null;
    // The latest quote sent for OK was approved (the same test the database uses).
    const latest = approvals[0] ?? null;
    const approvedQuote = Boolean(latest && latest.decision === "approved");
    const [isSupervisor, isDirector, admin] = await Promise.all([
      holds(db, context.userId, "ops_supervisor"),
      holds(db, context.userId, "director_ops"),
      loose(db).rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    const isAdmin = (admin as { data: unknown }).data === true;
    const { data: templates } = await db
      .from("email_templates")
      .select("name, subject, body")
      .in("name", ["Direct booking reply", "Direct booking follow-up"])
      .eq("active", true);
    const source = lead.inquiry_source_id
      ? (await db.from("inquiry_sources").select("id, name, cleaning_fee, application_fee, pet_fee_per_pet, security_deposit").eq("id", lead.inquiry_source_id).maybeSingle()).data
      : null;
    const { data: sources } = await db.from("inquiry_sources").select("id, name").eq("active", true).order("name");
    // The signed-in person's own name, used only to sign the email.
    const { data: me } = await db.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
    const { mailboxReadEnabled } = await import("./mailbox.server");
    // The homes offered in the reply, named the shared way, for "Which home did they book?".
    const offeredIds = lead.offered_property_ids ?? [];
    const { data: offeredRows } = offeredIds.length
      ? await db.from("properties").select("id, name, address_line1, unit, city, state, postal_code").in("id", offeredIds)
      : { data: [] as { id: string }[] };
    const offeredHomes = offeredIds.map((id) => {
      const p = ((offeredRows ?? []) as { id: string }[]).find((r) => r.id === id) ?? null;
      return { id, label: formatPropertyLabel(p as Parameters<typeof formatPropertyLabel>[0]).primary };
    });
    return {
      ready: true as const,
      lead,
      offeredHomes,
      fieldsReady: read.fieldsReady,
      me: context.userId,
      myName: me?.full_name ?? "",
      settings,
      approvalRequiredNow: approvalRequired(settings),
      pending: pending ? { id: pending.id, requested_at: pending.requested_at, escalated_at: pending.escalated_at, portal: pending.reply?.portal === true } : null,
      approvedQuote,
      approvedForPortal: approvedQuote && latest?.reply?.portal === true && !lead.reply_sent_at,
      canCorrectPortal: isSupervisor || isAdmin,
      lastSentBack: (() => {
        const back = approvals.find((a) => a.decision === "sent_back");
        return back ? { note: back.note, decided_at: back.decided_at } : null;
      })(),
      canApprove: Boolean(pending) && (isSupervisor || (isDirector && Boolean(pending && (pending.escalated_at || directorMayApprove(pending.requested_at, settings))))),
      isSupervisor,
      isDirector,
      templates: templates ?? [],
      source,
      sources: sources ?? [],
      mailboxConnected: mailboxReadEnabled(),
      /** Only for "Copy reply" when the mailbox cannot send; the screen shows the two role names. */
      ccEmails: await ccEmails(db),
    };
  });

// ============= Writes =============

const details = z.object({
  partner_name: z.string().max(200).optional(),
  contact_name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  email: z.string().max(320).optional(),
  phone: z.string().max(60).optional(),
  subject: z.string().max(300).optional(),
  location: z.string().max(240).optional(),
  move_in: z.string().max(10).optional(),
  move_out: z.string().max(10).optional(),
  bedrooms: z.number().int().min(0).max(12).nullable().optional(),
  bathrooms: z.number().min(0).max(12).nullable().optional(),
  guests: z.number().int().min(0).max(30).nullable().optional(),
  dogs: z.number().int().min(0).max(10).nullable().optional(),
  cats: z.number().int().min(0).max(10).nullable().optional(),
  requirements: z.string().max(4000).optional(),
  inquiry_source_id: z.string().uuid().nullable().optional(),
});

/** Section 1 fields added by the staged change. */
const extraDetails = z.object({
  asap: z.boolean().nullable().optional(),
  stay_length: z.string().max(60).optional(),
  preferred_bedrooms: z.number().int().min(0).max(12).nullable().optional(),
  near_address: z.string().max(300).optional(),
  distance_wanted: z.string().max(60).optional(),
});

export type DirectBookingDetails = z.infer<typeof details>;

export const createDirectBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => details.parse(input))
  .handler(async ({ context, data }) => {
    const toText = (v: unknown) => (v === null || v === undefined ? "" : String(v));
    const payload = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toText(v)]));
    const { data: id, error } = await loose(context.supabase).rpc("create_direct_booking", { _details: payload });
    if (error) throw new Error(notReady(error) ? NOT_READY : error.message);
    return { id: id as string };
  });

export const startDirectBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await loose(context.supabase).rpc("start_direct_booking", { _lead_id: data.id });
    if (error) throw new Error(notReady(error) ? NOT_READY : error.message);
    // Never pass a person's name to the screen: the owner is "a coordinator".
    const r = result as { won: boolean };
    return { won: r.won };
  });

export const saveDirectBookingDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => details.merge(extraDetails).extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    const { data: lead } = await db.from("leads").select("owned_by" as never).eq("id", data.id).maybeSingle();
    if ((lead as { owned_by?: string } | null)?.owned_by !== context.userId) throw new Error("Press Start the quote to own this request first.");
    const patch: Record<string, unknown> = {
      partner_name: data.partner_name || null,
      contact_name: data.contact_name || null,
      company: data.company || null,
      email: data.email || null,
      phone: data.phone || null,
      search_region: data.location || null,
      market: data.location || null,
      desired_move_in: data.move_in || null,
      desired_check_out: data.move_out || null,
      bedrooms: data.bedrooms ?? null,
      min_bathrooms: data.bathrooms ?? null,
      guests: data.guests ?? null,
      dogs: data.dogs ?? 0,
      cats: data.cats ?? 0,
      requirements: data.requirements || null,
      inquiry_source_id: data.inquiry_source_id ?? null,
    };
    const extra: Record<string, unknown> = {
      asap: data.asap ?? null,
      stay_length: data.stay_length || null,
      preferred_bedrooms: data.preferred_bedrooms ?? null,
      near_address: data.near_address || null,
      distance_wanted: data.distance_wanted || null,
    };
    let { error } = await db.from("leads").update({ ...patch, ...extra } as never).eq("id", data.id);
    let extraSaved = true;
    if (error && isMissingColumn(error)) {
      extraSaved = false;
      ({ error } = await db.from("leads").update(patch as never).eq("id", data.id));
    }
    if (error) throw new Error(error.message);
    return { ok: true, extraSaved };
  });

export const searchDirectBookingHomes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      distance: z.number().refine((d) => (SEARCH_DISTANCES as readonly number[]).includes(d)),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);
    const read = await selectLeads(db, (cols) => db.from("leads").select(cols as never).eq("id", data.id).maybeSingle());
    if (read.error || !read.data) throw new Error(read.error && notReady(read.error) ? NOT_READY : "This request was not found.");
    const lead = read.data as unknown as DirectBookingRow;
    const nearAddress = lead.near_address?.trim() || null;
    const location = nearAddress || lead.search_region || lead.market;
    const today = centralDate(new Date());
    const { checkIn, checkOut } = stayDates(lead, today);
    if (!location || !checkIn || !checkOut)
      return { ok: false as const, message: "Add the place and the dates (or as soon as possible and the length of stay) in step 1 first." };
    const settings = await loadSettings(db);
    try {
      const { findAvailableProperties } = await import("./availability-finder.server");
      const found = await findAvailableProperties(db, {
        checkIn,
        checkOut,
        location,
        dogs: lead.dogs ?? 0,
        cats: lead.cats ?? 0,
        guests: lead.guests ?? 0,
      });
      const ids = found.results.map((r) => r.id);
      const [titles, owners] = await Promise.all([
        ids.length ? db.from("properties").select("id, name").in("id", ids) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        ids.length
          ? db.from("owner_program_properties").select("property_id").in("property_id", ids).is("archived_at", null)
          : Promise.resolve({ data: [] as { property_id: string }[] }),
      ]);
      const titleOf = new Map((titles.data ?? []).map((t) => [t.id, t.name ?? ""]));
      const activeOwner = new Set((owners.data ?? []).map((o) => o.property_id));
      const candidates = found.results.map((r) => ({
        id: r.id,
        name: r.name,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        imageUrl: r.imageUrl,
        bookingUrl: r.bookingUrl,
        strConflicts: r.strConflicts,
        title: titleOf.get(r.id) ?? r.name,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        maxGuests: r.maxGuests,
        distanceMiles: r.distanceMiles,
        blocked: r.status === "unavailable",
        shortStays: r.strConflicts.length,
        // Pet and party rules already held back homes that do not fit.
        petsOk: true,
        activeOwner: isActiveOwnerHome(titleOf.get(r.id) ?? r.name, activeOwner.has(r.id)),
      })) satisfies (HomeCandidate & Record<string, unknown>)[];
      const ranked = rankHomes(candidates, {
        minBedrooms: lead.bedrooms ?? 0,
        minBathrooms: Number(lead.min_bathrooms ?? 0),
        guests: lead.guests ?? 0,
        preferredBedrooms: lead.preferred_bedrooms ?? lead.bedrooms ?? null,
        distance: data.distance as 5 | 10 | 20,
      });
      return {
        ok: true as const,
        center: found.center,
        checkedAt: new Date().toISOString(),
        checkIn,
        asapStart: Boolean(lead.asap && !lead.desired_move_in),
        addressGiven: Boolean(nearAddress),
        homes: ranked.map((h) => {
          const rent = rentFor(h.bedrooms, lead.inquiry_source_id, settings);
          const step = stepOf(h);
          const freeFrom = availableFrom(checkIn, h.strConflicts);
          const asapStart = Boolean(lead.asap && !lead.desired_move_in);
          return {
            availability: asapStart && freeFrom === checkIn ? "As soon as possible" : longDate(freeFrom),
            id: h.id,
            name: h.name,
            address: h.address,
            link: h.bookingUrl,
            lat: h.lat,
            lng: h.lng,
            photo: h.imageUrl ?? null,
            bedrooms: h.bedrooms,
            bathrooms: h.bathrooms,
            distanceMiles: Math.round(h.distanceMiles * 10) / 10,
            tag: homeTag(step, h.shortStays, freeFrom),
            shortStays: h.shortStays,
            freeFrom,
            rent,
          };
        }),
      };
    } catch (err) {
      console.error("Direct booking search failed:", err);
      return { ok: false as const, message: searchFailureMessage(err) };
    }
  });

const replyInput = z.object({
  id: z.string().uuid(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  propertyIds: z.array(z.string().uuid()).min(1).max(3),
  /** An address typed on the reply step, used instead of a no reply sender. */
  to: z.string().max(320).optional(),
  /** Sent for OK so it can be answered in the partner's portal: nothing is emailed. */
  portal: z.boolean().optional(),
});

type Reply = { to: string; cc: string[]; subject: string; body: string };

/** Sends one email. The copy list always comes from the two roles, whatever the caller passed. */
async function sendAndRecord(db: Client, userId: string, leadId: string, reply: Omit<Reply, "cc">) {
  // A no reply sender is never a reply address, whatever the screen did.
  if (isNoReplyAddress(reply.to)) throw new Error(NO_REPLY_WARNING);
  const { data: lead } = await db.from("leads").select("is_demo, source_detail").eq("id", leadId).maybeSingle();
  if (!lead) throw new Error("This request was not found.");
  const detail = (lead.source_detail ?? {}) as Record<string, unknown>;
  const { sendDirectBookingEmail } = await import("./direct-bookings-mail.server");
  const outcome = await sendDirectBookingEmail(db, {
    ...reply,
    cc: await ccEmails(db),
    leadId,
    threadMessageId: typeof detail["message_id"] === "string" ? (detail["message_id"] as string) : null,
    isDemo: lead.is_demo,
    sentBy: userId,
  });
  if (!outcome.sent) return outcome;
  const { error } = await loose(db).rpc("record_direct_booking_reply", { _lead_id: leadId, _via: "mailbox" });
  if (error) throw new Error(error.message);
  return outcome;
}

/** Sends to a supervisor for OK during the approval period; otherwise sends straight away. */
export const submitDirectBookingReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => replyInput.parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    const { data: lead } = await db.from("leads").select("email, inquiry_source_id").eq("id", data.id).maybeSingle();
    if (!lead) throw new Error("This request was not found.");
    const typed = data.to?.trim() ? usableReplyAddress(data.to) : null;
    if (data.to?.trim() && !typed) throw new Error(isNoReplyAddress(data.to) ? NO_REPLY_WARNING : "Type a full email address.");
    const to = typed ?? lead.email?.trim() ?? "";
    if (!data.portal) {
      if (!to) throw new Error("Add their email in step 1 first.");
      // A no reply sender is never a reply address.
      if (isNoReplyAddress(to)) throw new Error(NO_REPLY_WARNING);
    }
    // Active Owner homes can never be sent, even if picked earlier.
    await assertNoActiveOwner(db, data.propertyIds);
    // Homes without a rate cannot be sent.
    const settings = await loadSettings(db);
    const { data: homes } = await db.from("properties").select("id, bedrooms").in("id", data.propertyIds);
    if ((homes ?? []).some((h) => !rentFor(h.bedrooms, lead.inquiry_source_id, settings).ok))
      throw new Error("One home has no rate yet. Remove it or ask the Operations Supervisor to set the rate.");
    const reply: Reply = { to, cc: await ccEmails(db), subject: data.subject, body: data.body };
    const { data: result, error } = await loose(db).rpc("request_direct_booking_approval", {
      _lead_id: data.id,
      _reply: data.portal ? { ...reply, portal: true } : reply,
      _property_ids: data.propertyIds,
    });
    if (error) throw new Error(notReady(error) ? NOT_READY : error.message);
    if ((result as { approval_required: boolean }).approval_required) return { state: "waiting_approval" as const };
    // A portal answer outside the approval period needs no OK and sends nothing.
    if (data.portal) return { state: "no_ok_needed" as const };
    const sent = await sendAndRecord(db, context.userId, data.id, reply);
    return sent.sent ? { state: "sent" as const } : { state: "not_sent" as const, reason: sent.reason, detail: sent.detail };
  });

export const decideDirectBookingApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approved", "sent_back"]), note: z.string().max(1000).optional() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    if (data.decision === "approved") {
      const { data: waiting } = await (db as unknown as Client)
        .from("direct_booking_approvals" as never)
        .select("property_ids")
        .eq("lead_id" as never, data.id as never)
        .is("decision" as never, null)
        .maybeSingle();
      await assertNoActiveOwner(db, ((waiting as { property_ids?: string[] } | null)?.property_ids ?? []) as string[]);
    }
    const { data: result, error } = await loose(db).rpc("decide_direct_booking_approval", {
      _lead_id: data.id,
      _decision: data.decision,
      _note: data.note ?? null,
    });
    if (error) throw new Error(notReady(error) ? NOT_READY : error.message);
    if (data.decision === "sent_back") return { state: "sent_back" as const };
    const reply = (result as { reply: Reply & { portal?: boolean } }).reply;
    // Approved for the partner's portal (or to a no reply sender): nothing is emailed;
    // the coordinator answers in the portal and records it.
    if (reply.portal === true || isNoReplyAddress(reply.to)) return { state: "approved_for_portal" as const };
    const sent = await sendAndRecord(db, context.userId, data.id, { to: reply.to, subject: reply.subject, body: reply.body });
    return sent.sent ? { state: "sent" as const } : { state: "approved_not_sent" as const, reason: sent.reason, detail: sent.detail };
  });

/**
 * The 2 minute rule, also checked while a request screen is open. The staged
 * schedule (docs/pending/direct-bookings-fix/03) runs the same check on the
 * server every 20 seconds, so it no longer depends on an open screen.
 */
export const checkDirectBookingApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await loose(context.supabase).rpc("escalate_direct_booking_approvals");
    if (error) return { escalated: 0 };
    return { escalated: Number(data ?? 0) };
  });

/** Mailbox not connected: the coordinator sent from Outlook and says so. */
export const markDirectBookingSentByHand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await loose(context.supabase).rpc("record_direct_booking_reply", { _lead_id: data.id, _via: "manual" });
    if (error) throw new Error(notReady(error) ? NOT_READY : error.message);
    return { ok: true };
  });

export const sendDirectBookingFollowUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), body: z.string().min(1).max(20000), byHand: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    if (!data.byHand) {
      const { data: lead } = await db.from("leads").select("is_demo, source_detail, email, reply_to, reply_subject" as never).eq("id", data.id).maybeSingle();
      const l = lead as { is_demo: boolean; source_detail: Record<string, unknown> | null; email: string | null; reply_to: string | null; reply_subject: string | null } | null;
      if (!l) throw new Error("This request was not found.");
      const to = (l.reply_to || l.email || "").trim();
      if (!to) throw new Error("Add their email in step 1 first.");
      // A no reply sender is never a reply address.
      if (isNoReplyAddress(to)) throw new Error(NO_REPLY_WARNING);
      const detail = l.source_detail ?? {};
      const { sendDirectBookingEmail } = await import("./direct-bookings-mail.server");
      const sent = await sendDirectBookingEmail(db, {
        to, cc: await ccEmails(db), subject: `RE: ${(l.reply_subject ?? "").replace(/^re:\s*/i, "")}`, body: data.body, leadId: data.id,
        threadMessageId: typeof detail["message_id"] === "string" ? (detail["message_id"] as string) : null,
        isDemo: l.is_demo, sentBy: context.userId,
      });
      if (!sent.sent) return { state: "not_sent" as const, detail: sent.detail };
    }
    const { error } = await loose(db).rpc("record_direct_booking_follow_up", { _lead_id: data.id });
    if (error) throw new Error(error.message);
    return { state: "sent" as const };
  });

/**
 * "I answered in the partner's portal". The database stops the clock at the
 * press time, as for a sent reply, moves the request to Quote sent and sets the
 * 48 hour follow up; during the approval period only after the quote is OK.
 */
export const answerDirectBookingInPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      note: z.string().max(400),
      subject: z.string().max(300).optional(),
      body: z.string().max(20000).optional(),
      propertyIds: z.array(z.string().uuid()).max(3).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);
    const note = portalNote(data.note);
    if (!note) throw new Error("Add a short note, for example the portal quote number.");
    const ids = data.propertyIds ?? [];
    if (ids.length) {
      // The same home checks as an emailed reply.
      await assertNoActiveOwner(db, ids);
      const { data: lead } = await db.from("leads").select("inquiry_source_id").eq("id", data.id).maybeSingle();
      const settings = await loadSettings(db);
      const { data: homes } = await db.from("properties").select("id, bedrooms").in("id", ids);
      if ((homes ?? []).some((h) => !rentFor(h.bedrooms, lead?.inquiry_source_id ?? null, settings).ok))
        throw new Error("One home has no rate yet. Remove it or ask the Operations Supervisor to set the rate.");
    }
    const { data: at, error } = await loose(db).rpc("answer_direct_booking_in_portal", {
      _lead_id: data.id,
      _note: note,
      _reply: data.subject || data.body ? { subject: data.subject ?? null, body: data.body ?? null } : null,
      _property_ids: ids.length ? ids : null,
    });
    if (error) throw new Error(notReady(error) ? STEP_NOT_READY : error.message);
    return { answeredAt: at as string };
  });

/** The Operations Supervisor or an Admin corrects a portal answer, with a reason. */
export const correctDirectBookingPortalAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), reason: z.string().max(500) }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await loose(context.supabase).rpc("correct_direct_booking_portal_answer", { _lead_id: data.id, _reason: data.reason });
    if (error) throw new Error(notReady(error) ? STEP_NOT_READY : error.message);
    return { ok: true };
  });

/** The coordinator confirms the partner approved the quote: the request moves to Approved. */
export const markDirectBookingPartnerApproved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), note: z.string().max(1000).optional() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await loose(context.supabase).rpc("mark_direct_booking_partner_approved", { _lead_id: data.id, _note: data.note ?? null });
    if (error) throw new Error(notReady(error) ? STEP_NOT_READY : error.message);
    return { ok: true };
  });

/**
 * Reads the partner's replies in the same email thread and says whether one
 * sounds like an approval. Read only; nothing is saved until a coordinator
 * confirms. Without the mailbox it simply finds nothing.
 */
export const checkDirectBookingPartnerReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const none = { suggest: false as const };
    const db = context.supabase;
    await assertStaff(db, context.userId);
    const { mailboxReadEnabled, mailboxGraph } = await import("./mailbox.server");
    if (!mailboxReadEnabled()) return none;
    const { data: lead } = await db.from("leads").select("source_detail, reply_sent_at, outcome").eq("id", data.id).maybeSingle();
    const conversation = (lead?.source_detail as Record<string, unknown> | null)?.["conversation_id"];
    if (!lead?.reply_sent_at || lead.outcome || typeof conversation !== "string" || !conversation) return none;
    try {
      const { mailboxMessagesPath, authorizedMailbox } = await import("./mailbox-allowlist.server");
      const filter = encodeURIComponent(`conversationId eq '${conversation.replace(/'/g, "''")}'`);
      const res = await mailboxGraph(mailboxMessagesPath(`?$filter=${filter}&$select=from,receivedDateTime,bodyPreview&$top=25`));
      const body = (await res.json()) as { value?: { from?: { emailAddress?: { address?: string | null } }; receivedDateTime?: string; bodyPreview?: string }[] };
      const ours = authorizedMailbox().toLowerCase();
      const replies = (body.value ?? [])
        .filter((m) => (m.receivedDateTime ?? "") > lead.reply_sent_at!)
        .filter((m) => (m.from?.emailAddress?.address ?? "").toLowerCase() !== ours)
        .sort((a, b) => (b.receivedDateTime ?? "").localeCompare(a.receivedDateTime ?? ""));
      const hit = replies.find((m) => looksLikePartnerApproval(m.bodyPreview));
      return hit ? { suggest: true as const, excerpt: (hit.bodyPreview ?? "").slice(0, 400) } : none;
    } catch (err) {
      console.error("Direct booking partner reply check failed:", err instanceof Error ? err.message : err);
      return none;
    }
  });

export const markDirectBookingOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid(),
      outcome: z.enum(["booked", "not_booked"]),
      propertyId: z.string().uuid().nullable().optional(),
      moveIn: z.string().max(10).nullable().optional(),
      reason: z.string().max(60).optional(),
      note: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    if (data.outcome === "not_booked") {
      const problem = validateNotBooked(data.reason ?? "", data.note ?? "");
      if (problem) throw new Error(problem);
    }
    const { error } = await loose(context.supabase).rpc("mark_direct_booking_outcome", {
      _lead_id: data.id,
      _outcome: data.outcome,
      _property_id: data.propertyId ?? null,
      _move_in: data.moveIn || null,
      _reason: data.reason ?? null,
      _note: data.note ?? null,
    });
    if (error) throw new Error(notReady(error) ? NOT_READY : error.message);
    return { ok: true };
  });

// ============= Settings =============

export const getDirectBookingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);
    // Same rule as the database: the Operations Supervisor or Director of
    // Operations role, or Admin. Approving a quote is a separate rule.
    const [supervisor, director, admin] = await Promise.all([
      holds(db, context.userId, "ops_supervisor"),
      holds(db, context.userId, "director_ops"),
      loose(db).rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    return { settings: await loadSettings(db), canEdit: supervisor || director || (admin as { data: unknown }).data === true };
  });

export const saveDirectBookingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      approvalStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      approvalEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      requireApprovalAfterEnd: z.boolean(),
      nightlyRates: z.record(z.string(), z.number().positive().max(2000)),
      overnightClockStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time.").optional(),
    }).refine((v) => v.approvalEnd >= v.approvalStart, "The end date must be after the start date.").parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    const current = await loadSettings(db);
    const { error } = await loose(db).rpc("save_direct_booking_settings", { _value: { ...current, ...data } });
    if (error) throw new Error(notReady(error) ? NOT_READY : error.message);
    return { ok: true };
  });

// ============= Home: Needs you now =============

export const myDirectBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ demo: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const base = "id, partner_name, company, subject, created_at, reply_sent_at, outcome, owned_by, last_follow_up_at";
    const withDue = `${base}, follow_up_due_at, partner_approved_at`;
    const withNight = `${withDue}, overnight_until`;
    const owned = (cols: string) =>
      context.supabase
        .from("leads")
        .select(cols as never)
        .eq("is_demo", data.demo)
        .eq("kind" as never, "direct_booking" as never)
        .eq("owned_by" as never, context.userId as never)
        .is("outcome" as never, null)
        .order("created_at", { ascending: true })
        .limit(50);
    let cols = withNight;
    let { data: rows, error } = await owned(cols);
    if (error && isMissingColumn(error)) {
      cols = withDue;
      ({ data: rows, error } = await owned(cols));
    }
    if (error && isMissingColumn(error)) {
      cols = base;
      ({ data: rows, error } = await owned(cols));
    }
    if (error) return [];
    // Requests nobody has started yet that alerted this person (the database
    // chose who to alert by who is on shift; one alert row per person).
    const { data: alerts } = await context.supabase
      .from("staff_notifications")
      .select("entity_id")
      .eq("user_id", context.userId)
      .eq("kind", "direct_booking_new")
      .eq("entity_type", "lead")
      .order("created_at", { ascending: false })
      .limit(50);
    const alertedIds = ((alerts ?? []) as { entity_id: string | null }[])
      .map((a) => a.entity_id)
      .filter((id): id is string => !!id);
    // Also every unstarted request while this person is someone a new request would alert
    // right now (the routing rule in the database). Before that step is applied the
    // question is missing and only the people alerted see it, as before.
    const eligible = await loose(context.supabase).rpc("direct_booking_eligible_now", {});
    const eligibleNow = !eligible.error && eligible.data === true;
    const unstarted = () =>
      context.supabase
        .from("leads")
        .select(cols as never)
        .eq("is_demo", data.demo)
        .eq("kind" as never, "direct_booking" as never)
        .is("owned_by" as never, null)
        .is("outcome" as never, null);
    let waiting: HomeBookingRow[] = [];
    if (eligibleNow) {
      const { data: open } = await unstarted().order("created_at", { ascending: true }).limit(20);
      waiting = (open ?? []) as unknown as HomeBookingRow[];
    }
    const missing = alertedIds.filter((id) => !waiting.some((w) => w.id === id));
    if (missing.length > 0) {
      const { data: open } = await unstarted().in("id", missing).limit(20);
      waiting = [...waiting, ...((open ?? []) as unknown as HomeBookingRow[])];
    }
    const visibleIds = homeStartIds(alertedIds, eligibleNow, waiting.map((w) => w.id));
    const overnightStart = (await loadSettings(context.supabase)).overnightClockStart;
    return homeDirectBookings([...((rows ?? []) as unknown as HomeBookingRow[]), ...waiting], visibleIds, context.userId)
      .map((r) => ({ ...r, overnight_clock_start: overnightStart }));
  });
