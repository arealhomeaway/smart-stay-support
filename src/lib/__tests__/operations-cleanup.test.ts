import { describe, expect, it as test } from "bun:test";
import { inHomeTab, needsYouNow, type HomeTicket } from "../home-work";
import { teamBTotal, reviewItem } from "../team-b-view";
import { reportedIssueIds } from "../reported-issue-group";
import { DEFAULT_STANDARDS, standardFor } from "../guest-ready-standards";

const user = "00000000-0000-4000-8000-000000000001";
const lead = "00000000-0000-4000-8000-000000000002";
const second = "00000000-0000-4000-8000-000000000003";
const row: HomeTicket = { id: lead, title: "Issue", priority: "p1", status: "open", assigned_to: user, escalation_level: "supervisor", properties: { lifecycle_status: "onboarding" } };

describe("Operations cleanup", () => {
  test("Onboarding tickets are hidden on Home", () => {
    expect(inHomeTab(row, "active", user)).toBe(false);
  });
  test("Onboarding tickets are hidden in Needs you now", () => {
    expect(needsYouNow([row], user)).toHaveLength(0);
  });
  test("Carry-over stays visible in both Home and Needs you now", () => {
    const carry = { ...row, handoff_carryovers: [{ ticket_id: lead }] };
    expect(inHomeTab(carry, "active", user)).toBe(true);
    expect(needsYouNow([carry], user).map((i) => i.ticketId)).toEqual([lead]);
  });
  test("Team B chip is the sum of its five tabs including review rows", () => {
    expect(teamBTotal({ maintenance: 12, reported: 8, cleaning: 3, inspection: 2, lawn: 4 })).toBe(29);
  });
  test("Rolled-up panel retains every issue exactly once", () => {
    expect(reportedIssueIds(`${second},${lead},${second},bad`, lead)).toEqual([lead, second]);
  });
  test("Lawn routine reviews read their guest-ready date without replacing their original clock", () => {
    const source = { source: "routine" as const, id: lead, title: "Lawn mowing", status: "due", due_at: "2026-11-26T16:00:00Z", due_on: "2026-12-02", property: "Home" };
    expect(reviewItem(source)?.due_on).toBe("2026-12-02");
    expect(source.due_at).toBe("2026-11-26T16:00:00Z");
  });
  test("Minor items uses its own standard", () => {
    expect(standardFor(DEFAULT_STANDARDS, { workTypeName: "Minor items" })?.id).toBe("minor-items");
  });
  test("Pest control uses its own standard", () => {
    expect(standardFor(DEFAULT_STANDARDS, { workTypeName: "Pest control" })?.id).toBe("pest-control");
  });
});