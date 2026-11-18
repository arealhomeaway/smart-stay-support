// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { centralToday, dueDateLabel, dueOverdueDays, overdueByDays } from "@/lib/ticket-due-date";
import { compareInGroup, dueCell, groupTableRows } from "@/lib/ticket-table";

// Ticket Due date (Emily, Nov 18).
const NOW = new Date("2026-11-18T18:00:00Z"); // Nov 18, 12:00 PM Central
const STARTED = { status: "in_progress", acknowledged_at: "2026-11-18T10:00:00Z", action_started_at: "2026-11-18T10:05:00Z" };

describe("Due date words", () => {
  it("today is the Central date, not the UTC date", () => {
    expect(centralToday(new Date("2026-11-18T03:00:00Z"))).toBe("2026-11-17");
  });
  it("Today, Tomorrow, then the short date", () => {
    expect(dueDateLabel("2026-11-18", NOW)).toBe("Today");
    expect(dueDateLabel("2026-11-19", NOW)).toBe("Tomorrow");
    expect(dueDateLabel("2026-11-20", NOW)).toBe("Nov 20");
    expect(dueDateLabel("2027-01-04", NOW)).toBe("Jan 4, 2027");
  });
  it("overdue only when the date is before today and the ticket is not resolved or closed", () => {
    expect(dueOverdueDays({ status: "open", due_on: "2026-11-15" }, NOW)).toBe(3);
    expect(dueOverdueDays({ status: "open", due_on: "2026-11-18" }, NOW)).toBe(0);
    expect(dueOverdueDays({ status: "resolved", due_on: "2026-11-15" }, NOW)).toBe(0);
    expect(dueOverdueDays({ status: "closed", due_on: "2026-11-15" }, NOW)).toBe(0);
    expect(overdueByDays(3)).toBe("Overdue by 3 days");
  });
});

describe("Team Queue Due column: the last case uses the Due date", () => {
  it("due date set: the date, then Finish by", () => {
    expect(dueCell({ ...STARTED, due_on: "2026-11-20" }, NOW)).toMatchObject({ line1: "Nov 20", line2: "Finish by", overdue: false });
    expect(dueCell({ ...STARTED, due_on: "2026-11-18" }, NOW)).toMatchObject({ line1: "Today", line2: "Finish by", overdue: false });
  });
  it("past due date: Overdue by X days, counted as overdue", () => {
    expect(dueCell({ ...STARTED, due_on: "2026-11-15" }, NOW)).toMatchObject({ line1: "Nov 15", line2: "Overdue by 3 days", overdue: true });
  });
  it("no due date: No due date", () => {
    expect(dueCell({ ...STARTED, due_on: null }, NOW)).toMatchObject({ line1: "No due date", line2: null, overdue: false });
  });
  it("the reply, start and check back cases still come first", () => {
    expect(dueCell({ status: "open", response_due_at: "2026-11-18T19:00:00Z", due_on: "2026-11-01" }, NOW).line1).toBe("Reply now");
    expect(dueCell({ status: "waiting", due_on: "2026-11-01" }, NOW).line1).toBe("No check back date");
  });
  it("an overdue due date counts in the group header and sorts first; sooner due dates sort ahead", () => {
    const rows = [
      { id: "later", priority: "p3", ...STARTED, due_on: "2026-11-25" },
      { id: "soon", priority: "p3", ...STARTED, due_on: "2026-11-19" },
      { id: "late", priority: "p3", ...STARTED, due_on: "2026-11-10" },
      { id: "none", priority: "p3", ...STARTED, due_on: null },
    ];
    const [g] = groupTableRows(rows, "priority", { priority: (r) => r.priority, ownerId: () => null, ownerName: () => "" }, NOW);
    expect(g.overdue).toBe(1);
    expect(g.rows.map((r) => r.id)).toEqual(["late", "soon", "later", "none"]);
    expect(compareInGroup(rows[1], rows[0], NOW)).toBeLessThan(0);
  });
});

// The database rule, from the staged package, on an isolated database.
const APPLY = readFileSync("docs/pending/ticket-due-date/apply.sql", "utf8");
const fn = APPLY.slice(APPLY.indexOf("CREATE OR REPLACE FUNCTION private.ticket_due_on_default"), APPLY.indexOf("END $function$;") + "END $function$;".length);
const trg = APPLY.slice(APPLY.indexOf("CREATE TRIGGER tickets_zz_due_on_default"), APPLY.indexOf("private.ticket_due_on_default();", APPLY.indexOf("CREATE TRIGGER tickets_zz_due_on_default")) + "private.ticket_due_on_default();".length);

describe("Due date at creation (database rule)", () => {
  let db: PGlite;
  let today: string;
  beforeEach(async () => {
    db = new PGlite();
    await db.exec(`CREATE SCHEMA private; CREATE TABLE public.tickets(id serial PRIMARY KEY, title text, priority text NOT NULL DEFAULT 'p3', status text DEFAULT 'open', due_on date);`);
    await db.exec(fn);
    await db.exec(trg);
    today = (await db.query("SELECT ((now() AT TIME ZONE 'America/Chicago')::date)::text AS d")).rows[0].d;
  });
  const add = async (priority: string, due?: string) =>
    (await db.query(`INSERT INTO public.tickets(title, priority, due_on) VALUES ('t', $1, $2) RETURNING due_on::text AS d, id`, [priority, due ?? null])).rows[0];
  const plus = async (days: number) => (await db.query(`SELECT ($1::date + $2::int)::text AS d`, [today, days])).rows[0].d;

  it("Right now and Today are due today (Central)", async () => {
    expect((await add("p1")).d).toBe(today);
    expect((await add("p2")).d).toBe(today);
  });
  it("Routine is due seven days later", async () => {
    expect((await add("p3")).d).toBe(await plus(7));
  });
  it("a date given at creation is kept", async () => {
    expect((await add("p1", "2026-12-24")).d).toBe("2026-12-24");
  });
  it("changing the priority later does not change the due date", async () => {
    const row = await add("p3");
    await db.query(`UPDATE public.tickets SET priority = 'p1' WHERE id = $1`, [row.id]);
    expect((await db.query(`SELECT due_on::text AS d FROM public.tickets WHERE id = $1`, [row.id])).rows[0].d).toBe(await plus(7));
  });
});
