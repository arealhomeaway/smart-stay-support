import { describe, expect, it } from "vitest";
import {
  composerModes,
  filterTimeline,
  needsAction,
  ownerTabCount,
  ownerTabRights,
  partTimeLeft,
  reminderDay,
  weeklyAutoSendDue,
  weeklyDraftDue,
  weeklySendClosed,
  EMAIL_PART_BATCH,
  ownerChatWaiting,
  parseMentions,
  CHAT_FOLDERS,
  type OwnerTabViewer,
} from "@/lib/owner-tab";
import { teamUpdates } from "@/components/onboarding/home-page/UpdatesFeed";

const base: OwnerTabViewer = { userId: "u", isAdmin: false, isOnboardingDirector: false, isHomePm: false, isHomeTeam: false, isStaff: true };

describe("who can do what (Part 2)", () => {
  it("a view-only staff member reads both chats, posts only in Team only, and cannot reach the owner", () => {
    const r = ownerTabRights(base);
    expect(r.postTeamChat).toBe(true);
    expect(r.postOwnerChat).toBe(false);
    expect(r.askOwner).toBe(false);
    expect(r.logContact).toBe(false);
    expect(r.sendWeekly).toBe(false);
  });
  it("Designer and Utilities write to the owner but do not send the weekly update or edit Good to know", () => {
    const r = ownerTabRights({ ...base, isHomeTeam: true });
    expect(r.postOwnerChat).toBe(true);
    expect(r.askOwner).toBe(true);
    expect(r.sendWeekly).toBe(false);
    expect(r.editGoodToKnow).toBe(false);
  });
  it("the PM sends the weekly update and edits Good to know, but only Admin and the Director switch the plan and auto-send", () => {
    const pm = ownerTabRights({ ...base, isHomePm: true });
    expect(pm.sendWeekly && pm.editGoodToKnow && pm.editPreferred && pm.pauseWeekly).toBe(true);
    expect(pm.switchPlan || pm.switchAutoSend).toBe(false);
    const director = ownerTabRights({ ...base, isOnboardingDirector: true });
    expect(director.switchPlan && director.switchAutoSend && director.postOwnerChat).toBe(true);
  });
  it("an owner (not staff) has no staff rights", () => {
    const r = ownerTabRights({ ...base, isStaff: false, isHomePm: true });
    expect(Object.values(r).some(Boolean)).toBe(false);
  });
});

describe("Needs action", () => {
  const us = [{ kind: "waiting_on_us" as const, id: "a", title: "Paint", who: "Niles", at: "2026-11-10T10:00:00Z", source: "item" as const }];
  const them = [{ kind: "waiting_on_owner" as const, id: "b", title: "Pick tile", dueOn: "2026-11-20", taskTitle: "Order tile", reminderOn: "2026-11-19", reminderSent: false }];
  const check = [{ kind: "check_it" as const, id: "c", title: "Wifi photo", what: "1 file", at: "2026-11-11T10:00:00Z" }];
  it("Standard homes never list owner completions", () => {
    const rows = needsAction({ activeOwner: false, waitingOnUs: us, waitingOnOwner: them, checkIt: check, weekly: null });
    expect(rows.map((r) => r.kind)).toEqual(["waiting_on_us", "waiting_on_owner"]);
  });
  it("the Owner tab count is owner answers waiting on us plus the weekly update", () => {
    const rows = needsAction({ activeOwner: true, waitingOnUs: us, waitingOnOwner: them, checkIt: check, weekly: { kind: "weekly", id: "w", ownerFirstNames: "Niles" } });
    expect(rows.map((r) => r.kind)).toEqual(["waiting_on_us", "waiting_on_owner", "check_it", "weekly"]);
    expect(ownerTabCount(rows)).toBe(2);
  });
  it("the owner chat waits on us only when the owner spoke last", () => {
    expect(ownerChatWaiting([{ author_type: "staff", created_at: "1" }, { author_type: "owner", created_at: "2" }])).toEqual({ at: "2" });
    expect(ownerChatWaiting([{ author_type: "owner", created_at: "1" }, { author_type: "staff", created_at: "2" }])).toBeNull();
  });
});

