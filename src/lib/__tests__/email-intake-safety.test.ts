/**
 * Email intake safety batch (Emily, Nov 9), checked with fake message objects.
 * No real mailbox is read and no real database is touched.
 */
import { afterEach, describe, expect, it } from "bun:test";
import { createFakeIntakeDb, installFakeMailbox, type FakeMessage } from "./fakeIntakeDb";
import {
  BEFORE_START_REASON,
  INTAKE_OFF_MESSAGE,
  OWN_ADDRESS_REASON,
  intakeStatusLines,
  isEmailTestLead,
  isEmailTestTicket,
  isIntakeTest,
  isOwnAddress,
  nextStartLine,
  notificationState,
  receivedBeforeStart,
  testAlertTitle,
} from "@/lib/email-intake";
import {
  CATEGORY_PENDING,
  nextActionFor,
  processMessage,
  retryCategory,
  syncMailbox,
  syncTerminalStates,
} from "@/lib/mailbox.server";
import { authoriseSweep, handleNotifications, runSweep } from "@/lib/email-intake.server";
import { ensureSubscription } from "@/lib/outlook-subscription.server";
import {
  CREATE_TICKET_TAG,
  CREATED_TAG,
  DIRECT_BOOKING_TAG,
  OWNER_RESPONSE_FILED_TAG,
  OWNER_RESPONSE_TAG,
} from "@/lib/mail-categories";

const START = "2026-11-16T14:00:00Z";
const BEFORE = "2026-11-16T13:30:00Z";
const AFTER = "2026-11-16T14:05:00Z";

let mailbox: ReturnType<typeof installFakeMailbox> | null = null;
afterEach(() => {
  mailbox?.restore();
  mailbox = null;
});

function msg(over: Partial<FakeMessage> & { id: string }): FakeMessage {
  return {
    internetMessageId: `<${over.id}@example.com>`,
    conversationId: `conv-${over.id}`,
    subject: "AC not cooling",
    receivedDateTime: AFTER,
    categories: [CREATE_TICKET_TAG],
    from: { emailAddress: { name: "Guest", address: "guest@gmail.com" } },
    body: { content: "The AC is not cooling.", contentType: "text" },
    hasAttachments: false,
    ...over,
  };
}

const mailRows = (fake: ReturnType<typeof createFakeIntakeDb>) =>
  fake.rows("integration_events").filter((r) => r["operation"] === "mailbox_message");

describe("pure rules", () => {
  it("own address and the test marker", () => {
    expect(isOwnAddress("Emily@ArealHomeAway.com")).toBe(true);
    expect(isOwnAddress("someone@arealhomeaway.com.evil.net")).toBe(false);
    expect(isOwnAddress("partner@owlmarketplace.com")).toBe(false);
    expect(isIntakeTest("[RESOLVE TEST] AC not cooling", "ops@arealhomeaway.com")).toBe(true);
    expect(isIntakeTest("[resolve test] lower case", "ops@arealhomeaway.com")).toBe(true);
    expect(isIntakeTest("[RESOLVE TEST] AC not cooling", "partner@owlmarketplace.com")).toBe(false);
    expect(isIntakeTest("RE: [RESOLVE TEST] AC", "ops@arealhomeaway.com")).toBe(false);
  });

  it("start line: older or equal is skipped, no line or no time is skipped, and it only moves forward", () => {
    expect(receivedBeforeStart(BEFORE, START)).toBe(true);
    expect(receivedBeforeStart(START, START)).toBe(true);
    expect(receivedBeforeStart(AFTER, START)).toBe(false);
    expect(receivedBeforeStart(AFTER, null)).toBe(true);
    expect(receivedBeforeStart(null, START)).toBe(true);
    expect(nextStartLine("2026-09-01T23:20:20Z", new Date("2026-11-16T14:00:00.200Z"))).toBe("2026-11-16T14:00:01Z");
    expect(nextStartLine("2099-01-01T00:00:00Z", new Date("2026-11-16T14:00:00Z"))).toBe("2099-01-01T00:00:00Z");
  });

  it("test records and the Test alert wording", () => {
    expect(isEmailTestTicket({ is_demo: true, external_source: "email" })).toBe(true);
    expect(isEmailTestTicket({ is_demo: false, external_source: "email" })).toBe(false);
    expect(isEmailTestTicket({ is_demo: true, external_source: null })).toBe(false);
    expect(isEmailTestLead({ is_demo: true, source_detail: { email_test: true } })).toBe(true);
    expect(isEmailTestLead({ is_demo: true, source_detail: { origin: "outlook" } })).toBe(false);
    expect(testAlertTitle("New direct booking request")).toBe("Test: New direct booking request");
    expect(testAlertTitle("Test: already")).toBe("Test: already");
  });
});

