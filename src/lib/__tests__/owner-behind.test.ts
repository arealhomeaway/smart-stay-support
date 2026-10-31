import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import {
  behindItems,
  followUpDecision,
  followUpTitle,
  routeFollowUp,
  type OwnerItem,
} from "../owner-behind";

const now = new Date("2026-10-31T16:00:00Z");
const pastDue: OwnerItem = { id: "a", source: "review", status: "awaiting_owner", respondBy: "2026-10-20" };
const oldWaiting: OwnerItem = { id: "b", source: "work_item", status: "open", waitingSince: "2026-10-20T12:00:00Z" };
const recent: OwnerItem = { id: "c", source: "work_item", status: "open", waitingSince: "2026-10-26T18:10:00Z" };

describe("behind rule", () => {
  it("past respond-by date counts", () => expect(behindItems([pastDue], now)).toHaveLength(1));
  it("waiting more than 7 days with no respond-by counts", () => expect(behindItems([oldWaiting], now)).toHaveLength(1));
  it("waiting under 7 days does not count", () => expect(behindItems([recent], now)).toHaveLength(0));
  it("archived reviews never count", () =>
    expect(behindItems([{ ...pastDue, archivedAt: "2026-10-29T22:53:00Z" }], now)).toHaveLength(0));
  it("retired work items never count", () =>
    expect(behindItems([{ ...oldWaiting, retiredAt: "2026-10-29T00:00:00Z" }], now)).toHaveLength(0));
  it("answered or completed items never count", () => {
    expect(behindItems([{ ...pastDue, status: "answered" }], now)).toHaveLength(0);
    expect(behindItems([{ ...oldWaiting, status: "complete" }], now)).toHaveLength(0);
    expect(behindItems([{ ...oldWaiting, respondedAt: "2026-10-30T00:00:00Z" }], now)).toHaveLength(0);
  });
});

describe("routing by stage", () => {
  const base = { projectManager: "pm", onboardingDirector: "dir", followupSeatHolder: "seat", followupCover: null };
  it("onboarding goes to the home's Project Manager", () =>
    expect(routeFollowUp({ ...base, inOnboarding: true })).toEqual({ assignee: "pm", reason: "project_manager", noProjectManager: false }));
  it("onboarding with no Project Manager goes to the Onboarding Director and says so", () => {
    const r = routeFollowUp({ ...base, projectManager: null, inOnboarding: true });
    expect(r).toEqual({ assignee: "dir", reason: "no_project_manager", noProjectManager: true });
    expect(followUpTitle("Matt", 3, r.noProjectManager)).toContain("No Project Manager assigned");
  });
  it("after handoff goes to the follow-up seat", () =>
    expect(routeFollowUp({ ...base, inOnboarding: false }).assignee).toBe("seat"));
  it("after handoff an active cover wins", () =>
    expect(routeFollowUp({ ...base, inOnboarding: false, followupCover: "cover" })).toEqual({ assignee: "cover", reason: "followup_cover", noProjectManager: false }));
});

describe("dedupe, close and reopen", () => {
  it("creates once, then keeps while open", () => {
    expect(followUpDecision([pastDue], [], now).action).toBe("create");
    expect(followUpDecision([pastDue], [{ status: "open", closedAt: null }], now).action).toBe("keep");
  });
  it("after Reached out, the same items do not reopen", () =>
    expect(followUpDecision([pastDue], [{ status: "closed", closedAt: "2026-10-30T00:00:00Z" }], now).action).toBe("none"));
  it("reopens only when a new item falls behind after the close", () => {
    const later: OwnerItem = { id: "d", source: "review", status: "awaiting_owner", respondBy: "2026-10-30" };
    expect(followUpDecision([pastDue, later], [{ status: "closed", closedAt: "2026-10-30T12:00:00Z" }], now)).toEqual({ action: "create", count: 2 });
  });
  it("title wording", () =>
    expect(followUpTitle("Matt & Shannon Linder", 3)).toBe("Reach out to Matt & Shannon Linder about 3 items waiting. Email is fine."));
});

describe("call/text prompt is gone", () => {
  it("the call/text card and its loaders no longer exist", () => {
    expect(existsSync("src/components/OwnerContactAlerts.tsx")).toBe(false);
    expect(existsSync("src/lib/owner-alerts.functions.ts")).toBe(false);
    expect(readFileSync("src/routes/_authenticated/owner-programs.tsx", "utf8")).not.toMatch(/OwnerContactAlerts|Call or text/);
  });
  it("no code path creates new call/text items", () => {
    for (const f of ["src/lib/owner-notify.server.ts", "src/lib/owner-progress-alerts.server.ts"]) {
      expect(readFileSync(f, "utf8")).not.toContain("owner_contact_alerts");
    }
  });
});
