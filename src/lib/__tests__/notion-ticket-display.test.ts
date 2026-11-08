import { describe, expect, it } from "bun:test";
import {
  claimStepsAvailable,
  cleanNotionText,
  isQuietNotion,
  notionAction,
  notionBadge,
  notionQueueGroups,
  notionStatusLabel,
  notionTicketState,
  parseNotionBlock,
  reopenClocks,
  reopenReasonProblem,
  showsAssignee,
  withoutQuietNotion,
} from "@/lib/notion-ticket-display";
import { NOTION_CLAIM_REVIEW_STATUS } from "@/lib/notion-import/mapping";
import { slaState } from "@/lib/tickets";

const NOW = Date.parse("2026-11-09T15:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const notion = (over: Record<string, unknown> = {}) => ({
  id: "t1",
  external_source: "notion",
  external_status: "In progress",
  status: "open",
  priority: "p2",
  reported_at: daysAgo(5),
  ...over,
});

describe("the 30 day rule", () => {
  it("an open import created 29 days ago is recent, 31 days ago is older", () => {
    expect(notionTicketState(notion({ reported_at: daysAgo(29) }), NOW)).toBe("recent_open");
    expect(notionTicketState(notion({ reported_at: daysAgo(31) }), NOW)).toBe("older_open");
  });

  it("age is the Notion created date, never the import or last edit time", () => {
    const t = notion({ reported_at: daysAgo(40), created_at: daysAgo(0), updated_at: daysAgo(0) });
    expect(notionTicketState(t, NOW)).toBe("older_open");
  });

  it("a closed import is historical whatever its age", () => {
    expect(notionTicketState(notion({ status: "closed", reported_at: daysAgo(2) }), NOW)).toBe("historical");
    expect(notionTicketState(notion({ status: "resolved", reported_at: daysAgo(400) }), NOW)).toBe("historical");
  });

  it("Resolve tickets are untouched", () => {
    expect(notionTicketState({ status: "open", external_source: null }, NOW)).toBe("none");
    expect(isQuietNotion({ status: "open", external_source: "breezeway" }, NOW)).toBe(false);
  });
});

describe("badges", () => {
  it("closed import: Historical record from Notion, with no assignee", () => {
    const t = notion({ status: "closed" });
    expect(notionBadge(t, NOW)).toBe("Historical record from Notion");
    expect(showsAssignee(t, NOW)).toBe(false);
  });

  it("open import older than 30 days: Older open ticket from Notion", () => {
    expect(notionBadge(notion({ reported_at: daysAgo(45) }), NOW)).toBe("Older open ticket from Notion");
  });

  it("a ticket reopened in Resolve is live work again and shows its assignee", () => {
    const t = notion({ external_status: "reopened_in_resolve", reported_at: daysAgo(200) });
    expect(isQuietNotion(t, NOW)).toBe(false);
    expect(showsAssignee(t, NOW)).toBe(true);
    expect(withoutQuietNotion([t, notion({ status: "closed" })], NOW)).toEqual([t]);
  });
});