describe("6: honest status panel text", () => {
  const now = new Date("2026-11-16T15:00:00Z");
  const live = { status: "active", expiresAt: "2026-11-18T15:00:00Z" };
  it("never says Live notifications unless they are live", () => {
    expect(notificationState({ subscription: null, switchOn: true, sweepActive: true, now }).label).toBe(
      "Notifications not set up",
    );
    expect(
      notificationState({ subscription: { status: "active", expiresAt: "2026-09-04T22:22:14Z" }, switchOn: true, sweepActive: true, now }),
    ).toEqual({ label: "Notifications expired", live: false });
    expect(
      notificationState({ subscription: { status: "expired", expiresAt: "2026-11-18T15:00:00Z" }, switchOn: true, sweepActive: true, now }).label,
    ).toBe("Notifications expired");
    expect(notificationState({ subscription: live, switchOn: false, sweepActive: true, now })).toEqual({
      label: "Notifications not running",
      live: false,
    });
    expect(notificationState({ subscription: live, switchOn: true, sweepActive: false, now }).label).toBe(
      "Notifications not running",
    );
    expect(notificationState({ subscription: live, switchOn: true, sweepActive: true, now })).toEqual({
      label: "Live notifications",
      live: true,
    });
  });

  it("status lines for off and on", () => {
    const f = (iso: string) => `<${iso}>`;
    expect(
      intakeStatusLines({ switchOn: false, startLine: "2026-09-01T23:20:20Z", sweepActive: false, lastSweepAt: "2026-08-24T16:30:00Z", lastMessageAt: "2026-09-02T00:04:00Z", skippedSinceStart: 1, format: f }),
    ).toEqual([
      "Email intake is off.",
      "Mail received after <2026-09-01T23:20:20Z> is read. Older mail is ignored.",
      "Timed check is off. Last check: <2026-08-24T16:30:00Z>.",
      "Last message handled: <2026-09-02T00:04:00Z>.",
      "1 message skipped since the start line.",
    ]);
    expect(
      intakeStatusLines({ switchOn: true, startLine: null, sweepActive: true, lastSweepAt: null, lastMessageAt: null, skippedSinceStart: 3, format: f }),
    ).toEqual([
      "Email intake is on.",
      "No start line yet. It is set when email intake is turned on.",
      "Timed check runs every minute. Last check: none yet.",
      "Last message handled: none yet.",
      "3 messages skipped since the start line.",
    ]);
  });
});

describe("1: the switch off refuses every path with no side effect", () => {
  it("push, sweep, Run intake now, Preview and Refresh notifications", async () => {
    const fake = createFakeIntakeDb();
    fake.setSwitch(false, START);
    mailbox = installFakeMailbox([msg({ id: "m1" })]);

    let fetched = 0;
    const push = await handleNotifications(fake.db, ["m1"], { fetchMessage: async () => (fetched++, null) });
    expect(push).toEqual({ refused: true, processed: 0, message: INTAKE_OFF_MESSAGE });
    expect(fetched).toBe(0);

    let renewed = 0;
    const sweep = await runSweep(fake.db, { ensureSubscription: async () => (renewed++, { ok: true, action: "healthy" }) });
    expect(sweep).toEqual({ ok: false, refused: true, error: INTAKE_OFF_MESSAGE });
    expect(renewed).toBe(0);

    for (const dryRun of [false, true]) {
      const run = await syncMailbox(fake.db, { dryRun });
      expect(run.ok).toBe(false);
      expect(run.error).toBe(INTAKE_OFF_MESSAGE);
    }

    const refresh = await ensureSubscription(fake.db);
    expect(refresh).toEqual({ ok: false, action: "refused", error: INTAKE_OFF_MESSAGE });

    const direct = await processMessage(fake.db, msg({ id: "m1" }) as never);
    expect(direct.reason).toBe(INTAKE_OFF_MESSAGE);

    expect(mailbox.graphCalls()).toHaveLength(0);
    expect(mailRows(fake)).toHaveLength(0);
    expect(fake.rows("tickets")).toHaveLength(0);
    expect(fake.rows("leads")).toHaveLength(0);
  });
});

