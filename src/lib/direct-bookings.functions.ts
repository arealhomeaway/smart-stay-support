/**
 * Direct Bookings server actions. Every write goes through a caller-
 * authenticated database function that checks role and state itself
 * (docs/pending/direct-bookings/). Until that SQL is applied these return
 * `ready: false` and the screens say the page is being set up; the old
 * Leads pages keep working.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  rankHomes,
  readSettings,
  rentFor,
  stepOf,
  STEP_TAG,
  approvalRequired,
  directorMayApprove,
  validateNotBooked,
  SEARCH_DISTANCES,
  isMissingColumn,
  type HomeCandidate,
} from "./direct-bookings";

type Client = SupabaseClient<Database>;
// The staged functions and columns are not in the generated types yet.
type Loose = { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string; code?: string } | null }> };
const loose = (db: Client) => db as unknown as Loose;

function notReady(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error && (isMissingColumn(error) || error.code === "PGRST202" || error.code === "42883" || /Could not find the function/i.test(error.message ?? "")));
}

const NOT_READY = "Direct Bookings is still being set up. Use Leads for now.";

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

const LEAD_FIELDS =
  "id, kind, subject, partner_name, contact_name, company, email, phone, source, source_detail, market, search_region, desired_move_in, desired_check_out, bedrooms, min_bathrooms, guests, dogs, cats, requirements, inquiry_source_id, owned_by, started_at, reply_to, reply_cc, reply_subject, reply_body, offered_property_ids, reply_sent_at, reply_sent_by, reply_sent_via, last_follow_up_at, outcome, outcome_at, booked_property_id, booked_move_in, not_booked_reason, not_booked_note, is_demo, created_at";

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
};

async function names(db: Client, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (!unique.length) return {} as Record<string, string>;
  const { data } = await db.from("profiles").select("id, full_name").in("id", unique);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name ?? "A teammate"]));
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
    const current = await db
      .from("leads")
      .select(LEAD_FIELDS)
      .eq("is_demo", data.demo)
      .eq("kind" as never, "direct_booking" as never)
      .order("created_at", { ascending: false })
      .limit(200);
    if (current.error && notReady(current.error)) {
      return { ready: false as const, requests: [], pending: [] as string[], past: past.data ?? [], names: {} as Record<string, string> };
    }
    if (current.error) throw new Error(current.error.message);
    const rows = (current.data ?? []) as unknown as DirectBookingRow[];
    const approvals = await (db as unknown as Client).from("direct_booking_approvals" as never).select("lead_id").is("decision" as never, null);
    const pending = ((approvals.data ?? []) as { lead_id: string }[]).map((a) => a.lead_id);
    const pastRows = (past.data ?? []).filter((p) => !rows.some((r) => r.id === p.id));
    return {
      ready: true as const,
      requests: rows,
      pending,
      past: pastRows,
      names: await names(db, rows.flatMap((r) => [r.owned_by, r.reply_sent_by])),
    };
  });

export const getDirectBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    await assertStaff(db, context.userId);
    const { data: row, error } = await db.from("leads").select(LEAD_FIELDS).eq("id", data.id).maybeSingle();
    if (error && notReady(error)) return { ready: false as const };
    if (error) throw new Error(error.message);
    if (!row) throw new Error("This request was not found.");
    const lead = row as unknown as DirectBookingRow;
    const settings = await loadSettings(db);
    const { data: approvalRows } = await (db as unknown as Client)
      .from("direct_booking_approvals" as never)
      .select("id, requested_by, requested_at, escalated_at, decision, decided_by, decided_at, decided_as, note")
      .eq("lead_id" as never, data.id as never)
      .order("requested_at" as never, { ascending: false });
    const approvals = (approvalRows ?? []) as unknown as {
      id: string; requested_by: string; requested_at: string; escalated_at: string | null;
      decision: string | null; decided_by: string | null; decided_at: string | null; decided_as: string | null; note: string | null;
    }[];
    const pending = approvals.find((a) => a.decision === null) ?? null;
    const [isSupervisor, isDirector] = await Promise.all([
      holds(db, context.userId, "ops_supervisor"),
      holds(db, context.userId, "director_ops"),
    ]);
    const { data: templates } = await db
      .from("email_templates")
      .select("name, subject, body")
      .in("name", ["Direct booking reply", "Direct booking follow-up"])
      .eq("active", true);
    const source = lead.inquiry_source_id
      ? (await db.from("inquiry_sources").select("id, name, cleaning_fee, application_fee, pet_fee_per_pet, security_deposit").eq("id", lead.inquiry_source_id).maybeSingle()).data
      : null;
    const { data: sources } = await db.from("inquiry_sources").select("id, name").eq("active", true).order("name");
    const ccEmails = await approverEmails(db);
    const { mailboxReadEnabled } = await import("./mailbox.server");
    return {
      ready: true as const,
      lead,
      me: context.userId,
      settings,
      approvalRequiredNow: approvalRequired(settings),
      pending,
      lastSentBack: approvals.find((a) => a.decision === "sent_back") ?? null,
      lastApproved: approvals.find((a) => a.decision === "approved") ?? null,
      canApprove: Boolean(pending) && (isSupervisor || (isDirector && Boolean(pending && (pending.escalated_at || directorMayApprove(pending.requested_at, settings))))),
      isSupervisor,
      isDirector,
      templates: templates ?? [],
      source,
      sources: sources ?? [],
      ccEmails,
      mailboxConnected: mailboxReadEnabled(),
      names: await names(db, [lead.owned_by, lead.reply_sent_by, pending?.requested_by, ...approvals.map((a) => a.decided_by)]),
    };
  });

/** Cc: the people holding the Operations Supervisor and Director of Operations roles. */
async function approverEmails(db: Client) {
  const { data: roles } = await db.from("functional_roles").select("current_seat_holder").in("code", ["ops_supervisor", "director_ops"]);
  const ids = (roles ?? []).map((r) => r.current_seat_holder).filter((v): v is string => Boolean(v));
  if (!ids.length) return [] as string[];
  const { data } = await db.from("profiles").select("email").in("id", ids);
  return (data ?? []).map((p) => p.email).filter((e): e is string => Boolean(e));
}

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
    return result as { won: boolean; owner: string; owner_name: string | null };
  });

