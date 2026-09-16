import { expect, it } from "bun:test";
import { buildOwnerReport, reportCsv, reportPdf } from "../owner-report.server";
import { PDFDocument } from "pdf-lib";

function reportDatabase(includePrivateEvents = false) {
  const events = Array.from({ length: 205 }, (_, i) => ({
    id: `receipt-${i}`,
    review_id: "review",
    kind: "owner_participation_response",
    summary: "Response recorded",
    created_at: "2026-01-02T12:00:00Z",
    detail: {
      response: `I reviewed item ${i}`,
      propertyId: "33333333-3333-4333-8333-333333333333",
      ownerUpdate: {
        revision: 1,
        issue: "Original issue",
        work_performed: "Original repair was reviewed.",
        outcome: `Original outcome ${i}`,
        reviewed_at: "2026-01-01T12:00:00Z",
        secret: "PRIVATE",
      },
    },
  }));
  const sources: Record<string, unknown[]> = {
    owner_program_properties: [
      {
        id: "enrollment",
        property_id: "33333333-3333-4333-8333-333333333333",
        inclusion_status: "included",
        properties: { name: "QA Home" },
      },
    ],
    owner_reviews: [
      {
        id: "review",
        title: "LATEST TEXT MUST NOT REPLACE RECEIPTS",
        status: "awaiting_owner",
        responded_at: "2026-01-02",
      },
    ],
    owner_review_properties: [],
    owner_time_entries: [],
    owner_time_entry_properties: [],
    owner_badges: [],
    owner_program_events: includePrivateEvents
      ? [
          ...events,
          {
            id: "private",
            kind: "program_updated",
            created_at: "2026-01-03",
            summary: "PRIVATE STAFF NOTES",
            new_value: "PRIVATE ACCESS CREDENTIALS",
          },
        ]
      : events,
  };
  return {
    from: (table: string) => {
      let selectedKinds: string[] | undefined;
      const q = {
        select: () => q,
        eq: () => q,
        in: (_field: string, kinds: string[]) => {
          selectedKinds = kinds;
          return q;
        },
        order: () => q,
        single: async () => ({
          data: {
            id: "program",
            owner_name: "QA Owner",
            status: "active",
            started_on: "2026-01-01",
            ends_on: "2026-03-31",
          },
          error: null,
        }),
        range: async (from: number, to: number) => {
          const all = (sources[table] ?? []).filter(
            (row) => !selectedKinds || selectedKinds.includes((row as { kind: string }).kind),
          );
          return {
            data: all.slice(from, Math.min(to + 1, from + 100)),
            count: all.length,
            error: null,
          };
        },
      };
      return q;
    },
  };
}

it("exports all response revisions without creating time entries or substituting current narrative", async () => {
  const report = await buildOwnerReport(reportDatabase() as never, "program");
  expect(report.responses.length).toBe(205);
  expect(report.totals.reportedHours).toBe(0);
  expect(report.entries.length).toBe(0);
  expect(report.actions.length).toBe(0);
  const csv = reportCsv(report);
  expect(csv).toContain("Original outcome 204");
  expect(csv).toContain('"review_response","receipt-204"');
  expect(csv.includes("LATEST TEXT")).toBe(false);
  expect(csv.includes("PRIVATE")).toBe(false);
  const pdf = await PDFDocument.load(await reportPdf(report));
  expect(pdf.getPageCount() > 1).toBe(true);
});

it("excludes private program audit narratives from the complete owner report", async () => {
  const report = await buildOwnerReport(reportDatabase(true) as never, "program");
  expect(report.responses.length).toBe(205);
  expect(report.actions.length).toBe(1);
  expect(report.actions[0]?.summary).toBe("ARHA updated the participation program details.");
  expect(JSON.stringify(report).includes("PRIVATE")).toBe(false);
});
