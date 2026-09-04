/**
 * Thread handling: one email conversation produces at most one Resolve record.
 *
 * The case under test is the ordinary one — a coordinator categorises a later
 * reply on a thread Resolve already turned into work. That must surface the
 * existing Ticket or Lead, never open a twin.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { createFakeIntegrationEvents } from "./fakeIntegrationEvents";
import { claimMessage, conversationRecord, priorRecord } from "@/lib/mailbox.server";

const store = createFakeIntegrationEvents();
beforeEach(() => store.reset());

const CONV = "AAQkAconversation-001";
const first = { id: "graph-001", internetMessageId: "<net-001@arha>", conversationId: CONV };
const reply = { id: "graph-002", internetMessageId: "<net-002@arha>", conversationId: CONV };

async function settle(ids: string[], patch: Record<string, unknown>) {
  await (store.db as unknown as { from: (t: string) => any })
    .from("integration_events")
    .update(patch)
    .eq("system", "outlook_inbox")
    .in("external_id", ids);
}

describe("a reply on a thread that already produced work", () => {
  beforeEach(async () => {
    await claimMessage(store.db, first, null);
    await settle([first.id, first.internetMessageId], {
      status: "created",
      entity_type: "ticket",
      entity_id: "ticket-1",
    });
  });

  it("finds the record the thread already has, so nothing is created twice", async () => {
    const mate = await conversationRecord(store.db, CONV, [reply.id, reply.internetMessageId]);
    expect(mate?.entity_id).toBe("ticket-1");
    expect(mate?.entity_type).toBe("ticket");
  });

  it("does not treat the original message as its own thread mate", async () => {
    const mate = await conversationRecord(store.db, CONV, [first.id, first.internetMessageId]);
    expect(mate).toBeNull();
  });

  it("a message with no conversation id is simply judged on its own", async () => {
    expect(await conversationRecord(store.db, null)).toBeNull();
  });

  it("an unrelated conversation is left alone", async () => {
    expect(await conversationRecord(store.db, "AAQkAsomething-else")).toBeNull();
  });

  it("a thread whose only record failed offers nothing to link to", async () => {
    await settle([first.id, first.internetMessageId], {
      status: "failed",
      entity_type: null,
      entity_id: null,
    });
    expect(
      await conversationRecord(store.db, CONV, [reply.id, reply.internetMessageId]),
    ).toBeNull();
  });

  it("a lead thread links back to the lead, not to a ticket", async () => {
    await settle([first.id, first.internetMessageId], { entity_type: "lead", entity_id: "lead-9" });
    const mate = await conversationRecord(store.db, CONV, [reply.id]);
    expect(mate?.entity_type).toBe("lead");
    expect(mate?.entity_id).toBe("lead-9");
  });

  it("the reply itself is still claimed once and only once", async () => {
    expect(await claimMessage(store.db, reply, null)).toBe(true);
    expect(await claimMessage(store.db, reply, null)).toBe(false);
    expect((await priorRecord(store.db, [reply.id]))?.status).toBe("processing");
  });
});
