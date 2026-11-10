// @ts-nocheck: in-memory fake database fixture; row shapes are checked by assertions.
/**
 * Link the Breezeway work order (register C4, Emily Nov 10): the Repair card links a mirrored
 * Breezeway work order to the ticket. In-memory fake database and a stubbed Breezeway read; no
 * Breezeway call is made and nothing is created anywhere.
 */
import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { readFileSync } from "node:fs";

type Row = Record<string, unknown>;
const tables: Record<string, Row[]> = {};
const writes: { table: string; kind: string; row: Row }[] = [];
let breezewayReads: number[] = [];

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let patch: Row | null = null;
  const api = {
    select: () => api,
    order: () => api,
    limit: () => api,
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
    neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), api),
    is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), api),
    update: (p: Row) => ((patch = p), api),
    insert: async (row: Row) => {
      writes.push({ table, kind: "insert", row });
      (tables[table] ??= []).push(row);
      return { error: null };
    },
    maybeSingle: async () => ({ data: (tables[table] ?? []).find((r) => filters.every((f) => f(r))) ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown) => {
      const rows = (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
      if (patch) {
        for (const r of rows) Object.assign(r, patch);
        writes.push({ table, kind: "update", row: patch });
      }
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  return api;
}
const fakeDb = { from: (t: string) => query(t), rpc: async () => ({ data: true, error: null }) };

mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeDb }));
// Only refreshWorkOrder is stood in for, and only inside this file; every other export is real.
let standIn = true;
const realWorkOrders = await import("@/lib/breezeway-workorders.server");
mock.module("@/lib/breezeway-workorders.server", () => ({
  ...realWorkOrders,
  refreshWorkOrder: async (taskId: number) => {
    if (!standIn) return realWorkOrders.refreshWorkOrder(taskId);
    breezewayReads.push(taskId);
    if (taskId !== 333) return null;
    const row = { id: "wo-3", breezeway_task_id: 333, property_id: "home-1", name: "From Breezeway", linked_ticket_id: null, assignees: [] };
    tables.breezeway_work_orders.push(row);
    return { id: "wo-3" };
  },
}));
afterAll(() => {
  standIn = false;
});

const { linkTicketBreezewayOrder } = await import("@/lib/breezeway-bridge.server");

beforeEach(() => {
  writes.length = 0;
  breezewayReads = [];
  tables.tickets = [
    { id: "t-1", property_id: "home-1", is_demo: false },
    { id: "t-2", property_id: null, is_demo: false },
  ];
  tables.breezeway_work_orders = [
    { id: "wo-1", breezeway_task_id: 111, property_id: "home-1", name: "Fix the door", status: "Created", linked_ticket_id: null, assignees: [{ name: "Vendor" }] },
    { id: "wo-2", breezeway_task_id: 222, property_id: "home-2", name: "Other home", linked_ticket_id: null, assignees: [] },
    { id: "wo-9", breezeway_task_id: 999, property_id: "home-1", name: "Taken", linked_ticket_id: "t-other", assignees: [] },
  ];
  tables.ticket_activity = [];
});

describe("C4 Link the Breezeway work order", () => {
  it("picking one of the home's work orders links it and writes one history line", async () => {
    const r = await linkTicketBreezewayOrder(fakeDb, "user-1", { ticketId: "t-1", workOrderId: "wo-1" });
    expect(r).toEqual({ ok: true, workOrderId: "wo-1", breezewayTaskId: 111 });
    expect(tables.breezeway_work_orders[0].linked_ticket_id).toBe("t-1");
    expect(tables.ticket_activity.length).toBe(1);
    expect(tables.ticket_activity[0]).toMatchObject({ ticket_id: "t-1", event_type: "breezeway_linked", author_id: "user-1" });
  });

  it("pasting a number already in the mirror links it without calling Breezeway", async () => {
    const r = await linkTicketBreezewayOrder(fakeDb, "user-1", { ticketId: "t-1", taskNumber: 111 });
    expect(r.ok).toBe(true);
    expect(breezewayReads).toEqual([]);
  });

  it("a pasted number not yet in the mirror is read once (read only) and then linked", async () => {
    const r = await linkTicketBreezewayOrder(fakeDb, "user-1", { ticketId: "t-1", taskNumber: 333 });
    expect(r).toEqual({ ok: true, workOrderId: "wo-3", breezewayTaskId: 333 });
    expect(breezewayReads).toEqual([333]);
  });

  it("refuses another home's work order, one already on another ticket, an unknown number and a ticket with no home", async () => {
    expect(await linkTicketBreezewayOrder(fakeDb, "u", { ticketId: "t-1", workOrderId: "wo-2" })).toEqual({
      ok: false,
      message: "That Breezeway work order is for a different home.",
    });
    expect((await linkTicketBreezewayOrder(fakeDb, "u", { ticketId: "t-1", workOrderId: "wo-9" })).ok).toBe(false);
    expect(await linkTicketBreezewayOrder(fakeDb, "u", { ticketId: "t-1", taskNumber: 444 })).toEqual({
      ok: false,
      message: "We could not find that Breezeway work order.",
    });
    expect((await linkTicketBreezewayOrder(fakeDb, "u", { ticketId: "t-2", workOrderId: "wo-1" })).ok).toBe(false);
    expect(tables.ticket_activity.length).toBe(0);
  });

  it("linking twice adds no second history line", async () => {
    await linkTicketBreezewayOrder(fakeDb, "u", { ticketId: "t-1", workOrderId: "wo-1" });
    await linkTicketBreezewayOrder(fakeDb, "u", { ticketId: "t-1", workOrderId: "wo-1" });
    expect(tables.ticket_activity.length).toBe(1);
  });
});

describe("C4 internal work orders hidden while the switch is off", () => {
  const src = (p: string) => readFileSync(p, "utf8");
  it("the ticket's work order card links the Breezeway work order when the switch is off", () => {
    const panel = src("src/components/workorders/TicketWorkOrderPanel.tsx");
    expect(panel).toContain('if (!flags.enabled("internal_work_orders")) {');
    expect(panel).toContain("<BreezewayRepairLink");
  });
  it("Push to Breezeway and Send to Breezeway are hidden when the switch is off", () => {
    expect(src("src/components/workorders/VendorSourcingPanel.tsx")).toContain("internalWorkOrdersOn && wo.breezeway_handoff_status");
    expect(src("src/components/workorders/DispatchNextStep.tsx")).toContain('!flags.enabled("internal_work_orders") ? null');
  });
  it("the internal work orders switch is a known switch", async () => {
    const { FLAG_KEYS } = await import("@/lib/feature-flags");
    expect(FLAG_KEYS as readonly string[]).toContain("internal_work_orders");
  });
});
