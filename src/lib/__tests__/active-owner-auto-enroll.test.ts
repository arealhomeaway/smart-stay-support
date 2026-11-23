// @ts-nocheck: in-memory fake database fixture; row shapes are checked by assertions.
/**
 * Active Owner enrollment is fully automatic on every path (Admin, Nov 23).
 * Every path runs the one automatic path; the role of the person saving does not matter.
 * Nothing here touches a real database or sends anything.
 */
import { describe, expect, it } from "bun:test";
import { autoEnrollHome, finishAfterEmailSaved, runActiveOwnerSafetyNet, sameInput } from "../active-owner-auto-enroll.server";
import { enrollForOwnerType } from "../owner-type-enrollment.server";
import { autoEnrollHistoryLine, enrollmentState, labelSync, safetyNetAction, setupItemLink, SETUP_ITEM_TITLE } from "../active-owner-auto-enroll";
import { ADMIN, DIRECTOR, HOME, OWNER, PM, baseTables, fakeDb, fakeDeps } from "./support/fake-auto-enroll-db";

const actorClient = { from: () => ({}) };
const openItems = (t) => t.active_owner_setup_items.filter((i) => i.status === "open");
const programsFor = (t) => t.owner_programs.filter((p) => p.owner_record_id === OWNER);

describe("every path enrolls fully, whatever the saver's role", () => {
  it("a Project Manager using Add property with Active Owner: enrolled on the server, recorded as the Project Manager", async () => {
    const t = baseTables({ ownerType: null });
    const { db } = fakeDb(t); const { deps, calls } = fakeDeps(t);
    const out = await autoEnrollHome(db, { propertyId: HOME, actorId: PM, source: "add_property", actorClient, overrides: { closingDate: "2026-12-15" } }, deps);
    expect(out.kind).toBe("enrolled");
    expect(calls.enroll).toHaveLength(1);
    expect(calls.enroll[0]).toMatchObject({ actorId: PM, ownClient: false, email: "pat@example.com", closingDate: "2026-12-15" });
    expect(programsFor(t)[0].status).toBe("active");
    expect(t.onboarding_project_events.at(-1).summary).toBe("Enrolled automatically: Owner Type set to Active Owner by Project Manager One");
    expect(t.audit_log.at(-1)).toMatchObject({ actor_id: PM, action: "active_owner.auto_enrolled", entity_id: HOME });
  });

  it("a Project Manager changing Owner Type to Active Owner enrolls the home (no longer stops for authority)", async () => {
    const t = baseTables({ ownerType: "Standard DFY" });
    const { db } = fakeDb(t); const { deps, calls } = fakeDeps(t);
    t.onboarding_projects[0].owner_type = "Active Owner"; // the save itself
    const out = await enrollForOwnerType(actorClient, PM, { projectId: "proj", before: "Standard DFY", after: "Active Owner" }, { db, auto: deps });
    expect(out).toEqual({ kind: "enrolled", email: "pat@example.com", welcomeHeld: false });
    expect(calls.enroll[0].actorId).toBe(PM);
    expect(t.onboarding_project_events.some((e) => e.summary === "Enrolled automatically: Owner Type set to Active Owner by Project Manager One")).toBe(true);
  });

  for (const [label, who] of [["Director of Onboarding", DIRECTOR], ["Admin", ADMIN]]) {
    it(`the ${label} changing Owner Type enrolls the same way, through their own signed-in access`, async () => {
      const t = baseTables({ ownerType: "Active Owner" });
      const { db } = fakeDb(t); const { deps, calls } = fakeDeps(t);
      const out = await enrollForOwnerType(actorClient, who, { projectId: "proj", before: null, after: "Active Owner" }, { db, auto: deps });
      expect(out.kind).toBe("enrolled");
      expect(calls.enroll[0]).toMatchObject({ actorId: who, ownClient: true });
    });
  }

  it("Start onboarding with the Active Owner module enrolls fully, not only a draft program", async () => {
    const t = baseTables({ ownerType: null, modules: ["utilities", "active_owner"] });
    const { db } = fakeDb(t); const { deps } = fakeDeps(t);
    const out = await autoEnrollHome(db, { propertyId: HOME, actorId: PM, source: "start_onboarding", actorClient }, deps);
    expect(out.kind).toBe("enrolled");
    expect(programsFor(t)[0].status).toBe("active");
    expect(t.onboarding_project_events.some((e) => e.summary === "Enrolled automatically: Active Owner turned on by Project Manager One")).toBe(true);
  });

  it("the Owner Type label and the module are kept in step both ways on save", async () => {
    const a = baseTables({ ownerType: "Active Owner", modules: ["utilities"] });
    const da = fakeDb(a).db; // the saver's own access writes the project
    await autoEnrollHome(da, { propertyId: HOME, actorId: PM, source: "owner_type", actorClient: da }, fakeDeps(a).deps);
    expect(a.onboarding_projects[0].modules).toEqual(["utilities", "active_owner"]);
    const b = baseTables({ ownerType: "Standard DFY", modules: ["active_owner"] });
    const dbb = fakeDb(b).db;
    await autoEnrollHome(dbb, { propertyId: HOME, actorId: PM, source: "module", actorClient: dbb }, fakeDeps(b).deps);
    expect(b.onboarding_projects[0].owner_type).toBe("Active Owner");
    // a label that cannot be saved never blocks the enrollment
    const c = baseTables({ ownerType: "Active Owner", modules: [] });
    const out = await autoEnrollHome(fakeDb(c).db, { propertyId: HOME, actorId: PM, source: "owner_type", actorClient: { from: () => { throw new Error("no access"); } } }, fakeDeps(c).deps);
    expect(out.kind).toBe("enrolled");
    expect(labelSync({ owner_type: "Active Owner", modules: ["active_owner"] })).toMatchObject({ addModule: false, setOwnerType: false });
  });
});

