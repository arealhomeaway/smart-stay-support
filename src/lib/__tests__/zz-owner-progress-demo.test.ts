import { expect, it, mock } from "bun:test";

// This file is named zz-* on purpose: bun's mock.module is process-global and
// cannot be undone reliably, so this file must sort AFTER every sibling that
// imports the real owner-participation.server (e.g. owner-response-report).
let demo = true;
let held: string | null = null;
const inserted: Record<string, unknown>[] = [];
mock.module("../owner-participation.server", () => ({
  loadProgramAggregate: async () => ({
    program: { id: "synthetic", status: "active", startedOn: "2026-09-01", notifyEmail: true, ownerUserId: "owner" },
    snapshot: { day: 35, totalDays: 100, benchmark: 35, variance: -20, state: "significantly_behind", daysLeft: 65 },
    reportedMinutes: 900, reviews: [{ status: "open" }], lastOwnerActivityAt: null,
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
      maybeSingle: async () => ({ data: { pace_emails_held_until: held }, error: null }),
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
it("the pace email states her real hours and the recommended pace", async () => {
  demo = false; held = null; inserted.length = 0;
  await evaluateProgramAlerts(database() as never, "synthetic");
  const pace = inserted.find((r) => r["kind"] === "progress_pace");
  expect(pace?.["body"]).toBe(
    "You have 15 hours logged. The recommended pace for this point in your program is 35 hours. If you have done anything you haven't logged yet, now is a good time to add it.",
  );
  expect(pace?.["title"]).toBe("Significantly behind");
});
it("during a pace hold no pace, checkpoint, milestone or quiet notice is created", async () => {
  demo = false; held = new Date(Date.now() + 7 * 86_400_000).toISOString(); inserted.length = 0;
  await evaluateProgramAlerts(database() as never, "synthetic");
  const heldKinds = ["progress_pace", "progress_checkpoint", "progress_milestone", "progress_quiet"];
  expect(inserted.filter((r) => heldKinds.includes(String(r["kind"])))).toHaveLength(0);
  held = new Date(Date.now() - 60_000).toISOString(); inserted.length = 0;
  await evaluateProgramAlerts(database() as never, "synthetic");
  expect(inserted.some((r) => r["kind"] === "progress_pace")).toBe(true);
  held = null;
});
