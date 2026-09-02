import { describe, expect, it } from "bun:test";
import { attentionItems, workflowCue, workflowsFor } from "@/lib/home-workflows";
import { can, type AppRole } from "@/lib/permissions";

function forRoles(roles: AppRole[]) {
  return workflowsFor(roles, (c) => can(roles, c));
}

describe("home workflows", () => {
  it("never shows a workflow the role has no capability for", () => {
    const tech = forRoles(["tech"]).map((w) => w.key);
    expect(tech).toContain("tickets");
    expect(tech).not.toContain("onboarding");
    expect(tech).not.toContain("active_owner");
  });

  it("shows nothing to vendors and homeowners", () => {
    expect(forRoles(["vendor"]).length).toBe(0);
    expect(forRoles(["owner"]).length).toBe(0);
  });

  it("orders onboarding work first for onboarding staff", () => {
    expect(forRoles(["onboarding"])[0]?.key).toBe("onboarding");
  });

  it("gives supervisors every workflow", () => {
    expect(forRoles(["manager"]).length).toBe(8);
  });
});

describe("attention items", () => {
  it("stays empty when there is nothing real to report", () => {
    expect(attentionItems({}).length).toBe(0);
    expect(attentionItems({ ticketsOpen: 4, ticketsP1: 0 }).length).toBe(0);
  });

  it("puts urgent counts first", () => {
    const items = attentionItems({ ticketsP1: 2, ticketsMine: 5, workOrdersAwaitingOwner: 1 });
    expect(items[0]?.tone).toBe("urgent");
    expect(items.map((i) => i.key)).toEqual(["p1", "wo-owner", "mine"]);
  });
});

describe("workflow cues", () => {
  it("says nothing when the count is unknown", () => {
    expect(workflowCue("tickets", {})).toBe(undefined);
    expect(workflowCue("onboarding", { ticketsOpen: 3 })).toBe(undefined);
  });

  it("reports real counts", () => {
    expect(workflowCue("tickets", { ticketsOpen: 3, ticketsP1: 1 })).toBe("3 open · 1 at P1");
    expect(workflowCue("claims", { claimsOpen: 0 })).toBe("No open claims");
  });
});