describe("3: mail received before the start line is ignored on every path", () => {
  const old = () => msg({ id: "old-1", receivedDateTime: BEFORE, categories: [CREATE_TICKET_TAG] });

  it("push records it once as skipped and creates nothing", async () => {
    const fake = createFakeIntakeDb();
    fake.setSwitch(true, START);
    mailbox = installFakeMailbox([]);
    const r = await handleNotifications(fake.db, ["old-1"], { fetchMessage: async () => old() as never });
    expect(r.processed).toBe(1);
    const rows = mailRows(fake);
    expect(rows.map((x) => [x["status"], x["error_message"]])).toEqual([
      ["skipped", BEFORE_START_REASON],
      ["skipped", BEFORE_START_REASON],
    ]);
    expect(fake.rows("tickets")).toHaveLength(0);
    expect(mailbox.graphCalls()).toHaveLength(0);
  });

  it("sweep, Run intake now and Preview skip it even if Microsoft returned it", async () => {
    for (const path of ["sweep", "run", "preview"] as const) {
      const fake = createFakeIntakeDb();
      fake.setSwitch(true, START);
      mailbox?.restore();
      mailbox = installFakeMailbox([old()], { honourTime: false });
      const result =
        path === "sweep"
          ? await runSweep(fake.db, { ensureSubscription: async () => ({ ok: true, action: "healthy" }) })
          : await syncMailbox(fake.db, { dryRun: path === "preview" });
      const items = (result as { items: { outcome: string; reason?: string }[] }).items;
      expect(items.map((i) => [i.outcome, i.reason])).toEqual([["skipped", BEFORE_START_REASON]]);
      expect(fake.rows("tickets")).toHaveLength(0);
      expect(mailbox.graphCalls().filter((c) => c.method === "PATCH")).toHaveLength(0);
      expect(mailRows(fake).length).toBe(path === "preview" ? 0 : 2);
    }
  });

  it("an older message tagged with a Direct Booking tag by an ARHA sender is ignored too", async () => {
    const fake = createFakeIntakeDb();
    fake.setSwitch(true, START);
    mailbox = installFakeMailbox([]);
    const out = await processMessage(
      fake.db,
      msg({ id: "old-2", receivedDateTime: BEFORE, subject: "[RESOLVE TEST] x", categories: [DIRECT_BOOKING_TAG], from: { emailAddress: { address: "ops@arealhomeaway.com" } } }) as never,
    );
    expect(out.reason).toBe(BEFORE_START_REASON);
    expect(fake.rows("leads")).toHaveLength(0);
  });
});

