// @ts-nocheck: isolated SQL fixture, row shapes are checked by assertions.
import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

/**
 * Practice run of docs/pending/property-page-part2/apply.sql (and its undo) on an isolated copy
 * (Property page Part 2, Admin approval Nov 12). Live column names, fake people and homes only.
 */
const DIR = "docs/pending/property-page-part2";
const ADMIN = "00000000-0000-4000-8000-0000000000a0";
const DIRECTOR = "00000000-0000-4000-8000-0000000000a1";
const PM = "00000000-0000-4000-8000-0000000000a2";
const DESIGNER = "00000000-0000-4000-8000-0000000000a3";
const VIEWER = "00000000-0000-4000-8000-0000000000a4";
const COORD = "00000000-0000-4000-8000-0000000000a5";
const OWNER = "00000000-0000-4000-8000-0000000000c1";
const OTHER_OWNER = "00000000-0000-4000-8000-0000000000c2";
const HOME = "00000000-0000-4000-8000-0000000000b1";
const OTHER_HOME = "00000000-0000-4000-8000-0000000000b2";
const OWNER_REC = "00000000-0000-4000-8000-0000000000d1";
const PROGRAM = "00000000-0000-4000-8000-0000000000e1";
const OTHER_PROGRAM = "00000000-0000-4000-8000-0000000000e2";

let db: PGlite;
const as = async (user: string | null) => {
  await db.query("RESET ROLE");
  await db.query("DELETE FROM public.me");
  if (user) await db.query("INSERT INTO public.me VALUES ($1)", [user]);
};
const one = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows[0];
const all = async (sql: string, args: unknown[] = []) => (await db.query(sql, args)).rows;
/** Runs a read as the signed-in person through row level security (not as the database owner). */
const asReader = async (user: string, sql: string, args: unknown[] = []) => {
  await as(user);
  await db.query("SET ROLE authenticated");
  try { return (await db.query(sql, args)).rows; } finally { await db.query("RESET ROLE"); }
};
const fails = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return String((e as Error).message); }
  throw new Error("expected a refusal");
};
const post = (home: string, kind: string, body: string, att: unknown[] = [], mentions: string[] = []) =>
  one("SELECT public.post_home_chat_message($1, $2, $3, $4::jsonb, $5::uuid[]) AS id", [home, kind, body, JSON.stringify(att), mentions]).then((r) => r.id as string);
const central = (local: string) => `('${local}'::timestamp AT TIME ZONE 'America/Chicago')`;

beforeEach(async () => {
  db = new PGlite();
  await db.exec(readFileSync("src/lib/__tests__/fixtures/property-page-part2-schema.sql", "utf8"));
  await db.exec(`
    INSERT INTO public.user_roles VALUES ('${ADMIN}','admin'), ('${DIRECTOR}','onboarding'), ('${PM}','onboarding'),
      ('${DESIGNER}','onboarding'), ('${VIEWER}','onboarding'), ('${COORD}','tech'), ('${OWNER}','owner'), ('${OTHER_OWNER}','owner');
    INSERT INTO public.directors VALUES ('${DIRECTOR}');
    INSERT INTO public.profiles VALUES ('${PM}', 'Pat PM', 'pm@example.test'), ('${OWNER}', 'Niles Owner', 'o@example.test');
    INSERT INTO public.property_owners(id, name) VALUES ('${OWNER_REC}', 'Example Properties LLC');
    INSERT INTO public.properties(id, name, owner_record_id) VALUES ('${HOME}', '1 Test Ln', '${OWNER_REC}'), ('${OTHER_HOME}', '2 Other St', NULL);
    INSERT INTO public.onboarding_projects(property_id, project_manager, role_assignments)
      VALUES ('${HOME}', '${PM}', '{"lead_designer":"${DESIGNER}"}'), ('${OTHER_HOME}', '${VIEWER}', '{}');
    INSERT INTO public.owner_programs(id, owner_user_id) VALUES ('${PROGRAM}', '${OWNER}'), ('${OTHER_PROGRAM}', '${OTHER_OWNER}');
    INSERT INTO public.owner_program_properties(program_id, property_id) VALUES ('${PROGRAM}', '${HOME}'), ('${OTHER_PROGRAM}', '${OTHER_HOME}');
    INSERT INTO public.onboarding_tasks(id, property_id, title) VALUES ('00000000-0000-4000-8000-0000000000f1', '${HOME}', 'Order beds'),
      ('00000000-0000-4000-8000-0000000000f2', '${HOME}', 'Order rugs');
  `);
  await db.exec(readFileSync(`${DIR}/apply.sql`, "utf8"));
});

