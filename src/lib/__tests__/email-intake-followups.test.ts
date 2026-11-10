import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import {
  EMAIL_TEST_COPY,
  ONE_SWITCH_NOTE,
  OUT_OF_STEP_LINE,
  RUN_INTAKE_NOW_SHOWN,
  intakeStatusLines,
  isEmailTestTicket,
  seesEmailTestRecords,
  ticketShownInLens,
} from "@/lib/email-intake";

/**
 * Email intake follow ups (Emily, Nov 9, register E1 (a), (c), (e)).
 * (a) test records show with their Test chip to the people who run the test plan and to
 *     nobody else, and are never counted; (c) Run intake now is hidden; (e) one switch.
 */
const read = (p: string) => readFileSync(p, "utf8");
const queue = read("src/routes/_authenticated/team-queue.tsx");
const ticketPage = read("src/routes/_authenticated/tickets.$ticketId.tsx");
const dbList = read("src/routes/_authenticated/direct-bookings.index.tsx");
const dbFns = read("src/lib/direct-bookings.functions.ts");
const panel = read("src/components/MailboxIntakePanel.tsx");
const flags = read("src/components/FeatureFlagsPanel.tsx");

const testTicket = { is_demo: true, external_source: "email" };
const demoTicket = { is_demo: true, external_source: "manual" };
const realTicket = { is_demo: false, external_source: "email" };

describe("(a) who sees email test records", () => {
  it("the Admin, the Operations Supervisor and the Directors see them", () => {
    expect(seesEmailTestRecords(["admin"])).toBe(true);
    expect(seesEmailTestRecords(["manager"], { opsSupervisor: true })).toBe(true);
    expect(seesEmailTestRecords(["manager"], { opsDirector: true })).toBe(true);
    expect(seesEmailTestRecords(["onboarding"], { onboardingDirector: true })).toBe(true);
  });
  it("a coordinator does not, and neither does anyone else", () => {
    expect(seesEmailTestRecords(["tech"])).toBe(false);
    expect(seesEmailTestRecords(["tech"], { projectManager: true } as never)).toBe(false);
    expect(seesEmailTestRecords(["manager"], { finance: true } as never)).toBe(false);
    expect(seesEmailTestRecords(["onboarding"])).toBe(false);
    expect(seesEmailTestRecords([])).toBe(false);
  });
});

describe("(a) the ticket page", () => {
  it("opens an email test ticket in the normal screens for the Admin, Supervisor and Directors", () => {
    expect(isEmailTestTicket(testTicket)).toBe(true);
    expect(ticketShownInLens(testTicket, false, true)).toBe(true);
  });
  it("not for a coordinator", () => {
    expect(ticketShownInLens(testTicket, false, false)).toBe(false);
  });
  it("other demo records stay out of the normal screens for everyone; real tickets are unchanged", () => {
    expect(ticketShownInLens(demoTicket, false, true)).toBe(false);
    expect(ticketShownInLens(realTicket, false, false)).toBe(true);
    expect(ticketShownInLens(realTicket, false, true)).toBe(true);
    expect(ticketShownInLens(null, false, true)).toBe(false);
  });
  it("loads by id and applies the rule, keyed on it, after roles are known", () => {
    expect(ticketPage).toContain('queryKey: ["ticket", ticketId, demoMode, seesTests]');
    expect(ticketPage).toContain("enabled: !role.isLoading");
    expect(ticketPage).toContain("!ticketShownInLens(ticket.data, demoMode, seesTests)");
    expect(ticketPage).toContain("const seesTests = seesEmailTestRecords(role.roles, role.seats);");
    expect(ticketPage).toContain("{isEmailTestTicket(ticket) ? <EmailTestChip /> : null}");
  });
  it("a coordinator who follows a link reads This ticket is no longer available, not a demo message", () => {
    expect(ticketPage).toContain("!isEmailTestTicket(r.data)");
  });
});

