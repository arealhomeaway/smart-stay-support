import { describe, expect, it } from "bun:test";
import {
  HOME_COPY,
  HOME_TABS,
  boardColumnOf,
  inHomeTab,
  needsYouNow,
  unclaimedCount,
  urgencyLabel,
  type HomeTicket,
} from "@/lib/home-work";
import { matchesMyWorkView } from "@/lib/my-work";
import {
  countsInOpenTotal,
  notionAction,
  notionBadge,
  openTicketsForTotal,
  withoutQuietNotion,
} from "@/lib/notion-ticket-display";
import { isWorkingStatus } from "@/lib/ticket-lifecycle";
import { capabilitiesFor } from "@/lib/permissions";

const ME = "00000000-0000-4000-8000-0000000000aa";
const OTHER = "00000000-0000-4000-8000-0000000000bb";
const NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const t = (over: Partial<HomeTicket> & Record<string, unknown> = {}): HomeTicket =>
  ({
    id: Math.random().toString(36).slice(2),
    title: "Leak",
    priority: "p1",
    status: "open",
    reported_at: daysAgo(1),
    assigned_to: null,
    current_action_owner: null,
    record_owner: null,
    accountable_owner: null,
    pending_handoff_to: null,
    functional_role_code: null,
    ...over,
  }) as HomeTicket;

const resolveTicket = t();
const recentImport = t({ external_source: "notion", reported_at: daysAgo(5) });
const olderImport = t({ external_source: "notion", reported_at: daysAgo(31) });
const historical = t({ external_source: "notion", status: "closed", reported_at: daysAgo(3) });
const historicalResolved = t({ external_source: "notion", status: "resolved", reported_at: daysAgo(400) });
const reopened = t({ external_source: "notion", external_status: "reopened_in_resolve", reported_at: daysAgo(400) });

describe("b. open ticket totals (a home's page, homes list, Hub, map)", () => {
  it("never count closed Notion imports or open imports older than 30 days", () => {
    expect(countsInOpenTotal(historical)).toBe(false);
    expect(countsInOpenTotal(historicalResolved)).toBe(false);
    expect(countsInOpenTotal(olderImport)).toBe(false);
  });

  it("still count recent open imports, reopened imports and ordinary tickets", () => {
    expect(countsInOpenTotal(recentImport)).toBe(true);
    expect(countsInOpenTotal(reopened)).toBe(true);
    expect(countsInOpenTotal(resolveTicket)).toBe(true);
  });

  it("a home with one of each counts exactly 3 open tickets", () => {
    const rows = [resolveTicket, recentImport, olderImport, historical, historicalResolved, reopened];
    expect(openTicketsForTotal(rows).length).toBe(3);
    // The home page uses working statuses; same answer.
    expect(openTicketsForTotal(rows, isWorkingStatus).length).toBe(3);
  });

  it("the 30 day line: day 30 counts, day 31 does not", () => {
    expect(countsInOpenTotal(t({ external_source: "notion", reported_at: daysAgo(29.9) }))).toBe(true);
    expect(countsInOpenTotal(t({ external_source: "notion", reported_at: daysAgo(30.1) }))).toBe(false);
  });

  it("recent imports never count in the unclaimed count, Needs you now, Oversight or scorecards", () => {
    expect(unclaimedCount([recentImport], null)).toBe(0);
    expect(unclaimedCount([resolveTicket, recentImport], null)).toBe(1);
    const assigned = t({ external_source: "notion", reported_at: daysAgo(2), assigned_to: ME, escalation_level: "supervisor" });
    expect(needsYouNow([assigned], ME)).toEqual([]);
    // Oversight, Analytics, Executive View and the scorecards all read withoutQuietNotion.
    expect(withoutQuietNotion([resolveTicket, recentImport, olderImport, historical, reopened])).toEqual([
      resolveTicket,
      reopened,
    ]);
  });
});

