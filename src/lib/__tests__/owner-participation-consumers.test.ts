/**
 * Every hours consumer, invoked directly, against one synthetic Linder-shaped
 * fixture: draft program, confirmed 2026 closing, no start date, seven
 * effective entries = 530 minutes (8 hr 50 min). One corrected original and
 * one prior-year entry are present to prove no consumer adds its own filter.
 * Synthetic data only — no real program, homeowner or record.
 */
import { expect, it } from "bun:test";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { ownerProgramFixture, ownerEnrollmentFixture } from "./owner-program-reader-fixture";
import { loadProgramAggregate } from "../owner-participation.server";
import {
  buildProgramReportSnapshot,
  completionChecklist,
  loadPrograms,
} from "../owner-program.server";
import { loadOwnerAnalytics } from "../owner-analytics.server";
import { earnedBadges } from "../owner-badges.server";
import { buildOwnerReport, reportCsv, reportPdf } from "../owner-report.server";
import { formatDuration, hoursFromMinutes } from "../owner-participation";

const HOME = "33333333-3333-4333-8333-333333333333";
const PROGRAM = "program";

const entry = (id: string, entry_date: string, minutes: number, amends: string | null = null) => ({
  id,
  program_id: PROGRAM,
  owner_user_id: "owner",
  phase: "onboarding",
  entry_date,
  minutes,
  activity: "Reviewed onboarding work",
  activity_category: null,
  decision_outcome: null,
  output: null,
  comments: null,
  attachment_path: null,
  review_id: null,
  ticket_id: null,
  owner_update_revision: null,
  owner_update_snapshot: null,
  amends_entry_id: amends,
  correction_reason: amends ? "Corrected amount" : null,
  review_status: "submitted",
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
  attested: true,
  flagged: false,
  created_at: `${entry_date}T17:00:00Z`,
  is_demo: false,
  property_ids: [HOME],
});

const ENTRIES = [
  entry("e1", "2026-10-06", 80),
  entry("e2", "2026-10-10", 60),
  entry("e3", "2026-10-10", 60),
  entry("e4-original", "2026-10-10", 200), // replaced by e4
  entry("e4", "2026-10-10", 90, "e4-original"),
  entry("e5", "2026-10-10", 30),
  entry("e6", "2026-10-12", 120),
  entry("e7", "2026-10-12", 90),
  entry("prior-year", "2025-06-01", 45), // outside the 2026 participation year
];

const EVENTS = [
  { id: "resp-in", kind: "owner_participation_response", created_at: "2026-10-08T15:00:00Z", review_id: null, detail: { response: "In-year response" } },
  { id: "resp-out", kind: "owner_participation_response", created_at: "2025-06-02T15:00:00Z", review_id: null, detail: { response: "Prior-year response" } },
];

const programRow = {
  ...ownerProgramFixture({ id: PROGRAM, status: "draft", started_on: null, ends_on: null, activated_at: null }),
  archived_at: null,
  is_demo: false,
  report_version: 1,
  owner_record_id: null,
  canonical_owner: { name: "QA Owner", email: "owner@example.test" },
};
const enrollment = ownerEnrollmentFixture({
  program_id: PROGRAM,
  closing_date: "2026-10-06",
  closing_confirmed: true,
  added_on: "2026-10-01",
});

/** One fake that serves the staff (table) and homeowner (RPC) read paths. */
function database() {
  const tables: Record<string, Record<string, unknown>[]> = {
    owner_programs: [programRow],
    owner_program_properties: [enrollment],
    owner_reviews: [],
    owner_review_properties: [],
    owner_time_entries: ENTRIES,
    owner_time_entry_properties: ENTRIES.map((e) => ({
      entry_id: e.id,
      property_id: HOME,
      owner_time_entries: { program_id: PROGRAM },
    })),
    owner_badges: [],
    owner_program_events: EVENTS,
    owner_notifications: [],
    properties: [],
  };
  const valueAt = (row: Record<string, unknown>, key: string) =>
    key.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown> | undefined)?.[k], row);
  const query = (source: Record<string, unknown>[]) => {
    let rows = [...source];
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => ((rows = rows.filter((r) => valueAt(r, k) === v)), q),
      is: (k: string, v: unknown) => ((rows = rows.filter((r) => (valueAt(r, k) ?? null) === v)), q),
      in: (k: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(valueAt(r, k)))), q),
      or: () => q,
      order: () => q,
      limit: () => q,
      single: async () => ({ data: rows[0] ?? null, error: null }),
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), count: rows.length, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return q;
  };
  return {
    from: (table: string) => query(tables[table] ?? []),
    rpc: (name: string, args: { _section?: string } = {}) => {
      if (name === "read_owner_programs")
        return Promise.resolve({ data: [{ id: PROGRAM, program: programRow }], error: null });
      if (name === "read_owner_program_properties")
        return query([{ id: enrollment.id, enrollment }]);
      const section = { reviews: [], entries: ENTRIES, badges: [], events: EVENTS }[
        args._section as "entries"
      ] as Record<string, unknown>[] | undefined;
      return query((section ?? []).map((item) => ({ id: item["id"], item })));
    },
  };
}

