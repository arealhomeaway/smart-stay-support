import { describe, expect, it } from "bun:test";
import { GUIDED_TOURS, autostartTeam, resolveStepHref, sectionsFor, stepsFor, tourSeenKey, toursFor } from "@/lib/guided-tours";

const coordinator = { roles: ["tech" as const], seats: {} };
const supervisor = { roles: ["manager" as const], seats: { opsSupervisor: true } };
const directorOps = { roles: ["manager" as const], seats: { opsDirector: true } };
const onboarding = { roles: ["onboarding" as const], seats: {} };
const directorOnb = { roles: ["manager" as const], seats: { onboardingDirector: true } };
const admin = { roles: ["admin" as const], seats: {} };

describe("who sees which tour", () => {
  it("Operations tour: coordinators, Operations Supervisor, Director of Operations", () => {
    expect(toursFor(coordinator)).toEqual(["operations"]);
    expect(toursFor(supervisor)).toEqual(["operations"]);
    expect(toursFor(directorOps)).toEqual(["operations"]);
  });
  it("Onboarding tour: the onboarding role and the Director of Onboarding", () => {
    expect(toursFor(onboarding)).toEqual(["onboarding"]);
    expect(toursFor(directorOnb)).toEqual(["onboarding"]);
  });
  it("Admin can start either one, and nothing starts by itself for Admin", () => {
    expect(toursFor(admin)).toEqual(["operations", "onboarding"]);
    expect(autostartTeam(admin)).toBeNull();
  });
  it("vendors and homeowners get no tour", () => {
    expect(toursFor({ roles: ["vendor"], seats: {} })).toEqual([]);
    expect(toursFor({ roles: ["owner"], seats: {} })).toEqual([]);
  });
  it("each person's own team tour starts once, remembered per person", () => {
    expect(autostartTeam(coordinator)).toBe("operations");
    expect(autostartTeam(onboarding)).toBe("onboarding");
    expect(tourSeenKey("operations", "u1")).not.toBe(tourSeenKey("operations", "u2"));
  });
  it("Oversight and Shift handoffs only for the Supervisor, the Director of Operations and Admin", () => {
    const has = (v: Parameters<typeof sectionsFor>[1]) => sectionsFor("operations", v).some((s) => s.id === "ops-oversight");
    expect(has(coordinator)).toBe(false);
    expect(has(supervisor)).toBe(true);
    expect(has(directorOps)).toBe(true);
    expect(has(admin)).toBe(true);
  });
});

describe("tour shape and wording", () => {
  const all = Object.values(GUIDED_TOURS).flatMap((t) => t.sections);
  it("every section has 4 to 8 steps", () => {
    for (const s of all) {
      expect(s.steps.length).toBeGreaterThan(3);
      expect(s.steps.length).toBeLessThanOrEqual(8);
    }
  });
  it("every card is 1 to 3 sentences, with no long dashes or banned words", () => {
    for (const st of all.flatMap((s) => s.steps)) {
      const sentences = st.body.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length).toBeGreaterThan(0);
      expect(sentences.length).toBeLessThanOrEqual(3);
      expect(`${st.title} ${st.body}`).not.toMatch(/[\u2014\u2013]|\bseats?\b|Median|\bHit\b/i);
    }
  });
  it("step ids are unique so one section can be replayed", () => {
    const ids = all.flatMap((s) => s.steps.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(stepsFor("onboarding", "onb-catch-up", onboarding).every((s) => s.sectionId === "onb-catch-up")).toBe(true);
  });
});

describe("pages", () => {
  it("a step opens a real record, or its list page when none can be seen", () => {
    expect(resolveStepHref({ to: "/tickets/$ticket", fallbackTo: "/team-queue" }, { ticket: "t1", home: null, task: null })).toBe("/tickets/t1");
    expect(resolveStepHref({ to: "/tickets/$ticket", fallbackTo: "/team-queue" }, { ticket: null, home: null, task: null })).toBe("/team-queue");
    expect(resolveStepHref({ to: "/onboarding/$home?tab=tasks&task=$task", fallbackTo: "/onboarding" }, { ticket: null, home: "h1", task: null })).toBe("/onboarding/h1?tab=tasks");
  });
});

describe("Help page", () => {
  it("the onboarding role and the Director of Onboarding can open Help to replay their tour", async () => {
    const { canOpenPath } = await import("@/lib/route-access");
    expect(canOpenPath("/welcome", { roles: ["onboarding"], seats: {} })).toBe(true);
    expect(canOpenPath("/welcome", { roles: ["manager"], seats: { onboardingDirector: true } })).toBe(true);
    expect(canOpenPath("/welcome", { roles: ["tech"], seats: {} })).toBe(true);
  });
});
