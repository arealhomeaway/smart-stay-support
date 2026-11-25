/**
 * Weekly hours report (Nov 25): the scheduled part inside the existing five-minute owner run, the preview,
 * test copies and the Owner tab line. Quiet until docs/pending/weekly-hours-report is applied.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadProgramAggregate } from "@/lib/owner-participation.server";
import { isStagedMissing } from "@/lib/owner-tab.server";
import { centralParts, weekStartOf } from "@/lib/owner-tab";
import {
  HOURS_REPORT_KEY,
  LOG_HOURS_LABEL,
  LOG_HOURS_PATH,
  hoursReportDue,
  nextHoursReportDate,
  programEndInstant,
  readHoursReportSettings,
  renderHoursReport,
  type HoursReportSettings,
} from "@/lib/hours-report";

type Db = SupabaseClient;
const APP_ORIGIN = "https://smart-stay-support.lovable.app";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = (db: Db) => db as any;

export async function loadHoursReportSettings(db: Db): Promise<HoursReportSettings> {
  const r = await db.from("app_settings").select("value").eq("key", HOURS_REPORT_KEY).maybeSingle();
  return readHoursReportSettings((r.data as { value?: unknown } | null)?.value);
}

const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || null;

/** The email for one program right now, from the existing combined total. */
export async function buildProgramReport(db: Db, programId: string, settings: HoursReportSettings, now = new Date()) {
  const agg = await loadProgramAggregate(db as never, programId);
  const p = agg.program as unknown as { ownerName: string | null; startedOn: string | null; endsOn: string | null };
  const end = programEndInstant(p.endsOn, p.startedOn) ?? new Date(`${now.getUTCFullYear()}-12-31T23:59:59-06:00`);
  const r = renderHoursReport(settings, { firstName: firstName(p.ownerName), reportedMinutes: agg.reportedMinutes, end, now });
  const propertyIds = (agg.includedProperties ?? []).map((x: { propertyId: string }) => x.propertyId);
  return { ...r, propertyIds, endsOn: p.endsOn };
}

type LiveProgram = { id: string; status: string; ends_on: string | null; started_on: string | null };

async function livePrograms(db: Db): Promise<LiveProgram[]> {
  const r = await db.from("owner_programs").select("id, status, ends_on, started_on, archived_at, is_demo")
    .eq("is_demo", false).not("status", "in", "(closed,archived)").is("archived_at", null);
  if (r.error) throw r.error;
  return (r.data ?? []) as LiveProgram[];
}