describe("Reopen", () => {
  it("historical and older open tickets offer Reopen with the history line", () => {
    for (const t of [notion({ status: "closed" }), notion({ reported_at: daysAgo(60) })]) {
      const a = notionAction(t, true, NOW);
      expect(a?.label).toBe("Reopen");
      expect(a?.historyLine).toBe("Reopened from Notion history");
    }
  });

  it("only staff who can work tickets see it", () => {
    expect(notionAction(notion({ status: "closed" }), false, NOW)).toBeNull();
  });

  it("a short reason is required", () => {
    expect(reopenReasonProblem("")).toBe("Add a short reason.");
    expect(reopenReasonProblem("  ok ")).toBe("Add a short reason.");
    expect(reopenReasonProblem("Guest called back")).toBeNull();
    expect(reopenReasonProblem("x".repeat(501))).not.toBeNull();
  });

  it("clocks start fresh from the moment of reopening", () => {
    const at = new Date("2026-11-09T15:00:00Z");
    const c = reopenClocks("p1", at);
    expect(c.reopened_at).toBe("2026-11-09T15:00:00.000Z");
    expect(c.response_due_at).toBe("2026-11-09T15:03:00.000Z");
    expect(c.action_due_at).toBe("2026-11-09T15:05:00.000Z");
    const p2 = reopenClocks("p2", at);
    expect(p2.response_due_at).toBe("2026-11-09T15:30:00.000Z");
    expect(p2.action_due_at).toBe("2026-11-09T16:00:00.000Z");
  });

  it("a reopened P1 escalates from the reopening, not the old Notion date", () => {
    const fresh = slaState({
      status: "open",
      priority: "p1",
      external_source: "notion",
      external_status: "reopened_in_resolve",
      reported_at: "2025-01-01T00:00:00Z",
      last_reopened_at: new Date().toISOString(),
      response_due_at: new Date(Date.now() + 180_000).toISOString(),
      action_due_at: new Date(Date.now() + 300_000).toISOString(),
    } as never);
    expect(fresh.escalation).toBeNull();
  });
});

describe("claim steps", () => {
  it("a ticket with a claim keeps its claim steps whatever its age, status or label", () => {
    for (const t of [notion({ status: "closed", reported_at: daysAgo(500) }), notion({ reported_at: daysAgo(90) }), notion()]) {
      expect(claimStepsAvailable(true, t)).toBe(true);
    }
    expect(claimStepsAvailable(false, notion())).toBe(false);
  });
});

describe("Notion wording on screens", () => {
  it("the Notion claim review status is always shown as Claim review", () => {
    expect(notionStatusLabel(NOTION_CLAIM_REVIEW_STATUS)).toBe("Claim review");
    expect(notionStatusLabel(NOTION_CLAIM_REVIEW_STATUS.toLowerCase())).toBe("Claim review");
    expect(cleanNotionText(`Moved to ${NOTION_CLAIM_REVIEW_STATUS} today`)).toBe("Moved to Claim review today");
  });

  it("the import block shows the Notion assignee as text, never as the assignee", () => {
    const b = parseNotionBlock(
      `Broken blinds\n\nImported from Notion\nNotion status: ${NOTION_CLAIM_REVIEW_STATUS}\nAssigned in Notion to: Pat Example`,
    );
    expect(b.body).toBe("Broken blinds");
    expect(b.assigneeName).toBe("Pat Example");
    expect(b.lines).toEqual(["Notion status: Claim review"]);
    expect(b.lines.join(" ")).not.toContain(NOTION_CLAIM_REVIEW_STATUS);
  });
});

describe("Imported from Notion group in the Team Queue", () => {
  const staff = [
    { id: "a", full_name: "Pat Example" },
    { id: "b", full_name: "Sam Sample" },
  ];
  const teams: Record<string, string> = { a: "guest_experience", b: "property_operations" };
  const homeTeamOf = (id: string | null) => (id ? (teams[id] ?? null) : null);
  const block = (name: string) => `Leak\n\nImported from Notion\nAssigned in Notion to: ${name}`;

  it("only open imports from the past 30 days, split Team A, Team B and Unassigned", () => {
    const rows = [
      notion({ id: "1", description: block("Pat Example") }),
      notion({ id: "2", description: block("Sam Sample") }),
      notion({ id: "3", description: block("Someone Else") }),
      notion({ id: "4", description: "No block" }),
      notion({ id: "5", description: block("Pat Example"), reported_at: daysAgo(31) }),
      notion({ id: "6", description: block("Pat Example"), status: "closed" }),
      notion({ id: "7", description: block("Pat Example"), external_status: "reopened_in_resolve" }),
    ];
    const g = notionQueueGroups(rows, staff, homeTeamOf, NOW);
    expect(g.team_a.map((t) => t.id)).toEqual(["1"]);
    expect(g.team_b.map((t) => t.id)).toEqual(["2"]);
    expect(g.unassigned.map((t) => t.id)).toEqual(["3", "4"]);
  });
});
