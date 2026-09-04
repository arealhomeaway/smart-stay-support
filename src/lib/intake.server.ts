/**
 * Email / webhook intake (server-only).
 *
 * OwnerRez does not expose maintenance tasks through its API, so work that
 * originates outside Resolve arrives as a message instead: an OwnerRez
 * notification email, an owner or guest email forwarded by a coordinator, or a
 * webhook from any other tool. This turns that message into a draft ticket,
 * linked to a home when the text names one, so nothing gets lost in an inbox.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export type IntakePayload = {
  subject: string;
  body: string;
  from?: string | null | undefined;
  property?: string | null | undefined;
  source?: string | null | undefined;
  externalId?: string | null | undefined;
  externalUrl?: string | null | undefined;
};

export type IntakeResult = {
  ok: true;
  ticketId: string;
  ref: number;
  propertyMatched: boolean;
  priority: "p1" | "p2" | "p3";
  /** True when the message was filed as a reply on an existing ticket. */
  threaded?: boolean;
};

/** Every outbound ticket email carries [ARHA-123] so replies come back here. */
export const REF_TAG = /\[ARHA-(\d+)\]/i;
export function refTag(ref: number) {
  return `[ARHA-${ref}]`;
}

const P1 =
  /(fire|smoke|carbon monoxide|co alarm|gas|flood|flooding|active leak|no heat|no ac|no a\/c|no power|lockout|locked out|break-?in|injur|emergenc|urgent)/i;
const P2 =
  /(leak|water|hvac|heat|air condition|no hot water|toilet|clog|backed up|pest|roach|bed bug|broken|not working|guest complain)/i;

function guessPriority(text: string): "p1" | "p2" | "p3" {
  if (P1.test(text)) return "p1";
  if (P2.test(text)) return "p2";
  return "p3";
}

function guessCategory(text: string) {
  const s = text.toLowerCase();
  if (/(smoke|carbon|detector|alarm|security|gas)/.test(s)) return "safety";
  if (/(clean|turnover|linen|laundry|trash)/.test(s)) return "cleaning";
  if (/(lock|code|key|access)/.test(s)) return "access";
  if (/(inspect|walkthrough|quality)/.test(s)) return "quality";
  return "maintenance";
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Finds the home whose name or nickname appears in the message text. */
async function matchProperty(db: Db, hints: string) {
  const haystack = normalize(hints);
  const { data } = await db.from("properties").select("id, name, nickname").eq("active", true);
  let best: { id: string; score: number } | null = null;
  for (const row of data ?? []) {
    for (const label of [row.name, row.nickname]) {
      if (!label) continue;
      const needle = normalize(label);
      if (needle.length < 4) continue;
      if (haystack.includes(needle) && (!best || needle.length > best.score)) {
        best = { id: row.id, score: needle.length };
      }
    }
  }
  return best?.id ?? null;
}

export async function createIntakeMatter(db: Db, payload: IntakePayload): Promise<IntakeResult> {
  const subject = payload.subject.trim().slice(0, 200) || "Inbound request";
  const body = payload.body.trim();
  const source = (payload.source ?? "email").trim().toLowerCase().slice(0, 40);
  const combined = `${subject}\n${body}\n${payload.property ?? ""}`;

  // A reply to one of our own emails keeps the [ARHA-123] tag: file it on that
  // ticket's timeline instead of opening a duplicate.
  const tagged = subject.match(REF_TAG) ?? body.match(REF_TAG);
  if (tagged) {
    const { data: parent } = await db
      .from("tickets")
      .select("id, ref, property_id, priority")
      .eq("ref", Number(tagged[1]))
      .maybeSingle();
    if (parent) {
      await db.from("ticket_activity").insert({
        ticket_id: parent.id,
        kind: "note",
        event_type: "note",
        channel: source,
        body: [payload.from ? `Reply from ${payload.from}:` : "Emailed reply:", body || subject]
          .filter(Boolean)
          .join("\n\n"),
      });
      return {
        ok: true,
        ticketId: parent.id,
        ref: parent.ref,
        propertyMatched: Boolean(parent.property_id),
        priority: (parent.priority as IntakeResult["priority"]) ?? "p3",
        threaded: true,
      };
    }
  }

  // Don't create the same ticket twice when a webhook retries.
  if (payload.externalId) {
    const { data: existing } = await db
      .from("tickets")
      .select("id, ref, property_id, priority")
      .eq("external_source", source)
      .eq("external_id", payload.externalId)
      .maybeSingle();
    if (existing) {
      return {
        ok: true,
        ticketId: existing.id,
        ref: existing.ref,
        propertyMatched: Boolean(existing.property_id),
        priority: (existing.priority as IntakeResult["priority"]) ?? "p3",
      };
    }
  }

  const propertyId = await matchProperty(db, `${payload.property ?? ""} ${combined}`);
  const priority = guessPriority(combined);
  const now = new Date().toISOString();

  const { data: inserted, error } = await db
    .from("tickets")
    .insert({
      record_type: "active_task",
      title: subject,
      description:
        [payload.from ? `From: ${payload.from}` : null, body].filter(Boolean).join("\n\n") || null,
      property_id: propertyId,
      category: guessCategory(combined),
      priority,
      suggested_priority: priority,
      status: "open",
      guest_impact: "none",
      occupancy_status: "unknown",
      source_channel: source === "email" ? "email" : source,
      initiator_type: "external",
      source_reference: payload.externalId ?? payload.from ?? null,
      external_source: source,
      external_id: payload.externalId ?? null,
      external_status: "new",
      external_url: payload.externalUrl ?? null,
      external_synced_at: now,
      reported_at: now,
    })
    .select("id, ref")
    .single();

  if (error) throw new Error(error.message);

  // Freeze the OwnerRez stay context for emailed-in work too. Best effort:
  // OwnerRez remains authoritative and intake must not fail on its account.
  try {
    const { applyReservationSnapshot } = await import("./reservation-snapshot.server");
    await applyReservationSnapshot(db, inserted.id);
  } catch {
    /* ignore */
  }

  await db.from("ticket_activity").insert({
    ticket_id: inserted.id,
    kind: "created",
    event_type: "created",
    channel: source,
    body: `Created from an inbound ${source} message${payload.from ? ` from ${payload.from}` : ""}.${
      propertyId ? "" : " No home was recognised — link the property to complete the record."
    }`,
  });

  return {
    ok: true,
    ticketId: inserted.id,
    ref: inserted.ref,
    propertyMatched: Boolean(propertyId),
    priority,
  };
}
