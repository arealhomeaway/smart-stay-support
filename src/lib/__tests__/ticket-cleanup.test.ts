import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { canDecideApproval } from "@/lib/guest-recovery";
import { doThisNowDueAt, dueInLabel, recoveryStatusChip, recoveryTrackDone, ticketTracker, type TrackerFacts } from "@/lib/ticket-cleanup";

const base: TrackerFacts = { closed: false, guestInvolved: true, commState: "informed", stage: "repair", status: "open", acknowledged: true, makeRightOpen: false };
const cur = (f: Partial<TrackerFacts>) => ticketTracker({ ...base, ...f });

describe("step tracker", () => {
  it("guest acknowledgement or update due = Tell the guest", () => {
    expect(cur({ commState: "initial_ack" }).current).toBe("tell_guest");
    expect(cur({ commState: "update_due", stage: "repair_active" }).current).toBe("tell_guest");
  });
  it("open work = Fix it, with earlier steps checked", () => {
    for (const stage of ["repair", "repair_active", "steps", "verify"]) {
      const t = cur({ stage });
      expect(t.current).toBe("fix_it");
      expect(t.steps.filter((s) => s.complete).map((s) => s.key)).toEqual(["logged", "tell_guest"]);
    }
  });
  it("refund, credit or claim pending = Make it right", () => {
    expect(cur({ stage: "closure", makeRightOpen: true }).current).toBe("make_right");
  });
  it("no guest: Logged, Fix it, Done", () => {
    const t = cur({ guestInvolved: false, commState: "not_required" });
    expect(t.steps.map((s) => s.label)).toEqual(["Logged", "Fix it", "Done"]);
    expect(t.current).toBe("fix_it");
    expect(cur({ guestInvolved: false, commState: "not_required", stage: "closure" }).current).toBe("done");
  });
  it("closed: every step checked, none highlighted", () => {
    const t = cur({ closed: true, stage: "closed" });
    expect(t.current).toBeNull();
    expect(t.steps.every((s) => s.complete)).toBe(true);
  });
  it("unclear states show no highlight instead of guessing", () => {
    expect(cur({ status: "waiting", stage: "waiting" }).current).toBeNull();
    expect(cur({ commState: "waiting_guest" }).current).toBeNull();
    expect(cur({ guestInvolved: false, commState: "not_required", stage: "closure", makeRightOpen: true }).current).toBeNull();
    expect(cur({ status: "waiting", stage: "waiting" }).unmapped).toBeTruthy();
  });
});

describe("Do this now due line", () => {
  const now = new Date("2026-11-05T15:00:00Z");
  it("formats", () => {
    expect(dueInLabel("2026-11-05T15:03:00Z", now)).toBe("due in 3 min");
    expect(dueInLabel("2026-11-05T14:55:00Z", now)).toBe("overdue by 5 min");
    expect(dueInLabel(null, now)).toBeNull();
  });
  it("uses the existing clocks", () => {
    const t = { commState: "informed" as const, commDueAt: null, acknowledged_at: null, action_started_at: null, response_due_at: "R", action_due_at: "A", next_guest_update_at: "N" };
    expect(doThisNowDueAt(t)).toBe("R");
    expect(doThisNowDueAt({ ...t, acknowledged_at: "x" })).toBe("A");
    expect(doThisNowDueAt({ ...t, acknowledged_at: "x", commState: "update_due", commDueAt: "C" })).toBe("C");
  });
});

