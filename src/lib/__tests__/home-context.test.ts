import { describe, expect, it } from "bun:test";
import { handoffsWaiting, homeLifecycle, isOpsDirectorSeat, opsRecordStatus, showOnboardingView } from "../home-context";
import { groupOwnerTab, type OwnerTabItem } from "../onboarding-cleanup";
import { savedWaitingOrder } from "../owner-waiting-order";

describe("home header", () => {
  it("names the lifecycle in plain words", () => {
    expect(homeLifecycle({ lifecycleStatus: "onboarding", handoffState: "in_progress" })).toBe("Onboarding");
    expect(homeLifecycle({ lifecycleStatus: "onboarding", handoffState: "ready" })).toBe("Ready for handoff");
    expect(homeLifecycle({ lifecycleStatus: "active", handoffState: "accepted" })).toBe("Handed off");
    expect(homeLifecycle({ lifecycleStatus: "active_operations", handoffState: null })).toBe("Live");
  });
  it("shows the Onboarding view only with a project and existing access", () => {
    expect(showOnboardingView(true, true)).toBe(true);
    expect(showOnboardingView(false, true)).toBe(false);
    expect(showOnboardingView(true, false)).toBe(false);
  });
});

describe("handoffs waiting", () => {
  it("lists oldest first with whole days waiting", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    const rows = handoffsWaiting([
      { projectId: "b", propertyId: "2", name: "B", readyAt: "2026-10-28T12:00:00Z" },
      { projectId: "a", propertyId: "1", name: "A", readyAt: "2026-10-25T12:00:00Z" },
    ], now);
    expect(rows.map((r) => [r.projectId, r.days])).toEqual([["a", 4], ["b", 1]]);
  });
  it("shows only to the Director of Operations seat holder or the person covering it", () => {
    expect(isOpsDirectorSeat("micah", "micah", null)).toBe(true);
    expect(isOpsDirectorSeat("cover", "micah", "cover")).toBe(true);
    expect(isOpsDirectorSeat("pc", "micah", "cover")).toBe(false);
  });
});

describe("Operations items in the Active Owner tab", () => {
  it("groups Ticket updates and approvals as waiting until answered", () => {
    expect(opsRecordStatus({ type: "Ticket update", id: "u", ticketId: "t", title: "", sentAt: null, answeredAt: null })).toBe("open");
    expect(opsRecordStatus({ type: "Ticket update", id: "u", ticketId: "t", title: "", sentAt: null, answeredAt: "2026-10-01" })).toBe("complete");
    expect(opsRecordStatus({ type: "Approval request", id: "a", ticketId: null, title: "", sentAt: null, status: "pending", decidedAt: null })).toBe("open");
    expect(opsRecordStatus({ type: "Approval request", id: "a", ticketId: null, title: "", sentAt: null, status: "approved", decidedAt: "x" })).toBe("complete");
  });
  it("keeps Operations records after reorderable staff items and never reorderable", () => {
    const base = { status: "open", sentAt: "2026-10-01", completedAt: null, ownerAt: null, staffAt: null, activity: "" };
    const items: OwnerTabItem[] = [
      { ...base, id: "ops1", kind: "ops", title: "Ticket update", fromOperations: true, ticketId: "t1" },
      { ...base, id: "s1", kind: "request", title: "Staff" },
    ];
    const waiting = groupOwnerTab(items).waiting;
    expect(waiting.map((i) => i.id).sort()).toEqual(["ops1", "s1"]);
    expect(savedWaitingOrder(waiting, ["s1"]).map((i) => i.id)).toEqual(["s1", "ops1"]);
  });
});