export const saveDirectBookingDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => details.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    const { data: lead } = await db.from("leads").select("owned_by" as never).eq("id", data.id).maybeSingle();
    if ((lead as { owned_by?: string } | null)?.owned_by !== context.userId) throw new Error("Press Start to own this request first.");
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
    const { error } = await db.from("leads").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
    const { data: row, error } = await db.from("leads").select(LEAD_FIELDS).eq("id", data.id).maybeSingle();
    if (error || !row) throw new Error(error && notReady(error) ? NOT_READY : "This request was not found.");
    const lead = row as unknown as DirectBookingRow;
    const location = lead.search_region || lead.market;
    if (!location || !lead.desired_move_in || !lead.desired_check_out)
      return { ok: false as const, message: "Add the place and the dates in step 1 first." };
    const settings = await loadSettings(db);
    const source = lead.inquiry_source_id
      ? (await db.from("inquiry_sources").select("name").eq("id", lead.inquiry_source_id).maybeSingle()).data
      : null;
    try {
      const { findAvailableProperties } = await import("./availability-finder.server");
      const found = await findAvailableProperties(db, {
        checkIn: lead.desired_move_in,
        checkOut: lead.desired_check_out,
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
        title: titleOf.get(r.id) ?? r.name,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        maxGuests: r.maxGuests,
        distanceMiles: r.distanceMiles,
        blocked: r.status === "unavailable",
        shortStays: r.strConflicts.length,
        // Pet and party rules already held back homes that do not fit.
        petsOk: true,
        activeOwner: activeOwner.has(r.id),
      })) satisfies (HomeCandidate & Record<string, unknown>)[];
      const ranked = rankHomes(candidates, {
        minBedrooms: lead.bedrooms ?? 0,
        minBathrooms: Number(lead.min_bathrooms ?? 0),
        guests: lead.guests ?? 0,
        preferredBedrooms: lead.bedrooms ?? null,
        distance: data.distance as 5 | 10 | 20,
      });
      return {
        ok: true as const,
        center: found.center,
        homes: ranked.map((h) => {
          const rent = rentFor(h.bedrooms, source?.name ?? null, settings);
          return {
            id: h.id,
            name: h.name,
            address: h.address,
            lat: h.lat,
            lng: h.lng,
            bedrooms: h.bedrooms,
            bathrooms: h.bathrooms,
            distanceMiles: Math.round(h.distanceMiles * 10) / 10,
            tag: STEP_TAG[stepOf(h)],
            shortStays: h.shortStays,
            rent,
          };
        }),
      };
    } catch (err) {
      console.error("Direct booking search failed:", err);
      return { ok: false as const, message: "We could not check calendars. Try again." };
    }
  });

const replyInput = z.object({
  id: z.string().uuid(),
  to: z.string().min(3).max(320),
  cc: z.array(z.string().max(320)).max(10),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(20000),
  propertyIds: z.array(z.string().uuid()).min(1).max(3),
});

