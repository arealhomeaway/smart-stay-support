import { describe, expect, it } from "bun:test";
import {
  buildParticipationPrompts,
  PARTICIPATION_PROMPT_NOTE,
} from "../owner-participation-prompts";

describe("ways to participate prompts", () => {
  it("offers three to four stage-aware suggestions", () => {
    const onboarding = buildParticipationPrompts({ phase: "onboarding" });
    const ongoing = buildParticipationPrompts({ phase: "ongoing" });
    for (const set of [onboarding, ongoing]) {
      expect(set.length).toBeGreaterThanOrEqual(3);
      expect(set.length).toBeLessThanOrEqual(4);
    }
    expect(onboarding.map((p) => p.id)).not.toEqual(ongoing.map((p) => p.id));
  });

  it("puts a waiting decision first when one is pending", () => {
    const prompts = buildParticipationPrompts({
      phase: "onboarding",
      pendingOnboardingActions: 1,
    });
    expect(prompts[0]?.id).toBe("pending-decision");
  });

  it("never suggests an amount of time or promises a tax outcome", () => {
    const text = [
      PARTICIPATION_PROMPT_NOTE,
      ...buildParticipationPrompts({ phase: "onboarding", openReviews: 2 }).flatMap((p) => [
        p.title,
        p.description,
        p.relevance,
      ]),
      ...buildParticipationPrompts({ phase: "ongoing" }).flatMap((p) => [
        p.title,
        p.description,
        p.relevance,
      ]),
    ]
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/hour|hrs|minute/);
    expect(text).not.toMatch(/irs|tax deduction|write-off/);
  });
});
