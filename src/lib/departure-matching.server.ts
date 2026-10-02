import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEPARTURE_CLEAN_TYPES_KEY,
  isDepartureClean,
  isDone,
  matchAll,
  readMatchConfig,
  type BookingInput,
  type CleanInput,
  type MatchResult,
} from "./departure-matching";

type Admin = SupabaseClient<Database>;

type OrBooking = {
  id: number; property_id: number; arrival?: string; departure?: string; status?: string; is_block?: boolean;
  type?: string; platform_reservation_number?: string | null; listing_site?: string | null;
  guest_id?: number | null; guest?: { first_name?: string | null; last_name?: string | null } | null;
};

const chicagoToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const shift = (d: string, days: number) => new Date(Date.parse(d) + days * 86400000).toISOString().slice(0, 10);
const live = (b: OrBooking) => !b.is_block && (b.status ?? "active").toLowerCase() !== "cancelled" && b.type !== "block";

export type MatchInputs = Awaited<ReturnType<typeof loadMatchInputs>>;

/** Reads real cleans (Resolve) + real stays (OwnerRez) for the window. Read-only everywhere. */
export async function loadMatchInputs(admin: Admin, days = 30) {
  const today = chicagoToday();
  const from = shift(today, -days);
  const { data: setting } = await admin.from("app_settings").select("value").eq("key", DEPARTURE_CLEAN_TYPES_KEY).maybeSingle();
  const cfg = readMatchConfig(setting?.value);

  const { data: wos, error } = await admin
    .from("breezeway_work_orders")
    .select("id, breezeway_task_id, property_id, department, name, status, scheduled_date, finished_at, breezeway_updated_at, assignees, properties!inner(name, is_demo, ownerrez_property_id, market)")
    .eq("department", "housekeeping")
    .eq("properties.is_demo", false)
    .gte("scheduled_date", from)
    .lte("scheduled_date", today)
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = wos ?? [];

  const orIds = [...new Set(rows.map((r) => r.properties?.ownerrez_property_id).filter(Boolean) as string[])];
  const { data: homes } = await admin.from("properties").select("id, name, ownerrez_property_id, market").eq("is_demo", false).not("ownerrez_property_id", "is", null);
  const allOr = [...new Set([...orIds, ...(homes ?? []).map((h) => h.ownerrez_property_id!)])];

  const { ownerRezGet } = await import("./ownerrez.server");
  const bookings: (BookingInput & { guest_id: string | null })[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < allOr.length; i += 40) {
    let offset = 0;
    for (let page = 0; page < 20; page++) {
      const data = await ownerRezGet<{ items?: OrBooking[] }>("/bookings", {
        property_ids: allOr.slice(i, i + 40).join(","),
        from: shift(from, -7), to: today, limit: "100", offset: String(offset), include_guest: "true",
      });
      const items = data.items ?? [];
      for (const b of items) {
        if (!live(b) || !b.arrival || !b.departure || seen.has(b.id)) continue;
        seen.add(b.id);
        bookings.push({
          id: String(b.id), property_id: String(b.property_id), arrival: b.arrival.slice(0, 10), departure: b.departure.slice(0, 10),
          guest_name: [b.guest?.first_name, b.guest?.last_name].filter(Boolean).join(" ") || null,
          code: b.platform_reservation_number ?? null, listing_site: b.listing_site ?? null,
          guest_id: b.guest_id == null ? null : String(b.guest_id),
        });
      }
      if (items.length < 100) break;
      offset += 100;
    }
  }
  return { today, from, cfg, rows, homes: homes ?? [], bookings };
}

/** Cleans already holding a reservation by a saved (incl. manual) match. */
async function existingHolders(admin: Admin) {
  const { data } = await admin.from("departure_clean_matches").select("breezeway_work_order_id, ownerrez_booking_id, is_manual, state").eq("state", "matched");
  const byBooking = new Map<string, string>();
  const manual = new Map<string, string>();
  for (const m of data ?? []) {
    if (m.ownerrez_booking_id) byBooking.set(m.ownerrez_booking_id, m.breezeway_work_order_id);
    if (m.is_manual && m.ownerrez_booking_id) manual.set(m.breezeway_work_order_id, m.ownerrez_booking_id);
  }
  return { byBooking, manual };
}

