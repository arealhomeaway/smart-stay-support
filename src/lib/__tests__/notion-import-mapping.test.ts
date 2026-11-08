import { describe, expect, it } from "bun:test";
import {
  importGroup,
  importTeamGroup,
  isClaimReviewStatus,
  mapNotionPage,
  mapPriority,
  mapStatus,
  recentCutoff,
  resolveAssignee,
  type NotionPage,
  type StaffUser,
} from "@/lib/notion-import/mapping";
import { matchesMyWorkView } from "@/lib/my-work";
import { isImportHeld, withoutImportHeld } from "@/lib/import-hold";
import { claimStageLabel } from "@/lib/claims";

// Fictional people only.
const NOW = Date.parse("2026-11-08T18:00:00Z");
const CUTOFF = recentCutoff(NOW);
const staff: StaffUser[] = [
  { id: "pat", full_name: "Pat Example" },
  { id: "sam", full_name: "Sam Sample" },
  { id: "dana", full_name: "Dana Director" },
  { id: "twin1", full_name: "Alex Twin" },
  { id: "twin2", full_name: "Alex Twin" },
];
const directors = new Set(["dana"]);
const teams: Record<string, string> = { pat: "guest_experience", sam: "property_operations" };
const homeTeamOf = (id: string | null) => (id ? (teams[id] ?? null) : null);
const sel = (name: string | null) => ({ type: "select", select: name ? { name } : null });
const status = (name: string) => ({ type: "status", status: { name } });
const num = (n: number | null) => ({ type: "number", number: n });
const dt = (d: string | null) => ({ type: "date", date: d ? { start: d } : null });
const CLAIM_REVIEW = "Pending Claim Review with Pat";

function page(over: Record<string, unknown> = {}, meta: Partial<NotionPage> = {}): NotionPage {
  return {
    id: "page-1",
    url: "https://www.notion.so/page1",
    created_time: "2026-10-30T12:00:00Z",
    last_edited_time: "2026-11-01T12:00:00Z",
    properties: {
      "Issue Description": { type: "title", title: [{ plain_text: "Leaky faucet" }] },
      "Issue Status": status("In progress"),
      Priority: sel("Medium"),
      Assignee: sel("Pat Example"),
      "Property Address": { type: "relation", relation: [{ id: "pid-1" }] },
      "Created Date": dt("2026-10-30"),
      "Due Date": dt("2026-11-05"),
      "Will this be a claim?": sel("No"),
      ...over,
    },
    ...meta,
  } as NotionPage;
}
const ctx = {
  staff,
  directorIds: directors,
  homeTeamOf,
  cutoff: CUTOFF,
  pidOwnerRez: new Map<string, string | null>([["pid-1", "ORP123456"], ["pid-owens", "ORP410153"]]),
  propertyByOwnerRez: new Map([["123456", "home-1"], ["410153", "owens-home"]]),
};
const map = (over: Record<string, unknown> = {}, meta: Partial<NotionPage> = {}) => mapNotionPage(page(over, meta), ctx);

describe("the three groups", () => {
  it("closed is history at any age, with no assignee and not in the queue", () => {
    for (const s of ["Done", "Completed Same Day"]) {
      const out = map({ "Issue Status": status(s) });
      expect(out.group).toBe("closed");
      expect(out.ticket.status).toBe("closed");
      expect(out.ticket.assigned_to).toBeNull();
      expect(out.teamGroup).toBeNull();
    }
    expect(map({ "Issue Status": status("Done"), "Created Date": dt("2024-01-01") }).group).toBe("closed");
  });
  it("open and created in the past 30 days is recent; older is older open, held out of the queue", () => {
    expect(map().group).toBe("recent_open");
    expect(map().ticket.import_hold).toBeNull();
    const old = map({ "Created Date": dt("2026-09-01") });
    expect(old.group).toBe("older_open");
    expect(old.ticket.assigned_to).toBeNull();
    expect(old.ticket.import_hold).toBe("backlog_review");
    expect(old.teamGroup).toBeNull();
  });
  it("claim review is open", () => {
    expect(map({ "Issue Status": status(CLAIM_REVIEW) }).group).toBe("recent_open");
  });
});