describe("(a) the Team Queue", () => {
  it("shows test tickets with the Test chip in their own list, only for the test plan roles", () => {
    expect(queue).toContain("const seesTests = !demoMode && seesEmailTestRecords(roles, access.seats);");
    expect(queue).toContain("enabled: seesTests,");
    expect(queue).toContain("const emailTests = seesTests ? (testTickets.data ?? []) : [];");
    const list = queue.slice(queue.indexOf("<EmailTestRecords>"), queue.indexOf("</EmailTestRecords>"));
    expect(list).toContain("<EmailTestChip />");
    expect(list).toContain('to="/tickets/$ticketId"');
  });
  it("never counts them: the queue, its chips, flags and totals read only the main list", () => {
    // The main list still reads only the current lens, so test tickets are not in it.
    expect(queue).toContain('.eq("is_demo", demoMode)\n        .is("archived_at", null)\n        .order("reported_at", { ascending: false });');
    const uses = queue.split("emailTests").length - 1;
    expect(uses).toBe(3); // declared once, then only the separate list: its length check and its rows
    for (const counted of ["chipCounts({", "const flagButtons", "TEAM_QUEUE_COPY.summary("]) {
      const at = queue.indexOf(counted);
      expect(at).toBeGreaterThan(-1);
      expect(queue.slice(at, at + 900)).not.toContain("emailTests");
    }
    expect(read("src/components/EmailTestRecords.tsx")).not.toMatch(/\.length/);
  });
});

describe("(a) Direct Bookings", () => {
  it("the server returns test requests only to the test plan roles, in their own list", () => {
    expect(dbFns).toContain("data.demo ? Promise.resolve(false) : canSeeEmailTests(db, context.userId)");
    expect(dbFns).toContain("if (seesTests) {");
    expect(dbFns).toContain('.eq("source_detail->>email_test" as never, "true" as never)');
    expect(dbFns).toContain("tests = tests.filter((t) => isEmailTestLead(t));");
    expect(read("src/lib/email-test-viewer.server.ts")).toContain("seesEmailTestRecords(list, {");
  });
  it("a coordinator who opens a test request by its address is told it was not found", () => {
    expect(dbFns).toContain('if (isEmailTestLead(lead) && !(await canSeeEmailTests(db, context.userId))) {\n      throw new Error("This request was not found.");');
  });
  it("the board, its counts and tiles read only real requests; tests show in the separate list with the Test chip", () => {
    expect(dbList).toContain("const counts = viewCounts(board);");
    expect(dbList).toContain("const board = requests.map(");
    expect(dbList).toContain("seesEmailTestRecords(roles, seats) && !demoMode ? (data?.tests ?? []) : []");
    expect(dbList).toContain("<div className=\"space-y-3\">{testBoard.map(card)}</div>");
    expect(dbList).toContain("{isEmailTestLead(r) ? <EmailTestChip /> : null}");
  });
  it("test requests never reach the counted board", () => {
    const counted = dbList.slice(dbList.indexOf("const board = requests.map("), dbList.indexOf("const counts = viewCounts(board);"));
    expect(counted).not.toContain("tests");
    expect(dbFns).toContain("pending: pendingApprovals.map((a) => a.lead_id),");
  });
});

describe("(a) excluded from every count for everyone", () => {
  it("test records stay demo marked, so every total, scorecard, clock result and report that reads real work leaves them out", () => {
    expect(isEmailTestTicket({ is_demo: false, external_source: "email" })).toBe(false);
    expect(EMAIL_TEST_COPY.hint).toBe("Test records for the email intake test plan. They are never counted in any total.");
  });
});