describe("the 5 minute check", () => {
  it("catches an import or nightly PID style write with no app code involved, once", async () => {
    const t = baseTables({ ownerType: "Active Owner", modules: [] }); // written straight to the table
    const { db } = fakeDb(t); const { deps, calls } = fakeDeps(t);
    const first = await runActiveOwnerSafetyNet(db, deps);
    expect(first.enrolled).toBe(1);
    expect(calls.enroll[0].actorId).toBe(DIRECTOR); // runs as the Director of Onboarding seat
    expect(t.audit_log.filter((a) => a.action === "active_owner.auto_enrolled")).toHaveLength(1);
    expect(t.audit_log[0]).toMatchObject({ actor_id: null, actor_label: "5 minute check", reason: "Enrolled automatically by the 5 minute check" });
    const second = await runActiveOwnerSafetyNet(db, deps);
    expect(second.enrolled).toBe(0);
    expect(calls.enroll).toHaveLength(1);
    expect(programsFor(t)).toHaveLength(1);
  });

  it("never touches a home that is already enrolled: no enrollment, no second program, no label change, no history", async () => {
    const t = baseTables({ ownerType: "Active Owner", modules: [] });
    const program = { id: "live", owner_record_id: OWNER, status: "active", archived_at: null, owner_user_id: "owner-login" };
    t.owner_programs.push(program);
    t.owner_program_properties.push({ property_id: HOME, inclusion_status: "included", owner_programs: program });
    const { db, writes } = fakeDb(t); const { deps, calls } = fakeDeps(t);
    const summary = await runActiveOwnerSafetyNet(db, deps);
    expect(summary).toMatchObject({ checked: 1, enrolled: 0, skipped: 1 });
    expect(calls.enroll).toHaveLength(0);
    expect(writes).toHaveLength(0);
    expect(t.onboarding_projects[0].modules).toEqual([]);
  });

  it("an already enrolled home saved again: no change and no second program", async () => {
    const t = baseTables({ ownerType: "Active Owner", modules: ["active_owner"] });
    const program = { id: "live", owner_record_id: OWNER, status: "active", archived_at: null, owner_user_id: "owner-login" };
    t.owner_programs.push(program);
    t.owner_program_properties.push({ property_id: HOME, inclusion_status: "included", owner_programs: program });
    const { db, writes } = fakeDb(t); const { deps, calls } = fakeDeps(t);
    const out = await autoEnrollHome(db, { propertyId: HOME, actorId: PM, source: "owner_type" }, deps);
    expect(out).toEqual({ kind: "already_enrolled" });
    expect(calls.enroll).toHaveLength(0);
    expect(writes).toHaveLength(0);
    expect(t.owner_programs).toHaveLength(1);
  });

  it("skips demo and test homes", async () => {
    const demo = baseTables({ isDemo: true });
    const r1 = await runActiveOwnerSafetyNet(fakeDb(demo).db, fakeDeps(demo).deps);
    expect(r1.enrolled).toBe(0);
    const test = baseTables({ name: "ZZ QA Practice Home" });
    const { deps, calls } = fakeDeps(test);
    const r2 = await runActiveOwnerSafetyNet(fakeDb(test).db, deps);
    expect(r2.enrolled).toBe(0);
    expect(calls.enroll).toHaveLength(0);
  });

  it("a closed or removed program is flagged once for review, never re-enrolled", async () => {
    const t = baseTables();
    const program = { id: "old", owner_record_id: OWNER, status: "closed", archived_at: null, owner_user_id: "owner-login" };
    t.owner_programs.push(program);
    t.owner_program_properties.push({ property_id: HOME, inclusion_status: "included", owner_programs: program });
    const { db } = fakeDb(t); const { deps, calls } = fakeDeps(t);
    await runActiveOwnerSafetyNet(db, deps);
    await runActiveOwnerSafetyNet(db, deps);
    expect(calls.enroll).toHaveLength(0);
    expect(openItems(t)).toHaveLength(1);
    expect(openItems(t)[0]).toMatchObject({ kind: "needs_attention", audience: "director_and_admin" });
  });
});

