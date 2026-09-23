import { describe, expect, it } from "bun:test";
import {
  buildParticipationPrompts,
  PARTICIPATION_PROMPT_NOTE,
} from "../owner-participation-prompts";

describe("optional participation opportunities", () => {
  it("offers several stage-aware suggestions", () => {
    const onboarding = buildParticipationPrompts({ phase: "onboarding" });
    const ongoing = buildParticipationPrompts({ phase: "ongoing" });
    for (const set of [onboarding, ongoing]) {
      expect(set.length >= 4).toBe(true);
      expect(set.length <= 8).toBe(true);
    }
    expect(onboarding.map((p) => p.id)).not.toEqual(ongoing.map((p) => p.id));
  });

  it("never mixes in work the team assigned", () => {
    for (const phase of ["onboarding", "ongoing"]) {
      const ids = buildParticipationPrompts({ phase }).map((p) => p.id);
      expect(ids).not.toContain("pending-actions");
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("never suggests an amount of time or promises a tax outcome", () => {
    const text = [
      PARTICIPATION_PROMPT_NOTE,
      ...buildParticipationPrompts({ phase: "onboarding" }).flatMap((p) => [
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
    expect(/\birs\b|tax deduction|write-off|deductib/.test(text)).toBe(false);
  });
});
