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

describe("Build 17 finding 7: an owner notification opens the exact item", () => {
  it("a link naming an Opportunity opens the Opportunities view with that item open", () => {
    const src = read("src/routes/_authenticated/owner.tsx");
    expect(src).toContain('const view = search.view ?? (search.opportunity ? "opportunities" : "home");');
  });
});

describe("Build 17 finding 8: an undated OwnerRez review is historical, never today", () => {
  it("the import and the preview agree: no publish date is historical and starts nothing", async () => {
    const gf = await import("@/lib/guest-feedback");
    expect(gf.reviewImportDecision(1, null, "2026-11-01")).toBe("historical");
    const fields = (gf as unknown as { reviewDateFields: (d: string | null, stayEnd: string | null, now: Date) => { submitted_at: string; published_date_known: boolean } }).reviewDateFields;
    expect(typeof fields).toBe("function");
    const now = new Date("2026-11-11T15:00:00Z");
    const undated = fields(null, "2025-06-02", now);
    expect(undated.published_date_known).toBe(false);
    expect(undated.submitted_at.slice(0, 10)).not.toBe("2026-11-11");
    expect(fields("2026-11-10T12:00:00Z", null, now)).toEqual({ submitted_at: "2026-11-10T12:00:00Z", published_date_known: true });
  });
  it("an undated review never shows as a new review to check", async () => {
    const { reviewNeedsCheck } = await import("@/lib/record-routine");
    const r = { id: "x", feedback_type: "external_review", rating: 2, submitted_at: new Date().toISOString(), published_date_known: false };
    expect(reviewNeedsCheck(r as never, new Set())).toBe(false);
  });
  it("the real import uses the shared date rule, not today", () => {
    const src = read("src/lib/guest-feedback.server.ts");
    expect(src).not.toContain("submitted_at: r.date ?? new Date().toISOString()");
    expect(src).toContain("...reviewDateFields(r.date, r.stay_end ?? null, new Date())");
  });
});

describe("Build 17 finding 9: Project Team screen and database apply one rule", () => {
  const fn = read("src/lib/onboarding-team.functions.ts");
  const panel = read("src/components/onboarding/ProjectTeamPanel.tsx");
  it("the screen asks the database's own rule, not a separate one", () => {
    expect(fn).toContain('rpc("can_manage_project_team"');
  });
  it("saved shows only when the person actually changed; no change says so", () => {
    expect(panel).toContain("r.changed");
    expect(panel).toContain(TEAM_NO_CHANGE);
  });
  it("a refusal is a plain message, never a database error", async () => {
    const { projectTeamRefusal } = await import("@/lib/onboarding-team-rules");
    expect(projectTeamRefusal('permission denied for table onboarding_projects')).toBe(
      "You cannot change this home's Project Team. Ask the Director of Onboarding.",
    );
    expect(projectTeamRefusal("Only the Onboarding Director or leadership can change the Onboarding team.")).toBe(
      "Only the Onboarding Director or leadership can change the Onboarding team.",
    );
  });
  it("a new Project Manager takes the home's unfinished Project Manager work", () => {
    expect(fn).toContain('data.roleCode === "onboarding_project_manager" ? true : data.reassignPending');
  });
});
const TEAM_NO_CHANGE = "No change: that person already holds this role.";
