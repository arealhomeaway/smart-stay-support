import { expect, it } from "bun:test";
import { loadOwnerTicketProjection, projectOwnerTicket } from "../owner-ticket-projection.server";

const ticket = {
  id: "ticket",
  ref: 42,
  property_id: "home",
  category: "maintenance",
  priority: "p2",
  status: "resolved",
  reported_at: "2026-09-15T12:00:00Z",
  resolved_at: "2026-09-15T13:00:00Z",
  owner_participation_path: "inform",
  owner_submitted: false,
};
const names = {
  tickets: "read_owner_tickets",
  work: "read_owner_ticket_financial_context",
  updates: "read_owner_ticket_updates",
};
function database(
  records: Record<string, unknown[]>,
  calls: { name: string; ids: string[] }[] = [],
) {
  return {
    from: () => {
      throw new Error("Owner projection must never query raw operational tables.");
    },
    rpc: (
      name: string,
      args: { _program_id: string; _property_ids: string[]; _preview: boolean },
      options: { count: string },
    ) => {
      expect(Object.values(names).includes(name)).toBe(true);
      expect(args._program_id).toBe("program");
      expect(args._preview).toBe(false);
      expect(options.count).toBe("exact");
      calls.push({ name, ids: args._property_ids });
      const visible = (records[name] ?? []).filter((item) => {
        const row = item as { property_id: string; is_demo?: boolean };
        return args._property_ids.includes(row.property_id) && !row.is_demo;
      });
      const query = {
        order: () => query,
        range: async (from: number, to: number) => ({
          data: visible.slice(from, Math.min(to + 1, from + 200)),
          count: visible.length,
          error: null,
        }),
      };
      return query;
    },
  };
}

it("attaches authority only from Work Orders linked to both the Ticket and its Property", async () => {
  const db = database({
    [names.tickets]: [ticket],
    [names.work]: [
      { ticket_id: "ticket", property_id: "home", phase: "permanent", quote_amount: 150 },
      { ticket_id: "ticket", property_id: "other-home", phase: "permanent", quote_amount: 9999 },
      { ticket_id: "other-ticket", property_id: "home", phase: "permanent", quote_amount: 9999 },
    ],
  });
  const result = await loadOwnerTicketProjection(
    db as never,
    ["home", "other-home"],
    false,
    "program",
  );
  expect(result[0]!.request.label).toBe("Review — No approval required");
  expect(result[0]!.request.why).toContain("$150");
  expect(result[0]!.request.why.includes("9,999")).toBe(false);
});
it("projects structured Ticket context without spreading private source text", () => {
  const poisoned = {
    ...ticket,
    title: "PRIVATE guest",
    description: "PRIVATE credentials",
    resolution_notes: "PRIVATE internal note",
    guest_contact: "PRIVATE phone",
  };
  const projected = projectOwnerTicket(poisoned);
  expect(projected.title).toBe("Maintenance · Ticket #42");
  expect(projected.status).toBe("resolved");
  expect(projected.property_id).toBe("home");
  expect(JSON.stringify(projected).includes("PRIVATE")).toBe(false);
  expect(
    JSON.stringify(
      projectOwnerTicket({
        ...poisoned,
        category: "PRIVATE",
        priority: "PRIVATE",
        status: "PRIVATE",
        owner_participation_path: "PRIVATE",
      }),
    ).includes("PRIVATE"),
  ).toBe(false);
});
it("loads every visible Ticket across bounded property scopes and pages, retaining archived history", async () => {
  const homes = Array.from({ length: 101 }, (_, i) => `home-${i}`);
  const rows = Array.from({ length: 1305 }, (_, i) => ({
    ...ticket,
    id: `ticket-${i}`,
    ref: i,
    property_id: homes[i % homes.length]!,
    archived_at: i === 0 ? "2026-09-15" : null,
    is_demo: false,
  }));
  rows.push(
    { ...rows[0]!, id: "excluded", property_id: "not-enrolled" },
    { ...rows[0]!, id: "demo", is_demo: true },
  );
  const calls: { name: string; ids: string[] }[] = [];
  const db = database({ [names.tickets]: rows }, calls);
  const result = await loadOwnerTicketProjection(db as never, homes, false, "program");
  expect(
    calls.filter((call) => call.name === names.tickets).map((call) => call.ids.length),
  ).toEqual([100, 1]);
  expect(result.length).toBe(1305);
  expect(result.some((row) => row.id === "ticket-0")).toBe(true);
  expect(result.some((row) => ["demo", "excluded"].includes(row.id))).toBe(false);
  expect(await loadOwnerTicketProjection(db as never, [], false, "program")).toEqual([]);
});
it("uses scoped receipts, actual costs and reviewed narrative without raw table access", async () => {
  const db = database({
    [names.tickets]: [ticket],
    [names.updates]: [
      {
        ticket_id: "ticket",
        property_id: "home",
        revision: 1,
        issue: "A pipe was leaking.",
        work_performed: "The pipe was repaired.",
        outcome: "Leak testing passed.",
        reviewed_at: "2026-09-15T12:00:00Z",
      },
    ],
    [names.work]: [
      {
        id: "work",
        ticket_id: "ticket",
        property_id: "home",
        phase: "permanent",
        quote_amount: 650,
        final_cost: 625,
        approved_amount: 650,
        approval_id: "approval",
        approval_status: "pending",
        receipt_id: "approval",
        receipt_status: "approved",
        receipt_amount: 650,
        receipt_decided_at: "2026-09-15T12:00:00Z",
      },
    ],
  });
  const result = await loadOwnerTicketProjection(db as never, ["home"], false, "program");
  expect(result[0]!.request.ownerActionRequired).toBe(false);
  expect(result[0]!.request.why).toContain("prior response is recorded");
  expect(result[0]!.description).toContain("The pipe was repaired.");
  expect(result[0]!.resolution_notes).toBe("Leak testing passed.");
  expect(result[0]!.owner_update_revision).toBe(1);
  expect(result[0]!.costs?.recordedAmount).toBe(625);
});
it("fails closed when the Ticket boundary rejects the request", async () => {
  const db = {
    rpc: () => {
      const query = {
        order: () => query,
        range: async () => ({ data: null, count: null, error: new Error("Not authorized") }),
      };
      return query;
    },
  };
  let message = "";
  try {
    await loadOwnerTicketProjection(db as never, ["home"], false, "program");
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toBe("Not authorized");
});
