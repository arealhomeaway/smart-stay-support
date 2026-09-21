import { describe, expect, it } from "bun:test";
import { loadPreviousContacts } from "../email-composer.server";

function db(rows: { recipient: string | null; created_at: string | null }[]) {
  return {
    from() {
      const q = {
        select: () => q,
        order: () => q,
        limit: async () => ({ data: rows, error: null }),
      };
      return q;
    },
  };
}

describe("addresses written to before", () => {
  it("offers each address once, newest first", async () => {
    const list = await loadPreviousContacts(
      db([
        { recipient: "Dana@example.com", created_at: "2026-09-20T10:00:00Z" },
        { recipient: "dana@example.com", created_at: "2026-09-01T10:00:00Z" },
        { recipient: "morgan@example.com", created_at: "2026-08-01T10:00:00Z" },
      ]) as never,
    );
    expect(list.map((c) => c.email)).toEqual(["Dana@example.com", "morgan@example.com"]);
    expect(list[0]?.lastSentAt).toBe("2026-09-20T10:00:00Z");
  });

  it("leaves out contacts already on the record, and anything that is not an address", async () => {
    const list = await loadPreviousContacts(
      db([
        { recipient: "owner@example.com", created_at: null },
        { recipient: "not-an-address", created_at: null },
        { recipient: null, created_at: null },
        { recipient: "vendor@example.com", created_at: null },
      ]) as never,
      ["OWNER@example.com"],
    );
    expect(list.map((c) => c.email)).toEqual(["vendor@example.com"]);
  });

  it("keeps the list short enough to pick from", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      recipient: `person${i}@example.com`,
      created_at: null,
    }));
    expect(await loadPreviousContacts(db(rows) as never)).toHaveLength(15);
  });
});
