import { beforeEach, describe, expect, it } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { RECOVERY_POLICY } from "@/lib/recovery-policy";

/**
 * Isolated PostgreSQL check of docs/pending/alerts/ (Emily, Nov 7, 2026; register T2, T6, C2, C3).
 * Helpers are the live captures; only tables are stubbed. Nothing touches the real database.
 */
const DIR = "docs/pending/alerts";
const read = (p: string) => readFileSync(p, "utf8");
const cap = (n: string) => read(`${DIR}/live-capture/${n}.sql`).trimEnd() + ";\n";
const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const COORD = U(1), OWNER = U(2), SUP = U(3), DIR_OPS = U(4), ADMIN = U(5), VENDOR = U(6), MENTIONED = U(7);

const SCHEMA = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA cron; CREATE SCHEMA private;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
CREATE TABLE cron.jobs(name text PRIMARY KEY, schedule text, command text);
CREATE FUNCTION cron.schedule(n text, s text, c text) RETURNS bigint LANGUAGE sql AS
  $$ INSERT INTO cron.jobs VALUES (n, s, c) ON CONFLICT (name) DO UPDATE SET schedule = excluded.schedule, command = excluded.command RETURNING 1::bigint $$;
CREATE FUNCTION cron.unschedule(n text) RETURNS boolean LANGUAGE sql AS $$ DELETE FROM cron.jobs WHERE name = n RETURNING true $$;
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE FUNCTION private.is_supervisor(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','manager')) $$;
CREATE FUNCTION private.is_synthetic_account() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE FUNCTION private.demo_notify_ok(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.functional_roles(code text PRIMARY KEY, current_seat_holder uuid, current_seat_name text);
CREATE FUNCTION public.seat_override_at(_role_code text, _at timestamptz) RETURNS TABLE(user_id uuid, kind text) LANGUAGE sql STABLE AS
  $$ SELECT NULL::uuid, NULL::text WHERE false $$;
CREATE TABLE public.app_settings(key text PRIMARY KEY, value jsonb);
CREATE TABLE public.staff_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, kind text, title text, body text,
  entity_type text, entity_id uuid, link_path text, priority text, actor_id uuid, email_status text, is_demo boolean, created_at timestamptz DEFAULT now());
CREATE TABLE public.tickets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ref serial, title text DEFAULT 'Water leak', status text DEFAULT 'open',
  priority text DEFAULT 'p1', assigned_to uuid, current_action_owner uuid, record_owner uuid, accountable_owner uuid, created_by uuid,
  pending_handoff_to uuid, archived_at timestamptz, is_demo boolean DEFAULT false, external_source text, external_status text,
  reported_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(), acknowledged_at timestamptz, action_started_at timestamptz,
  response_due_at timestamptz, action_due_at timestamptz, next_review_at timestamptz);
CREATE TABLE public.ticket_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, author_id uuid, kind text, event_type text,
  body text, internal boolean DEFAULT true, mentions uuid[] DEFAULT '{}');
CREATE TABLE public.approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, title text, detail text,
  approver_id uuid, status text DEFAULT 'pending', requested_by uuid, is_demo boolean DEFAULT false);
CREATE TABLE public.work_orders(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid);
CREATE TABLE public.guest_recovery(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, title text, proposed_amount numeric,
  approval_status text, approval_authority text, requested_by uuid, is_demo boolean DEFAULT false);
CREATE TABLE public.claims(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_id uuid, title text DEFAULT 'Broken table', stage text DEFAULT 'gathering',
  estimated_amount numeric, submitted_amount numeric, assigned_to uuid, is_demo boolean DEFAULT false);
