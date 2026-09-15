import { expect, it } from "bun:test";
import { buildProgramReport, buildProgramReportSnapshot } from "../owner-program.server";
import { REPORT_DISCLAIMER } from "../owner-participation";

it("exports the saved closeout report without recomputing later participation", async () => {
  const stored = { generatedAt: "2026-01-01T12:00:00Z", totals: { combinedHours: 105 }, log: [] };
  let reads = 0;
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: { status: "completed", completion_report: stored }, error: null }),
  };
  const result = await buildProgramReport(
    {
      from: () => {
        reads++;
        if (reads > 1) throw new Error("unexpected recomputation");
        return query;
      },
    } as never,
    "program",
  );
  expect(result).toEqual(stored);
  expect(reads).toBe(1);
});

it("does not fall back to another report when program access fails", async () => {
  const query = {
    select: () => query,
    eq: () => query,
    single: async () => ({ data: null, error: new Error("program not visible") }),
  };
  const message = await buildProgramReport({ from: () => query } as never, "other-program").then(
    () => "unexpected success",
    (error: Error) => error.message,
  );
  expect(message).toBe("program not visible");
});

it("reports actual attestation and distinguishes corrected history from counted participation", () => {
  const report = buildProgramReportSnapshot({
    program: {
      ownerName: "QA Owner",
      ownerEmail: "qa@example.invalid",
      startedOn: "2026-01-01",
      endsOn: "2026-03-31",
    },
    properties: [{ propertyId: "home", name: "QA Home" }],
    includedProperties: [],
    reviews: [],
    badges: [],
    reportedMinutes: 45,
    onboardingMinutes: 45,
    operationalMinutes: 0,
    entries: [
      {
        id: "original",
        entry_date: "2026-01-02",
        minutes: 90,
        activity: "Review",
        propertyIds: ["home"],
        review_status: "returned",
        amends_entry_id: null,
        attested: false,
      },
      {
        id: "correction",
        entry_date: "2026-01-02",
        minutes: 45,
        activity: "Corrected review",
        propertyIds: ["home"],
        review_status: "approved",
        amends_entry_id: "original",
        attested: true,
      },
    ],
  } as never);
  expect(report.disclaimer).toBe(REPORT_DISCLAIMER);
  expect(report.totals.combinedHours).toBe(0.75);
  expect(report.log[0]?.attested).toBe(false);
  expect(report.log[0]?.countsTowardTotal).toBe(false);
  expect(report.log[1]?.attested).toBe(true);
  expect(report.log[1]?.countsTowardTotal).toBe(true);
  expect(report.log[1]?.correctionOf).toBe("original");
});
