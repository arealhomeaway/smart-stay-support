import { expect, it } from "bun:test";
import { loadTicketOwnerUpdates } from "../ticket-owner-updates.server";

it("denies owner-update staff history before reading records when access cannot be verified", async () => {
  for (const result of [
    { data: false, error: null },
    { data: true, error: new Error("permission unavailable") },
  ]) {
    let reads = 0;
    let denied = false;
    try {
      await loadTicketOwnerUpdates(
        {
          rpc: async () => result,
          from: () => {
            reads++;
            throw new Error("unexpected read");
          },
        } as never,
        "owner",
        "ticket",
      );
    } catch {
      denied = true;
    }
    expect(denied).toBe(true);
    expect(reads).toBe(0);
  }
});

it("loads reviewed history with the canonical Owner version and no raw Ticket narrative", async () => {
  const db = {
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      const query = {
        select: (fields: string) => {
          if (table === "tickets") expect(fields).toBe("id, updated_at, property_id");
          return query;
        },
        eq: () => query,
        order: () => query,
        single: async () => ({
          data:
            table === "tickets"
              ? { id: "ticket", property_id: "home", updated_at: "viewed version" }
              : { owner_record_id: "canonical owner" },
          error: null,
        }),
        range: async () => ({ data: [{ id: "update", revision: 1 }], count: 1, error: null }),
      };
      return query;
    },
  };
  const result = await loadTicketOwnerUpdates(db as never, "staff", "ticket");
  expect(result.ownerRecordId).toBe("canonical owner");
  expect(result.ticket.updated_at).toBe("viewed version");
  expect(result.history[0]!.revision).toBe(1);
});
