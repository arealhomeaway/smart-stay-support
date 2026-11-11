import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(p, "utf8");

describe("Build 17 finding 2: the homeowner sees the conversation from the first staff message", () => {
  const src = read("src/components/owner/OwnerOpportunities.tsx");
  it("the conversation shows on every Opportunity, not only ARHA led ones", () => {
    const at = src.indexOf("<OwnerConversation");
    expect(at).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, at - 80), at);
    expect(before).not.toContain("arha ?");
  });
});
