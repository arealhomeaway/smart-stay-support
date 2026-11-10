import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  TOUCH_BASE_CANCEL_NOTE,
  TOUCH_BASE_START_DATE,
  addDays,
  centralDate,
  isCancelledBooking,

  touchBaseDueAt,
  touchBaseDueToCreate,
  touchBaseEventKey,
  touchBaseSyncDue,
  type TouchBaseBooking,
} from "./guest-touch-base";
import { arrivalIngestRow, type SyncBooking } from "./arrival-check";
import type { Json } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;
export const TOUCH_BASE_SYSTEM = "ownerrez_bookings";
export const TOUCH_BASE_OPERATION = "guest_touch_base_sync";

type Booking = TouchBaseBooking & { property_id: number; guest_id?: number; guest_name?: string; listing_site?: string | null };

/** Read-only fetch of OwnerRez bookings for mapped homes in a date window. */
export async function fetchBookingsWindow(ownerRezIds: string[], from: string, to: string): Promise<Booking[]> {
  const { ownerRezGet } = await import("./ownerrez.server");
  const out: Booking[] = [];
  // OwnerRez only accepts whole-number listing IDs; anything else cannot be a listing.
  ownerRezIds = ownerRezIds.filter((id) => /^\d{1,9}$/.test(id));
  for (let i = 0; i < ownerRezIds.length; i += 25) {
    const ids = ownerRezIds.slice(i, i + 25).join(",");
    let offset = 0;
    for (let page = 0; page < 20; page++) {
      const data = await ownerRezGet<{ items?: Booking[] }>("/bookings", {
        property_ids: ids,
        from,
        to,
        limit: "100",
        offset: String(offset),
        include_guest: "true",
      });
      const items = data.items ?? [];
      out.push(...items);
      if (items.length < 100) break;
      offset += 100;
    }
  }
  return out;
}

/**
 * Build 12 (register BN10): the same bookings this sync already fetched are stored for the
 * arrival check, guest first name only. No new OwnerRez call. A failure is recorded for
 * Integrations and never stops the touch base sync.
 */
async function storeArrivalBookings(admin: Admin, bookings: Booking[]) {
  try {
    const rows = bookings.map((b) => arrivalIngestRow(b as unknown as SyncBooking));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin.rpc("arrival_ingest_bookings", { _bookings: rows.slice(i, i + 200) as unknown as Json });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    await admin.from("integration_events").insert({
      system: "arrival_checks",
      direction: "inbound",
      operation: "store_bookings",
      status: "failed",
      error_message: e instanceof Error ? e.message.slice(0, 300) : "The bookings could not be stored.",
    });
  }
}

async function mappedHomes(admin: Admin) {
  const { data } = await admin
    .from("properties")
    .select("id, ownerrez_property_id, is_demo")
    .not("ownerrez_property_id", "is", null);
  return new Map((data ?? []).map((p) => [String(p.ownerrez_property_id), p] as const));
}

/**
 * Creates one Guest Touch Base per qualifying stay on day 2 and closes open
 * ones whose reservation was cancelled. Reads OwnerRez only; never contacts
 * guests and never writes to OwnerRez, Breezeway or Notion. Duplicates are
 * impossible: routine_controls has a unique (kind, event_key) key.
 */
export async function runGuestTouchBaseSync(admin: Admin, now = new Date()) {
  const { data: recent } = await admin
    .from("integration_events")
    .select("created_at")
    .eq("system", TOUCH_BASE_SYSTEM)
    .eq("operation", TOUCH_BASE_OPERATION)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!touchBaseSyncDue(now, recent?.[0]?.created_at ?? null)) return { skipped: true };

  const { data: run } = await admin
    .from("integration_events")
    .insert({ system: TOUCH_BASE_SYSTEM, direction: "inbound", operation: TOUCH_BASE_OPERATION, status: "processing", request_payload: {} })
    .select("id")
    .single();

  try {
    const homes = await mappedHomes(admin);
    const today = centralDate(now);
    // Look back far enough to catch any missed day 2 while the guest is still there.
    const fromCandidate = addDays(today, -30);
    const from = fromCandidate < TOUCH_BASE_START_DATE ? TOUCH_BASE_START_DATE : fromCandidate;
    const bookings = today < TOUCH_BASE_START_DATE ? [] : await fetchBookingsWindow([...homes.keys()], from, addDays(today, 1));
    await storeArrivalBookings(admin, bookings);

    let created = 0;
    for (const b of bookings) {
      const home = homes.get(String(b.property_id));
      if (!home || String(b.property_id) === "undefined") continue;
      if (!touchBaseDueToCreate(b, now)) continue;
      const { data, error } = await admin
        .from("routine_controls")
        .upsert(
          {
            kind: "guest_touch_base",
            event_key: touchBaseEventKey(b.id),
            property_id: home.id,
            status: "due",
            title: "Guest touch base" + (b.guest_name ? `: ${b.guest_name}` : ""),
            guest_name: b.guest_name ?? null,
            reservation_confirmation: String(b.id),
            reservation_channel: b.listing_site ?? null,
            stay_arrival: b.arrival.slice(0, 10),
            stay_departure: b.departure.slice(0, 10),
            due_at: touchBaseDueAt(b.arrival).toISOString(),
            team: "guest_experience",
            is_demo: home.is_demo ?? false,
          },
          { onConflict: "kind,event_key", ignoreDuplicates: true },
        )
        .select("id");
      if (error) throw new Error(error.message);
      created += data?.length ?? 0;
    }

    // Close open auto-created touch bases whose reservation was cancelled.
    const { data: open } = await admin
      .from("routine_controls")
      .select("id, event_key, notes")
      .eq("kind", "guest_touch_base")
      .like("event_key", "touchbase:%")
      .in("status", ["due", "in_progress"]);
    const { ownerRezGet } = await import("./ownerrez.server");
    let cancelled = 0;
    for (const row of open ?? []) {
      const bookingId = row.event_key.slice("touchbase:".length);
      const seen = bookings.find((b) => String(b.id) === bookingId);
      const booking = seen ?? (await ownerRezGet<Booking>(`/bookings/${encodeURIComponent(bookingId)}`).catch(() => null));
      if (!booking || !isCancelledBooking(booking)) continue;
      const { error: closeError } = await admin
        .from("routine_controls")
        .update({
          status: "cancelled",
          outcome: "not_applicable",
          notes: row.notes ? `${row.notes}\n\n${TOUCH_BASE_CANCEL_NOTE}` : TOUCH_BASE_CANCEL_NOTE,
        })
        .eq("id", row.id)
        .in("status", ["due", "in_progress"]);
      if (closeError) throw new Error(`Could not close touch base ${row.id}: ${closeError.message}`);
      cancelled++;
    }

    if (run) await admin.from("integration_events").update({ status: "completed", request_payload: { created, cancelled, checked: bookings.length } }).eq("id", run.id);
    return { created, cancelled };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (run) await admin.from("integration_events").update({ status: "failed", error_message: message }).eq("id", run.id);
    throw e;
  }
}

