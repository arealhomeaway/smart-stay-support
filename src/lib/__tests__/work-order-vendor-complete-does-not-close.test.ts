import { describe, expect, it } from "bun:test";
import { canClose, closureBlockers, derivedStage, workOrderBucket } from "../work-orders";
import { repairIsComplete, ticketStage } from "../ticket-stage";

/**
 * Regression guard for the reported defect: "Vendor says complete
 * immediately closed the Work Order." Stamping `vendor_completed_at` alone
 * (no `closed_at`) must never read as closed anywhere derived state is
 * computed, and the linked Ticket must not advance until the Work Order is
 * actually closed.
 */
describe("Vendor says complete does not close the Work Order", () => {
  const vendorCompleteOnly = {
    vendor_contacted_at: "2026-01-01T00:00:00Z",
    vendor_acknowledged_at: "2026-01-01T00:05:00Z",
    vendor_arrived_at: "2026-01-02T09:00:00Z",
    vendor_completed_at: "2026-01-02T11:00:00Z",
    closed_at: null,
  };

  it("derivedStage reports 'evidence', not 'closed'", () => {
    expect(derivedStage(vendorCompleteOnly)).toBe("evidence");
    expect(derivedStage(vendorCompleteOnly)).not.toBe("closed");
  });

  it("workOrderBucket reports an open bucket, not 'closed'", () => {
    expect(workOrderBucket(vendorCompleteOnly)).not.toBe("closed");
  });

  it("Work Order remains editable afterward: closure is still blocked pending the rest of the checklist", () => {
    // Nothing else recorded yet (no evidence, no final cost) — canClose must
    // stay false, i.e. the record is not being treated as done.
    expect(canClose(vendorCompleteOnly)).toBe(false);
    expect(closureBlockers(vendorCompleteOnly).length).toBeGreaterThan(0);
    // Vendor completion itself is no longer a blocker once stamped.
    expect(closureBlockers(vendorCompleteOnly)).not.toContain(
      "Vendor completion has not been confirmed.",
    );
  });

  it("explicit Close Work Order is still required: even with every other requirement satisfied, closed_at absent means not closed", () => {
    const fullyDocumented = {
      ...vendorCompleteOnly,
      evidence_complete: true,
      final_cost: 150,
    };
    expect(canClose(fullyDocumented)).toBe(true); // eligible to close...
    expect(derivedStage(fullyDocumented)).not.toBe("closed"); // ...but not closed yet.
    expect(workOrderBucket(fullyDocumented)).not.toBe("closed");
  });

  it("closing still requires closed_at to be set — that's the only thing that flips derivedStage to 'closed'", () => {
    const actuallyClosed = { ...vendorCompleteOnly, closed_at: "2026-01-03T00:00:00Z" };
    expect(derivedStage(actuallyClosed)).toBe("closed");
    expect(workOrderBucket(actuallyClosed)).toBe("closed");
  });

  it("Ticket does not advance to Verify until the Work Order is actually closed (repairIsComplete stays false)", () => {
    expect(repairIsComplete({ vendorStatus: null, liveOrders: [{ closed_at: null }] })).toBe(false);

    const stage = ticketStage({
      status: "open",
      closed: false,
      repairExists: true,
      repairComplete: repairIsComplete({ vendorStatus: null, liveOrders: [{ closed_at: null }] }),
      verified: false,
      requiredOpenSteps: 0,
      repairPossible: true,
      repairReportedIncomplete: false,
    });
    expect(stage).toBe("repair_active");
    expect(stage).not.toBe("verify");
  });

  it("Ticket advances to Verify only once the Work Order actually closes", () => {
    expect(
      repairIsComplete({ vendorStatus: null, liveOrders: [{ closed_at: "2026-01-03T00:00:00Z" }] }),
    ).toBe(true);

    const stage = ticketStage({
      status: "open",
      closed: false,
      repairExists: true,
      repairComplete: true,
      verified: false,
      requiredOpenSteps: 0,
      repairPossible: true,
      repairReportedIncomplete: false,
    });
    expect(stage).toBe("verify");
  });
});