describe("project chat", () => {
  it("never returns the team chat to an owner, by any read", async () => {
    await as(PM);
    await post(HOME, "team", "Internal: owner is slow on paint");
    await post(HOME, "owner", "Hi, the paint samples are in");
    await as(OWNER);
    await post(HOME, "owner", "Thanks, I will look tonight");
    const msgs = await asReader(OWNER, "SELECT body FROM public.home_chat_messages ORDER BY created_at");
    expect(msgs.map((m) => m.body)).toEqual(["Hi, the paint samples are in", "Thanks, I will look tonight"]);
    expect((await asReader(OWNER, "SELECT kind FROM public.home_chats")).map((c) => c.kind)).toEqual(["owner"]);
    expect((await asReader(OWNER, "SELECT kind FROM public.my_home_chat_inbox()")).every((r) => r.kind === "owner")).toBe(true);
    // Another home's owner sees nothing at all.
    expect(await asReader(OTHER_OWNER, "SELECT body FROM public.home_chat_messages")).toEqual([]);
    // Staff read both.
    expect((await asReader(VIEWER, "SELECT body FROM public.home_chat_messages")).length).toBe(3);
    await as(OWNER);
    expect(await fails(post(HOME, "team", "let me in"))).toContain("team only");
    await as(OTHER_OWNER);
    expect(await fails(post(HOME, "owner", "wrong home"))).toContain("not post");
  });

  it("view-only staff read both chats and post only in Team only", async () => {
    await as(VIEWER);
    expect(await post(HOME, "team", "I can help with the rugs")).toBeTruthy();
    expect(await fails(post(HOME, "owner", "Hello owner"))).toContain("not post");
    await as(DESIGNER);
    expect(await post(HOME, "owner", "Here are the boards")).toBeTruthy();
  });

  it("an owner message alerts the team and My homes followers; an @mention alerts that teammate", async () => {
    await db.query(`INSERT INTO public.onboarding_follows VALUES ('${HOME}', '${VIEWER}')`);
    await as(OWNER);
    await post(HOME, "owner", "Approved the floor plan");
    const to = (await all("SELECT user_id FROM public.staff_notifications WHERE kind='owner_chat_message' ORDER BY user_id")).map((r) => r.user_id);
    expect(to).toEqual([DIRECTOR, PM, DESIGNER, VIEWER].sort());
    await as(PM);
    await post(HOME, "team", "Can you check this?", [], [DESIGNER, OWNER]);
    const m = await all("SELECT user_id, title FROM public.staff_notifications WHERE kind='home_chat_mention'");
    expect(m).toEqual([{ user_id: DESIGNER, title: "Pat PM mentioned you" }]);
  });

  it("attachments must name one of the six folders and be in the home's Files", async () => {
    const doc = (await one(`INSERT INTO public.documents(property_id) VALUES ('${HOME}') RETURNING id`)).id;
    const otherDoc = (await one(`INSERT INTO public.documents(property_id) VALUES ('${OTHER_HOME}') RETURNING id`)).id;
    await as(PM);
    expect(await fails(post(HOME, "team", "", [{ document_id: doc, folder: "other" }]))).toContain("folder");
    expect(await fails(post(HOME, "team", "", [{ document_id: otherDoc, folder: "media" }]))).toContain("Files");
    expect(await post(HOME, "team", "", [{ document_id: doc, folder: "media", name: "a.jpg" }])).toBeTruthy();
  });

  it("emails the owner once after 15 minutes unread, at most once per 15 minutes per home", async () => {
    await as(PM);
    const m1 = await post(HOME, "owner", "Paint samples are in");
    await as(null);
    await db.query("UPDATE public.home_chat_messages SET created_at = now() - interval '20 minutes' WHERE id = $1", [m1]);
    let r = await one("SELECT public.home_chat_unread_alert_run(now()) AS r");
    expect(r.r.owner_emails).toBe(1);
    const n = await one("SELECT title, email_status FROM public.owner_notifications WHERE kind='home_chat_message'");
    expect(n).toEqual({ title: "You have a new message from ARHA about 1 Test Ln", email_status: "pending" });
    r = await one("SELECT public.home_chat_unread_alert_run(now()) AS r");
    expect(r.r.owner_emails).toBe(0);
    // A second message 16 minutes old, but the last email went out less than 15 minutes ago.
    await as(PM);
    const m2 = await post(HOME, "owner", "Also the rug");
    await as(null);
    await db.query("UPDATE public.home_chat_messages SET created_at = now() - interval '16 minutes' WHERE id = $1", [m2]);
    expect((await one("SELECT public.home_chat_unread_alert_run(now()) AS r")).r.owner_emails).toBe(0);
    expect((await one("SELECT public.home_chat_unread_alert_run(now() + interval '16 minutes') AS r")).r.owner_emails).toBe(1);
    // Once the owner has read it, nothing more goes out.
    await as(OWNER);
    const chat = (await one("SELECT id FROM public.home_chats WHERE kind='owner'")).id;
    await one("SELECT public.mark_home_chat_read($1)", [chat]);
    await as(null);
    expect((await one("SELECT public.home_chat_unread_alert_run(now() + interval '40 minutes') AS r")).r.owner_emails).toBe(0);
  });

  it("Make a Task links the Task back to the message on the same home only", async () => {
    await as(PM);
    const m = await post(HOME, "team", "Order the rugs this week");
    await one("SELECT public.link_chat_message_task($1, '00000000-0000-4000-8000-0000000000f2')", [m]);
    expect(Number((await one("SELECT count(*) n FROM public.home_chat_message_tasks")).n)).toBe(1);
    await as(OWNER);
    expect(await fails(one("SELECT public.link_chat_message_task($1, '00000000-0000-4000-8000-0000000000f1')", [m]))).toContain("not available");
  });
});

