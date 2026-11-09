import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { FAST_EMAIL_KINDS, drainStaffNotifications } from "../staff-notify.server";

/**
 * Team Queue alert emails go out right away (Emily, Nov 8, 2026): the Supervisor (10 minute) and
 * Director (15 minute) alerts are emailed the moment they are written, one by one. The 5-minute
 * pass leaves them alone for 10 minutes, then sends any still waiting, so each goes out once.
 */
type Row = { id: string; user_id: string; kind: string; email_status: string; is_demo: boolean; created_at: string };

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
          if (!patch) filters.push((r) => r[f as keyof Row] === v);
          return query;
        },
        in: (f: string, v: string[]) => (filters.push((r) => v.includes(String(r[f as keyof Row]))), query),
        or: (expr: string) => {
          // "kind.not.in.(a,b),created_at.lt.<iso>"
          const m = /^kind\.not\.in\.\(([^)]*)\),created_at\.lt\.(.+)$/.exec(expr);
          expect(m).not.toBeNull();
          const list = m![1]!.split(",");
          const cutoff = Date.parse(m![2]!);
          filters.push((r) => !list.includes(r.kind) || Date.parse(r.created_at) < cutoff);
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
    fast: (id: string) => drainStaffNotifications(db as never, 1, delivery as never, undefined, id, NOW),
    main: (now: Date = NOW) => drainStaffNotifications(db as never, 50, delivery as never, undefined, undefined, now),
  };
}

const NOW = new Date("2026-11-09T15:20:00Z");
const AT = "2026-11-09T15:19:30Z";
const ROWS = (): Row[] => [
  { id: "1", user_id: "sup", kind: "team_queue_supervisor", email_status: "pending", is_demo: false, created_at: AT },
  { id: "2", user_id: "dir", kind: "team_queue_director", email_status: "pending", is_demo: false, created_at: AT },
  { id: "3", user_id: "pc", kind: "ticket_note", email_status: "pending", is_demo: false, created_at: AT },
  { id: "4", user_id: "pc", kind: "approval_required", email_status: "pending", is_demo: false, created_at: AT },
];

describe("Team Queue alert emails", () => {
  it("the instant send emails exactly the one Team Queue alert it is asked for", async () => {
    const t = fixture(ROWS());
    await t.fast("1");
    expect(t.sends).toEqual(["staff_team_queue_supervisor"]);
    await t.fast("2");
    expect(t.sends).toEqual(["staff_team_queue_supervisor", "staff_team_queue_director"]);
    expect(t.rows.map((r) => r.email_status)).toEqual(["sent", "sent", "pending", "pending"]);
  });

  it("the instant send never sends any other kind of alert", async () => {
    const t = fixture(ROWS());
    await t.fast("3");
    await t.fast("4");
    expect(t.sends).toEqual([]);
  });

  it("the 5-minute pass sends everything else and leaves new Team Queue alerts alone", async () => {
    const t = fixture(ROWS());
    await t.main();
    expect(t.sends).toEqual(["staff_ticket_note", "staff_approval_required"]);
    expect(t.rows.map((r) => r.email_status)).toEqual(["pending", "pending", "sent", "sent"]);
  });

  it("a Team Queue alert email still waiting after 10 minutes goes out on the 5-minute pass", async () => {
    const t = fixture(ROWS());
    await t.main(new Date("2026-11-09T15:29:00Z"));
    expect(t.sends).not.toContain("staff_team_queue_supervisor");
    await t.main(new Date("2026-11-09T15:30:00Z"));
    expect(t.sends).toContain("staff_team_queue_supervisor");
    expect(t.sends).toContain("staff_team_queue_director");
  });

  it("each alert is emailed once across both paths", async () => {
    const t = fixture(ROWS());
    await t.fast("1");
    await t.fast("2");
    await t.main();
    await t.fast("1");
    await t.main(new Date("2026-11-09T16:00:00Z"));
    expect(t.sends.sort()).toEqual(
      ["staff_approval_required", "staff_team_queue_director", "staff_team_queue_supervisor", "staff_ticket_note"],
    );
  });

  it("demo Team Queue alerts are never emailed", async () => {
    const t = fixture([{ id: "1", user_id: "sup", kind: "team_queue_supervisor", email_status: "pending", is_demo: true, created_at: AT }]);
    await t.fast("1");
    expect(t.sends).toEqual([]);
    expect(t.rows[0]!.email_status).toBe("skipped");
  });

  it("covers exactly the two Team Queue alert kinds the minute check writes", () => {
    expect([...FAST_EMAIL_KINDS]).toEqual(["team_queue_supervisor", "team_queue_director"]);
    const check = readFileSync("docs/pending/alerts/01_team_queue_and_waiting_alerts.sql", "utf8");
    const trigger = readFileSync("docs/pending/alerts-email/01_team_queue_alert_email_now.sql", "utf8");
    for (const k of FAST_EMAIL_KINDS) {
      expect(check).toContain(`'${k}'`);
      expect(trigger).toContain(`'${k}'`);
    }
    expect(trigger).toContain("NOT coalesce(NEW.is_demo, false)");
    expect(trigger).not.toContain("cron.schedule");
  });

  it("the instant route checks the scheduler token and sends one alert by id", () => {
    const src = readFileSync("src/routes/api/public/hooks/team-queue-alert-email.ts", "utf8");
    expect(src).toContain("cleaner_verify_cron_token");
    expect(src).toContain("parsed.data.id");
    expect(src).not.toContain("runEmailJob");
  });
});