describe("missing details never block", () => {
  it("no homeowner email: enrolled and live with no login or welcome; the Project Manager is asked; saving the email finishes and clears it", async () => {
    const t = baseTables({ email: null });
    const { db } = fakeDb(t); const { deps, calls } = fakeDeps(t);
    const out = await autoEnrollHome(db, { propertyId: HOME, actorId: PM, source: "owner_type" }, deps);
    expect(out.kind).toBe("enrolled_no_email");
    expect(calls.enroll[0].email).toBe("");
    expect(programsFor(t)[0]).toMatchObject({ status: "active", owner_user_id: null });
    expect(openItems(t)).toHaveLength(1);
    expect(openItems(t)[0]).toMatchObject({ kind: "add_email", assigned_to: PM, title: "Add the homeowner's email to finish Active Owner setup.", link_path: `/property/${HOME}?tab=owner` });
    // the 5 minute check waits while there is still no email
    expect((await runActiveOwnerSafetyNet(db, deps)).finished).toBe(0);
    t.property_owners[0].email = "pat@example.com";
    const done = await finishAfterEmailSaved(db, OWNER, PM, null, deps);
    expect(done[0].kind).toBe("enrolled");
    expect(calls.enroll.at(-1).email).toBe("pat@example.com");
    expect(programsFor(t)).toHaveLength(1);
    expect(programsFor(t)[0].owner_user_id).toBe("owner-login");
    expect(openItems(t)).toHaveLength(0);
  });

  it("the 5 minute check also finishes a home once its email is saved anywhere", async () => {
    const t = baseTables({ email: null });
    const { db } = fakeDb(t); const { deps } = fakeDeps(t);
    await autoEnrollHome(db, { propertyId: HOME, actorId: PM, source: "owner_type" }, deps);
    t.property_owners[0].email = "pat@example.com";
    const r = await runActiveOwnerSafetyNet(db, deps);
    expect(r.finished).toBe(1);
    expect(openItems(t)).toHaveLength(0);
  });

  it("no owner record: one is created from the home's owner name and email, then enrollment continues", async () => {
    const t = baseTables();
    t.properties[0].owner_record_id = null;
    const { db } = fakeDb(t); const { deps } = fakeDeps(t);
    const out = await autoEnrollHome(db, { propertyId: HOME, actorId: PM, source: "add_property", overrides: { ownerName: "Sam Homeowner", ownerEmail: "sam@example.com" } }, deps);
    expect(out.kind).toBe("enrolled");
    expect(t.properties[0].owner_record_id).toBe("new-owner");
  });

  it("no closing date: the Project Manager is asked; once the date is saved the 5 minute check finishes it", async () => {
    const t = baseTables({ closing: null });
    const { db } = fakeDb(t); const { deps, calls } = fakeDeps(t);
    const out = await autoEnrollHome(db, { propertyId: HOME, actorId: PM, source: "owner_type" }, deps);
    expect(out.kind).toBe("waiting_closing");
    expect(openItems(t).map((i) => i.kind)).toEqual(["add_closing"]);
    expect(openItems(t)[0]).toMatchObject({ assigned_to: PM, title: "Add the closing date for this Active Owner home." });
    expect((await runActiveOwnerSafetyNet(db, deps)).enrolled).toBe(0); // still no date
    t.onboarding_projects[0].planned_closing_on = "2026-12-20";
    const r = await runActiveOwnerSafetyNet(db, deps);
    expect(r.enrolled).toBe(1);
    expect(calls.enroll.at(-1).closingDate).toBe("2026-12-20");
    expect(programsFor(t)).toHaveLength(1);
    expect(programsFor(t)[0].status).toBe("active");
    expect(openItems(t)).toHaveLength(0);
  });

  it("any other failure is never silent: the Director of Onboarding and Admin are told, and it retries at most hourly", async () => {
    const t = baseTables();
    const { db } = fakeDb(t); const { deps, calls } = fakeDeps(t, { failWith: "Resolve conflicting homeowner programs before enrolling." });
    const out = await autoEnrollHome(db, { propertyId: HOME, actorId: PM, source: "owner_type" }, deps);
    expect(out).toMatchObject({ kind: "needs_attention", detail: "Resolve conflicting homeowner programs before enrolling." });
    expect(openItems(t)[0]).toMatchObject({ kind: "needs_attention", audience: "director_and_admin", title: "Active Owner setup needs attention.", attempts: 1 });
    await runActiveOwnerSafetyNet(db, deps); // within the hour: no retry
    expect(calls.enroll).toHaveLength(1);
    openItems(t)[0].last_attempt_at = "2026-11-23T13:00:00Z";
    await runActiveOwnerSafetyNet(db, deps);
    expect(calls.enroll).toHaveLength(2);
    expect(calls.enroll[1].requestId).toBe(calls.enroll[0].requestId); // same details resume the same run
    expect(openItems(t)).toHaveLength(1);
  });
});

