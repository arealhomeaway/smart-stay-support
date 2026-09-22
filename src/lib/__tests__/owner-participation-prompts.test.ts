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
      expect(set.length >= 3).toBe(true);
      expect(set.length <= 4).toBe(true);
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
    expect(/\d/.test(text)).toBe(false);
    expect(/hour|hrs|minute/.test(text)).toBe(false);
    expect(/irs|tax deduction|write-off/.test(text)).toBe(false);
  });
});