describe("Good to know and logged calls", () => {
  it("PM, Director and Admin edit Good to know, each change logged; others and direct writes are refused", async () => {
    await as(PM);
    await one("SELECT public.set_owner_team_notes($1, 'Prefers texts after 6 PM')", [OWNER_REC]);
    await as(DIRECTOR);
    await one("SELECT public.set_owner_team_notes($1, 'Prefers texts after 6 PM. Has a dog.')", [OWNER_REC]);
    const h = await all("SELECT before_text, after_text, actor_id FROM public.property_owner_team_note_events ORDER BY created_at, after_text");
    expect(h.map((x) => x.actor_id)).toEqual([PM, DIRECTOR]);
    expect(h[1].before_text).toBe("Prefers texts after 6 PM");
    await as(DESIGNER);
    expect(await fails(one("SELECT public.set_owner_team_notes($1, 'x')", [OWNER_REC]))).toContain("Only the Project Manager");
    await as(PM);
    await db.query("SET ROLE authenticated");
    const err = await fails(db.query("UPDATE public.property_owners SET team_notes = 'sneaky' WHERE id = $1", [OWNER_REC]));
    await db.query("RESET ROLE");
    expect(err).toContain("Owner tab");
  });

  it("a logged call is a note with kind call, written only by the home's team", async () => {
    await as(PM);
    const id = (await one("SELECT public.log_owner_contact($1, 'call', 'Called about the closing date') AS id", [HOME])).id;
    expect(await one("SELECT kind, author_id, internal FROM public.onboarding_notes WHERE id=$1", [id])).toEqual({ kind: "call", author_id: PM, internal: true });
    await as(VIEWER);
    expect(await fails(one("SELECT public.log_owner_contact($1, 'text', 'Texted them')", [HOME]))).toContain("Only the home");
    expect(await fails(db.query(`INSERT INTO public.onboarding_notes(property_id, body, kind) VALUES ('${HOME}', 'fake call', 'call')`))).toContain("Owner tab");
    expect((await one(`INSERT INTO public.onboarding_notes(property_id, body) VALUES ('${HOME}', 'team note') RETURNING kind`)).kind).toBe("note");
  });
});