describe("5: test marking and our own address", () => {
  it("[RESOLVE TEST] from an ARHA address makes a test Ticket and a test request", async () => {
    const fake = createFakeIntakeDb({ properties: [{ id: "home-1", name: "Maple Grove", nickname: null, active: true }] });
    fake.setSwitch(true, START);
    mailbox = installFakeMailbox([]);
    const arha = { emailAddress: { name: "Ops", address: "ops@arealhomeaway.com" } };
    await processMessage(fake.db, msg({ id: "t1", subject: "[RESOLVE TEST] AC not cooling at Maple Grove", from: arha }) as never);
    await processMessage(fake.db, msg({ id: "t2", subject: "[RESOLVE TEST] Housing request", categories: [DIRECT_BOOKING_TAG], from: arha }) as never);
    const [ticket] = fake.rows("tickets");
    expect(ticket).toMatchObject({ is_demo: true, external_source: "email", property_id: null });
    expect(isEmailTestTicket(ticket as never)).toBe(true);
    const created = fake.rows("ticket_activity")[0]!;
    expect(String(created["body"])).toContain("Home recognised: Maple Grove");
    expect(created["is_demo"]).toBe(true);
    const [lead] = fake.rows("leads");
    expect(lead).toMatchObject({ is_demo: true });
    expect(isEmailTestLead(lead as never)).toBe(true);
    // Excluded from every live count: live screens read is_demo = false only.
    expect([...fake.rows("tickets"), ...fake.rows("leads")].filter((r) => r["is_demo"] === false)).toHaveLength(0);
  });

  it("the same subject from another address is not a test", async () => {
    const fake = createFakeIntakeDb();
    fake.setSwitch(true, START);
    mailbox = installFakeMailbox([]);
    const partner = { emailAddress: { address: "partner@owlmarketplace.com" } };
    await processMessage(fake.db, msg({ id: "p1", subject: "[RESOLVE TEST] AC", from: partner }) as never);
    await processMessage(fake.db, msg({ id: "p2", subject: "[RESOLVE TEST] Housing", categories: [DIRECT_BOOKING_TAG], from: partner }) as never);
    expect("is_demo" in fake.rows("tickets")[0]!).toBe(false);
    expect("is_demo" in fake.rows("leads")[0]!).toBe(false);
    expect(isEmailTestLead(fake.rows("leads")[0] as never)).toBe(false);
  });

  it("our own address without the marker never creates a Direct Booking request", async () => {
    const fake = createFakeIntakeDb();
    fake.setSwitch(true, START);
    mailbox = installFakeMailbox([]);
    const out = await processMessage(
      fake.db,
      msg({ id: "own-1", subject: "RE: Housing for 3 months", categories: [DIRECT_BOOKING_TAG], from: { emailAddress: { address: "info@arealhomeaway.com" } } }) as never,
    );
    expect(out).toMatchObject({ outcome: "skipped", reason: OWN_ADDRESS_REASON });
    expect(fake.rows("leads")).toHaveLength(0);
    expect(mailRows(fake).map((r) => [r["status"], r["error_message"]])).toEqual([
      ["skipped", OWN_ADDRESS_REASON],
      ["skipped", OWN_ADDRESS_REASON],
    ]);
    // Preview says the same.
    const preview = await processMessage(
      fake.db,
      msg({ id: "own-2", categories: [DIRECT_BOOKING_TAG], from: { emailAddress: { address: "info@arealhomeaway.com" } } }) as never,
      true,
    );
    expect(preview.reason).toBe(OWN_ADDRESS_REASON);
  });
});

describe("4: the sweep", () => {
  it("needs the private scheduler secret, never the public project key", async () => {
    const verifyToken = async (t: string) => t === "db-held-token-0123456789abcdef0123";
    const deps = { appSecret: "app-secret-value", verifyToken };
    const h = (pairs: Record<string, string>) => new Headers(pairs);
    expect(await authoriseSweep(h({ apikey: "sb_publishable_project_key" }), deps)).toBe(false);
    expect(await authoriseSweep(h({}), deps)).toBe(false);
    expect(await authoriseSweep(h({ "x-cron-secret": "wrong" }), deps)).toBe(false);
    expect(await authoriseSweep(h({ "x-cron-secret": "app-secret-value" }), deps)).toBe(true);
    expect(await authoriseSweep(h({ "x-cron-secret": "db-held-token-0123456789abcdef0123" }), deps)).toBe(true);
    expect(await authoriseSweep(h({ "x-cron-secret": "x" }), { appSecret: undefined, verifyToken: async () => { throw new Error("down"); } })).toBe(false);
  });

  it("renews first, then reads 50 per page oldest first until nothing is left, and records the run", async () => {
    const fake = createFakeIntakeDb();
    fake.setSwitch(true, START);
    const many = Array.from({ length: 120 }, (_, i) =>
      msg({ id: `bulk-${String(i).padStart(3, "0")}`, subject: `Item ${i}`, receivedDateTime: new Date(Date.parse(AFTER) + i * 60_000).toISOString() }),
    );
    mailbox = installFakeMailbox([...many].reverse());
    let renewed = 0;
    const result = await runSweep(fake.db, { ensureSubscription: async () => (renewed++, { ok: true, action: "renewed" }) });
    expect(renewed).toBe(1);
    expect(result.ok).toBe(true);
    expect((result as { created: number }).created).toBe(120);
    expect(fake.rows("tickets").map((t) => t["title"])).toEqual(many.map((m) => m.subject));
    const sweepRow = fake.rows("integration_events").find((r) => r["operation"] === "sweep_run");
    expect(sweepRow).toMatchObject({ status: "ok" });
  });
});

