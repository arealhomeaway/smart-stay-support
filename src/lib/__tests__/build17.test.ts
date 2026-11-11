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

describe("Build 17 finding 5: Send to Active Owner shows for every home in a live program", () => {
  it("shows for any live program status, hides only for closed or archived, or no program", async () => {
    const { canSendToActiveOwner } = await import("@/lib/ao-engine");
    for (const s of ["active", "complete", "goal_reached", "paused"]) expect(canSendToActiveOwner(s)).toBe(true);
    for (const s of ["closed", "archived", null, undefined]) expect(canSendToActiveOwner(s)).toBe(false);
  });
  it("a program's second home counts: the lookup reads the program's homes too", () => {
    const src = read("src/lib/ao-data.ts");
    const fn = src.slice(src.indexOf("export async function loadHomeProgramStatus"), src.indexOf("export async function loadHomeProgramStatus") + 900);
    expect(fn).toContain("owner_program_properties");
  });
});

describe("Build 17 finding 6: the Enroll result stays on screen until staff close it", () => {
  const src = read("src/components/property/ActiveOwnerEnrollForm.tsx");
  const panel = read("src/components/property/ActiveOwnerPanel.tsx");
  it("saving does not refresh the page underneath; that waits for Done", () => {
    const start = src.indexOf("const run = useMutation");
    const onSuccess = src.slice(start, src.indexOf("onError", start));
    expect(onSuccess).not.toContain("invalidateQueries");
    expect(onSuccess).not.toContain("onDone()");
  });
  it("every step shows, each failed step has its own Retry, a plain success line and the counts", () => {
    expect(src).toContain("Retry this step");
    expect(src).toContain(ENROLL_SUCCESS);
    expect(src).toContain("receipt.onboardingAdded} onboarding and");
  });
  it("the panel keeps the window mounted while it is open", () => {
    expect(panel).toContain("canEnroll || enrollOpen");
  });
});
const ENROLL_SUCCESS = "The homeowner is enrolled in Active Owner.";