describe("weekly owner update", () => {
  it("sends nothing from 3 PM Friday until Monday", async () => {
    const closed = async (t: string) => (await one(`SELECT public.weekly_update_send_closed(${central(t)}) AS c`)).c;
    expect(await closed("2026-11-13 14:59")).toBe(false);
    expect(await closed("2026-11-13 15:00")).toBe(true);
    expect(await closed("2026-11-14 10:00")).toBe(true);
    expect(await closed("2026-11-15 22:00")).toBe(true);
    expect(await closed("2026-11-16 08:00")).toBe(false);
  });

  it("only the PM, Director or Admin send; a sent update reaches the portal once", async () => {
    const id = (await one(`INSERT INTO public.owner_weekly_updates(property_id, week_start, draft_text) VALUES ('${HOME}', '2026-11-09', 'Done this week: beds ordered') RETURNING id`)).id;
    await as(DESIGNER);
    expect(await fails(one("SELECT public.send_weekly_update($1, 'x long enough text')", [id]))).toContain("Only the Project Manager");
    await as(null);
    const out = (await one("SELECT public.weekly_update_send_internal($1, 'Done this week: beds ordered', $2, false, NULL) AS r", [id, PM])).r;
    expect(out.notification_id).toBeTruthy();
    expect(await one("SELECT kind, title, email_status FROM public.owner_notifications")).toEqual({ kind: "weekly_update", title: "This week at 1 Test Ln", email_status: "pending" });
    expect(await fails(one("SELECT public.weekly_update_send_internal($1, 'again and again', $2, false, NULL)", [id, PM]))).toContain("already handled");
  });

  it("auto-send starts off for every home and only the Director or Admin turn it on; the PM can pause", async () => {
    expect(Number((await one("SELECT count(*) n FROM public.owner_weekly_update_settings")).n)).toBe(0);
    await as(PM);
    expect(await fails(one("SELECT public.set_weekly_update_switch($1, true, NULL)", [HOME]))).toContain("Only the Director");
    await one("SELECT public.set_weekly_update_switch($1, NULL, true)", [HOME]);
    await as(DIRECTOR);
    await one("SELECT public.set_weekly_update_switch($1, true, NULL)", [HOME]);
    expect(await one("SELECT auto_send, paused FROM public.owner_weekly_update_settings")).toEqual({ auto_send: true, paused: true });
    expect(Number((await one("SELECT count(*) n FROM public.audit_log WHERE action='weekly_update_switch_changed'")).n)).toBe(2);
  });
});