describe("age is the Notion created date", () => {
  it("never the last edit or the page time", () => {
    const out = map({ "Created Date": dt("2026-08-01") }, { created_time: "2026-11-07T00:00:00Z", last_edited_time: "2026-11-08T00:00:00Z" });
    expect(out.group).toBe("older_open");
    expect(out.ticket.reported_at).toBe("2026-08-01");
  });
  it("a blank created date is older, never recent", () => {
    expect(importGroup(page({ "Created Date": dt(null) }), CUTOFF)).toBe("older_open");
    const out = map({ "Created Date": dt(null) }, { created_time: "2026-11-07T00:00:00Z" });
    expect(out.group).toBe("older_open");
    expect(out.blankCreatedDate).toBe(true);
    expect(out.ticket.assigned_to).toBeNull();
    // Held as Backlog review so the display can never call it recent, even with a recent page time.
    expect(out.ticket.import_hold).toBe("backlog_review");
    expect(out.ticket.description).toContain("Created date in Notion: blank");
  });
});

describe("assignee: exact match only, never a new login", () => {
  it("assigns on an exact name match with one active login, in group (b) only", () => {
    expect(resolveAssignee("Pat Example", staff, directors)).toEqual({ userId: "pat", reason: "matched", missingLogin: null });
    expect(resolveAssignee("  pat   example ", staff, directors).userId).toBe("pat");
    expect(map().ticket.assigned_to).toBe("pat");
  });
  it("a partial name, an unknown name or two people with the same name stay unassigned", () => {
    expect(resolveAssignee("Pat", staff, directors)).toEqual({ userId: null, reason: "no_login", missingLogin: "Pat" });
    expect(resolveAssignee("Jo Nobody", staff, directors).userId).toBeNull();
    expect(resolveAssignee("Alex Twin", staff, directors)).toEqual({ userId: null, reason: "not_unique", missingLogin: null });
  });
  it("the Director of Operations, General and blank stay unassigned", () => {
    expect(resolveAssignee("Dana Director", staff, directors).reason).toBe("director");
    expect(map({ Assignee: sel("Dana Director") }).ticket.assigned_to).toBeNull();
    expect(resolveAssignee("General", staff, directors).reason).toBe("general");
    expect(resolveAssignee(null, staff, directors).reason).toBe("blank");
  });
  it("the Notion assignee is always kept as text, also on closed and older tickets", () => {
    for (const out of [map({ "Issue Status": status("Done") }), map({ "Created Date": dt("2026-01-01") })]) {
      expect(out.ticket.assigned_to).toBeNull();
      expect(out.ticket.description).toContain("Assigned in Notion to: Pat Example");
      expect(out.assigneeReason).toBe("not_recent");
    }
  });
});

describe("Team Queue group", () => {
  it("the team of the assigned person; no person is Unassigned", () => {
    expect(map().teamGroup).toBe("team_a");
    expect(map({ Assignee: sel("Sam Sample") }).teamGroup).toBe("team_b");
    expect(map({ Assignee: sel("General") }).teamGroup).toBe("unassigned");
  });
  it("an open claim created in the past 30 days goes to Team B", () => {
    expect(map({ "Will this be a claim?": sel("Yes") }).teamGroup).toBe("team_b");
    expect(map({ "Issue Status": status(CLAIM_REVIEW), Assignee: sel(null) }).teamGroup).toBe("team_b");
    expect(importTeamGroup({ assigned_to: "pat", needs_home: false, has_claim: true }, homeTeamOf)).toBe("team_b");
  });
  it("no home is Needs a home, under Unassigned, with no person", () => {
    const out = map({ "Property Address": { type: "relation", relation: [] } });
    expect(out.ticket.import_hold).toBe("needs_home");
    expect(out.ticket.assigned_to).toBeNull();
    expect(out.teamGroup).toBe("unassigned");
    expect(out.ticket.description).toContain("Needs a home");
  });
});

