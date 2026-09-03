import { describe, expect, it } from "bun:test";
import {
  allowedTransitions,
  isFinished,
  isTerminal,
  isWorkingStatus,
  reviewDateProblem,
  validateTicketTransition,
  type LifecycleFacts,
} from "@/lib/ticket-lifecycle";
import { closureEvidenceSatisfied, requiresPhotoOrFile } from "@/lib/evidence-requirements";

const base: LifecycleFacts = {
  status: "open",
  requiresFieldWork: false,
  hasDispatchObject: false,
  hasDispatchDestination: false,
  hasDispatchScope: false,
  dispatchApprovalPending: false,
  hasGuestContext: false,
  guestCommunicationRecorded: false,
  requiresClosureEvidence: false,
  requiresClosureFile: false,
  hasQualifyingFile: false,
  hasClosureSummary: true,
  requiredStepsComplete: true,
};

const future = () => new Date(Date.now() + 86_400_000).toISOString();

describe("resolved and closed mean different things", () => {
  it("resolved is finished work but not terminal", () => {
    expect(isFinished("resolved")).toBe(true);
    expect(isTerminal("resolved")).toBe(false);
    expect(isWorkingStatus("resolved")).toBe(false);
    expect(isTerminal("closed")).toBe(true);
  });

  it("a ticket cannot be closed before it is resolved", () => {
    const v = validateTicketTransition("closed", { ...base, status: "in_progress" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("close_before_resolved");
  });

  it("closure QA must pass before closing", () => {
    const blocked = validateTicketTransition("closed", { ...base, status: "resolved" });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.exception).toBe("closure_qa");
    expect(
      validateTicketTransition("closed", { ...base, status: "resolved", closureQaResult: "pass" }).ok,
    ).toBe(true);
  });

  it("a closed ticket must be reopened before anything else", () => {
    const v = validateTicketTransition("in_progress", { ...base, status: "closed" });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("reopen_required");
  });
});

describe("waiting always has a dependency, a reason and a future date", () => {
  it("refuses a waiting state with nothing to wait on", () => {
    expect(validateTicketTransition("waiting", { ...base }).ok).toBe(false);
  });

  it("refuses a review date in the past", () => {
    const v = validateTicketTransition("waiting", {
      ...base,
      waiting_on: "vendor",
      waiting_reason: "Quote",
      next_review_at: "2020-01-01T00:00:00.000Z",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("waiting_no_review_date");
  });

  it("accepts a complete waiting state", () => {
    expect(
      validateTicketTransition("waiting", {
        ...base,
        waiting_on: "vendor",
        waiting_reason: "Quote",
        next_review_at: future(),
      }).ok,
    ).toBe(true);
  });

  it("an unreadable date is refused rather than silently accepted", () => {
    expect(reviewDateProblem("not a date")).toBeTruthy();
    expect(reviewDateProblem(future())).toBeNull();
  });
});

describe("dispatch needs somewhere to dispatch to", () => {
  it("refuses dispatch with no work order", () => {
    const v = validateTicketTransition("dispatched", { ...base, requiresFieldWork: true });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.exception).toBe("dispatch_prerequisites");
  });

  it("refuses dispatch while the cost tier is unapproved", () => {
    const v = validateTicketTransition("dispatched", {
      ...base,
      requiresFieldWork: true,
      hasDispatchObject: true,
      hasDispatchDestination: true,
      hasDispatchScope: true,
      dispatchApprovalPending: true,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("dispatch_awaiting_approval");
  });
});

describe("awaiting guest confirmation needs a guest", () => {
  it("refuses when there is no guest and no message sent", () => {
    expect(validateTicketTransition("awaiting_guest", base).ok).toBe(false);
    const v = validateTicketTransition("awaiting_guest", { ...base, hasGuestContext: true });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("guest_no_communication");
  });
});

describe("closure evidence is evidence, not a sentence", () => {
  it("a photo requirement is not met by a description", () => {
    const v = validateTicketTransition("resolved", {
      ...base,
      status: "in_progress",
      requiresClosureEvidence: true,
      requiresClosureFile: true,
      closureEvidenceText: "I took a photo, trust me",
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("closure_no_file");
  });

  it("the requirement reader knows a photo request from a note request", () => {
    expect(requiresPhotoOrFile("Photo of the completed repair")).toBe(true);
    expect(requiresPhotoOrFile("Upload the vendor invoice")).toBe(true);
    expect(requiresPhotoOrFile("Written confirmation from the guest")).toBe(false);
    expect(closureEvidenceSatisfied({ requirement: "Photo of repair", text: "done" })).toBe(false);
    expect(
      closureEvidenceSatisfied({ requirement: "Photo of repair", text: "done", fileCount: 1 }),
    ).toBe(true);
    expect(closureEvidenceSatisfied({ requirement: null, text: "" })).toBe(true);
  });

  it("open required steps block resolution", () => {
    const v = validateTicketTransition("resolved", {
      ...base,
      status: "in_progress",
      requiredStepsComplete: false,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("closure_steps_open");
  });
});

describe("the status menu only offers what is legal", () => {
  it("a bare open ticket cannot be offered dispatch or closure", () => {
    const options = allowedTransitions(base);
    expect(options).toContain("in_progress");
    expect(options).not.toContain("closed");
    expect(options).not.toContain("dispatched");
  });

  it("a supervisor with exceptions sees more, but not the impossible", () => {
    const options = allowedTransitions(base, { allowExceptions: true });
    expect(options).toContain("dispatched");
    // Closing before resolving has no named exception — it stays unavailable.
    expect(options).not.toContain("closed");
  });
});