async function sendAndRecord(db: Client, userId: string, leadId: string, reply: { to: string; cc: string[]; subject: string; body: string }) {
  const { data: lead } = await db.from("leads").select("is_demo, source_detail").eq("id", leadId).maybeSingle();
  if (!lead) throw new Error("This request was not found.");
  const detail = (lead.source_detail ?? {}) as Record<string, unknown>;
  const { sendDirectBookingEmail } = await import("./direct-bookings-mail.server");
  const outcome = await sendDirectBookingEmail(db, {
    ...reply,
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

/** Sends for approval during the approval period; otherwise sends straight away. */
export const submitDirectBookingReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => replyInput.parse(input))
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    // Homes without a rate cannot be sent.
    const settings = await loadSettings(db);
    const { data: homes } = await db.from("properties").select("id, bedrooms").in("id", data.propertyIds);
    if ((homes ?? []).some((h) => !rentFor(h.bedrooms, null, settings).ok))
      throw new Error("One home has no rate yet. Remove it or ask the Operations Supervisor to set the rate.");
    const reply = { to: data.to, cc: data.cc, subject: data.subject, body: data.body };
    const { data: result, error } = await loose(db).rpc("request_direct_booking_approval", {
      _lead_id: data.id,
      _reply: reply,
      _property_ids: data.propertyIds,
    });
    if (error) throw new Error(notReady(error) ? NOT_READY : error.message);
    if ((result as { approval_required: boolean }).approval_required) return { state: "waiting_approval" as const };
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
    const { data: result, error } = await loose(db).rpc("decide_direct_booking_approval", {
      _lead_id: data.id,
      _decision: data.decision,
      _note: data.note ?? null,
    });
    if (error) throw new Error(notReady(error) ? NOT_READY : error.message);
    if (data.decision === "sent_back") return { state: "sent_back" as const };
    const reply = (result as { reply: { to: string; cc: string[]; subject: string; body: string } }).reply;
    const sent = await sendAndRecord(db, context.userId, data.id, reply);
    return sent.sent ? { state: "sent" as const } : { state: "approved_not_sent" as const, reason: sent.reason, detail: sent.detail };
  });

/** The 2 minute rule, run on the server whenever a request screen is open. */
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
    z.object({ id: z.string().uuid(), to: z.string().min(3), cc: z.array(z.string()).max(10), subject: z.string().min(1), body: z.string().min(1), byHand: z.boolean() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const db = context.supabase;
    if (!data.byHand) {
      const { data: lead } = await db.from("leads").select("is_demo, source_detail").eq("id", data.id).maybeSingle();
      if (!lead) throw new Error("This request was not found.");
      const detail = (lead.source_detail ?? {}) as Record<string, unknown>;
      const { sendDirectBookingEmail } = await import("./direct-bookings-mail.server");
      const sent = await sendDirectBookingEmail(db, {
        to: data.to, cc: data.cc, subject: data.subject, body: data.body, leadId: data.id,
        threadMessageId: typeof detail["message_id"] === "string" ? (detail["message_id"] as string) : null,
        isDemo: lead.is_demo, sentBy: context.userId,
      });
      if (!sent.sent) return { state: "not_sent" as const, detail: sent.detail };
    }
    const { error } = await loose(db).rpc("record_direct_booking_follow_up", { _lead_id: data.id });
    if (error) throw new Error(error.message);
    return { state: "sent" as const };
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
    // Same rule as the database: the Operations Supervisor or Director of Operations role.
    const [supervisor, director] = await Promise.all([
      holds(db, context.userId, "ops_supervisor"),
      holds(db, context.userId, "director_ops"),
    ]);
    return { settings: await loadSettings(db), canEdit: supervisor || director };
  });

export const saveDirectBookingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      approvalStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      approvalEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      requireApprovalAfterEnd: z.boolean(),
      nightlyRates: z.record(z.string(), z.number().positive().max(2000)),
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
    const cols = "id, partner_name, company, subject, created_at, reply_sent_at, outcome, owned_by";
    const { data: rows, error } = await context.supabase
      .from("leads")
      .select(cols as never)
      .eq("is_demo", data.demo)
      .eq("kind" as never, "direct_booking" as never)
      .eq("owned_by" as never, context.userId as never)
      .is("outcome" as never, null)
      .order("created_at", { ascending: true })
      .limit(20);
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
    let waiting: HomeBookingRow[] = [];
    if (alertedIds.length > 0) {
      const { data: open } = await context.supabase
        .from("leads")
        .select(cols as never)
        .eq("is_demo", data.demo)
        .eq("kind" as never, "direct_booking" as never)
        .is("owned_by" as never, null)
        .is("outcome" as never, null)
        .in("id", alertedIds)
        .limit(20);
      waiting = (open ?? []) as unknown as HomeBookingRow[];
    }
    return homeDirectBookings([...((rows ?? []) as unknown as HomeBookingRow[]), ...waiting], alertedIds, context.userId);
  });
