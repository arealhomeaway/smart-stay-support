import { describe, expect, it } from "bun:test";
import {
  currentGuestDisplay,
  guestCommState,
  isPostStayFeedback,
  relationFromDates,
  suggestActiveStayImpact,
  ticketGuestComm,
} from "@/lib/guest-impact";
import { ticketCurrentAction } from "@/lib/ticket-current-action";
import { ticketNextAction } from "@/lib/ticket-next-action";
import { ticketGuidance } from "@/lib/ticket-guidance";

const now = new Date("2026-10-02T15:00:00Z");
const started = {
  status: "in_progress",
  acknowledged_at: "2026-10-02T10:00:00Z",
  action_started_at: "2026-10-02T10:05:00Z",
};

describe("A. vacant property + post-stay survey", () => {
  const t = { guest_in_residence: true, issue_reservation_relation: "prior" };
  it("is not an active stay and never starts a cadence", () => {
    expect(isPostStayFeedback("Guest review, survey and rating logs")).toBe(true);
    expect(isPostStayFeedback("Cleaning Review Log")).toBe(false);
    const g = ticketGuestComm(t, "Guest review, survey and rating logs", now);
    expect(g.impact).toBe("no");
    expect(g.activeCadence).toBe(false);
    expect(g.commState).toBe("not_required");
  });
  it("says Contact prior guest when follow-up is required", () => {
    const g = ticketGuestComm({ ...t, guest_comm_required: "yes" }, "Guest review, survey and rating logs", now);
    expect(g.commState).toBe("contact_prior_guest");
    expect(ticketCurrentAction({ ...started, guest_comm_state: g.commState })?.title).toBe(
      "Contact prior guest for feedback",
    );
    expect(ticketNextAction({ ...started, guest_comm_state: g.commState })?.label).toBe(
      "Contact prior guest for feedback",
    );
  });
  it("prior dates resolve to a prior relation", () => {
    expect(relationFromDates("2026-09-20", "2026-09-25", now)).toBe("prior");
    expect(relationFromDates("2026-10-01", "2026-10-05", now)).toBe("current");
    expect(relationFromDates("2026-10-10", "2026-10-12", now)).toBe("future");
  });
});

describe("B. current guest + active issue", () => {
  const base = { active_stay_impact: "yes", guest_comm_required: "yes" };
  it("asks for the initial acknowledgement first", () => {
    const g = ticketGuestComm(base, "HVAC", now);
    expect(g.commState).toBe("initial_ack");
    expect(ticketCurrentAction({ ...started, guest_comm_state: g.commState })?.title).toBe(
      "Send initial guest acknowledgement",
    );
  });
  it("does not repeat the guest step right after an update", () => {
    const g = ticketGuestComm(
      { ...base, guest_update_at: "2026-10-02T14:50:00Z", next_guest_update_at: "2026-10-02T17:00:00Z" },
      "HVAC",
      now,
    );
    expect(g.commState).toBe("informed");
    const a = ticketCurrentAction({
      ...started,
      guest_comm_state: g.commState,
      vendor_name: "Cool Air",
      vendor_status: "scheduled",
    });
    expect(a?.id).toBe("vendor_checkin");
    expect(
      ticketNextAction({ ...started, guest_comm_state: g.commState, vendor_name: "Cool Air", vendor_status: "scheduled" })
        ?.label,
    ).toBe("Waiting for vendor");
  });
  it("brings the guest step back only when the scheduled update is due", () => {
    const g = ticketGuestComm(
      { ...base, guest_update_at: "2026-10-02T12:00:00Z", next_guest_update_at: "2026-10-02T14:00:00Z" },
      "HVAC",
      now,
    );
    expect(g.commState).toBe("update_due");
    expect(ticketCurrentAction({ ...started, guest_comm_state: g.commState })?.title).toBe("Guest update due");
  });
  it("guided panel: initial ack once, then no repeat until due", () => {
    const common = {
      status: "in_progress",
      closed: false,
      acknowledged_at: "x",
      openWorkOrders: 0,
      completeWorkOrders: 0,
      requiredOpenSteps: 0,
      missingEvidence: false,
      active_stay: true,
      now,
    };
    expect(ticketGuidance(common).title).toBe("Send initial guest acknowledgement");
    expect(
      ticketGuidance({ ...common, guest_update_at: "y", next_guest_update_at: "2026-10-02T18:00:00Z" }).step,
    ).not.toBe("guest_update");
    expect(
      ticketGuidance({ ...common, guest_update_at: "y", next_guest_update_at: "2026-10-02T14:00:00Z" }).title,
    ).toBe("Guest update due");
  });
  it("waiting on the guest is its own state", () => {
    expect(
      guestCommState({ impact: "yes", comm: "yes", postStay: false, guest_update_at: "x", waiting_on: "guest", now }).state,
    ).toBe("waiting_guest");
  });
});

describe("C. current guest differs from issue guest", () => {
  it("a prior-stay issue never asks to update the current guest", () => {
    const impact = suggestActiveStayImpact({ occupancy: "in_home", relation: "prior", postStay: true });
    expect(impact).toBe("no");
    const g = ticketGuestComm(
      { issue_reservation_relation: "prior", active_stay_impact: impact, guest_comm_required: "yes", guest_in_residence: true },
      "Guest review, survey and rating logs",
      now,
    );
    expect(g.activeCadence).toBe(false);
    expect(g.commState).toBe("contact_prior_guest");
  });
});

describe("D. vacant maintenance", () => {
  it("no guest communication unless chosen", () => {
    const impact = suggestActiveStayImpact({ occupancy: "vacant", relation: null, postStay: false, guestImpact: "none" });
    expect(impact).toBe("no");
    const g = ticketGuestComm({ active_stay_impact: impact, guest_comm_required: "no" }, "Appliance repair", now);
    expect(g.commState).toBe("not_required");
    expect(ticketCurrentAction({ ...started, guest_comm_state: g.commState })?.id).not.toBe("guest_update");
  });
});

describe("E. occupancy unknown", () => {
  it("never guesses Guest in home", () => {
    for (const s of ["not_linked", "ambiguous", "source_error", "unknown"]) {
      const d = currentGuestDisplay({ status: s });
      expect(d.occupancy).toBe("unknown");
      expect(d.headline).toBe("Occupancy unknown");
      expect(d.showGuest).toBe(false);
    }
    expect(suggestActiveStayImpact({ occupancy: "unknown", relation: null, postStay: false })).toBe("unknown");
  });
});

describe("F. active reservation, contact missing", () => {
  it("shows Guest in home with a clear missing-contact message, never 'no guest'", () => {
    const d = currentGuestDisplay({ status: "occupied", guest_name: "Synthetic Guest", phone: null, email: null });
    expect(d.occupancy).toBe("in_home");
    expect(d.showGuest).toBe(true);
    expect(d.contactMissing).toBe(true);
    expect(d.headline).toContain("contact details are unavailable");
    expect(currentGuestDisplay({ status: "occupied", phone: "555" }).contactMissing).toBe(false);
    expect(currentGuestDisplay({ status: "vacant" }).headline).toBe("No current guest");
  });
});

describe("legacy tickets keep working", () => {
  it("guest_in_residence without new fields still asks to update the guest", () => {
    expect(ticketCurrentAction({ ...started, guest_in_residence: true })?.title).toBe("Update the guest");
    const g = ticketGuestComm({ guest_in_residence: true }, "HVAC", now);
    expect(g.activeCadence).toBe(true);
  });
});