/** Five-minute part: on the saved day at or after the saved time, one report per live program per week. */
export async function runWeeklyHoursReports(db: Db, now = new Date()) {
  const settings = await loadHoursReportSettings(db);
  const { due, weekStart } = hoursReportDue(settings, now);
  if (!due) return { skipped: settings.enabled ? "not_due" : "off" };
  const probe = await loose(db).from("ao_hours_reports").select("program_id").eq("week_start", weekStart);
  if (isStagedMissing(probe.error)) return { skipped: "staged" };
  if (probe.error) throw probe.error;
  const done = new Set(((probe.data ?? []) as { program_id: string }[]).map((x) => x.program_id));
  const holds = await loose(db).from("ao_hours_report_holds").select("property_id").eq("week_start", weekStart);
  const held = new Set(((holds.data ?? []) as { property_id: string }[]).map((x) => x.property_id));
  const today = centralParts(now).date;
  let sent = 0, skippedHeld = 0, ended = 0;
  const errors: string[] = [];
  for (const prog of await livePrograms(db)) {
    if (done.has(prog.id)) continue;
    const endsOn = prog.ends_on?.slice(0, 10) ?? (prog.started_on ? `${prog.started_on.slice(0, 4)}-12-31` : null);
    if (endsOn && today > endsOn) { ended++; continue; }
    try {
      const r = await buildProgramReport(db, prog.id, settings, now);
      if (r.propertyIds.some((id: string) => held.has(id))) { skippedHeld++; continue; }
      const rec = await db.rpc("ao_record_hours_report" as never, { _program_id: prog.id, _week_start: weekStart, _subject: r.subject, _body: r.body, _property_ids: r.propertyIds } as never);
      if (rec.error) throw rec.error;
      if (rec.data) sent++;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (errors.length) throw new Error(`Hours report: ${errors.length} program(s) failed. ${errors[0]}`);
  return { sent, skippedHeld, ended };
}

/** Send one copy now to a staff address only. Never to an owner. */
export async function sendHoursReportTestCopy(db: Db, to: string, programId: string, settings?: HoursReportSettings) {
  const s = settings ?? (await loadHoursReportSettings(db));
  const r = await buildProgramReport(db, programId, s);
  const { sendEmail, emailShell, emailText } = await import("@/lib/email.server");
  const subject = `[RESOLVE TEST] ${r.subject}`;
  const action = { label: LOG_HOURS_LABEL, url: `${APP_ORIGIN}${LOG_HOURS_PATH}` };
  const res = await sendEmail({ to, subject, html: emailShell(r.subject, r.body, action, "owner"), bodyText: emailText(r.subject, r.body, action), purpose: "owner_update_test_copy" });
  if (res.status !== "sent") throw new Error(res.error ?? "The test copy could not be sent.");
  return { ok: true as const };
}

export async function programForHome(db: Db, propertyId: string): Promise<LiveProgram | null> {
  const link = await db.from("owner_program_properties").select("program_id").eq("property_id", propertyId);
  const ids = ((link.data ?? []) as { program_id: string }[]).map((x) => x.program_id);
  const direct = await db.from("owner_programs").select("id, status, ends_on, started_on, archived_at, is_demo")
    .or([`property_id.eq.${propertyId}`, ...(ids.length ? [`id.in.(${ids.join(",")})`] : [])].join(","))
    .not("status", "in", "(closed,archived)").is("archived_at", null).limit(1).maybeSingle();
  return (direct.data ?? null) as LiveProgram | null;
}

/** The Owner tab line for one home. */
export async function hoursReportLine(db: Db, propertyId: string, now = new Date()) {
  const program = await programForHome(db, propertyId);
  if (!program) return { program: null };
  const settings = await loadHoursReportSettings(db);
  const sent = await loose(db).from("ao_hours_report_homes").select("sent_at, ao_hours_reports(week_start)").eq("property_id", propertyId).order("sent_at", { ascending: false }).limit(60);
  const holds = await loose(db).from("ao_hours_report_holds").select("week_start").eq("property_id", propertyId);
  const staged = !isStagedMissing(sent.error) && !isStagedMissing(holds.error);
  const sentRows = (staged ? sent.data ?? [] : []) as { sent_at: string; ao_hours_reports: { week_start: string } | null }[];
  const progSent = await loose(db).from("ao_hours_reports").select("week_start").eq("program_id", program.id);
  const sentWeeks = [...new Set([...sentRows.map((x) => x.ao_hours_reports?.week_start).filter(Boolean), ...((staged ? progSent.data ?? [] : []) as { week_start: string }[]).map((x) => x.week_start)])] as string[];
  const heldWeeks = ((staged ? holds.data ?? [] : []) as { week_start: string }[]).map((x) => x.week_start);
  const endsOn = program.ends_on?.slice(0, 10) ?? (program.started_on ? `${program.started_on.slice(0, 4)}-12-31` : null);
  const next = nextHoursReportDate(settings, now, { sentWeeks, heldWeeks, endsOn });
  return {
    program: { id: program.id },
    staged,
    enabled: settings.enabled,
    time: settings.time,
    nextDate: next,
    nextWeek: next ? weekStartOf(next) : null,
    heldThisWeek: next ? false : heldWeeks.includes(weekStartOf(centralParts(now).date)),
    lastSentAt: sentRows[0]?.sent_at ?? null,
  };
}
