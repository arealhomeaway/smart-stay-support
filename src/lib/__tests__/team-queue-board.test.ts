import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  TEAM_QUEUE_COPY,
  alertLine,
  chipCounts,
  declineReasonOk,
  defaultScope,
  dueLine,
  durationLabel,
  giveBackPatch,
  groupCountLine,
  handoffFromLine,
  handoffsForMe,
  inScope,
  isLate,
  parseScope,
  sourceGroups,
  waitLine,
} from "../team-queue-board";
import { notionGroupsFor } from "@/components/operations/NotionImportedGroup";

/** Team Queue board (Emily, Nov 7, 2026; register T6, T7, T12, T13, N4). */
const read = (p: string) => readFileSync(p, "utf8");
const A = "guest_experience";
const B = "property_operations";
const CFG = { after_hours_start_minute: 22 * 60, after_hours_end_minute: 8 * 60, timezone: "America/Chicago" };
// Monday Nov 9, 2026: Central is UTC minus 6.
const central = (hhmm: string, day = "2026-11-09") => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), h! + 6, m!));
};

describe("the page words, exactly as drawn", () => {
  it("title, subtitle, chips, sections and empty states", () => {
    expect(TEAM_QUEUE_COPY.title).toBe("Team Queue");
    expect(TEAM_QUEUE_COPY.subtitle).toBe("Work nobody owns yet. Take what you can do.");
    expect(Object.values(TEAM_QUEUE_COPY.chips)).toEqual(["Team A", "Team B", "All teams", "All unclaimed"]);
    expect(TEAM_QUEUE_COPY.pickUp).toBe("Pick up work");
    expect(TEAM_QUEUE_COPY.summary(8, 2)).toBe("8 waiting for an owner · 2 handoffs waiting for you");
    expect(TEAM_QUEUE_COPY.summary(1, 0)).toBe("1 waiting for an owner");
    expect(TEAM_QUEUE_COPY.empty).toBe("Nothing is waiting for an owner in this team.");
    expect(TEAM_QUEUE_COPY.everyone).toBe("Everyone's work");
    expect(TEAM_QUEUE_COPY.emptyList).toBe("Nothing matches these filters.");
    expect(TEAM_QUEUE_COPY.search).toBe("Search by title or home");
    expect(TEAM_QUEUE_COPY.moreFilters).toBe("More filters");
    expect(TEAM_QUEUE_COPY.problemType).toBe("Problem type");
    expect([TEAM_QUEUE_COPY.allOwners, TEAM_QUEUE_COPY.noOwner, TEAM_QUEUE_COPY.urgent, TEAM_QUEUE_COPY.any]).toEqual(["All owners", "No owner", "How urgent", "Any"]);
  });
  it("group titles in board order, and the count lines", () => {
    expect(Object.values(TEAM_QUEUE_COPY.groups)).toEqual(["Handoffs waiting for you", "From email", "From Breezeway", "From OwnerRez", "Imported from Notion"]);
    expect(TEAM_QUEUE_COPY.groupCount(3, "12 minutes")).toBe("3 waiting · Longest: 12 minutes");
    expect(TEAM_QUEUE_COPY.notionCount(4)).toBe("4 quiet · No clocks or alerts");
    expect(TEAM_QUEUE_COPY.notionLine).toBe("Imported from Notion. No clock.");
  });
  it("row words: home, guest, alert lines, buttons and done states", () => {
    expect(TEAM_QUEUE_COPY.noHome).toBe("No home found. Pick the home.");
    expect(TEAM_QUEUE_COPY.guest).toBe("Guest in the home");
    expect(TEAM_QUEUE_COPY.openBreezeway).toBe("Open in Breezeway");
    expect([TEAM_QUEUE_COPY.take, TEAM_QUEUE_COPY.took, TEAM_QUEUE_COPY.openTicket, TEAM_QUEUE_COPY.giveBack]).toEqual(["Take it", "You took it.", "Open ticket", "Give it back"]);
    expect([TEAM_QUEUE_COPY.accept, TEAM_QUEUE_COPY.decline, TEAM_QUEUE_COPY.declineLabel, TEAM_QUEUE_COPY.declinePlaceholder, TEAM_QUEUE_COPY.send]).toEqual(["Accept", "Decline", "Why can you not accept this?", "Write a short reason", "Send"]);
    expect([TEAM_QUEUE_COPY.declined, TEAM_QUEUE_COPY.undo, TEAM_QUEUE_COPY.accepted]).toEqual(["Declined. It goes back with your reason.", "Undo", "You accepted it."]);
  });
  it("no banned word, name or long dash anywhere on the Team Queue screen", () => {
    const BANNED = [/\bseats?\b/i, /\bhit\b/i, /\bmedian\b/i, /\u2014/, /\bP[1-4]\b/, /\bJosh\b/, /\bEmily\b/];
    const strings = JSON.stringify(TEAM_QUEUE_COPY) + TEAM_QUEUE_COPY.summary(2, 3);
    for (const re of BANNED) expect({ re: String(re), hit: re.test(strings) }).toEqual({ re: String(re), hit: false });
    for (const f of [
      "src/routes/_authenticated/team-queue.tsx",
      "src/components/operations/QueueRow.tsx",
      "src/components/operations/AutomatedSourceQueue.tsx",
      "src/components/operations/TicketHandoffsQueue.tsx",
      "src/components/operations/NotionImportedGroup.tsx",
    ]) {
      const visible = read(f).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
      for (const re of [/\bseats?\b/i, /\bmedian\b/i, /\u2014/, /Work Map"/])
        expect({ f, re: String(re), hit: re.test(visible) }).toEqual({ f, re: String(re), hit: false });
    }
  });
});

describe("team chips", () => {
  it("the viewer's own team is selected first; people with no team start on All teams", () => {
    expect(defaultScope(A)).toBe("a");
    expect(defaultScope(B)).toBe("b");
    expect(defaultScope(null)).toBe("all");
    expect(parseScope("unclaimed", A)).toBe("unclaimed");
    expect(parseScope("nonsense", B)).toBe("b");
  });
  it("a team chip shows its team plus work with no team yet", () => {
    expect(inScope(A, "a")).toBe(true);
    expect(inScope(B, "a")).toBe(false);
    expect(inScope(null, "b")).toBe(true);
    expect(inScope(B, "all")).toBe(true);
  });
  it("counts: automated groups per team, every unowned ticket for All unclaimed, overnight requests on Team A", () => {
    expect(chipCounts({ automatedTeams: [A, B, null], unownedTeams: [A, B, null, B], overnight: 1 })).toEqual({ a: 3, b: 2, all: 4, unclaimed: 5 });
  });
  it("imported Notion tickets never count: the counts come only from the automated and unowned lists, which leave them out", () => {
    const page = read("src/routes/_authenticated/team-queue.tsx");
    expect(page).toContain("automatedTeams: automatedWaiting(sourceRows)");
    expect(page).toContain("withoutQuietNotion(withoutImportHeld(data ?? []))");
    expect(page).toContain("const sourceRows = all as unknown as SourceRow[];");
  });
});

describe("Pick up work groups", () => {
  const t = (id: string, extra: Record<string, unknown>) => ({ id, status: "open", priority: "p3", reported_at: "2026-11-09T10:00:00Z", ...extra });
  const rows = [
    t("ownerrez", { external_source: "ownerrez", functional_role_code: "ge_day" }),
    t("bz-old", { external_source: "breezeway", reported_at: "2026-11-09T08:00:00Z" }),
    t("bz-now", { external_source: "breezeway", priority: "p1", reported_at: "2026-11-09T11:00:00Z" }),
    t("email-b", { external_source: "email", priority: "p2", functional_role_code: "po_day", reported_at: "2026-11-09T07:00:00Z" }),
    t("email-a", { external_source: "email", priority: "p2", functional_role_code: "ge_day", reported_at: "2026-11-09T09:00:00Z" }),
    t("owned", { external_source: "email", assigned_to: "u1" }),
    t("staff", {}),
  ];
  it("board order From email, From Breezeway, From OwnerRez; a group with no rows is left out", () => {
    expect(sourceGroups(rows as never, "all", null).map((g) => g.source)).toEqual(["email", "breezeway", "ownerrez"]);
    expect(sourceGroups(rows as never, "b", B).map((g) => g.source)).toEqual(["email", "breezeway"]);
  });
  it("inside a group: urgency, then the viewer's own team, then longest waiting", () => {
    const ids = (scope: "all", team: string) => sourceGroups(rows as never, scope, team).map((g) => g.rows.map((r) => r.row.id));
    expect(ids("all", A)).toEqual([["email-a", "email-b"], ["bz-now", "bz-old"], ["ownerrez"]]);
    expect(ids("all", B)).toEqual([["email-b", "email-a"], ["bz-now", "bz-old"], ["ownerrez"]]);
  });
  it("count line: N waiting · Longest", () => {
    expect(groupCountLine(["2026-11-09T10:00:00Z", "2026-11-09T09:18:00Z"], new Date("2026-11-09T10:00:00Z"))).toBe("2 waiting · Longest: 42 minutes");
    expect(durationLabel(1)).toBe("1 minute");
    expect(durationLabel(125)).toBe("2 hours");
    expect(durationLabel(3 * 1440)).toBe("3 days");
  });
  it("the Notion group shows the chosen team plus Unassigned", () => {
    expect(notionGroupsFor("a")).toEqual(["team_a", "unassigned"]);
    expect(notionGroupsFor("b")).toEqual(["team_b", "unassigned"]);
    expect(notionGroupsFor("all")).toEqual(["team_a", "team_b", "unassigned"]);
  });
});

describe("late, as drawn", () => {
  it("Right now is late at 3 minutes", () => {
    const since = central("10:00").toISOString();
    expect(isLate("p1", since, central("10:02"), CFG)).toBe(false);
    expect(isLate("p1", since, central("10:03"), CFG)).toBe(true);
  });
  it("Today is late when the shift is ending: the last 30 minutes before the after-hours window, or a later day", () => {
    const since = central("14:00").toISOString();
    expect(isLate("p2", since, central("21:29"), CFG)).toBe(false);
    expect(isLate("p2", since, central("21:30"), CFG)).toBe(true);
    expect(isLate("p2", since, central("09:00", "2026-11-10"), CFG)).toBe(true);
    expect(isLate("p2", since, central("21:45"), null)).toBe(false);
  });
  it("Routine is late past 24 hours", () => {
    const since = central("10:00").toISOString();
    expect(isLate("p3", since, central("10:00", "2026-11-10"), CFG)).toBe(false);
    expect(isLate("p3", since, central("10:01", "2026-11-10"), CFG)).toBe(true);
  });
  it("the waiting line says Late when it is late", () => {
    expect(waitLine("2026-11-09T10:00:00Z", new Date("2026-11-09T10:05:00Z"), true)).toBe("Waiting 5 minutes. Late.");
    expect(waitLine("2026-11-09T10:00:00Z", new Date("2026-11-09T10:01:00Z"), false)).toBe("Waiting 1 minute");
  });
});

describe("the alert line for Right now", () => {
  it("three states from what has happened; nothing for Today or Routine", () => {
    expect(alertLine("p1", "none")).toBe("If nobody takes it, a supervisor is alerted at 10 minutes and the director at 15.");
    expect(alertLine("p1", null)).toBe("If nobody takes it, a supervisor is alerted at 10 minutes and the director at 15.");
    expect(alertLine("p1", "supervisor")).toBe("A supervisor has been alerted. The director is alerted at 15 minutes.");
    expect(alertLine("p1", "director")).toBe("A supervisor and the director have been alerted.");
    expect(alertLine("p2", "supervisor")).toBeNull();
    expect(alertLine("p3", "none")).toBeNull();
  });
  it("imported Notion rows have no clock, no red state and no alert line", () => {
    const g = read("src/components/operations/NotionImportedGroup.tsx");
    expect(g).toContain("quietLine={NOTION_GROUP_COPY.line}");
    expect(g).not.toContain("wait=");
    expect(g).not.toContain("alert=");
    expect(g).toContain("const [open, setOpen] = useState(false);");
  });
});

describe("handoffs waiting for you", () => {
  const ticket = { id: "t", status: "open", archived_at: null, is_demo: false };
  const h = (id: string, extra: Record<string, unknown>) => ({ id, ticket_id: "t", from_user: "sender", to_user: "me", to_role_code: null, priority: "p2", next_action: null, created_at: `2026-11-09T0${id}:00:00Z`, status: "pending", ticket, ...extra });
  it("offered to me by name or to a role I hold now; never my own request, a closed or archived ticket, or the other demo mode", () => {
    const rows = [
      h("1", {}),
      h("2", { to_user: null, to_role_code: "ge_day" }),
      h("3", { to_user: null, to_role_code: "po_day" }),
      h("4", { from_user: "me" }),
      h("5", { status: "accepted" }),
      h("6", { ticket: { ...ticket, status: "closed" } }),
      h("7", { ticket: { ...ticket, archived_at: "2026-11-01" } }),
      h("8", { ticket: { ...ticket, is_demo: true } }),
      h("9", { to_user: "someone" }),
    ];
    expect(handoffsForMe(rows as never, "me", new Set(["ge_day"]), false, ["open", "in_progress"]).map((x) => x.id)).toEqual(["1", "2"]);
  });
  it("the from line uses roles and teams only", () => {
    expect(handoffFromLine(A, B)).toBe("From a coordinator, Team A to Team B.");
    expect(handoffFromLine(null, B)).toBe("From a teammate.");
  });
  it("Decline needs a short reason; Send stays gray until there is one", () => {
    expect(declineReasonOk("")).toBe(false);
    expect(declineReasonOk("   ")).toBe(false);
    expect(declineReasonOk("Not my team")).toBe(true);
    expect(declineReasonOk("x".repeat(501))).toBe(false);
    const q = read("src/components/operations/TicketHandoffsQueue.tsx");
    expect(q).toContain("disabled={!declineReasonOk(reason) || busy !== null}");
  });
  it("ownership moves only on Accept: Decline never writes an owner", () => {
    const q = read("src/components/operations/TicketHandoffsQueue.tsx");
    const declineFn = q.slice(q.indexOf("async function decline("), q.indexOf("async function revert("));
    expect(declineFn).toContain('.update({ handoff_status: "rejected", pending_handoff_to: null })');
    expect(declineFn).not.toContain("current_action_owner: userId");
    const acceptFn = q.slice(q.indexOf("async function accept("), q.indexOf("async function decline("));
    expect(acceptFn).toContain("current_action_owner: userId");
    expect(acceptFn).toContain('settleHandoff("accept"');
  });
});

describe("Take it and Give it back", () => {
  it("Give it back puts the owners back as they were before Take it", () => {
    expect(giveBackPatch({ record_owner: null, accountable_owner: null, assignment_source: null, assignment_note: "Waiting in the Team Queue for the team to take it." })).toEqual({
      assigned_to: null, current_action_owner: null, record_owner: null, accountable_owner: null, assignment_source: null, assignment_note: "Waiting in the Team Queue for the team to take it.",
    });
    const q = read("src/components/operations/AutomatedSourceQueue.tsx");
    const give = q.slice(q.indexOf("async function giveBack("));
    expect(give).toContain('.eq("assigned_to", userId)');
    expect(give).toContain('.eq("current_action_owner", userId)');
  });
  it("Take it on an imported ticket goes through the one Notion rule, never a direct write", () => {
    const g = read("src/components/operations/NotionImportedGroup.tsx");
    expect(g).toContain("useServerFn(reopenNotionTicket)");
    expect(g).not.toContain('.from("tickets")');
  });
  it("onboarding accounts cannot Take (T12): Take needs the Operations work capability", () => {
    expect(read("src/routes/_authenticated/team-queue.tsx")).toContain("const canTake = operationsAccess && !readOnly;");
  });
});

describe("Everyone's work", () => {
  const fmt = (iso: string) => iso.slice(0, 10);
  it("the due or back to you line", () => {
    expect(dueLine({ status: "waiting", next_review_at: "2026-11-10T15:00:00Z", next_action_due_at: "2026-11-09T15:00:00Z" }, fmt)).toBe("Back to you 2026-11-10");
    expect(dueLine({ status: "open", next_action_due_at: "2026-11-09T15:00:00Z" }, fmt)).toBe("Due 2026-11-09");
    expect(dueLine({ status: "open" }, fmt)).toBe("No due time");
  });
  it("filters Owner, How urgent, Home, Problem type, Search and More filters; Work Map stays hidden behind its switch", () => {
    const page = read("src/routes/_authenticated/team-queue.tsx");
    for (const s of ["label={TEAM_QUEUE_COPY.owner}", "label={TEAM_QUEUE_COPY.urgent}", "label={TEAM_QUEUE_COPY.home}", "label={TEAM_QUEUE_COPY.problemType}", "placeholder={TEAM_QUEUE_COPY.search}", "{TEAM_QUEUE_COPY.moreFilters}"])
      expect(page).toContain(s);
    expect(page).toContain('(["list", "kanban", "calendar"] as const)');
    expect(page).toContain('requestedView === "map" && !flagEnabled("work_map") ? "list" : requestedView');
    expect(page).toContain('.from("work_types").select("id, name").eq("active", true)');
  });
  it("every button and field on the queue is at least 44px tall", () => {
    for (const f of ["src/components/operations/QueueRow.tsx", "src/components/operations/TicketHandoffsQueue.tsx", "src/components/operations/NotionImportedGroup.tsx", "src/routes/_authenticated/team-queue.tsx"]) {
      const src = read(f);
      for (const m of src.matchAll(/<(Button|Input|SelectTrigger)\b[^>]*>/g)) {
        const tag = m[0];
        if (/asChild/.test(tag) && !/className/.test(tag)) continue;
        expect({ f, tag, tall: /(min-h-1[12]|h-11)/.test(tag) }).toEqual({ f, tag, tall: true });
      }
    }
  });
});