describe("refund status chip", () => {
  const names = { supervisor: "James Almario", director: "Micah Sinor" };
  it("per state", () => {
    expect(recoveryStatusChip({ stage: "awaiting_approval", approval_status: "pending", approval_authority: "supervisor" }, names)).toBe("Waiting on James");
    expect(recoveryStatusChip({ stage: "awaiting_approval", approval_status: "pending", approval_authority: "director" }, names)).toBe("Waiting on Micah");
    expect(recoveryStatusChip({ stage: "approved", approval_status: "approved" }, names)).toBe("Approved");
    expect(recoveryStatusChip({ stage: "decision_drafted", approval_status: "declined" }, names)).toBe("Declined");
    expect(recoveryStatusChip({ stage: "completed", approval_status: "approved", delivered_amount: 600 }, names)).toBe("Issued");
  });
  it("tracker progress", () => {
    expect(recoveryTrackDone({ stage: "awaiting_approval", approval_status: "pending" })).toBe(1);
    expect(recoveryTrackDone({ stage: "approved", approval_status: "approved" })).toBe(2);
    expect(recoveryTrackDone({ stage: "completed", delivered_amount: 5 })).toBe(3);
    expect(recoveryTrackDone({ stage: "closed" })).toBe(4);
  });
});

describe("approve/decline and reachability", () => {
  it("visibility rule unchanged", () => {
    expect(canDecideApproval("supervisor", { isSupervisor: true, isDirector: false })).toBe(true);
    expect(canDecideApproval("director", { isSupervisor: true, isDirector: false })).toBe(false);
    expect(canDecideApproval("director", { isSupervisor: false, isDirector: true })).toBe(true);
    const box = readFileSync("src/components/recovery/RecoveryDecisionBox.tsx", "utf8");
    expect(box).toContain("canDecideApproval(recovery.approval_authority, authority.data)");
    expect(box).toContain('rpc("decide_recovery_approval"');
    for (const f of ["src/components/recovery/RecoveryDrawer.tsx", "src/components/recovery/TicketRecoveryPanel.tsx"]) {
      expect(readFileSync(f, "utf8")).toContain("<RecoveryDecisionBox");
    }
  });
  it("every previous ticket section is still on the page", () => {
    const s = readFileSync("src/routes/_authenticated/tickets.$ticketId.tsx", "utf8");
    for (const piece of ["<CurrentActionCard", "<GuidedTicketPanel", "<ActivityList", "addNote", "<AttachmentsPanel", "<PropertyHistoryList", "<ReservationContextPanel", "<OccupancyGuestPanel", "<TicketOwnerBox", "<SentToOwner", "<TicketOwnerUpdatePanel", "<ExpensesCard", "<TicketWorkOrderPanel", "<WaitingControl", "<MoreActions", "<TicketRecoveryPanel", "<TicketClaimPanel", "<ClaimRelatedPrompt", "<NotionImportBlock", "<ClockText", "<PersonChip", "<OutlookSourceCard", "<VisitLogPanel", "<FinalReviewPanel", "Show all details"]) {
      expect(s.includes(piece)).toBe(true);
    }
    // "Open in Notion" now lives inside the Imported from Notion block on the same page.
    expect(readFileSync("src/components/tickets/NotionImportBlock.tsx", "utf8").includes("Open in Notion")).toBe(true);
    expect(s.includes('<TabsTrigger value="activity">')).toBe(false);
  });
  it("Do this now keeps the same Next action logic", () => {
    const s = readFileSync("src/routes/_authenticated/tickets.$ticketId.tsx", "utf8");
    expect(s).toContain("const currentAction = ticketCurrentAction({");
    const i = s.indexOf("<DoThisNow due={doNowDue}>");
    const j = s.indexOf("</DoThisNow>");
    expect(i > 0 && j > i).toBe(true);
    expect(s.slice(i, j)).toContain("<CurrentActionCard");
    expect(s.slice(i, j)).toContain("<GuidedTicketPanel");
  });
  it("serious-situation checkboxes sit under a collapsed row that opens when one is checked", () => {
    for (const f of ["src/components/recovery/TicketRecoveryPanel.tsx", "src/components/recovery/LogRecoveryDialog.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s).toContain("Anything serious? (legal, safety, insurance, damage...)");
      expect(s).toContain("open={flags.length > 0 ? true : undefined}");
    }
  });
});