describe("timeline and composer", () => {
  const rows = [
    { id: "1", kind: "portal" as const, text: "Paint colors", who: "Niles", at: "2026-11-10" },
    { id: "2", kind: "call" as const, text: "Called about keys", who: "PM", at: "2026-11-11" },
    { id: "3", kind: "weekly" as const, text: "This week", who: "Resolve", at: "2026-11-12" },
  ];
  it("kind chips and search narrow the one timeline", () => {
    expect(filterTimeline(rows, "calls", "").map((r) => r.id)).toEqual(["2"]);
    expect(filterTimeline(rows, "all", "paint").map((r) => r.id)).toEqual(["1"]);
    expect(filterTimeline(rows, "weekly", "").map((r) => r.id)).toEqual(["3"]);
  });
  it("Standard homes without a portal get Email instead of Message", () => {
    const rights = ownerTabRights({ ...base, isHomePm: true });
    expect(composerModes({ activeOwner: false, ownerHasPortal: false, rights })).toEqual(["email", "log"]);
    expect(composerModes({ activeOwner: true, ownerHasPortal: true, rights })).toEqual(["message", "email", "log"]);
  });
  it("Updates on Overview shows team notes only", () => {
    const shown = teamUpdates([
      { id: "n", body: "Keys at office", author_id: null, created_at: "2", task_id: null, kind: "note" },
      { id: "c", body: "Called owner", author_id: null, created_at: "3", task_id: null, kind: "call" },
      { id: "t", body: "Task comment", author_id: null, created_at: "4", task_id: "x", kind: "note" },
    ]);
    expect(shown.map((n) => n.id)).toEqual(["n"]);
  });
});

describe("chat", () => {
  it("files go in one of six folders, never Other", () => {
    expect(CHAT_FOLDERS).toHaveLength(6);
    expect(CHAT_FOLDERS.some((f) => /other|unfiled/i.test(f.id))).toBe(false);
  });
  it("@mentions find a teammate by full or first name", () => {
    const people = [{ id: "1", name: "Dana Syska" }, { id: "2", name: "Niles Syska" }];
    expect(parseMentions("Can @Dana Syska check?", people)).toEqual(["1"]);
  });
});

describe("reminders, weekly update and email limits", () => {
  it("the reminder goes out the business day before, skipping weekends and holidays", () => {
    expect(reminderDay("2026-11-17")).toBe("2026-11-16"); // Tuesday due, Monday reminder
    expect(reminderDay("2026-11-16")).toBe("2026-11-13"); // Monday due, Friday reminder
    expect(reminderDay("2026-11-27", ["2026-11-26"])).toBe("2026-11-25"); // after Thanksgiving
  });
  it("drafts are written Friday from 7 AM Central and nothing is sent from 3 PM Friday until Monday", () => {
    expect(weeklyDraftDue(new Date("2026-11-13T12:59:00Z"))).toBe(false); // Fri 6:59 AM Central
    expect(weeklyDraftDue(new Date("2026-11-13T13:00:00Z"))).toBe(true); // Fri 7:00 AM Central
    expect(weeklySendClosed(new Date("2026-11-13T20:59:00Z"))).toBe(false); // Fri 2:59 PM
    expect(weeklySendClosed(new Date("2026-11-13T21:00:00Z"))).toBe(true); // Fri 3:00 PM
    expect(weeklySendClosed(new Date("2026-11-15T18:00:00Z"))).toBe(true); // Sunday
    expect(weeklySendClosed(new Date("2026-11-16T15:00:00Z"))).toBe(false); // Monday
    expect(weeklyAutoSendDue(new Date("2026-11-13T21:05:00Z"))).toBe(true);
  });
  it("each email part sends at most 50 and stops after 60 seconds", () => {
    expect(EMAIL_PART_BATCH).toBe(50);
    expect(partTimeLeft(0, 59_999)).toBe(true);
    expect(partTimeLeft(0, 60_000)).toBe(false);
  });
});
