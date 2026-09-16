import { expect, it } from "bun:test";
import { createOwnerMatter } from "../owner-portal.server";
const input = {
  programId: "program",
  propertyId: "home",
  path: "inform" as const,
  title: "Loose railing",
  description: "Please inspect",
  category: "maintenance",
};
it("opens owner work through one atomic request with no operational table writes", async () => {
  const calls: unknown[] = [];
  const db = {
    from: () => {
      throw new Error("Raw operational access is forbidden");
    },
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: [{ ticket_id: "ticket", ref: 42 }], error: null };
    },
  };
  const result = await createOwnerMatter(db as never, "authenticated-owner", input);
  expect(result).toEqual({ ok: true, ticketId: "ticket", ref: 42 });
  expect(calls).toEqual([
    {
      name: "create_owner_matter",
      args: {
        _program_id: "program",
        _property_id: "home",
        _path: "inform",
        _title: "Loose railing",
        _description: "Please inspect",
        _category: "maintenance",
      },
    },
  ]);
});
it("does not claim success or retry separately after an owner matter rejection or missing receipt", async () => {
  for (const result of [
    { data: null, error: new Error("Property changed") },
    { data: [], error: null },
  ]) {
    let count = 0;
    const db = {
      rpc: async () => {
        count++;
        return result;
      },
    };
    let message = "";
    try {
      await createOwnerMatter(db as never, "owner", input);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message.length > 0).toBe(true);
    expect(count).toBe(1);
  }
});