CREATE TABLE public.claim_waivers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claim_id uuid, status text, requested_by uuid, routed_to uuid);
CREATE TABLE public.claim_activity(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claim_id uuid, author_id uuid, event_type text, body text, detail jsonb, is_demo boolean);
`;

const PARTS = [
  "01_team_queue_and_waiting_alerts",
  "02_note_alerts",
  "03_approval_links",
  "04_claim_approval",
  "05_notification_categories",
];

let db: PGlite;

async function fresh() {
  db = new PGlite();
  await db.exec(SCHEMA);
  await db.exec(`CREATE TABLE public.user_notification_preferences(user_id uuid PRIMARY KEY, email_enabled boolean NOT NULL DEFAULT true);`);
  for (const n of ["private.is_staff", "public.is_supervisor", "public.seat_holder_at", "private.is_director", "public.notify_staff", "public.notify_staff_isolated", "public.notify_ticket_flow_events", "public.notify_approval_events", "public.notify_unrouted_approval", "public.notify_recovery_approval"])
    await db.exec(cap(n));
  await db.exec(`CREATE FUNCTION public.is_director(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT private.is_director(_user_id) $$;`);
  await db.exec(`CREATE TRIGGER notify_ticket_flow_events_trg AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.notify_ticket_flow_events();
    CREATE TRIGGER notify_approval_events_trg AFTER INSERT OR UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.notify_approval_events();
    CREATE TRIGGER notify_recovery_approval_trg AFTER INSERT OR UPDATE ON public.guest_recovery FOR EACH ROW EXECUTE FUNCTION public.notify_recovery_approval();`);
  for (const [u, r] of [[COORD, "tech"], [OWNER, "tech"], [MENTIONED, "tech"], [SUP, "manager"], [DIR_OPS, "manager"], [ADMIN, "admin"], [VENDOR, "vendor"]] as const)
    await db.query("INSERT INTO public.user_roles VALUES ($1, $2)", [u, r]);
  await db.query("INSERT INTO public.functional_roles(code, current_seat_holder) VALUES ('ops_supervisor', $1), ('director_ops', $2)", [SUP, DIR_OPS]);
  for (const p of PARTS) await db.exec(read(`${DIR}/${p}.sql`));
  await db.exec(read(`${DIR}/06_team_queue_timing_setting.sql`));
}

const as = (uid: string | null) => db.exec(`SELECT set_config('test.uid', '${uid ?? ""}', false)`);
const run = async () => (await db.query<{ n: number }>("SELECT public.run_ticket_timed_alerts() AS n")).rows[0]!.n;
const alerts = async (kind?: string) =>
  (await db.query<{ user_id: string; kind: string; link_path: string; title: string; email_status: string; body: string }>(
    `SELECT user_id, kind, link_path, title, email_status, body FROM public.staff_notifications ${kind ? "WHERE kind = $1" : ""} ORDER BY created_at, kind`,
    kind ? [kind] : [],
  )).rows;
async function ticket(extra: Record<string, unknown> = {}) {
  const cols = Object.keys(extra);
  const vals = Object.values(extra);
  const sql = cols.length
    ? `INSERT INTO public.tickets(${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`
    : "INSERT INTO public.tickets DEFAULT VALUES RETURNING id";
  return (await db.query<{ id: string }>(sql, vals)).rows[0]!.id;
}
const waitedMinutes = (id: string, m: number) =>
  db.query(`UPDATE public.tickets SET unowned_since = now() - make_interval(mins => ${m}) WHERE id = $1`, [id]);
async function throws(sql: string, params: unknown[] = []) {
  try {
    await db.query(sql, params);
  } catch (e) {
    return (e as Error).message;
  }
  return null;
}

beforeEach(fresh);

describe("Team Queue: a Right now ticket nobody has taken", () => {
  it("nothing at 3 minutes; the Supervisor once at 10; the Director once at 15; no repeats", async () => {
    const t = await ticket();
    await waitedMinutes(t, 3);
    expect(await run()).toBe(0);
    await waitedMinutes(t, 10);
    // The wait start is the key, so set it once and let the clock run past both marks.
    const ten = await run();
    expect(ten).toBe(1);
    expect((await alerts()).map((a) => [a.user_id, a.kind])).toEqual([[SUP, "team_queue_supervisor"]]);
    expect(await run()).toBe(0);
  });

  it("at 15 minutes the Director too, each once, in app and email, linked to the ticket", async () => {
    const t = await ticket();
    await waitedMinutes(t, 15);
    expect(await run()).toBe(2);
    expect(await run()).toBe(0);
    expect(await run()).toBe(0);
    const rows = await alerts();
    expect(rows.map((a) => [a.user_id, a.kind]).sort()).toEqual([[SUP, "team_queue_supervisor"], [DIR_OPS, "team_queue_director"]].sort());
    for (const a of rows) {
      expect(a.link_path).toBe(`/tickets/${t}`);
      expect(a.email_status).toBe("pending");
    }
    expect(rows.find((a) => a.kind === "team_queue_director")!.body).toContain("The Operations Supervisor was alerted at 10 minutes.");
  });

  it("never alerts for Today or Routine, waiting, owned, archived, demo or quiet Notion tickets", async () => {
    for (const extra of [
      { priority: "p2" },
      { priority: "p3" },
      { status: "waiting" },
      { assigned_to: COORD },
      { archived_at: new Date().toISOString() },
      { is_demo: true },
      { external_source: "notion", external_status: "Open" },
    ]) {
      const t = await ticket(extra);
      await waitedMinutes(t, 30);
    }
    expect(await run()).toBe(0);
  });

  it("tickets from the three automated sources are included once nobody owns them", async () => {
    for (const s of ["email", "ownerrez", "breezeway"]) await waitedMinutes(await ticket({ external_source: s }), 11);
    expect(await run()).toBe(3);
  });

  it("a ticket that was given back alerts again for its new wait, once", async () => {
    const t = await ticket();
    await waitedMinutes(t, 11);
    expect(await run()).toBe(1);
    await db.query("UPDATE public.tickets SET assigned_to = $1 WHERE id = $2", [COORD, t]);
    await db.query("UPDATE public.tickets SET assigned_to = NULL WHERE id = $1", [t]);
    expect(await run()).toBe(0);
    await waitedMinutes(t, 12);
    expect(await run()).toBe(1);
    expect(await run()).toBe(0);
  });
});

describe("Waiting for an owner never counts against the person who takes it", () => {
  it("a new ticket with no owner starts waiting; Take clears it and moves the unmet clocks forward by the wait", async () => {
    const t = await ticket({ response_due_at: "2026-11-09T15:03:00Z", action_due_at: "2026-11-09T15:05:00Z" });
    const before = (await db.query<{ unowned_since: string | null }>("SELECT unowned_since FROM public.tickets WHERE id = $1", [t])).rows[0]!;
    expect(before.unowned_since).not.toBeNull();
    await db.query("UPDATE public.tickets SET unowned_since = now() - interval '40 minutes' WHERE id = $1", [t]);
    await db.query("UPDATE public.tickets SET assigned_to = $1 WHERE id = $2", [COORD, t]);
    const after = (await db.query<{ unowned_since: string | null; r: string; a: string }>(
      "SELECT unowned_since, (response_due_at - '2026-11-09T15:03:00Z'::timestamptz)::text AS r, (action_due_at - '2026-11-09T15:05:00Z'::timestamptz)::text AS a FROM public.tickets WHERE id = $1",
      [t],
    )).rows[0]!;
    expect(after.unowned_since).toBeNull();
    expect(after.r.startsWith("00:40")).toBe(true);
    expect(after.a.startsWith("00:40")).toBe(true);
  });

  it("a clock already met, or reset in the same save, is not moved", async () => {
    const t = await ticket({ response_due_at: "2026-11-09T15:03:00Z", acknowledged_at: "2026-11-09T15:01:00Z" });
    await db.query("UPDATE public.tickets SET unowned_since = now() - interval '40 minutes' WHERE id = $1", [t]);
    await db.query("UPDATE public.tickets SET assigned_to = $1 WHERE id = $2", [COORD, t]);
    const r = (await db.query<{ v: string }>("SELECT response_due_at::text AS v FROM public.tickets WHERE id = $1", [t])).rows[0]!.v;
    expect(r.startsWith("2026-11-09 15:03")).toBe(true);
    const t2 = await ticket({ response_due_at: "2026-11-09T15:03:00Z" });
    await db.query("UPDATE public.tickets SET assigned_to = $1, response_due_at = '2026-11-10T09:00:00Z' WHERE id = $2", [COORD, t2]);
    const r2 = (await db.query<{ v: string }>("SELECT response_due_at::text AS v FROM public.tickets WHERE id = $1", [t2])).rows[0]!.v;
    expect(r2.startsWith("2026-11-10 09:00")).toBe(true);
  });

  it("a ticket created with an owner never waits", async () => {
    const t = await ticket({ assigned_to: COORD });
    const r = (await db.query<{ u: string | null }>("SELECT unowned_since AS u FROM public.tickets WHERE id = $1", [t])).rows[0]!;
    expect(r.u).toBeNull();
  });
});

describe("Back from waiting fires at the return time", () => {
  it("not before the return time, once at it, again only for a new return time", async () => {
    const t = await ticket({ assigned_to: OWNER, status: "waiting", next_review_at: new Date(Date.now() + 3_600_000).toISOString() });
    expect(await run()).toBe(0);
    await db.query("UPDATE public.tickets SET next_review_at = now() - interval '1 minute' WHERE id = $1", [t]);
    expect(await run()).toBe(1);
    expect(await run()).toBe(0);
    const [a] = await alerts("waiting_returned");
    expect(a!.user_id).toBe(OWNER);
    expect(a!.body).toBe("The return time you set has come. Pick it up again.");
    expect(a!.email_status).toBe("pending");
    await db.query("UPDATE public.tickets SET next_review_at = now() - interval '30 seconds' WHERE id = $1", [t]);
    expect(await run()).toBe(1);
  });

  it("leaving Waiting no longer alerts; closure QA still does", async () => {
    const t = await ticket({ assigned_to: OWNER, status: "waiting", next_review_at: new Date(Date.now() + 3_600_000).toISOString() });
    await as(COORD);
    await db.query("UPDATE public.tickets SET status = 'in_progress' WHERE id = $1", [t]);
    expect(await alerts("waiting_returned")).toEqual([]);
    await db.query("UPDATE public.tickets SET status = 'resolved' WHERE id = $1", [t]);
    expect((await alerts("closure_qa")).map((a) => a.user_id)).toEqual([SUP]);
  });
});

describe("New note alert and mentions", () => {
  it("the owner and the people involved get New note, the mentioned get You were mentioned, the author nothing", async () => {
    const t = await ticket({ assigned_to: OWNER, created_by: COORD, record_owner: OWNER });
    await db.query(
      "INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, body, mentions) VALUES ($1, $2, 'note', 'note', 'Called the guest.  Plumber at 3.', $3)",
      [t, COORD, [MENTIONED, VENDOR, COORD]],
    );
    const rows = await alerts();
    expect(rows.map((a) => [a.user_id, a.kind]).sort()).toEqual([[MENTIONED, "note_mention"], [OWNER, "ticket_note"]].sort());
    for (const a of rows) {
      expect(a.link_path).toBe(`/tickets/${t}`);
      expect(a.body).toBe("Called the guest. Plumber at 3.");
      expect(a.email_status).toBe("pending");
    }
  });

  it("a mentioned owner is alerted once, as a mention", async () => {
    const t = await ticket({ assigned_to: OWNER });
    await db.query("INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, body, mentions) VALUES ($1, $2, 'note', 'internal_note', 'Can you check?', $3)", [t, COORD, [OWNER]]);
    expect((await alerts()).map((a) => [a.user_id, a.kind])).toEqual([[OWNER, "note_mention"]]);
  });

  it("system lines and other activity never alert", async () => {
    const t = await ticket({ assigned_to: OWNER });
    await db.query("INSERT INTO public.ticket_activity(ticket_id, author_id, kind, event_type, body) VALUES ($1, $2, 'note', 'insurance_risk', 'x'), ($1, $2, 'status', 'status_changed', 'x'), ($1, NULL, 'note', 'note', 'x')", [t, COORD]);
    expect(await alerts()).toEqual([]);
  });
});

describe("Approval alerts open the exact ticket", () => {
  it("a work order approval links to its ticket; without a ticket the old link stays", async () => {
    const t = await ticket({ assigned_to: COORD });
    const wo = (await db.query<{ id: string }>("INSERT INTO public.work_orders(ticket_id) VALUES ($1) RETURNING id", [t])).rows[0]!.id;
    await db.query("INSERT INTO public.approvals(entity_type, entity_id, title, approver_id, requested_by) VALUES ('work_order', $1, 'Repair', $2, $3)", [wo, SUP, COORD]);
    await db.query("INSERT INTO public.approvals(entity_type, entity_id, title, approver_id, requested_by) VALUES ('onboarding_task', $1, 'Paint', $2, $3)", [U(99), SUP, COORD]);
    expect((await alerts("approval_required")).map((a) => a.link_path).sort()).toEqual(["/oversight", `/tickets/${t}`].sort());
  });

  it("a refund approval links to its ticket", async () => {
    const t = await ticket({ assigned_to: COORD });
    await db.query("INSERT INTO public.guest_recovery(ticket_id, title, proposed_amount, approval_status, approval_authority, requested_by) VALUES ($1, 'Late check in', 200, 'pending', 'supervisor', $2)", [t, COORD]);
    expect((await alerts("approval_required")).map((a) => [a.user_id, a.link_path])).toEqual([[SUP, `/tickets/${t}`]]);
  });

  it("only the link changes in each function (the undo restores every live capture)", () => {
    const staged = read(`${DIR}/03_approval_links.sql`);
    const undo = read(`${DIR}/03_undo_approval_links.sql`);
    for (const n of ["notify_approval_events", "notify_unrouted_approval", "notify_recovery_approval", "decide_recovery_approval", "request_claim_waiver", "decide_claim_waiver"]) {
      const live = read(`${DIR}/live-capture/public.${n}.sql`).trimEnd();
      expect(undo).toContain(live + ";");
      const body = staged.split(`-- public.${n}\n`)[1]!.split("$function$;")[0]! + "$function$";
      const changed = body.split("\n").filter((l, i) => l !== live.split("\n")[i]);
      expect(changed.length).toBe(1);
      expect(changed[0]).toContain("private.ticket_link_for(");
    }
    const flowUndo = read(`${DIR}/01_undo_team_queue_and_waiting_alerts.sql`);
    expect(flowUndo).toContain(read(`${DIR}/live-capture/public.notify_ticket_flow_events.sql`).trimEnd() + ";");
  });
});

describe("Claim card decision (register C2)", () => {
  async function claim(amount: number, extra: Record<string, unknown> = {}) {
    const t = await ticket({ assigned_to: COORD });
    const cols = ["ticket_id", "estimated_amount", ...Object.keys(extra)];
    const vals = [t, amount, ...Object.values(extra)];
    const id = (await db.query<{ id: string }>(`INSERT INTO public.claims(${cols.join(",")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id`, vals)).rows[0]!.id;
    return { id, ticket: t };
  }
  const authority = async (amount: number) =>
    (await db.query<{ a: string }>("SELECT private.claim_required_authority($1) AS a", [amount])).rows[0]!.a;

  it("the ladder: coordinator up to and including $500, Supervisor to $1,500, Director above, same as refunds", async () => {
    expect(await authority(500)).toBe("coordinator");
    expect(await authority(500.01)).toBe("supervisor");
    expect(await authority(600)).toBe("supervisor");
    expect(await authority(1500)).toBe("supervisor");
    expect(await authority(1500.01)).toBe("director");
    expect(await authority(1600)).toBe("director");
    expect(RECOVERY_POLICY.pcApprovalCeiling).toBe(500);
    expect(RECOVERY_POLICY.supervisorApprovalCeiling).toBe(1500);
  });

  it("a $600 claim needs the Operations Supervisor; a coordinator cannot decide it; a reason is required", async () => {
    const c = await claim(600);
    await as(COORD);
    const level = (await db.query<{ l: string }>("SELECT public.request_claim_approval($1, 600) AS l", [c.id])).rows[0]!.l;
    expect(level).toBe("supervisor");
    const [n] = await alerts("approval_required");
    expect(n!.user_id).toBe(SUP);
    expect(n!.link_path).toBe(`/tickets/${c.ticket}`);
    expect(n!.email_status).toBe("pending");
    expect(await throws("SELECT public.decide_claim_approval($1, 'approve', 'ok')", [c.id])).toContain("Only the Operations Supervisor");
    await as(SUP);
    expect(await throws("SELECT public.decide_claim_approval($1, 'approve', '  ')", [c.id])).toContain("Add a reason");
    await db.query("SELECT public.decide_claim_approval($1, 'approve', 'Photos are clear')", [c.id]);
    const row = (await db.query<{ approval_status: string; approval_reason: string }>("SELECT approval_status, approval_reason FROM public.claims WHERE id = $1", [c.id])).rows[0]!;
    expect(row).toEqual({ approval_status: "approved", approval_reason: "Photos are clear" });
    expect((await alerts("approval_decided")).map((a) => [a.user_id, a.link_path])).toEqual([[COORD, `/tickets/${c.ticket}`]]);
  });

  it("a $1,600 claim needs the Director of Operations; the Supervisor is refused", async () => {
    const c = await claim(1600);
    await as(COORD);
    await db.query("SELECT public.request_claim_approval($1, 1600)", [c.id]);
    expect((await alerts("approval_required")).map((a) => a.user_id)).toEqual([DIR_OPS]);
    await as(SUP);
    expect(await throws("SELECT public.decide_claim_approval($1, 'approve', 'ok')", [c.id])).toContain("Only the Director of Operations");
    await as(DIR_OPS);
    await db.query("SELECT public.decide_claim_approval($1, 'decline', 'Not enough proof')", [c.id]);
    expect((await db.query<{ s: string }>("SELECT approval_status AS s FROM public.claims WHERE id = $1", [c.id])).rows[0]!.s).toBe("declined");
  });

  it("up to $500 needs no approval; asking is refused with a plain line", async () => {
    const c = await claim(500);
    await as(COORD);
    expect(await throws("SELECT public.request_claim_approval($1, 500)", [c.id])).toContain("Up to $500 needs no approval.");
  });

  it("a claim over $500 cannot be sent without the approval at the right level; approval fields cannot be typed in", async () => {
    const small = await claim(450);
    await db.query("UPDATE public.claims SET stage = 'submitted' WHERE id = $1", [small.id]);
    const c = await claim(600);
    expect(await throws("UPDATE public.claims SET stage = 'submitted' WHERE id = $1", [c.id])).toContain("needs the Operations Supervisor");
    expect(await throws("UPDATE public.claims SET approval_status = 'approved', approval_amount = 600 WHERE id = $1", [c.id])).toContain("Claim approvals are recorded");
    await as(COORD);
    await db.query("SELECT public.request_claim_approval($1, 600)", [c.id]);
    await as(SUP);
    await db.query("SELECT public.decide_claim_approval($1, 'approve', 'ok')", [c.id]);
    expect(await throws("UPDATE public.claims SET estimated_amount = 1600, stage = 'submitted' WHERE id = $1", [c.id])).toContain("needs the Director of Operations");
    await db.query("UPDATE public.claims SET stage = 'submitted' WHERE id = $1", [c.id]);
  });

  it("only Operations can ask", async () => {
    const c = await claim(900);
    await as(VENDOR);
    expect(await throws("SELECT public.request_claim_approval($1, 900)", [c.id])).toContain("Only Operations");
  });
});

describe("Schedule, setting and preferences", () => {
  it("the check runs every minute and the setting holds the decided times", async () => {
    const job = (await db.query<{ schedule: string; command: string }>("SELECT schedule, command FROM cron.jobs WHERE name = 'ticket-timed-alerts'")).rows[0]!;
    expect(job).toEqual({ schedule: "* * * * *", command: "SELECT public.run_ticket_timed_alerts()" });
    const v = (await db.query<{ value: Record<string, unknown> }>("SELECT value FROM public.app_settings WHERE key = 'team_queue_timing'")).rows[0]!.value;
    expect(v).toEqual({
      right_now_red_minutes: 3,
      supervisor_minutes: 10,
      director_minutes: 15,
      today_day_shift_ends: "17:00",
      today_night_shift_ends: "22:00",
      today_red_minutes_before: 120,
      routine_default_hours: 24,
    });
  });

  it("a new person starts with email and in app on for notes and mentions and Team Queue", async () => {
    await db.query("INSERT INTO public.user_notification_preferences(user_id) VALUES ($1)", [COORD]);
    const r = (await db.query("SELECT email_notes_mentions, inapp_notes_mentions, email_team_queue, inapp_team_queue FROM public.user_notification_preferences")).rows[0];
    expect(r).toEqual({ email_notes_mentions: true, inapp_notes_mentions: true, email_team_queue: true, inapp_team_queue: true });
  });

  it("every undo runs cleanly after the change", async () => {
    for (const p of ["05", "04", "03", "02"]) {
      const f = { "05": "05_undo_notification_categories", "04": "04_undo_claim_approval", "03": "03_undo_approval_links", "02": "02_undo_note_alerts" }[p]!;
      // decide_recovery_approval and the claim waiver functions are recreated by undo 03; their tables are not stubbed, which plpgsql allows.
      await db.exec(read(`${DIR}/${f}.sql`));
    }
    await db.exec(read(`${DIR}/01_undo_team_queue_and_waiting_alerts.sql`));
    await db.exec(read(`${DIR}/06_undo_team_queue_timing_setting.sql`));
    expect((await db.query("SELECT 1 FROM cron.jobs")).rows).toEqual([]);
  });
});