describe("pure rules", () => {
  it("wording and links", () => {
    expect(SETUP_ITEM_TITLE.add_email).toBe("Add the homeowner's email to finish Active Owner setup.");
    expect(SETUP_ITEM_TITLE.add_closing).toBe("Add the closing date for this Active Owner home.");
    expect(setupItemLink("add_closing", "h")).toBe("/onboarding/h?tab=details&section=dates");
    expect(autoEnrollHistoryLine("owner_type", "Project Manager One")).toBe("Enrolled automatically: Owner Type set to Active Owner by Project Manager One");
    expect(autoEnrollHistoryLine("five_minute_check", null)).toBe("Enrolled automatically by the 5 minute check");
  });
  it("a draft program is not enrolled; a live one with a login is complete", () => {
    const live = { status: "active", archived_at: null, owner_user_id: "x" };
    expect(enrollmentState([{ inclusion_status: "included", program: live }])).toBe("complete");
    expect(enrollmentState([{ inclusion_status: "included", program: { ...live, owner_user_id: null } }])).toBe("live_no_login");
    expect(enrollmentState([{ inclusion_status: "included", program: { ...live, status: "draft" } }])).toBe("not_enrolled");
    expect(enrollmentState([])).toBe("not_enrolled");
  });
  it("the check skips homes not labelled Active Owner", () => {
    expect(safetyNetAction({ propertyId: "h", name: "1 Main", isDemo: false, archived: false, ownerType: "Standard DFY", modules: [], state: "not_enrolled", hasEmail: true, hasClosing: true, openItems: [] })).toBe("skip");
  });
  it("saved attempts compare details regardless of key order", () => {
    expect(sameInput({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(sameInput({ a: 1, b: 3 }, { a: 1, b: 2 })).toBe(false);
  });
});
