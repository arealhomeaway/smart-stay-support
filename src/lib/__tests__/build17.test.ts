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

describe("Build 17 finding 4: a second home from the Availability Finder joins the lead just made", () => {
  const src = read("src/routes/_authenticated/availability-finder.tsx");
  it("the offer uses the lead from the page, else the lead the first offer made", () => {
    const save = src.slice(src.indexOf("async function saveOffer"), src.indexOf("async function saveOffer") + 900);
    expect(save).toContain("const leadId = search.leadId ?? offeredLeadId");
    expect(save).toContain("...(leadId ? { leadId } : {})");
  });
});