export function evaluate(inputs: MatchInputs, holders: { byBooking: Map<string, string>; manual: Map<string, string> }) {
  const { rows, cfg, bookings, today, from, homes } = inputs;
  const toClean = (r: (typeof rows)[number]): CleanInput => ({
    id: r.id, task_id: r.breezeway_task_id, property_id: r.property_id, ownerrez_property_id: r.properties?.ownerrez_property_id ?? null,
    department: r.department, name: r.name, status: r.status, scheduled_date: r.scheduled_date,
  });
  const departureRows = rows.filter((r) => isDepartureClean(r.department, r.name, cfg));
  const ready = departureRows.filter((r) => isDone(r.status));
  const pending = departureRows.filter((r) => !isDone(r.status) && r.status !== "Deleted");
  const auto = ready.filter((r) => !holders.manual.has(r.id));
  const results: MatchResult[] = matchAll(auto.map(toClean), bookings, cfg, today, holders.byBooking);
  for (const r of ready.filter((x) => holders.manual.has(x.id))) {
    const b = holders.manual.get(r.id)!;
    results.push({ clean_id: r.id, state: "matched", booking_id: b, checkout_date: bookings.find((x) => x.id === b)?.departure ?? null, method: "manual", confidence: null, reason: "Linked manually by a supervisor", candidate_ids: [b] });
  }

  const labels = new Map<string, { total: number; departure: boolean; done: number }>();
  for (const r of rows) {
    const k = r.name ?? "(no name)";
    const l = labels.get(k) ?? { total: 0, done: 0, departure: isDepartureClean(r.department, r.name, cfg) };
    l.total++; if (isDone(r.status)) l.done++;
    labels.set(k, l);
  }

  const homeIds = new Set(homes.map((h) => h.ownerrez_property_id));
  const departures = bookings.filter((b) => b.departure >= from && b.departure <= today && homeIds.has(b.property_id));
  const matchedIds = new Set(results.filter((r) => r.state === "matched").map((r) => r.booking_id));
  const cleansByBooking = new Map<string, number>();
  for (const r of results) for (const id of r.state === "matched" || r.state === "already_linked" ? r.candidate_ids : []) cleansByBooking.set(id, (cleansByBooking.get(id) ?? 0) + 1);

  const rowById = new Map(rows.map((r) => [r.id, r]));
  const bookingById = new Map(bookings.map((b) => [b.id, b]));
  const homeByOr = new Map(homes.map((h) => [h.ownerrez_property_id, h]));
  const describe = (m: MatchResult) => {
    const r = rowById.get(m.clean_id)!;
    const b = m.booking_id ? bookingById.get(m.booking_id) : null;
    return {
      ...m,
      property: r.properties?.name ?? "—",
      market: r.properties?.market ?? null,
      clean_name: r.name, clean_status: r.status, clean_date: r.scheduled_date, task_id: r.breezeway_task_id,
      clean_time_exact: !!r.finished_at, clean_time: r.finished_at ?? r.breezeway_updated_at,
      guest: b?.guest_name ?? null, arrival: b?.arrival ?? null, code: b?.code ?? null, listing_site: b?.listing_site ?? null,
      candidates: m.candidate_ids.map((id) => bookingById.get(id)).filter(Boolean).map((x) => ({ id: x!.id, guest: x!.guest_name, arrival: x!.arrival, departure: x!.departure, code: x!.code })),
    };
  };
  const count = (s: MatchResult["state"]) => results.filter((r) => r.state === s).length;
  const unmatchedDepartures = departures.filter((d) => !matchedIds.has(d.id)).map((d) => ({
    id: d.id, property: homeByOr.get(d.property_id)?.name ?? d.property_id, guest: d.guest_name, arrival: d.arrival, departure: d.departure, code: d.code,
  }));
  return {
    window: { from, to: today },
    config: cfg,
    totals: {
      departures: departures.length,
      cleansReviewed: rows.length,
      departureCleans: departureRows.length,
      finishedDepartureCleans: ready.length,
      notYetFinished: pending.length,
      matched: count("matched"),
      highConfidence: results.filter((r) => r.state === "matched" && r.confidence === "high").length,
      noReservation: count("no_reservation"),
      multiple: count("multiple_reservations"),
      alreadyLinked: count("already_linked"),
      missingData: count("missing_data"),
      departuresWithoutClean: unmatchedDepartures.length,
      multiCleanReservations: [...cleansByBooking.values()].filter((n) => n > 1).length,
      exactFinishTimes: ready.filter((r) => r.finished_at).length,
      pctMatched: departures.length ? Math.round((departures.filter((d) => matchedIds.has(d.id)).length / departures.length) * 1000) / 10 : 0,
    },
    labels: [...labels.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total),
    results: results.map(describe),
    unmatchedDepartures,
  };
}

/** Dry run: no writes anywhere. */
export async function previewMatching(admin: Admin, days = 30) {
  const inputs = await loadMatchInputs(admin, days);
  return evaluate(inputs, await existingHolders(admin));
}

/**
 * Saves match states (never overwrites a manual link) and logs state changes.
 * Creates no Departure Reviews by itself; the review trigger stays gated for real homes.
 */
export async function saveMatching(admin: Admin, days = 30) {
  const holders = await existingHolders(admin);
  const report = evaluate(await loadMatchInputs(admin, days), holders);
  const { data: prev } = await admin.from("departure_clean_matches").select("id, breezeway_work_order_id, state, is_manual");
  const prevBy = new Map((prev ?? []).map((p) => [p.breezeway_work_order_id, p]));
  let saved = 0;
  for (const r of report.results) {
    const old = prevBy.get(r.clean_id);
    if (old?.is_manual) continue;
    const row = {
      breezeway_work_order_id: r.clean_id, breezeway_task_id: r.task_id,
      property_id: null as string | null, state: r.state, ownerrez_booking_id: r.state === "matched" ? r.booking_id : null,
      checkout_date: r.state === "matched" ? r.checkout_date : null, match_method: r.state === "matched" ? r.method : null,
      confidence: r.state === "matched" ? r.confidence : null, reason: r.reason, candidates: r.candidates,
      reservation: r.state === "matched" ? { guest_name: r.guest, arrival: r.arrival, departure: r.checkout_date, reservation_code: r.code, booking_source: r.listing_site, ownerrez_booking_id: r.booking_id } : null,
      last_evaluated_at: new Date().toISOString(),
    };
    const { data: wo } = await admin.from("breezeway_work_orders").select("property_id").eq("id", r.clean_id).maybeSingle();
    row.property_id = wo?.property_id ?? null;
    const { data: up, error } = await admin.from("departure_clean_matches").upsert(row, { onConflict: "breezeway_work_order_id" }).select("id").single();
    if (error || !up) continue;
    saved++;
    if (!old || old.state !== r.state)
      await admin.from("departure_clean_match_events").insert({ match_id: up.id, event_type: "evaluated", from_state: old?.state ?? null, to_state: r.state, ownerrez_booking_id: row.ownerrez_booking_id, summary: r.reason });
  }
  return { saved, totals: report.totals };
}