/** Text drawn in the PDF (content streams inflated, hex strings decoded). */
async function pdfText(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  let out = "";
  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const streams = contents && "asArray" in contents ? (contents as { asArray(): unknown[] }).asArray() : [contents];
    for (const ref of streams) {
      const stream = doc.context.lookup(ref as never) as { contents?: Uint8Array } | undefined;
      if (!stream?.contents) continue;
      let raw: Buffer;
      try {
        raw = inflateSync(stream.contents);
      } catch {
        raw = Buffer.from(stream.contents);
      }
      for (const m of raw.toString("latin1").matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g))
        out += Buffer.from(m[1]!, "hex").toString("latin1") + "\n";
    }
  }
  return out;
}

const MINUTES = 530;
const HOURS = hoursFromMinutes(MINUTES); // 8.83

it("formats the fixture total as 8 hr 50 min", () => {
  expect(formatDuration(MINUTES)).toBe("8 hr 50 min");
});

it("owner portal total (homeowner read path) = 530", async () => {
  const agg = await loadProgramAggregate(database() as never, PROGRAM, { ownerView: true });
  expect(agg.program.startedOn).toBe(null);
  expect(agg.reportedMinutes).toBe(MINUTES);
});

it("staff program total, close-out checklist and report snapshot = 530", async () => {
  const agg = await loadProgramAggregate(database() as never, PROGRAM);
  expect(agg.reportedMinutes).toBe(MINUTES);
  const checklist = completionChecklist(agg);
  expect(checklist.entriesAttributed).toBe(true);
  const snapshot = buildProgramReportSnapshot(agg);
  expect(snapshot.totals.combinedHours).toBe(HOURS);
  const counted = snapshot.log.filter((l) => l.countsTowardTotal);
  expect(counted.reduce((n, l) => n + l.minutes, 0)).toBe(MINUTES);
  expect(counted.length).toBe(7);
});

it("staff programs list total = 530 (8.83 h)", async () => {
  const { rows } = await loadPrograms(database() as never);
  const row = rows.find((r) => r.id === PROGRAM)!;
  expect(row.reportedHours).toBe(HOURS);
});

it("analytics total = 530 (8.83 h, 7 entries)", async () => {
  const analytics = await loadOwnerAnalytics(database() as never);
  expect(analytics.programs[0]?.reportedHours).toBe(HOURS);
  expect(analytics.programs[0]?.entries).toBe(7);
});

it("milestones use the same 530 minutes", async () => {
  const agg = await loadProgramAggregate(database() as never, PROGRAM);
  const codes = earnedBadges(agg).map((b) => b.code);
  expect(codes).toContain("first_step");
  // No hour milestone beyond the fixture's 8.83 h is awarded.
  expect(codes).not.toContain("hundred_plus");
});

it("CSV: 530 total; in-period flags on entries and homeowner responses", async () => {
  const report = await buildOwnerReport(database() as never, PROGRAM);
  expect(report.totals.reportedMinutes).toBe(MINUTES);
  expect(report.totals.reportedHours).toBe(HOURS);
  expect(report.yearTotals).toEqual([{ year: "2026", hours: HOURS }]);
  expect(report.entries.filter((e) => e.counts).reduce((n, e) => n + e.minutes, 0)).toBe(MINUTES);
  expect(report.outsidePeriod.map((e) => e.id)).toEqual(["prior-year"]);
  // Regression: response in-period follows the participation year, not started_on.
  const flags = Object.fromEntries(report.responses.map((r) => [r.id, r.inPeriod]));
  expect(flags).toEqual({ "resp-in": true, "resp-out": false });

  const csv = reportCsv(report);
  expect(csv).toContain(`# Combined hours (each activity once),${HOURS}`);
  expect(csv).toContain(`# Shared participation total — 2026 (each activity once),${HOURS}`);
});

it("PDF: same 530 total; prior-year response marked outside the period", async () => {
  const report = await buildOwnerReport(database() as never, PROGRAM);
  const text = await pdfText(await reportPdf(report));
  expect(text).toContain(String(HOURS));
  expect(/2025-06-02[^\n]*Outside program period/.test(text)).toBe(true);
  expect(/2026-10-08[^\n]*Outside program period/.test(text)).toBe(false);
});
