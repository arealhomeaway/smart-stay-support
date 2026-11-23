/**
 * Claim filing overdue alert (Emily, Nov 23), acceptance on demo records only: the real
 * five-minute sweep (sweepDeadlineAlerts) against an in-memory backend that keeps the live
 * demo rule of notify_staff_isolated (demo alerts reach only the designated demo stand-ins).
 */
import { describe, expect, it } from "bun:test";
import { sweepDeadlineAlerts } from "@/lib/deadline-alerts.server";

type Row = Record<string, unknown>;
const DEMO_OWNER = "demo-coordinator";
const DEMO_SUP = "demo-supervisor";
const REAL_SUP = "real-supervisor";

function fakeBackend(claims: Row[]) {
  const notices: Row[] = [];
  const demoOk = new Set([DEMO_OWNER, DEMO_SUP]);
  const builder = (table: string) => {
    const filters: { col: string; values: unknown[] }[] = [];
    const rows = (): Row[] => {
      const base = table === "claims" ? claims : table === "staff_notifications" ? notices : [];
      return base.filter((r) => filters.every((f) => f.values.includes(r[f.col])));
    };
    const b: Record<string, unknown> = {
      select: () => b,
      not: () => b,
      is: () => b,
      or: () => b,
      eq: () => b,
      in: (col: string, values: unknown[]) => (filters.push({ col, values }), b),
      maybeSingle: async () =>
        table === "app_settings" ? { data: { value: { ops_supervisor: DEMO_SUP } }, error: null } : { data: null, error: null },
      then: (ok: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: rows(), error: null }).then(ok),
    };
    return b;
  };
  const insert = (a: Row) => {
    notices.push({ user_id: a["_user_id"], kind: a["_kind"], entity_id: a["_entity_id"], link_path: a["_link_path"], priority: a["_priority"], email: a["_email"], is_demo: a["_is_demo"] });
    return { data: "id", error: null };
  };
  const client = {
    from: builder,
    rpc: async (name: string, args: Row = {}) => {
      if (name === "seat_holder_at") return { data: REAL_SUP, error: null };
      if (name === "notify_staff_isolated") {
        if (args["_is_demo"] && !demoOk.has(args["_user_id"] as string)) return { data: null, error: null };
        return insert(args);
      }
      if (name === "notify_staff") return insert(args);
      return { data: null, error: null };
    },
  };
  return { client: client as never, notices };
}

// Nov 24, 9:00 AM Chicago: the day after a Nov 23 deadline.
const DAY_AFTER = new Date("2026-11-24T15:00:00Z");
const demoClaim = (id: string, over: Row = {}): Row => ({
  id, title: `Demo ${id}`, stage: "gathering", assigned_to: DEMO_OWNER, deadline_on: "2026-11-23",
  deadline_source: "platform_default", deadline_verified: false, is_demo: true, ...over,
});

describe("claim filing overdue alert, demo acceptance (Nov 23)", () => {
  it("a demo claim one day past its deadline and not Submitted notifies its owner exactly once", async () => {
    const { client, notices } = fakeBackend([demoClaim("owned")]);
    await sweepDeadlineAlerts(client, DAY_AFTER);
    expect(notices.map((n) => [n["user_id"], n["kind"], n["priority"], n["email"]])).toEqual([[DEMO_OWNER, "claim_filing_overdue", "normal", false]]);
    await sweepDeadlineAlerts(client, DAY_AFTER);
    await sweepDeadlineAlerts(client, new Date("2026-11-24T22:00:00Z"));
    expect(notices).toHaveLength(1);
  });

  it("an unassigned demo claim notifies the Supervisor stand-in once, never the real Supervisor", async () => {
    const { client, notices } = fakeBackend([demoClaim("unowned", { assigned_to: null })]);
    await sweepDeadlineAlerts(client, DAY_AFTER);
    await sweepDeadlineAlerts(client, DAY_AFTER);
    expect(notices.map((n) => [n["user_id"], n["kind"]])).toEqual([[DEMO_SUP, "claim_filing_overdue"]]);
  });

  it("a Submitted demo claim sends nothing", async () => {
    const { client, notices } = fakeBackend([demoClaim("filed", { stage: "submitted" })]);
    await sweepDeadlineAlerts(client, DAY_AFTER);
    expect(notices).toEqual([]);
  });

  it("a demo claim owned by real staff sends them nothing", async () => {
    const { client, notices } = fakeBackend([demoClaim("real", { assigned_to: "real-coordinator" })]);
    await sweepDeadlineAlerts(client, DAY_AFTER);
    expect(notices).toEqual([]);
  });

  it("at most two alerts per deadline date: 3 days before and the day after, none on the day, none after", async () => {
    const { client, notices } = fakeBackend([demoClaim("life")]);
    for (let day = 18; day <= 28; day++) {
      await sweepDeadlineAlerts(client, new Date(`2026-11-${day}T15:00:00Z`));
      await sweepDeadlineAlerts(client, new Date(`2026-11-${day}T23:00:00Z`));
    }
    expect(notices.map((n) => n["kind"])).toEqual(["claim_filing_reminder", "claim_filing_overdue"]);
  });

  it("a new deadline date gets its own reminder and its own overdue alert", async () => {
    const claims = [demoClaim("moved")];
    const { client, notices } = fakeBackend(claims);
    await sweepDeadlineAlerts(client, DAY_AFTER);
    claims[0]!["deadline_on"] = "2026-11-30";
    await sweepDeadlineAlerts(client, new Date("2026-11-27T15:00:00Z"));
    await sweepDeadlineAlerts(client, new Date("2026-11-30T15:00:00Z"));
    await sweepDeadlineAlerts(client, new Date("2026-12-01T15:00:00Z"));
    await sweepDeadlineAlerts(client, new Date("2026-12-01T20:00:00Z"));
    expect(notices.map((n) => [n["kind"], String(n["link_path"]).split("file_by=")[1]])).toEqual([
      ["claim_filing_overdue", "2026-11-23"],
      ["claim_filing_reminder", "2026-11-30"],
      ["claim_filing_overdue", "2026-11-30"],
    ]);
  });
});
