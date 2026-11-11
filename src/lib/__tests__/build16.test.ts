import { describe, expect, it } from "bun:test";
import { breezewayRepairSignal, BREEZEWAY_CHECK_STEP, ticketStage } from "@/lib/ticket-stage";
import { breezewayReportLink, breezewayTaskPage, isFinishedState } from "@/lib/breezeway-bridge";
import { handoffAlertLine, TEAM_QUEUE_COPY } from "@/lib/team-queue-board";
import { marketOptions } from "@/lib/property-card";
import { FLAG_KEYS } from "@/lib/feature-flags";
import { readFileSync } from "node:fs";

describe("Build 16 A2: both Breezeway links on a ticket", () => {
  it("the task page is always there, the report only when Breezeway gives one", () => {
    expect(breezewayTaskPage(42)).toBe("https://app.breezeway.io/task/42");
    expect(breezewayReportLink(null)).toBeNull();
    expect(breezewayReportLink("  ")).toBeNull();
    expect(breezewayReportLink("https://r.example/1")).toBe("https://r.example/1");
  });
});

describe("Build 16 A3: a finished Breezeway work order moves the ticket to Verify the outcome", () => {
  it("finished means Finished, Approved or Closed", () => {
    expect(isFinishedState("finished", null)).toBe(true);
    expect(isFinishedState(null, "Approved")).toBe(true);
    expect(isFinishedState("started", "In progress")).toBe(false);
  });
  it("all linked orders must be finished", () => {
    expect(breezewayRepairSignal([])).toEqual({ exists: false, finished: false });
    expect(breezewayRepairSignal([{ finished: true }, { finished: false }])).toEqual({ exists: true, finished: false });
    expect(breezewayRepairSignal([{ finished: true }])).toEqual({ exists: true, finished: true });
  });
  it("the stage is Verify until the work is checked", () => {
    const base = { closed: false, hasDiagnosis: true, repairPossible: true, repairExists: true, repairComplete: true };
    expect(ticketStage({ ...base, verified: false } as never)).toBe("verify");
    expect(BREEZEWAY_CHECK_STEP).toBe("Check the finished work");
  });
  it("the database sets the same next step", () => {
    const sql = readFileSync("drizzle/migrations/0331_build16_switches_settings_breezeway_finished.sql", "utf8");
    expect(sql).toContain(`next_action = '${BREEZEWAY_CHECK_STEP}'`);
  });
});

describe("Build 16 B: retired buttons stay behind switches that default off", () => {
  it("both switches are known keys", () => {
    expect(FLAG_KEYS).toContain("arrival_ready_button");
    expect(FLAG_KEYS).toContain("finance_packet_button");
  });
});

describe("Build 16 D: Team Queue handoff alert line", () => {
  it("only Right now handoffs carry the line", () => {
    expect(handoffAlertLine("p2", false)).toBeNull();
    expect(handoffAlertLine("p1", false)).toBe(TEAM_QUEUE_COPY.alert.handoffBefore(15));
    expect(handoffAlertLine("p1", true)).toBe(TEAM_QUEUE_COPY.alert.handoffSent);
  });
});

describe("Build 16 D: Properties market filter", () => {
  it("board order first, then any other market a home has", () => {
    expect(marketOptions(["Houston", "OKC", null, "Carlton Landing"])).toEqual([
      "Fort Worth", "OKC", "Tulsa", "Indy", "Carlton Landing", "Houston",
    ]);
  });
});
