import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { FAST_EMAIL_KINDS, drainStaffNotifications } from "../staff-notify.server";

/**
 * Team Queue alert emails go out within a minute (Emily, Nov 8, 2026): a second email run every
 * minute for the Supervisor (10 minute) and Director (15 minute) alerts only. Each alert is
 * emailed by exactly one run: the 5-minute pass leaves these two kinds alone.
 */
type Row = { id: string; user_id: string; kind: string; email_status: string; is_demo: boolean };

function fixture(rows: Row[]) {
  const sends: string[] = [];
  const db = {
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { id } }, error: null }) } },
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      const filters: ((r: Row) => boolean)[] = [];
      const eqs = new Map<string, unknown>();
      let patch: Record<string, unknown> | undefined;
      const query = {
        select: () => query,
        update: (v: Record<string, unknown>) => ((patch = v), query),
        eq: (f: string, v: unknown) => {
          eqs.set(f, v);
          if (f === "email_status") filters.push((r) => r.email_status === v);
          return query;
        },
        in: (f: string, v: string[]) => (filters.push((r) => v.includes(String(r[f as keyof Row]))), query),
        not: (f: string, op: string, v: string) => {
          expect(op).toBe("in");
          const list = v.replace(/[()]/g, "").split(",");
          filters.push((r) => !list.includes(String(r[f as keyof Row])));
          return query;
        },
        order: () => query,
        limit: () => query,
        then: (resolve: (x: unknown) => unknown) => {
          if (patch) {
            Object.assign(rows.find((r) => r.id === eqs.get("id"))!, patch);
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
          if (table === "staff_notifications")
            return Promise.resolve({
              data: rows.filter((r) => filters.every((f) => f(r))).map((r) => ({ ...r, title: r.kind, body: "b", link_path: "/tickets/1", priority: "normal", email_attempts: 0 })),
              error: null,
            }).then(resolve);
          if (table === "profiles")
            return Promise.resolve({ data: rows.map((r) => ({ id: r.user_id, email: `${r.user_id}@example.invalid` })), error: null }).then(resolve);
          if (table === "user_roles") return Promise.resolve({ data: [{ role: "manager" }], error: null }).then(resolve);
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return query;
    },
  };
  const delivery = {
    sendEmail: async (input: { purpose?: string }) => (sends.push(String(input.purpose)), { status: "sent" as const, error: null }),
    emailShell: () => "html",
    isEmailAddress: (v: unknown): v is string => typeof v === "string",
  };
  return {
    rows,
    sends,
    fast: () => drainStaffNotifications(db as never, 20, delivery as never, undefined, "fast"),
    main: () => drainStaffNotifications(db as never, 50, delivery as never),
  };
}

const ROWS = (): Row[] => [
  { id: "1", user_id: "sup", kind: "team_queue_supervisor", email_status: "pending", is_demo: false },
  { id: "2", user_id: "dir", kind: "team_queue_director", email_status: "pending", is_demo: false },
  { id: "3", user_id: "pc", kind: "ticket_note", email_status: "pending", is_demo: false },
  { id: "4", user_id: "pc", kind: "approval_required", email_status: "pending", is_demo: false },
];

describe("Team Queue alert emails", () => {
  it("the minute run emails only the Supervisor and Director Team Queue alerts", async () => {
    const t = fixture(ROWS());
    await t.fast();
    expect(t.sends).toEqual(["staff_team_queue_supervisor", "staff_team_queue_director"]);
    expect(t.rows.map((r) => r.email_status)).toEqual(["sent", "sent", "pending", "pending"]);
  });

  it("the 5-minute pass sends everything else and leaves the Team Queue alerts alone", async () => {
    const t = fixture(ROWS());
    await t.main();
    expect(t.sends).toEqual(["staff_ticket_note", "staff_approval_required"]);
    expect(t.rows.map((r) => r.email_status)).toEqual(["pending", "pending", "sent", "sent"]);
  });

  it("each alert is emailed once across both runs", async () => {
    const t = fixture(ROWS());
    await t.fast();
    await t.main();
    await t.fast();
    await t.main();
    expect(t.sends.sort()).toEqual(
      ["staff_approval_required", "staff_team_queue_director", "staff_team_queue_supervisor", "staff_ticket_note"],
    );
  });

  it("demo Team Queue alerts are never emailed", async () => {
    const t = fixture([{ id: "1", user_id: "sup", kind: "team_queue_supervisor", email_status: "pending", is_demo: true }]);
    await t.fast();
    expect(t.sends).toEqual([]);
    expect(t.rows[0]!.email_status).toBe("skipped");
  });

  it("covers exactly the two Team Queue alert kinds the minute check writes", () => {
    expect([...FAST_EMAIL_KINDS]).toEqual(["team_queue_supervisor", "team_queue_director"]);
    const sql = readFileSync("docs/pending/alerts/01_team_queue_and_waiting_alerts.sql", "utf8");
    for (const k of FAST_EMAIL_KINDS) expect(sql).toContain(`'${k}'`);
  });

  it("the minute route checks the scheduler token and runs only the fast scope", () => {
    const src = readFileSync("src/routes/api/public/hooks/team-queue-alert-email.ts", "utf8");
    expect(src).toContain("cleaner_verify_cron_token");
    expect(src).toContain('"fast"');
    expect(src).not.toContain("runEmailJob");
  });
});
