import { describe, expect, it } from "bun:test";
import {
  BULK_LIMIT,
  bulkDenialReason,
  canRunBulkAction,
  planBulkUpdate,
} from "@/lib/queue-bulk";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("who may run a batch action", () => {
  it("keeps reassignment and priority with supervisors", () => {
    const tech = { roles: ["tech"] };
    expect(canRunBulkAction(tech, "assign")).toBe(false);
    expect(canRunBulkAction(tech, "priority")).toBe(false);
    expect(canRunBulkAction(tech, "status")).toBe(true);
    expect(canRunBulkAction({ roles: ["manager"] }, "assign")).toBe(true);
    expect(canRunBulkAction({ roles: ["admin"] }, "priority")).toBe(true);
  });

  it("lets nobody change anything while previewing another role", () => {
    const viewer = { roles: ["admin"], readOnly: true };
    expect(canRunBulkAction(viewer, "status")).toBe(false);
    expect(bulkDenialReason(viewer, "status")).toContain("previewing");
  });

  it("shuts out owners and vendors", () => {
    expect(canRunBulkAction({ roles: ["owner"] }, "status")).toBe(false);
    expect(canRunBulkAction({ roles: ["vendor"] }, "status")).toBe(false);
    expect(bulkDenialReason({ roles: ["vendor"] }, "status")).toContain("Operations staff");
  });
});

describe("planning the change", () => {
  it("refuses an empty or oversized selection", () => {
    expect(planBulkUpdate({ ticketIds: [], action: "status", status: "open" })).toMatchObject({
      ok: false,
    });
    const many = Array.from({ length: BULK_LIMIT + 1 }, (_, i) => id(i));
    expect(planBulkUpdate({ ticketIds: many, action: "status", status: "open" })).toMatchObject({
      ok: false,
    });
  });

  it("de-duplicates the selection", () => {
    const plan = planBulkUpdate({ ticketIds: [id(1), id(1), id(2)], action: "status", status: "in_progress" });
    expect(plan.ok && plan.ticketIds).toEqual([id(1), id(2)]);
  });

  it("will not resolve or close in a batch", () => {
    const plan = planBulkUpdate({ ticketIds: [id(1)], action: "status", status: "closed" });
    expect(plan).toMatchObject({ ok: false });
    expect(!plan.ok && plan.error).toContain("one at a time");
  });

  it("requires a written reason for a priority change", () => {
    expect(planBulkUpdate({ ticketIds: [id(1)], action: "priority", priority: "p1" })).toMatchObject({
      ok: false,
    });
    const plan = planBulkUpdate({
      ticketIds: [id(1)],
      action: "priority",
      priority: "p1",
      reason: "Freeze warning across the market",
    });
    expect(plan.ok && plan.patch).toEqual({
      priority: "p1",
      priority_override_reason: "Freeze warning across the market",
    });
  });

  it("allows clearing the assignee back to unassigned", () => {
    const plan = planBulkUpdate({ ticketIds: [id(3)], action: "assign", assigneeId: null });
    expect(plan.ok && plan.patch).toEqual({ assigned_to: null });
  });
});