describe("priority and category", () => {
  it("Urgent is P1, High is P2, Medium, Low and blank are P3", () => {
    expect(mapPriority("Urgent")).toBe("p1");
    expect(mapPriority("High")).toBe("p2");
    expect(mapPriority("Medium")).toBe("p3");
    expect(mapPriority("Low")).toBe("p3");
    expect(mapPriority(null)).toBe("p3");
    expect(map({ Priority: sel("Urgent") }).ticket.priority).toBe("p1");
  });
});

describe("claims", () => {
  it("a claim when Will this be a claim? is Yes or the status is claim review, closed ones too", () => {
    expect(map().ticket.claim).toBeNull();
    expect(map({ "Will this be a claim?": sel("Yes") }).ticket.claim).not.toBeNull();
    expect(map({ "Issue Status": status(CLAIM_REVIEW) }).ticket.claim).not.toBeNull();
    expect(map({ "Will this be a claim?": sel("Yes"), "Issue Status": status("Done") }).ticket.claim).not.toBeNull();
  });
  it("carries the amounts; a filed claim starts at Gathering evidence", () => {
    const c = map({
      "Will this be a claim?": sel("Yes"),
      "Claim Filed?": sel("Yes"),
      "Total Damages $ (not including management fee)": num(420),
      "Reimbursed Amount $ ": num(100),
    }).ticket.claim!;
    expect(c.estimated_amount).toBe(420);
    expect(c.recovered_amount).toBe(100);
    expect(c.stage).toBe("gathering");
  });
  it("the claim review status shows as Claim review over the existing stage", () => {
    expect(isClaimReviewStatus(CLAIM_REVIEW)).toBe(true);
    expect(mapStatus(CLAIM_REVIEW)).toEqual({ status: "in_progress", waitingOnClaimReview: true });
    const out = map({ "Issue Status": status(CLAIM_REVIEW) });
    const c = out.ticket.claim!;
    expect(c.stage).toBe("potential");
    expect(claimStageLabel({ stage: c.stage, incident_description: c.notes })).toBe("Claim review");
    expect(claimStageLabel({ stage: "costing", incident_description: c.notes })).toBe("Determining cost");
    expect(claimStageLabel({ stage: "potential", incident_description: null })).toBe("Potential claim");
    // The status with a person's name is never written into the text.
    expect(out.ticket.description).not.toContain(CLAIM_REVIEW);
    expect(c.notes).not.toContain(CLAIM_REVIEW);
  });
});

describe("homes", () => {
  it("matches by the Property ID with the ORP prefix dropped", () => {
    expect(map().ticket.property_id).toBe("home-1");
  });
  it("21036 Owens Rd stays unlinked even if a home with that ID exists", () => {
    const out = map({ "Property Address": { type: "relation", relation: [{ id: "pid-owens" }] } });
    expect(out.ticket.property_id).toBeNull();
    expect(out.ticket.import_hold).toBe("needs_home");
    expect(out.ticket.description).toContain("Former property: 21036 Owens Rd");
  });
});

describe("held imports stay out of queues", () => {
  const held = { id: "t1", status: "in_progress", priority: "p3", assigned_to: "pat", import_hold: "backlog_review" };
  it("is absent from My Work even when assigned to me", () => {
    expect(matchesMyWorkView(held as never, "active", "pat")).toBe(false);
  });
  it("is filtered from Team Queue lists", () => {
    expect(withoutImportHeld([held, { ...held, id: "t2", import_hold: "needs_home" }, { ...held, id: "t3", import_hold: null }]).map((t) => t.id)).toEqual(["t3"]);
    expect(isImportHeld({})).toBe(false);
  });
});
