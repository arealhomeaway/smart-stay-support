import { expect, it, mock } from "bun:test";

// This file is named zz-* on purpose: bun's mock.module is process-global and
// cannot be undone reliably, so this file must sort AFTER every sibling that
// imports the real owner-participation.server (e.g. owner-response-report).
let demo = true;
const inserted: Record<string, unknown>[] = [];
mock.module("../owner-participation.server", () => ({
  loadProgramAggregate: async () => ({
    program: { id: "synthetic", status: "active", startedOn: "2026-09-01", notifyEmail: true, ownerUserId: "owner" },
    snapshot: { day: 35, totalDays: 100, variance: -20, state: "significantly_behind", daysLeft: 65 },
    reportedMinutes: 0, reviews: [{ status: "open" }], lastOwnerActivityAt: null,
    includedProperties: [], goalMet: false,
  }),
  recordEvent: async () => {},
}));
const { evaluateProgramAlerts } = await import("../owner-progress-alerts.server");
function database() {
  return { from: (table: string) => {
    const q = {
      select: () => q, eq: () => q, gte: () => q,
      single: async () => ({ data: { is_demo: demo }, error: null }),
      insert: async (row: Record<string, unknown>) => { if (table === "owner_notifications") inserted.push(row); return { error: null }; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
    }; return q;
  } };
}
it("demo progress creates in-app alerts with zero deliverable emails or texts", async () => {
  demo = true; inserted.length = 0;
  await evaluateProgramAlerts(database() as never, "synthetic");
  expect(inserted.length).toBeGreaterThan(0);
  expect(inserted.every((r) => r["is_demo"] === true && r["email_status"] === "skipped" && r["sms_status"] === "skipped")).toBe(true);
  expect(inserted.filter((r) => r["email_status"] === "pending")).toHaveLength(0);
});
it("a real program still queues email normally", async () => {
  demo = false; inserted.length = 0;
  await evaluateProgramAlerts(database() as never, "synthetic");
  expect(inserted.length).toBeGreaterThan(0);
  expect(inserted.every((r) => r["is_demo"] === false && r["email_status"] === "pending")).toBe(true);
});