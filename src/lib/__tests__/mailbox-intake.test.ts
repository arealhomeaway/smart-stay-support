/**
 * Retry and concurrency behaviour for email intake.
 *
 * The case under test: a ticket saves successfully but the Outlook category
 * update fails. The next pass must find the existing ticket through the
 * persistent source-message link and retry only the category — never open a
 * second ticket. Runs entirely against the in-memory integration_events fake;
 * no Microsoft Graph call and no real database.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { createFakeIntegrationEvents } from "./fakeIntegrationEvents";
import {
  CATEGORY_PENDING,
  CLAIM_STALE_MS,
  claimMessage,
  isStaleClaim,
  nextActionFor,
  priorRecord,
  type MailboxRecord,
} from "@/lib/mailbox.server";

const store = createFakeIntegrationEvents();
beforeEach(() => store.reset());

const GRAPH_ID = "AAMkAGgraph-id-001";
const NET_ID = "<net-id-001@arealhomeaway.com>";
const msg = { id: GRAPH_ID, internetMessageId: NET_ID };
const ids = [GRAPH_ID, NET_ID];

function record(over: Partial<MailboxRecord> = {}): MailboxRecord {
  return {
    id: "1",
    status: "created",
    error_message: null,
    entity_id: "ticket-1",
    external_id: GRAPH_ID,
    created_at: new Date().toISOString(),
    ...over,
  };
}

describe("category update failed after the ticket saved", () => {
  it("the next pass retags only — it does not create a second ticket", () => {
    const prior = record({ error_message: CATEGORY_PENDING });
    expect(nextActionFor(prior)).toBe("retag");
  });

  it("a ticket that saved and tagged cleanly is simply skipped", () => {
    expect(nextActionFor(record())).toBe("skip");
  });

  it("refuses to retag when no ticket is linked — that would be an unfinished create, not a retry", () => {
    expect(nextActionFor(record({ error_message: CATEGORY_PENDING, entity_id: null }))).toBe(
      "skip",
    );
  });

  it("the link survives a Graph id lookup as well as an internet-message-id lookup", async () => {
    await claimMessage(store.db, msg, null);
    expect((await priorRecord(store.db, [GRAPH_ID]))?.status).toBe("processing");
    expect((await priorRecord(store.db, [NET_ID]))?.status).toBe("processing");
    // A redelivery that only carries the internet id still finds the record.
    expect(await priorRecord(store.db, ["some-other-id"])).toBeNull();
  });

  it("a failed intake is never silently retried into a duplicate — it stays a decision on file", () => {
    expect(
      nextActionFor(record({ status: "failed", entity_id: null, error_message: "Intake failed" })),
    ).toBe("skip");
  });
});

describe("two passes processing the same message at once", () => {
  it("only the first claim wins; the second is turned away rather than creating a twin", async () => {
    const first = await claimMessage(store.db, msg, null);
    const second = await claimMessage(store.db, msg, null);
    expect(first).toBe(true);
    expect(second).toBe(false);
    // One row per id, and no second attempt recorded.
    expect(store.rows().length).toBe(2);
  });

  it("a claim in flight blocks creation for any other pass", () => {
    const claimed = record({ status: "processing", entity_id: null });
    expect(nextActionFor(claimed)).toBe("skip");
  });

  it("without the unique index both passes would proceed — the index is what settles the race", async () => {
    store.withoutUniqueIndex();
    expect(await claimMessage(store.db, msg, null)).toBe(true);
    expect(await claimMessage(store.db, msg, null)).toBe(true);
  });
});

describe("a pass that died mid-flight", () => {
  const old = new Date(Date.now() - CLAIM_STALE_MS - 1000).toISOString();

  it("an abandoned claim is reclaimed rather than blocking the message forever", () => {
    expect(nextActionFor(record({ status: "processing", entity_id: null, created_at: old }))).toBe(
      "create",
    );
  });

  it("only a claim goes stale — a settled decision never reopens, however old", () => {
    expect(isStaleClaim(record({ status: "created", created_at: old }))).toBe(false);
    expect(isStaleClaim(record({ status: "failed", created_at: old }))).toBe(false);
    expect(isStaleClaim(record({ status: "skipped", created_at: old }))).toBe(false);
    expect(isStaleClaim(record({ status: "processing", created_at: old }))).toBe(true);
  });

  it("reclaiming re-stamps the existing row instead of inserting a duplicate", async () => {
    await claimMessage(store.db, msg, null);
    const stale = { ...(await priorRecord(store.db, ids))!, created_at: old };
    expect(await claimMessage(store.db, msg, stale)).toBe(true);
    expect(store.rows().length).toBe(2); // still one row per id
  });
});
