import { describe, expect, it as test } from "bun:test";
import { can } from "../permissions";

// Approved boundary (Emily Jimenez, 8 Oct 2026): Active Owner enrollment,
// welcome Retry and Reconcile = Onboarding Director seat or Platform Owner.
describe("Active Owner authority", () => {
  test("Platform Owner may enroll", () => {
    expect(can(["admin"], "active_owner_enroll")).toBe(true);
  });
  test("Onboarding Director seat may enroll", () => {
    expect(can(["onboarding"], "active_owner_enroll", { onboardingDirector: true })).toBe(true);
  });
  test("Supervisor role alone may not enroll", () => {
    expect(can(["manager"], "active_owner_enroll")).toBe(false);
  });
  test("Director of Operations seat alone may not enroll", () => {
    expect(can(["manager"], "active_owner_enroll", { opsDirector: true })).toBe(false);
  });
  test("Onboarding PM without the Director seat may not enroll", () => {
    expect(can(["onboarding"], "active_owner_enroll")).toBe(false);
  });
  test("Homeowner and staff may not enroll", () => {
    expect(can(["owner"], "active_owner_enroll")).toBe(false);
    expect(can(["tech"], "active_owner_enroll")).toBe(false);
  });
  test("Supervisors keep their other Active Owner program access", () => {
    expect(can(["manager"], "owner_programs")).toBe(true);
  });
});