describe("7a: the owner response tag retry", () => {
  it("retries the owner response tag, not the ticket tag, even when the reply was held to place", async () => {
    const fake = createFakeIntakeDb({ approval_email_responses: [{ id: "r1", internet_message_id: "<own-r1@example.com>" }] });
    mailbox = installFakeMailbox([msg({ id: "own-r1", categories: [OWNER_RESPONSE_TAG] })]);
    const prior = {
      id: "row-1",
      status: "linked",
      error_message: CATEGORY_PENDING,
      entity_id: null,
      entity_type: "approval",
      external_id: "own-r1",
      created_at: new Date().toISOString(),
    };
    expect(nextActionFor(prior)).toBe("retag");
    const outcome = await retryCategory(fake.db, msg({ id: "own-r1", internetMessageId: "<own-r1@example.com>", categories: [OWNER_RESPONSE_TAG] }) as never, prior);
    expect(outcome).toBe("retagged");
    const patch = mailbox.graphCalls().find((c) => c.method === "PATCH");
    expect((patch?.body as { categories: string[] }).categories).toEqual([OWNER_RESPONSE_FILED_TAG]);
  });

  it("does not re-tag when the filed reply is gone", async () => {
    const fake = createFakeIntakeDb({ integration_events: [{ id: "row-2", error_message: CATEGORY_PENDING }] });
    mailbox = installFakeMailbox([]);
    const outcome = await retryCategory(fake.db, msg({ id: "own-r2", categories: [OWNER_RESPONSE_TAG] }) as never, {
      id: "row-2", status: "linked", error_message: CATEGORY_PENDING, entity_id: null, entity_type: "approval", external_id: "own-r2", created_at: new Date().toISOString(),
    });
    expect(outcome).toBe("no_record");
    expect(mailbox.graphCalls()).toHaveLength(0);
  });
});

describe("7b: a tag swap only with a live record", () => {
  it("a retag retry for a removed Ticket does not re-tag, and retires the marker", async () => {
    const fake = createFakeIntakeDb({ integration_events: [{ id: "row-3", error_message: CATEGORY_PENDING }] });
    mailbox = installFakeMailbox([]);
    const prior = { id: "row-3", status: "created", error_message: CATEGORY_PENDING, entity_id: "gone", entity_type: "ticket", external_id: "m3", created_at: new Date().toISOString() };
    expect(await retryCategory(fake.db, msg({ id: "m3" }) as never, prior)).toBe("no_record");
    expect(mailbox.graphCalls()).toHaveLength(0);
    expect(fake.rows("integration_events")[0]!["error_message"]).toBe("record removed; not re-tagged");
  });

  it("a retag retry for a live Ticket still re-tags", async () => {
    const fake = createFakeIntakeDb({ tickets: [{ id: "t-live" }] });
    mailbox = installFakeMailbox([msg({ id: "m4" })]);
    const prior = { id: "row-4", status: "created", error_message: CATEGORY_PENDING, entity_id: "t-live", entity_type: "ticket", external_id: "m4", created_at: new Date().toISOString() };
    expect(await retryCategory(fake.db, msg({ id: "m4" }) as never, prior)).toBe("retagged");
    expect((mailbox.graphCalls()[0]!.body as { categories: string[] }).categories).toEqual([CREATED_TAG]);
  });

  it("the closed or created sweep never touches a message whose record was removed (the Sep 1 QA messages)", async () => {
    const fake = createFakeIntakeDb({
      integration_events: [
        { id: "e1", system: "outlook_inbox", operation: "mailbox_message", external_id: "qa-1", entity_id: "removed-ticket", entity_type: "ticket", status: "closed", created_at: "2026-09-01T23:40:00Z" },
      ],
    });
    mailbox = installFakeMailbox([msg({ id: "qa-1", categories: ["Resolve: ticket closed"] })]);
    expect(await syncTerminalStates(fake.db)).toEqual({ closed: 0, reopened: 0 });
    expect(mailbox.graphCalls()).toHaveLength(0);
  });

  it("a tagged reply on a thread whose record was removed is not linked to it", async () => {
    const fake = createFakeIntakeDb({
      integration_events: [
        { id: "e2", system: "outlook_inbox", operation: "mailbox_message", external_id: "first", conversation_id: "conv-shared", entity_id: "removed-ticket", entity_type: "ticket", status: "created", created_at: "2026-11-16T14:01:00Z" },
      ],
    });
    fake.setSwitch(true, START);
    mailbox = installFakeMailbox([]);
    const out = await processMessage(fake.db, msg({ id: "reply", conversationId: "conv-shared" }) as never);
    expect(out.outcome).toBe("created");
    expect(fake.rows("ticket_activity").some((a) => a["ticket_id"] === "removed-ticket")).toBe(false);
  });
});