describe("(c) Run intake now", () => {
  it("is hidden, so nobody presses a button that cannot work", () => {
    expect(RUN_INTAKE_NOW_SHOWN).toBe(false);
    expect(panel).toContain("{RUN_INTAKE_NOW_SHOWN ? (");
    const at = panel.indexOf("{RUN_INTAKE_NOW_SHOWN ? (");
    expect(panel.slice(at, at + 600)).toContain("Run intake");
  });
  it("Preview and Refresh notifications stay as built", () => {
    expect(panel).toContain("<Eye className=\"size-4\" /> Preview");
    expect(panel).toContain("<Radio className=\"size-4\" /> Refresh notifications");
  });
});

describe("(e) one switch", () => {
  it("the switch row says what it does", () => {
    expect(ONE_SWITCH_NOTE).toBe("Turning this on also starts the timed check every minute. Turning it off stops both.");
    expect(flags).toContain("{ONE_SWITCH_NOTE}");
    expect(flags).toContain('"Email intake is on. The timed check started."');
    expect(flags).toContain('"Email intake is off. The timed check stopped."');
  });
  it("the status panel shows both, and says so if they ever differ", () => {
    expect(panel).toContain('{intake?.sweepActive ? "Timed check on" : "Timed check off"}');
    const base = { startLine: null, lastSweepAt: null, lastMessageAt: null, skippedSinceStart: 0, format: (s: string) => s };
    expect(intakeStatusLines({ ...base, switchOn: true, sweepActive: true })).not.toContain(OUT_OF_STEP_LINE);
    expect(intakeStatusLines({ ...base, switchOn: false, sweepActive: false })).not.toContain(OUT_OF_STEP_LINE);
    expect(intakeStatusLines({ ...base, switchOn: true, sweepActive: false }).at(-1)).toBe(OUT_OF_STEP_LINE);
    expect(intakeStatusLines({ ...base, switchOn: false, sweepActive: true }).at(-1)).toBe(OUT_OF_STEP_LINE);
  });
});

describe("staged files", () => {
  const dir = "docs/pending/email-intake-followups";
  it("has the change, its undo, a README and matching checksums", () => {
    for (const f of ["01-one-switch.sql", "undo.sql", "README.md", "sha256.json"]) expect(existsSync(`${dir}/${f}`)).toBe(true);
    const sums = JSON.parse(read(`${dir}/sha256.json`)) as Record<string, string>;
    for (const [f, sum] of Object.entries(sums)) {
      expect(createHash("sha256").update(readFileSync(`${dir}/${f}`)).digest("hex")).toBe(sum);
    }
    expect(Object.keys(sums).sort()).toEqual(["01-one-switch.sql", "README.md", "undo.sql"]);
  });
  it("is staged only: not in the applied migrations until approved", () => {
    const sql = read(`${dir}/01-one-switch.sql`);
    for (const f of readdirSync("drizzle/migrations").filter((x) => x.endsWith(".sql"))) {
      expect(read(`drizzle/migrations/${f}`)).not.toContain("The timed check follows the switch in the same step.");
    }
    expect(sql).toContain("The timed check follows the switch in the same step.");
  });
  it("the switch row says so if the timed check did not follow", () => {
    expect(flags).toContain("if (r?.timed_check !== v) toast.error(OUT_OF_STEP_LINE);");
  });
  it("the undo restores the safety batch function text exactly", () => {
    const safety = read("docs/pending/email-intake-safety/01-schema.sql");
    const fn = (s: string) => s.slice(s.indexOf("CREATE OR REPLACE FUNCTION public.set_email_intake"), s.indexOf("GRANT EXECUTE ON FUNCTION public.set_email_intake"));
    expect(fn(read(`${dir}/undo.sql`))).toBe(fn(safety));
  });
});

describe("decision register", () => {
  it("E1 records (a) and (e)", () => {
    const e1 = read("docs/decision-register.md").split("\n").find((l) => l.startsWith("E1 ")) ?? "";
    expect(e1).toContain("A test record shows with its Test chip in the normal screens to the Admin, the Operations Supervisor and the Directors");
    expect(e1).toContain("One switch: turning email intake on also starts the timed check");
  });
});
