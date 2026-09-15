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

it("attaches authority only from Work Orders linked to both the Ticket and its Property", async () => {
  const records: Record<string, unknown[]> = {
    tickets: [ticket],
    approvals: [],
    work_orders: [
      { ticket_id: "ticket", property_id: "home", phase: "permanent", quote_amount: 150 },
      { ticket_id: "ticket", property_id: "other-home", phase: "permanent", quote_amount: 9999 },
      { ticket_id: "other-ticket", property_id: "home", phase: "permanent", quote_amount: 9999 },
    ],
  };
  const db = {
    rpc: (
      name: string,
      args: { _program_id: string; _property_ids: string[]; _preview: boolean },
      options: { count: string },
    ) => {
      if (name === "read_owner_ticket_updates") {
        const query = {
          order: () => query,
          range: async () => ({ data: [], count: 0, error: null }),
        };
        return query;
      }
      expect(name).toBe("read_owner_ticket_financial_context");
      expect(args._program_id).toBe("program");
      expect(options.count).toBe("exact");
      return db.from("work_orders").select("id", options).in("property_id", args._property_ids);
    },
    from: (table: string) => {
      const query = {
        select: (_fields?: string, _options?: { count: string }) => query,
        in: (_key?: string, _ids?: string[]) => query,
        eq: () => query,
        order: () => query,
        range: async (from: number, to: number) => ({
          data: records[table]!.slice(from, to + 1),
          count: records[table]!.length,
          error: null,
        }),
      };
      return query;
    },
  };
  const result = await loadOwnerTicketProjection(db as never, ["home"], false, "program");
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
  const unexpected = projectOwnerTicket({
    ...poisoned,
    category: "PRIVATE",
    priority: "PRIVATE",
    status: "PRIVATE",
    owner_participation_path: "PRIVATE",
  });
  expect(JSON.stringify(unexpected).includes("PRIVATE")).toBe(false);
});

it("loads every visible Ticket across bounded property filters and pages, retaining archived history", async () => {
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
  const filterSizes: number[] = [];
  const db = {
    rpc: (
      name: string,
      args: { _program_id: string; _property_ids: string[]; _preview: boolean },
      options: { count: string },
    ) => {
      if (name === "read_owner_ticket_updates") {
        const query = {
          order: () => query,
          range: async () => ({ data: [], count: 0, error: null }),
        };
        return query;
      }
      expect(name).toBe("read_owner_ticket_financial_context");
      expect(args._program_id).toBe("program");
      expect(options.count).toBe("exact");
      return db.from("work_orders").select("id", options).in("property_id", args._property_ids);
    },
    from: (table: string) => {
      let visible = table === "tickets" ? rows : [];
      const query = {
        select: (fields: string, options: { count: string }) => {
          expect(
            fields
              .split(", ")
              .some((field) =>
                ["title", "description", "resolution_notes", "guest_contact"].includes(field),
              ),
          ).toBe(false);
          expect(options.count).toBe("exact");
          return query;
        },
        in: (_key: string, ids: string[]) => {
          if (table === "tickets") filterSizes.push(ids.length);
          visible = visible.filter((row) => ids.includes(row.property_id));
          return query;
        },
        eq: (_key: string, value: boolean) => {
          visible = visible.filter((row) => row.is_demo === value);
          return query;
        },
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
  const result = await loadOwnerTicketProjection(db as never, homes, false, "program");
  expect(filterSizes).toEqual([100, 1]);
  expect(result.length).toBe(1305);
  expect(result.some((row) => row.id === "ticket-0")).toBe(true);
  expect(result.some((row) => ["demo", "excluded"].includes(row.id))).toBe(false);
  expect(await loadOwnerTicketProjection(db as never, [], false, "program")).toEqual([]);
});

it("uses the scoped receipt without requesting raw Work Orders or approval records", async () => {
  const db = {
    from: (table: string) => {
      expect(table).toBe("tickets");
      const query = {
        select: () => query,
        in: () => query,
        eq: () => query,
        order: () => query,
        range: async () => ({ data: [ticket], count: 1, error: null }),
      };
      return query;
    },
    rpc: (_name: string, args: Record<string, unknown>) => {
      if (_name === "read_owner_ticket_updates") {
        const query = {
          order: () => query,
          range: async () => ({
            data: [
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
            count: 1,
            error: null,
          }),
        };
        return query;
      }
      expect(args).toEqual({ _program_id: "program", _property_ids: ["home"], _preview: false });
      const query = {
        order: () => query,
        range: async () => ({
          data: [
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
          count: 1,
          error: null,
        }),
      };
      return query;
    },
  };
  const result = await loadOwnerTicketProjection(db as never, ["home"], false, "program");
  expect(result[0]!.request.ownerActionRequired).toBe(false);
  expect(result[0]!.request.why).toContain("prior response is recorded");
  expect(result[0]!.description).toContain("The pipe was repaired.");
  expect(result[0]!.resolution_notes).toBe("Leak testing passed.");
  expect(result[0]!.owner_update_revision).toBe(1);
  expect(result[0]!.costs?.recordedAmount).toBe(625);
});
