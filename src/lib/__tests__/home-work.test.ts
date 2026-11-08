import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  HOME_COPY,
  HOME_TABS,
  inHomeTab,
  needsYouNow,
  unclaimedCount,
  type HomeTicket,
} from "@/lib/home-work";
import { matchesMyWorkView } from "@/lib/my-work";
import { NOTION_CLAIM_REVIEW_STATUS } from "@/lib/notion-import/mapping";

const ME = "00000000-0000-4000-8000-0000000000aa";
const NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const t = (over: Partial<HomeTicket> & Record<string, unknown> = {}): HomeTicket =>
  ({
    id: Math.random().toString(36).slice(2),
    title: "Leak",
    priority: "p2",
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

describe("Team queue unclaimed count", () => {
  it("never counts imported Notion tickets, recent, older or closed", () => {
    const rows = [
      t(),
      t({ external_source: "notion", reported_at: daysAgo(3) }),
      t({ external_source: "notion", reported_at: daysAgo(90) }),
      t({ external_source: "notion", status: "closed" }),
      t({ import_hold: "needs_home" }),
    ];
    expect(unclaimedCount(rows, null)).toBe(1);
  });

  it("a Notion ticket reopened in Resolve is ordinary work again", () => {
    const reopened = t({ external_source: "notion", external_status: "reopened_in_resolve", reported_at: daysAgo(200) });
    expect(unclaimedCount([reopened], null)).toBe(1);
  });

  it("owned and closed work is not unclaimed", () => {
    expect(unclaimedCount([t({ assigned_to: ME }), t({ status: "closed" })], null)).toBe(0);
  });
});

describe("My work and Needs you now", () => {
  it("has exactly Active, Waiting and Done recently", () => {
    expect(HOME_TABS.map((x) => x.label)).toEqual(["Active", "Waiting", "Done recently"]);
  });

  it("imported Notion tickets never appear in My work, even when assigned", () => {
    const rows = [
      t({ assigned_to: ME, external_source: "notion", reported_at: daysAgo(3) }),
      t({ assigned_to: ME, external_source: "notion", reported_at: daysAgo(60) }),
      t({ assigned_to: ME, external_source: "notion", status: "closed", resolved_at: daysAgo(1) }),
    ];
    for (const r of rows) {
      for (const tab of HOME_TABS) expect(inHomeTab(r, tab.value, ME)).toBe(false);
      expect(matchesMyWorkView(r as never, "mine", ME)).toBe(false);
    }
  });

  it("Active and Waiting split open work; Done recently keeps the last 7 days", () => {
    expect(inHomeTab(t({ assigned_to: ME }), "active", ME)).toBe(true);
    expect(inHomeTab(t({ assigned_to: ME, status: "waiting" }), "waiting", ME)).toBe(true);
    expect(inHomeTab(t({ assigned_to: ME, status: "waiting" }), "active", ME)).toBe(false);
    expect(inHomeTab(t({ assigned_to: ME, status: "closed", resolved_at: daysAgo(2) }), "done", ME)).toBe(true);
    expect(inHomeTab(t({ assigned_to: ME, status: "closed", resolved_at: daysAgo(10) }), "done", ME)).toBe(false);
  });

  it("Needs you now holds only work addressed to this person, never Team Queue items", () => {
    const handed = t({ handoff_status: "pending", pending_handoff_to: ME });
    const escalated = t({ assigned_to: ME, escalation_level: "supervisor" });
    const unowned = t({ escalation_level: "supervisor" });
    const imported = t({ external_source: "notion", pending_handoff_to: ME, handoff_status: "pending" });
    const items = needsYouNow([handed, escalated, unowned, imported], ME);
    expect(items.map((i) => i.ticketId)).toEqual([handed.id, escalated.id]);
  });
});

describe("word check", () => {
  const FILES = [
    "src/routes/_authenticated/dashboard.tsx",
    "src/routes/_authenticated/team-queue.tsx",
    "src/components/tickets/NotionImportBlock.tsx",
    "src/components/operations/NotionImportedGroup.tsx",
    "src/lib/home-work.ts",
  ];
  // Words that never reach a screen, plus the Notion claim status that names a person.
  const BANNED = [/\bseat\b/i, /\bHit\b/, /\bmedian\b/i, /Checkouts/];

  it("Home words carry none of the banned words", () => {
    const copy = Object.values(HOME_COPY)
      .map((v) => (typeof v === "function" ? v(3) : v))
      .concat(HOME_TABS.flatMap((x) => [x.label, x.empty]))
      .join("\n");
    for (const re of BANNED) expect(copy).not.toMatch(re);
    expect(HOME_COPY.heroLine).toBe("Our homes. Take good care of them.");
    expect(HOME_COPY.teamQueueLink(4)).toBe("Team queue (4 unclaimed)");
  });

  it("no new screen quotes a banned word or the Notion claim status in visible text", () => {
    for (const f of FILES) {
      const visible = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l) && !/^\s*import /.test(l))
        .join("\n");
      // Strings and JSX text only: anything between quotes or between > and <.
      const text = [...visible.matchAll(/"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)]
        .map((m) => m[1] ?? m[2] ?? m[3] ?? "")
        .join("\n");
      for (const re of BANNED) expect({ f, hit: re.test(text) }).toEqual({ f, hit: false });
      expect(text).not.toContain(NOTION_CLAIM_REVIEW_STATUS);
    }
  });
});
