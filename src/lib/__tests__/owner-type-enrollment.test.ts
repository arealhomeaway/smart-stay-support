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
type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};
let calls: { updateProject: Row[]; ensure: string[]; enroll: Row[] } = { updateProject: [], ensure: [], enroll: [] };
let authority = true;

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  const rows = () => (tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
  const api = {
    select: () => api,
    eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), api),
    is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), api),
    not: () => api,
    single: async () => ({ data: rows()[0] ?? null, error: rows()[0] ? null : { message: "none" } }),
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(resolve),
  };
  return api;
}
const actor = { from: (t: string) => query(t) };

const deps = {
  isActiveOwnerAuthority: async () => authority,
  mayActOnRecord: async () => true,
  updateProject: async (_s: unknown, _u: string, input: Row) => {
    calls.updateProject.push(input);
    tables.onboarding_projects[0].modules = input.modules;
  },
  ensureActiveOwnerEnrollment: async (_s: unknown, _u: string, propertyId: string) => {
    calls.ensure.push(propertyId);
  },
  enrollFully: async (_a: unknown, actorId: string, input: Row) => {
    calls.enroll.push({ ...input, actorId });
    return { complete: true, welcomeHeld: false, steps: [] };
  },
};

import { enrollForOwnerType as run, OWNER_TYPE_MODULE_REASON } from "../owner-type-enrollment.server";
const enrollForOwnerType = (a, u, i) => run(a, u, i, deps);

beforeEach(() => {
  authority = true;
  calls = { updateProject: [], ensure: [], enroll: [] };
  tables = {
    onboarding_projects: [{ id: "proj", property_id: "11111111-1111-4111-8111-111111111111", modules: ["utilities"], planned_closing_on: "2026-11-30" }],
    properties: [{ id: "11111111-1111-4111-8111-111111111111", owner_record_id: "22222222-2222-4222-8222-222222222222", planned_closing_on: null, actual_closing_on: null, is_demo: false }],
    property_owners: [{ id: "22222222-2222-4222-8222-222222222222", name: "Pat Owner", email: "Pat@Example.com", active: true }],
    owner_program_properties: [],
    owner_programs: [],
  };
});

describe("Owner Type set to Active Owner", () => {
  it("adds the module with a reason and enrolls through the Enroll path as the person who saved", async () => {
    const out = await enrollForOwnerType(actor, "user-1", { projectId: "proj", before: "Standard DFY", after: "Active Owner" });
    expect(calls.updateProject).toHaveLength(1);
    expect(calls.updateProject[0].modules).toEqual(["utilities", "active_owner"]);
    expect(calls.updateProject[0].reason).toBe(OWNER_TYPE_MODULE_REASON);
    expect(calls.ensure).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(calls.enroll).toHaveLength(1);
    expect(calls.enroll[0]).toMatchObject({ actorId: "user-1", propertyId: "11111111-1111-4111-8111-111111111111", ownerRecordId: "22222222-2222-4222-8222-222222222222", name: "Pat Owner", email: "pat@example.com", closingDate: "2026-11-30" });
    expect(out).toEqual({ kind: "enrolled", email: "pat@example.com", welcomeHeld: false });
  });

  it("never creates a second program when the home is already in a live program", async () => {
    tables.onboarding_projects[0].modules = ["active_owner"];
    tables.owner_program_properties = [{ property_id: "11111111-1111-4111-8111-111111111111", inclusion_status: "included", owner_programs: { status: "active", archived_at: null } }];
    const out = await enrollForOwnerType(actor, "user-1", { projectId: "proj", before: null, after: "Active Owner" });
    expect(out).toEqual({ kind: "already_enrolled" });
    expect(calls.ensure).toHaveLength(0);
    expect(calls.enroll).toHaveLength(0);
    expect(calls.updateProject).toHaveLength(0);
  });

  it("no owner email: the program is still created and linked, with no login and no welcome", async () => {
    tables.property_owners[0].email = null;
    const out = await enrollForOwnerType(actor, "user-1", { projectId: "proj", before: null, after: "Active Owner" });
    expect(calls.ensure).toEqual(["11111111-1111-4111-8111-111111111111"]);
    expect(calls.enroll).toHaveLength(0);
    expect(out).toEqual({ kind: "needs_email" });
  });

  it("someone who cannot enroll keeps the module in step but enrolls nothing", async () => {
    authority = false;
    const out = await enrollForOwnerType(actor, "pm", { projectId: "proj", before: null, after: "Active Owner" });
    expect(calls.updateProject).toHaveLength(1);
    expect(calls.ensure).toHaveLength(0);
    expect(calls.enroll).toHaveLength(0);
    expect(out).toEqual({ kind: "needs_authority" });
  });

  it("changing away from Active Owner, or saving the same value, does nothing", async () => {
    expect(await enrollForOwnerType(actor, "user-1", { projectId: "proj", before: "Active Owner", after: "Standard DFY" })).toBe(null);
    expect(await enrollForOwnerType(actor, "user-1", { projectId: "proj", before: "Active Owner", after: "Active Owner" })).toBe(null);
    expect(calls.updateProject).toHaveLength(0);
    expect(calls.enroll).toHaveLength(0);
  });

  it("uses the home's planned closing when the project has none", async () => {
    tables.onboarding_projects[0].planned_closing_on = null;
    tables.properties[0].planned_closing_on = "2026-12-10";
    await enrollForOwnerType(actor, "user-1", { projectId: "proj", before: null, after: "Active Owner" });
    expect(calls.enroll[0].closingDate).toBe("2026-12-10");
  });
});
