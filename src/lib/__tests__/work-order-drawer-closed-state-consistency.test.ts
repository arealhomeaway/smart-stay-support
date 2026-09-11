import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * This repo has no React rendering/DOM test harness (see the other
 * __tests__ files — every one tests a plain function, never a component),
 * so "a closed Work Order locks its actions" can't be exercised by
 * simulating a click. This is a source-level regression guard instead: it
 * fails if the wiring behind that behavior is ever removed.
 *
 * Root cause of the reported inconsistency: `readOnly` was derived only
 * from the viewer's edit permission (`!canEdit`), never from
 * `workOrder.closed_at`. So once a Work Order was actually closed (a real
 * "Work order closed" event in history), every field and button gated on
 * `readOnly` — including "Close work order" itself — stayed enabled,
 * because closing never flips `readOnly` to true. "Vendor says complete"
 * itself never touches `closed_at` (see
 * work-order-vendor-complete-does-not-close.test.ts); the closed state
 * seen in that acceptance round came from an explicit "Close work order"
 * click, and the leftover-active Close button is what made it look like
 * more clicks were still doing something.
 */
describe("WorkOrderDrawer — closed state and available actions stay consistent", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../../components/workorders/WorkOrderDrawer.tsx"), "utf8");

  it("readOnly locks once the Work Order is actually closed, not just on edit permission", () => {
    expect(src).toContain("const permissionReadOnly = !canEdit;");
    expect(src).toContain("const readOnly = permissionReadOnly || Boolean(workOrder.closed_at);");
  });

  it("Close work order is disabled by that same readOnly, so it can't stay active on a closed record", () => {
    expect(src).toContain("disabled={readOnly || save.isPending || !canClose(workOrder, reqs)}");
  });

  it("Reopen ignores the closed-state lock — it must stay clickable precisely when the record is closed", () => {
    const reopenMatch = src.match(
      /\{workOrder\.closed_at && isSupervisor \? \(\s*<Button[\s\S]*?<\/Button>/,
    );
    expect(reopenMatch).not.toBeNull();
    const body = reopenMatch?.[0] ?? "";
    expect(body).toContain("disabled={permissionReadOnly || save.isPending}");
    expect(body).not.toContain("disabled={readOnly");
  });

  it("Reopen is still gated on the Work Order being closed and the viewer being a supervisor", () => {
    expect(src).toContain("{workOrder.closed_at && isSupervisor ? (");
  });

  it("the Stamp for Vendor says complete only ever writes vendor_completed_at, never closed_at", () => {
    const stampMatch = src.match(/<Stamp\s+label="Vendor says complete"[\s\S]*?\/>/);
    expect(stampMatch).not.toBeNull();
    expect(stampMatch?.[0] ?? "").toContain('k="vendor_completed_at"');
  });
});
