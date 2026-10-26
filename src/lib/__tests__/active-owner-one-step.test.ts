import { describe, expect, it } from "bun:test";
import { assertOwnerAccountRoles, enrollmentInput, runEnrollment, type EnrollmentStep } from "../active-owner-enrollment";
import { countsTowardParticipation, participationYearTotals } from "../owner-participation";
import { ownerHoursEligibility } from "../owner-hours-eligibility";
import { can } from "../permissions";

function fixture() {
  let account = false; let program = false; let failure: EnrollmentStep | null = null;
  const durable = new Map<string, { programId: string; added?: number; held?: boolean }>();
  const counts = { accounts: 0, programs: 0, welcomes: 0 };
  return { counts, fail: (step: EnrollmentStep | null) => { failure = step; }, ops: {
    prepare: async () => {},
    account: async () => { if (!account) { account = true; counts.accounts++; } return { id: "owner", created: counts.accounts === 1 }; },
    step: async (step: Exclude<EnrollmentStep, "account">) => {
      const saved = durable.get(step); if (saved) return saved;
      if (failure === step) throw new Error("Temporary failure");
      if (step === "enrollment" && !program) { program = true; counts.programs++; }
      if (step === "welcome") counts.welcomes++;
      const r = { programId: "program", added: step === "onboarding" ? 22 : step === "operating" ? 10 : 0, held: true };
      durable.set(step, r); return r;
    },
  } };
}
describe("one-step Active Owner", () => {
  it("new owner completes the sequential workflow with one account, program and held welcome", async () => {
    const f = fixture(); const r = await runEnrollment(f.ops);
    expect(r.complete).toBe(true); expect(r.onboardingAdded).toBe(22); expect(r.operatingAdded).toBe(10);
    expect(r.welcomeHeld).toBe(true); expect(f.counts).toEqual({ accounts: 1, programs: 1, welcomes: 1 });
  });
  it("partway failure exposes login and retained program; Retry creates no duplicate", async () => {
    const f = fixture(); f.fail("closing"); const r = await runEnrollment(f.ops);
    expect(r.accountId).toBe("owner"); expect(r.programId).toBe("program");
    expect(r.steps.find((s) => s.key === "closing")?.status).toBe("failed");
    expect(r.steps.find((s) => s.key === "activation")?.status).toBe("not_reached");
    f.fail(null); expect((await runEnrollment(f.ops)).complete).toBe(true);
    expect(f.counts).toEqual({ accounts: 1, programs: 1, welcomes: 1 });
  });
  it("failure immediately after account creation cannot hide an unlinked login", async () => {
    const f = fixture(); f.fail("enrollment"); const r = await runEnrollment(f.ops);
    expect(r.accountId).toBe("owner"); expect(r.programId).toBeNull(); expect(r.complete).toBe(false);
  });
  it("staff email is refused, owner email accepted", () => {
    expect(() => assertOwnerAccountRoles(["owner", "admin"])).toThrow("staff account");
    expect(() => assertOwnerAccountRoles(["owner"])).not.toThrow();
  });
  it("same-year second home shares one activity total without duplicating it", () => {
    expect(participationYearTotals([{ entry_date: "2026-02-01", minutes: 60 }], ["2026-10-06", "2026-11-10"], "2026-10-26")).toEqual([{ year: "2026", minutes: 60 }]);
  });
  it("different-year second home keeps totals separate", () => {
    expect(participationYearTotals([{ entry_date: "2026-02-01", minutes: 60 }, { entry_date: "2027-01-02", minutes: 30 }], ["2026-10-06", "2027-11-10"], "2027-12-31")).toEqual([{ year: "2026", minutes: 60 }, { year: "2027", minutes: 30 }]);
  });
  it("pre-closing entries count toward the expected closing year", () => {
    expect(countsTowardParticipation("2026-02-01", { closingDates: ["2026-11-10"], startedOn: null }, "2026-10-26")).toBe(true);
    expect(ownerHoursEligibility({ status: "active" }, [{ inclusionStatus: "included", closingDate: "2026-11-10", closingConfirmed: false }]).eligible).toBe(true);
  });
  it("missing dates allow saving without inventing a counting year", () => {
    expect(ownerHoursEligibility({ status: "draft" }, [{ inclusionStatus: "included", closingDate: null }]).eligible).toBe(true);
    expect(countsTowardParticipation("2026-02-01", { closingDates: [], startedOn: null }, "2026-10-26")).toBe(false);
  });
  it("paused and closed programs stay locked", () => {
    for (const status of ["paused", "closed", "completed"]) expect(ownerHoursEligibility({ status }, []).eligible).toBe(false);
  });
  it("only Admin and Onboarding Director retain enrollment permission", () => {
    expect(can(["admin"], "active_owner_enroll")).toBe(true);
    expect(can(["onboarding"], "active_owner_enroll", { onboardingDirector: true })).toBe(true);
    expect(can(["manager"], "active_owner_enroll")).toBe(false);
  });
  it("rejects impossible dates before any account creation", () => {
    expect(enrollmentInput.safeParse({ requestId: crypto.randomUUID(), propertyId: crypto.randomUUID(), ownerRecordId: crypto.randomUUID(), name: "Owner", email: "owner@resolve-test.invalid", closingDate: "2026-02-30" }).success).toBe(false);
  });
});