describe("automatic owner reminders", () => {
  const item = async (due: string, extra = "") =>
    (await one(`INSERT INTO public.work_items(program_id, property_id, title, due_on, response_types${extra ? "," + extra.split("=")[0] : ""})
      VALUES ('${PROGRAM}', '${HOME}', 'Pick the paint', '${due}', '{decision}'${extra ? "," + extra.split("=")[1] : ""}) RETURNING id`)).id;
  const run = async (t: string) => (await one(`SELECT public.owner_decision_reminder_run(${central(t)}) AS r`)).r.reminders;

  it("sends one reminder at 9 AM Central the business day before, never twice", async () => {
    await item("2026-11-16"); // Monday
    expect(await run("2026-11-13 08:55")).toBe(0); // Friday before 9
    expect(await run("2026-11-13 09:05")).toBe(1);
    expect(await run("2026-11-13 09:10")).toBe(0);
    expect(await one("SELECT title, email_status FROM public.owner_notifications")).toEqual({ title: "Reminder: Pick the paint is due Nov 16.", email_status: "held" });
  });

  it("skips weekends and holidays, and items already answered", async () => {
    await db.query("INSERT INTO public.ao_business_holidays(day) VALUES ('2026-11-13')");
    await item("2026-11-16");
    expect(await run("2026-11-13 09:05")).toBe(0); // the holiday
    expect(await run("2026-11-12 09:05")).toBe(1); // Thursday is the business day before
    await item("2026-11-19", "responded_at=now()");
    expect(await run("2026-11-18 09:05")).toBe(0);
  });

  it("bundles every reminder for one owner on one day into the one daily email", async () => {
    await item("2026-11-16");
    await db.query(`INSERT INTO public.work_items(program_id, property_id, title, due_on, response_types) VALUES ('${PROGRAM}', '${HOME}', 'Choose the rug', '2026-11-16', '{decision}')`);
    expect(await run("2026-11-13 09:05")).toBe(2);
    const r = (await one(`SELECT public.ao_owner_email_run(${central("2026-11-13 09:06")}) AS r`)).r;
    expect(r.daily_sent).toBe(1);
    const daily = await all("SELECT body FROM public.owner_notifications WHERE kind='ao_daily'");
    expect(daily.length).toBe(1);
    expect(daily[0].body).toContain("Reminder: Pick the paint is due Nov 16.");
    expect(daily[0].body).toContain("Reminder: Choose the rug is due Nov 16.");
  });
});

describe("email safety", () => {
  it("Task notices written together in one save are in-app only; a single Task keeps its email", async () => {
    await db.exec(`
      BEGIN;
      INSERT INTO public.staff_notifications(user_id, kind, entity_type, entity_id, actor_id, email_status)
        VALUES ('${DIRECTOR}', 'onboarding_task_completed', 'onboarding_task', '00000000-0000-4000-8000-0000000000f1', '${PM}', 'pending');
      INSERT INTO public.staff_notifications(user_id, kind, entity_type, entity_id, actor_id, email_status)
        VALUES ('${DIRECTOR}', 'onboarding_task_completed', 'onboarding_task', '00000000-0000-4000-8000-0000000000f2', '${PM}', 'pending');
      COMMIT;`);
    expect((await all("SELECT email_status FROM public.staff_notifications")).map((r) => r.email_status)).toEqual(["none", "none"]);
    await db.query(`INSERT INTO public.staff_notifications(user_id, kind, entity_type, entity_id, actor_id, email_status)
        VALUES ('${DIRECTOR}', 'onboarding_task_completed', 'onboarding_task', '00000000-0000-4000-8000-0000000000f1', '${PM}', 'pending')`);
    expect(Number((await one("SELECT count(*) n FROM public.staff_notifications WHERE email_status='pending'")).n)).toBe(1);
  });
});

describe("undo", () => {
  it("removes everything added and restores the live daily owner email", async () => {
    await db.exec(readFileSync(`${DIR}/apply.undo.sql`, "utf8"));
    expect(Number((await one("SELECT count(*) n FROM information_schema.tables WHERE table_name LIKE 'home_chat%' OR table_name LIKE 'owner_weekly%'")).n)).toBe(0);
    expect(Number((await one("SELECT count(*) n FROM information_schema.columns WHERE table_name IN ('onboarding_notes','property_owners') AND column_name IN ('kind','team_notes')")).n)).toBe(0);
    const def = (await one("SELECT pg_get_functiondef('public.ao_owner_email_run(timestamptz)'::regprocedure) d")).d;
    expect(def).not.toContain("owner_decision_reminder");
    expect(def).toContain("Here is what is new in your portal.");
  });
});