describe("c. a recent import assigned to a person shows in their My work", () => {
  const mine = t({ external_source: "notion", reported_at: daysAgo(4), assigned_to: ME, response_due_at: daysAgo(1) });

  it("appears under Active only, with the Imported from Notion badge", () => {
    expect(inHomeTab(mine, "active", ME)).toBe(true);
    expect(inHomeTab(mine, "waiting", ME)).toBe(false);
    expect(inHomeTab(mine, "done", ME)).toBe(false);
    expect(notionBadge(mine)).toBe("Imported from Notion");
    expect(HOME_COPY.importBadge).toBe("Imported from Notion");
  });

  it("an imported Notion status of waiting still shows under Active and sits in the Open column", () => {
    const waiting = t({ external_source: "notion", reported_at: daysAgo(4), assigned_to: ME, status: "waiting" });
    expect(inHomeTab(waiting, "active", ME)).toBe(true);
    expect(inHomeTab(waiting, "waiting", ME)).toBe(false);
    expect(boardColumnOf(waiting, "active")).toBe("open");
  });

  it("the old My Work list agrees: Active only", () => {
    expect(matchesMyWorkView(mine as never, "active", ME)).toBe(true);
    for (const v of ["attention", "waiting", "blocked", "scheduled", "escalated", "completed"] as const)
      expect(matchesMyWorkView(mine as never, v, ME)).toBe(false);
  });

  it("only for the person it is assigned to", () => {
    expect(inHomeTab(mine, "active", OTHER)).toBe(false);
    const unassigned = t({ external_source: "notion", reported_at: daysAgo(4) });
    expect(inHomeTab(unassigned, "active", ME)).toBe(false);
  });

  it("older open and closed imports never show, even when assigned", () => {
    const older = t({ external_source: "notion", reported_at: daysAgo(45), assigned_to: ME });
    const closed = t({ external_source: "notion", status: "closed", resolved_at: daysAgo(1), assigned_to: ME });
    for (const tab of HOME_TABS) {
      expect(inHomeTab(older, tab.value, ME)).toBe(false);
      expect(inHomeTab(closed, tab.value, ME)).toBe(false);
    }
  });

  it("stays quiet: no clock in its urgency, never Needs you now, never unclaimed", () => {
    // Even with an old due time on the row, the label shows priority only.
    expect(urgencyLabel(mine)).toBe("P1");
    expect(urgencyLabel(t({ assigned_to: ME, response_due_at: daysAgo(1) }))).not.toBe("P1");
    expect(needsYouNow([mine], ME)).toEqual([]);
    expect(unclaimedCount([mine], null)).toBe(0);
    expect(withoutQuietNotion([mine])).toEqual([]);
  });

  it("once taken it is ordinary work and counts everywhere", () => {
    const taken = { ...mine, external_status: "reopened_in_resolve" } as HomeTicket;
    expect(inHomeTab(taken, "active", ME)).toBe(true);
    expect(notionBadge(taken)).toBe("Reopened from Notion");
    expect(withoutQuietNotion([taken])).toEqual([taken]);
  });
});

describe("d. who can Take or Reopen", () => {
  it("staff who work tickets see Take this ticket on a recent import", () => {
    expect(notionAction(recentImport, true)?.label).toBe("Take this ticket");
    expect(notionAction(olderImport, true)?.label).toBe("Reopen");
  });

  it("the onboarding role cannot Reopen or Take", () => {
    const canWork = capabilitiesFor(["onboarding"]).has("work_orders_internal");
    expect(canWork).toBe(false);
    expect(notionAction(recentImport, canWork)).toBeNull();
    expect(notionAction(olderImport, canWork)).toBeNull();
    expect(notionAction(historical, canWork)).toBeNull();
  });

  it("coordinators, Supervisors and Admins can", () => {
    for (const r of ["tech", "manager", "admin"] as const)
      expect(capabilitiesFor([r]).has("work_orders_internal")).toBe(true);
  });
});

describe("a. Routine Work page", () => {
  it("no longer shows a My Work tab, so no tab bar appears", async () => {
    const { pageTabGroupFor, visiblePageTabs } = await import("@/lib/shell-nav");
    const group = pageTabGroupFor("/routines");
    expect(group?.tabs.map((x) => x.label)).toEqual(["Routine Work"]);
    const tabs = visiblePageTabs(group!, { can: () => true, canOpen: () => true, guestExperienceSeat: false, flagEnabled: () => true });
    expect(tabs.map((x) => x.label)).not.toContain("My Work");
    expect(tabs.length).toBeLessThan(2);
  });
});
