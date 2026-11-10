/**
 * Home, the rest (Emily, Nov 7; register T1, T2): the Needs you now side panel,
 * See all, Recent activity collapsed and My scorecard.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MY_SCORECARD_LABEL,
  MY_SCORECARD_TO,
  NEEDS_KIND_LABEL,
  NEEDS_PANEL_COPY,
  NEEDS_WHY,
  RECENT_ACTIVITY_COPY,
  SEE_ALL_LABEL,
  myScorecardVisible,
  recentActivityHeading,
  seeAllVisible,
} from "@/lib/home-needs";
import { recordWorkOrderSupervisorDecision } from "@/lib/work-order-supervisor-decision";

const home = readFileSync("src/routes/_authenticated/dashboard.tsx", "utf8");
const panel = readFileSync("src/components/home/NeedsYouNowPanel.tsx", "utf8");
const drawer = readFileSync("src/components/workorders/WorkOrderDrawer.tsx", "utf8");

describe("Needs you now side panel (register T2)", () => {
  it("every row opens the side panel instead of leaving Home", () => {
    const section = home.slice(home.indexOf("function NeedsYouNow"), home.indexOf("const PRIORITY_OPTIONS"));
    for (const kind of ["booking", "approval"]) expect(section).toContain(`data-needs-row="${kind}"`);
    expect(section).toContain("data-needs-row={i.kind}");
    expect(section.match(/onClick=\{\(\) =>\s*\{?\s*(const t = rows\.find[\s\S]*?)?setPanel\(/g)?.length).toBe(3);
    // No row links away from Home any more.
    expect(section).not.toMatch(/<Link\s+key=\{(r|a|i)\.id\}/);
    expect(section).toContain("<NeedsYouNowPanel item={panel}");
  });

  it("every row still says what and why", () => {
    const section = home.slice(home.indexOf("function NeedsYouNow"), home.indexOf("const PRIORITY_OPTIONS"));
    expect(section).toContain("Waiting for your approval");
    expect(section).toContain("{homeBookingLine(r)}");
    expect(section).toContain("{i.detail}");
  });

  it("the panel says why the item waits on this person", () => {
    expect(NEEDS_WHY.handoff).toBe("Someone handed this ticket to you. It becomes yours only when you accept it. Decline it with a reason if it is not yours.");
    expect(NEEDS_WHY.approval).toBe("This is waiting for your decision.");
    expect(NEEDS_WHY.escalation).toBe("This ticket is yours and it has gone past its time. Open it and take the next step.");
    expect(Object.keys(NEEDS_KIND_LABEL).sort()).toEqual(["approval", "booking", "escalation", "handoff"]);
  });

  it("a wide screen gets a drawer from the right and a phone a full sheet (the shared side panel)", () => {
    expect(panel).toContain("<TaskWorkspace");
    expect(panel).not.toContain('placement="center"');
    const ws = readFileSync("src/components/ui/workspace.tsx", "utf8");
    expect(ws).toContain('side="right"');
    expect(ws).toContain("// Phone: full screen.");
  });

  it("handoff Accept and Decline are the ticket's own, so ownership still moves only on Accept", () => {
    expect(panel).toContain("<HandoffPanel ticket={item.ticket} closed onChanged={refresh} />");
    const hp = readFileSync("src/components/HandoffPanel.tsx", "utf8");
    expect(hp).toContain("handoffSelfAcceptCheck");
    expect(hp).toContain('toast.error("A declined handoff needs a reason.")');
  });

  it("Approve uses the same Work Order spending decision as the Work Order panel, with the same authority check", () => {
    expect(panel).toContain("recordWorkOrderSupervisorDecision(supabase, { workOrder: wo, outcome, note, userId })");
    expect(panel).toContain('supabase.rpc("my_spending_approval_authority")');
    expect(drawer).toContain("await recordWorkOrderSupervisorDecision(supabase, {");
    // The writes now live in one place only.
    expect(drawer).not.toContain('.from("approvals")\n          .update({ status: outcome');
    expect(NEEDS_PANEL_COPY.approve).toBe("Approve this amount");
  });

  it("the shared decision writes the approval, then the Work Order, then one history line, unchanged", async () => {
    const calls: { table: string; op: string; body: unknown; id?: unknown }[] = [];
    const client = {
      from(table: string) {
        return {
          update(body: unknown) {
            return { eq: async (_c: string, id: unknown) => (calls.push({ table, op: "update", body, id }), { error: null }) };
          },
          insert: async (body: unknown) => (calls.push({ table, op: "insert", body }), { error: null }),
        };
      },
    };
    await recordWorkOrderSupervisorDecision(client as never, {
      workOrder: { id: "wo1", supervisor_approval_id: "ap1", is_demo: false },
      outcome: "approved",
      note: "Within the ladder",
      userId: "sup",
    });
    expect(calls.map((c) => `${c.op} ${c.table} ${c.id ?? ""}`.trim())).toEqual(["update approvals ap1", "update work_orders wo1", "insert work_order_events"]);
    expect(calls[0]!.body).toMatchObject({ status: "approved", decision_note: "Within the ladder" });
    expect(calls[1]!.body).toMatchObject({ supervisor_approval_status: "approved", supervisor_approval_note: "Within the ladder" });
    expect(calls[2]!.body).toEqual({ work_order_id: "wo1", author_id: "sup", event_type: "supervisor_approved", body: "Supervisor approved · Within the ladder", is_demo: false });
  });
});

describe("See all (register T2)", () => {
  it("shows for the Operations Supervisor, Directors, the COO and Admin, never for coordinators", () => {
    expect(seeAllVisible(["manager"])).toBe(true);
    expect(seeAllVisible(["admin"])).toBe(true);
    expect(seeAllVisible(["tech"])).toBe(false);
    expect(seeAllVisible(["onboarding"])).toBe(false);
    expect(SEE_ALL_LABEL).toBe("See all in Oversight");
    expect(home).toContain('to="/oversight"');
    expect(home.indexOf("{seeAll && (")).toBeGreaterThan(home.indexOf("{nothing && <p"));
  });
});

describe("Recent activity (register T1)", () => {
  it("starts collapsed, with a plain heading and a count, and opens to the last items", () => {
    expect(recentActivityHeading(6)).toBe("Recent activity (6)");
    const section = home.slice(home.indexOf("function RecentActivity"));
    expect(section).toContain("const [open, setOpen] = useState(false);");
    expect(section).toContain("hidden={!open}");
    expect(section).toContain("aria-expanded={open}");
    expect(section).toContain(".slice(0, RECENT_ACTIVITY_LIMIT)");
    expect(RECENT_ACTIVITY_COPY).toEqual({ show: "Show", hide: "Hide" });
    // Still the last thing on Home.
    expect(home.indexOf("<RecentActivity rows")).toBeGreaterThan(home.indexOf("<MyShiftCard"));
  });
});

describe("My scorecard (register T1)", () => {
  it("is hidden without a scorecard record and shown with one", () => {
    expect(myScorecardVisible(false, true)).toBe(false);
    expect(myScorecardVisible(true, true)).toBe(true);
  });

  it("is never a dead button: hidden when the view it opens cannot be opened", () => {
    expect(myScorecardVisible(true, false)).toBe(false);
    const btn = readFileSync("src/components/home/MyScorecardButton.tsx", "utf8");
    expect(btn).toContain("canOpen(MY_SCORECARD_TO)");
    expect(btn).toContain('.or(`recorded_by.eq.${userId},about_user_id.eq.${userId}`)');
    expect(btn).toContain('.eq("is_demo", false)');
    // Register A19 (Build 9 D2): the person's own read only page, not Analytics.
    expect(MY_SCORECARD_TO).toBe("/my-scorecard");
    expect(MY_SCORECARD_LABEL).toBe("My scorecard");
  });

  it("sits right after the banner, before Needs you now", () => {
    const btn = home.indexOf("<MyScorecardButton");
    expect(btn).toBeGreaterThan(home.indexOf("<PageHero"));
    expect(home.indexOf("<NeedsYouNow rows")).toBeGreaterThan(btn);
  });
});

describe("the sections already built stay", () => {
  it("banner, Needs you now, My work, Routine work, My shift, Recent activity are all still there in order", () => {
    const order = ["<PageHero", "<NeedsYouNow rows", "<MyWork rows", "<RoutineWorkDue", "<MyShiftCard", "<RecentActivity rows"].map((s) => home.indexOf(s));
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]!);
    expect(home).toContain("description={HOME_COPY.heroLine}");
    expect(home).toContain("dailyHomePhoto(");
  });
});

describe("wording", () => {
  it("no seat, no long dash, no names on the new words", () => {
    const words = [
      ...Object.values(NEEDS_WHY),
      ...Object.values(NEEDS_KIND_LABEL),
      ...Object.values(NEEDS_PANEL_COPY),
      SEE_ALL_LABEL,
      MY_SCORECARD_LABEL,
      recentActivityHeading(3),
      ...Object.values(RECENT_ACTIVITY_COPY),
    ];
    for (const w of words) {
      expect(w).not.toMatch(/\bseat\b/i);
      expect(w).not.toContain("—");
      expect(w).not.toMatch(/\b(Emily|James|Josh|Micah)\b/);
    }
  });
});
