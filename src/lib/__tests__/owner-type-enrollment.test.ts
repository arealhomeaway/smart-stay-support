// @ts-nocheck: in-memory fake database fixture; row shapes are checked by assertions.
/**
 * Owner Type "Active Owner" enrolls the home (Emily, Nov 20). Pure rules plus the server
 * composition with the existing Enroll path stubbed; nothing touches a real database.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import {
  enrollmentClosingDate,
  finishSetupLabel,
  isLiveProgram,
  ownerTypeMessage,
  ownerTypeTurnsOnActiveOwner,
} from "../owner-type-enrollment";

describe("rules", () => {
  it("only a change to Active Owner starts enrollment; changing away or saving the same value does nothing", () => {
    expect(ownerTypeTurnsOnActiveOwner("Standard DFY", "Active Owner")).toBe(true);
    expect(ownerTypeTurnsOnActiveOwner(null, "Active Owner")).toBe(true);
    expect(ownerTypeTurnsOnActiveOwner("Active Owner", "Active Owner")).toBe(false);
    expect(ownerTypeTurnsOnActiveOwner("Active Owner", "Standard DFY")).toBe(false);
    expect(ownerTypeTurnsOnActiveOwner("Active Owner", null)).toBe(false);
  });
  it("a draft or closed program is not live; active and paused are", () => {
    expect(isLiveProgram({ status: "active", archived_at: null })).toBe(true);
    expect(isLiveProgram({ status: "paused", archived_at: null })).toBe(true);
    expect(isLiveProgram({ status: "draft", archived_at: null })).toBe(false);
    expect(isLiveProgram({ status: "closed", archived_at: null })).toBe(false);
    expect(isLiveProgram({ status: "active", archived_at: "2026-11-01" })).toBe(false);
  });
  it("closing date: project planned, else the home's planned; a confirmed closing wins", () => {
    expect(enrollmentClosingDate({ actualClosingOn: null, projectPlannedClosingOn: "2026-11-30", propertyPlannedClosingOn: "2026-12-05" })).toBe("2026-11-30");
    expect(enrollmentClosingDate({ actualClosingOn: null, projectPlannedClosingOn: null, propertyPlannedClosingOn: "2026-12-05" })).toBe("2026-12-05");
    expect(enrollmentClosingDate({ actualClosingOn: "2026-11-02", projectPlannedClosingOn: "2026-11-30", propertyPlannedClosingOn: null })).toBe("2026-11-02");
    expect(enrollmentClosingDate({ actualClosingOn: null, projectPlannedClosingOn: null, propertyPlannedClosingOn: null })).toBe(null);
  });
  it("messages: welcome email named; missing email points to the Active Owner tab", () => {
    expect(ownerTypeMessage({ kind: "enrolled", email: "a@b.com", welcomeHeld: false })?.text).toContain("Welcome email sent to a@b.com");
    expect(ownerTypeMessage({ kind: "needs_email" })?.text).toContain("Add the owner email");
    expect(ownerTypeMessage({ kind: "already_enrolled" })).toBe(null);
    expect(ownerTypeMessage(null)).toBe(null);
  });
  it("Active Owner tab: Add owner email only on a program with no login and no email", () => {
    expect(finishSetupLabel({ ownerLinked: false, ownerEmail: null, propertyCount: 1 })).toBe("Add owner email");
    expect(finishSetupLabel({ ownerLinked: false, ownerEmail: "a@b.com", propertyCount: 1 })).toBe("Finish setup");
    expect(finishSetupLabel({ ownerLinked: true, ownerEmail: null, propertyCount: 1 })).toBe(null);
    expect(finishSetupLabel({ ownerLinked: false, ownerEmail: null, propertyCount: 0 })).toBe(null);
  });
});

// ---------------------------------------------------------------- server composition
// Admin, Nov 23: every role enrolls through the one automatic path (autoEnrollHome). The
// former "someone who cannot enroll ... enrolls nothing" and "no email stops at the draft"
// checks are replaced by the rules below and in active-owner-auto-enroll.test.ts.
import { enrollForOwnerType, OWNER_TYPE_MODULE_REASON } from "../owner-type-enrollment.server";
import { HOME, OWNER, PM, baseTables, fakeDb, fakeDeps } from "./support/fake-auto-enroll-db";

let tables;
const run = (who, before, after) => {
  const { db } = fakeDb(tables);
  const f = fakeDeps(tables);
  // the saver's own signed-in access is the same fake database here
  return enrollForOwnerType(db, who, { projectId: "proj", before, after }, { db, auto: f.deps }).then((out) => ({ out, calls: f.calls }));
};

beforeEach(() => {
  tables = baseTables({ ownerType: "Active Owner", modules: ["utilities"], closing: "2026-11-30" });
});

describe("Owner Type set to Active Owner", () => {
  it("adds the module with the same History reason and enrolls as the person who saved", async () => {
    const { out, calls } = await run(PM, "Standard DFY", "Active Owner");
    expect(tables.onboarding_projects[0].modules).toEqual(["utilities", "active_owner"]);
    expect(tables.onboarding_project_events.some((e) => e.kind === "scope_changed" && e.detail === OWNER_TYPE_MODULE_REASON)).toBe(true);
    expect(calls.enroll[0]).toMatchObject({ actorId: PM, propertyId: HOME, ownerRecordId: OWNER, name: "Pat Owner", email: "pat@example.com", closingDate: "2026-11-30" });
    expect(out).toEqual({ kind: "enrolled", email: "pat@example.com", welcomeHeld: false });
  });

  it("never creates a second program when the home is already in a live program", async () => {
    tables.onboarding_projects[0].modules = ["active_owner"];
    const program = { id: "live", owner_record_id: OWNER, status: "active", archived_at: null, owner_user_id: "login" };
    tables.owner_programs.push(program);
    tables.owner_program_properties.push({ property_id: HOME, inclusion_status: "included", owner_programs: program });
    const { out, calls } = await run(PM, null, "Active Owner");
    expect(out).toEqual({ kind: "already_enrolled" });
    expect(calls.enroll).toHaveLength(0);
    expect(tables.owner_programs).toHaveLength(1);
  });

  it("no owner email: enrolled with no login and no welcome, and the message asks for the email", async () => {
    tables.property_owners[0].email = null;
    const { out, calls } = await run(PM, null, "Active Owner");
    expect(calls.enroll[0].email).toBe("");
    expect(out).toEqual({ kind: "enrolled_no_email" });
    expect(ownerTypeMessage(out)?.text).toContain("Add the homeowner's email");
  });

  it("changing away from Active Owner, or saving the same value, does nothing", async () => {
    expect((await run(PM, "Active Owner", "Standard DFY")).out).toBe(null);
    expect((await run(PM, "Active Owner", "Active Owner")).out).toBe(null);
    expect(tables.onboarding_projects[0].modules).toEqual(["utilities"]);
    expect(tables.owner_programs).toHaveLength(0);
  });

  it("uses the home's planned closing when the project has none", async () => {
    tables.onboarding_projects[0].planned_closing_on = null;
    tables.properties[0].planned_closing_on = "2026-12-10";
    const { calls } = await run(PM, null, "Active Owner");
    expect(calls.enroll[0].closingDate).toBe("2026-12-10");
  });
});
