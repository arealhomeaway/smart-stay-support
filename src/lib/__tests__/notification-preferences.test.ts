import { describe, expect, it } from "bun:test";
import {
  DEFAULT_PREFERENCES,
  allowsEmail,
  allowsInApp,
  categoryForKind,
  personInitials,
  preferenceRow,
  readPreferences,
} from "../notification-preferences";

describe("notification preferences", () => {
  it("maps the kinds the database writes onto the settings people see", () => {
    expect(categoryForKind("ticket_assigned")).toBe("assignments");
    expect(categoryForKind("approval_required")).toBe("approvals");
    expect(categoryForKind("handoff_pending")).toBe("handoffs");
    expect(categoryForKind("work_order_update")).toBe("work_orders");
    expect(categoryForKind("closure_qa")).toBe("work_orders");
    expect(categoryForKind("sla_breach")).toBe("escalations");
  });

  it("treats a person with no saved settings as fully opted in", () => {
    const prefs = readPreferences(null);
    expect(prefs).toEqual(DEFAULT_PREFERENCES);
    expect(allowsEmail(prefs, "ticket_assigned")).toBe(true);
    expect(allowsInApp(prefs, "approval_required")).toBe(true);
  });

  it("round-trips a saved row", () => {
    const prefs = readPreferences({ email_enabled: true, email_assignments: false });
    expect(prefs.email.assignments).toBe(false);
    expect(prefs.email.approvals).toBe(true);
    const row = preferenceRow(prefs);
    expect(row["email_assignments"]).toBe(false);
    expect(readPreferences(row)).toEqual(prefs);
  });

  it("stops email for a category that is switched off", () => {
    const prefs = readPreferences({ email_work_orders: false });
    expect(allowsEmail(prefs, "work_order_update")).toBe(false);
    expect(allowsEmail(prefs, "ticket_assigned")).toBe(true);
    // The in-app record is untouched by an email choice.
    expect(allowsInApp(prefs, "work_order_update")).toBe(true);
  });

  it("stops every email when the master switch is off", () => {
    const prefs = readPreferences({ email_enabled: false });
    expect(allowsEmail(prefs, "approval_required")).toBe(false);
    expect(allowsInApp(prefs, "approval_required")).toBe(true);
  });

  it("hides a category from the bell when its in-app switch is off", () => {
    const prefs = readPreferences({ inapp_escalations: false });
    expect(allowsInApp(prefs, "sla_breach")).toBe(false);
    expect(allowsInApp(prefs, "ticket_assigned")).toBe(true);
  });

  it("falls back to initials people recognise", () => {
    expect(personInitials("Emily Jimenez")).toBe("EJ");
    expect(personInitials("Kati")).toBe("KA");
    expect(personInitials(null, "micah@arealhomeaway.com")).toBe("MI");
    expect(personInitials(null, null)).toBe("?");
  });
});
