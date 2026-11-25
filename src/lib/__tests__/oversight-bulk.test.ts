import { describe, expect, it } from "bun:test";
import { anyLocked, selectedTicketIds } from "@/lib/oversight-bulk";
import { canRunBulkAction, planBulkUpdate } from "@/lib/queue-bulk";

const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

describe("oversight bulk", () => {
  it("a rolled-up reported issues row closes every issue inside it", () => {
    const ids = selectedTicketIds([{ id: id(1), status: "open", rollup: [{ id: id(2), status: "open" }, { id: id(3), status: "open" }] }, { id: id(4), status: "open" }]);
    expect(ids).toEqual([id(2), id(3), id(4)]);
  });
  it("asks for one reason when any selected ticket is locked", () => {
    expect(anyLocked([{ id: id(1), status: "open", due_locked: false }, { id: id(2), status: "open", rollup: [{ id: id(3), status: "open", due_locked: true }] }])).toBe(true);
    expect(planBulkUpdate({ ticketIds: [id(1)], action: "due", dueOn: "2026-12-01", anyLocked: true }).ok).toBe(false);
    expect(planBulkUpdate({ ticketIds: [id(1)], action: "due", dueOn: "2026-12-01", anyLocked: true, reason: "Vendor late" }).ok).toBe(true);
    expect(planBulkUpdate({ ticketIds: [id(1)], action: "due", dueOn: "2026-12-01" }).ok).toBe(true);
  });
  it("only Supervisors and Admin run Move due date and Close selected", () => {
    expect(canRunBulkAction({ roles: ["tech"] }, "due")).toBe(false);
    expect(canRunBulkAction({ roles: ["tech"] }, "close")).toBe(false);
    expect(canRunBulkAction({ roles: ["manager"] }, "close")).toBe(true);
  });
});
