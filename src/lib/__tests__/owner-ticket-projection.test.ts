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
    from: () => {
      let visible = rows;
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
          filterSizes.push(ids.length);
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
  const result = await loadOwnerTicketProjection(db as never, homes, false);
  expect(filterSizes).toEqual([100, 1]);
  expect(result.length).toBe(1305);
  expect(result.some((row) => row.id === "ticket-0")).toBe(true);
  expect(result.some((row) => ["demo", "excluded"].includes(row.id))).toBe(false);
  expect(await loadOwnerTicketProjection(db as never, [], false)).toEqual([]);
});
