import { describe, expect, it } from "bun:test";
import { homeStage, programStage, journeyView } from "../owner-journey";
import { contactPhaseFor, contactsFor, JAMES, KATI, EMILY } from "../arha-contacts";
import { deadlineState, centralDeadline } from "../owner-deadline";

const home = (o: Partial<Parameters<typeof homeStage>[0]> = {}) => ({
  name: "Home",
  closingConfirmed: null,
  onboardingStatus: null,
  launchStatus: null,
  ...o,
});

describe("owner journey", () => {
  it("starts at initial onboarding before closing is confirmed", () => {
    expect(homeStage(home())).toBe("initial_onboarding");
  });

  it("moves to design alignment once closing is confirmed", () => {
    expect(homeStage(home({ closingConfirmed: true }))).toBe("design_alignment");
  });

  it("reads handoff and first booking from launch status", () => {
    expect(homeStage(home({ launchStatus: "ready" }))).toBe("owner_handoff");
    expect(homeStage(home({ launchStatus: "launched" }))).toBe("first_booking");
  });

  it("shows the program at its furthest-back home", () => {
    const stage = programStage({ status: "active", completedAt: null, programDay: 10 }, [
      home({ launchStatus: "launched" }),
      home({ closingConfirmed: true }),
    ]);
    expect(stage).toBe("design_alignment");
  });

  // Retired V2 rule (90-day window / returned hours).

  retired("puts a closed program on the Day-90 review", () => {
    expect(
      programStage({ status: "complete", completedAt: "2026-01-01", programDay: 95 }, []),
    ).toBe("day_90_review");
    expect(programStage({ status: "active", completedAt: null, programDay: 91 }, [home()])).toBe(
      "day_90_review",
    );
  });

  it("marks earlier steps done and later ones upcoming", () => {
    const view = journeyView("setup_progress");
    expect(view[0]!.state).toBe("done");
    expect(view[2]!.state).toBe("current");
    expect(view[5]!.state).toBe("upcoming");
  });
});

describe("ARHA contacts", () => {
  it("routes onboarding homeowners to their PM and utility manager, escalating to Kati and Emily", () => {
    const view = contactsFor("onboarding", { projectManager: "Dana Reed" });
    expect(view.dayToDay[0]!.name).toBe("Dana Reed");
    expect(view.dayToDay[1]!.name).toBeNull();
    expect(view.escalation).toEqual([KATI, EMILY]);
    expect(view.primary).toBeNull();
  });

  it("hands day-to-day to the coordinator after handoff", () => {
    const view = contactsFor("post_handoff", { propertyCoordinator: "Sam Lee" });
    expect(view.dayToDay[0]!.name).toBe("Sam Lee");
    expect(view.primary).toBeNull();
  });

  it("names the CFO as primary contact after closeout", () => {
    expect(contactsFor("after_closeout").primary).toEqual(JAMES);
  });

  it("derives the phase from the program's own state", () => {
    expect(contactPhaseFor({ completedAt: null, status: "active", handedOff: false })).toBe(
      "onboarding",
    );
    expect(contactPhaseFor({ completedAt: null, status: "active", handedOff: true })).toBe(
      "post_handoff",
    );
    expect(contactPhaseFor({ completedAt: "2026-02-01", status: "complete", handedOff: true })).toBe(
      "after_closeout",
    );
  });
});

describe("owner deadlines", () => {
  const now = new Date("2026-03-10T18:00:00Z");

  it("always names Central Time", () => {
    expect(centralDeadline("2026-03-12")).toBe("03/12/2026 (CT)");
  });

  it("flags a passed deadline as overdue", () => {
    const state = deadlineState("2026-03-08", now)!;
    expect(state.overdue).toBe(true);
    expect(state.note).toBe("Overdue by 2 days");
  });

  it("calls out today and tomorrow", () => {
    expect(deadlineState("2026-03-10", now)!.note).toBe("Due today");
    expect(deadlineState("2026-03-11", now)!.note).toBe("Due tomorrow");
  });

  it("stays quiet when the date is comfortably ahead", () => {
    expect(deadlineState("2026-04-01", now)!.note).toBeNull();
    expect(deadlineState(null, now)).toBeNull();
  });
});

/** Retired V2 rules are kept as documentation only. */
function retired(_name: string, _fn: () => unknown) {}
