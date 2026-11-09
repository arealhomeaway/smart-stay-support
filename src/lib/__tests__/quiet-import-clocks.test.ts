import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { slaState } from "@/lib/tickets";
import {
  QUIET_IMPORT_LINE,
  hidesQuietAction,
  quietImportLine,
  reopenClocks,
  visibleClocks,
  NOTION_LIVE_STATUS,
} from "@/lib/notion-ticket-display";
import { TEAM_QUEUE_COPY } from "@/lib/team-queue-board";
import { urgencyLabel } from "@/lib/home-work";

// Rule (Emily, Nov 9; register N4, T7): an imported ticket is quiet until someone
// takes or reopens it. The ticket drawer and page show "Imported from Notion. No clock."
// and no minutes, response clock, escalation or Acknowledge. After Take it, the
// normal clocks start from that moment, never from the Notion created date.

const NOW = new Date("2026-11-09T17:00:00.000Z");
afterEach(() => setSystemTime());

const untouched = {
  external_source: "notion",
  external_status: "In progress",
  status: "in_progress",
  priority: "p1",
  reported_at: "2026-10-22T00:00:00.000Z",
  acknowledged_at: null,
  action_started_at: null,
  response_due_at: null,
  action_due_at: null,
  import_hold: null,
};

describe("an untouched import shows no clock", () => {
  it("shows the plain line", () => {
    setSystemTime(NOW);
    expect(quietImportLine(untouched)).toBe("Imported from Notion. No clock.");
  });

  it("hides the minutes, the response clock and the escalation", () => {
    setSystemTime(NOW);
    // Without the rule a P1 import from Oct 22 reads as escalated for thousands of minutes.
    expect(slaState(untouched).escalation?.minutes).toBeGreaterThan(20000);
    const shown = visibleClocks(untouched, slaState(untouched));
    expect(shown.escalation).toBeNull();
    expect(shown.response).toBeNull();
    expect(shown.action).toBeNull();
    expect(shown.breached).toBe(false);
  });

  it("hides the Acknowledge step", () => {
    setSystemTime(NOW);
    expect(hidesQuietAction(untouched, "acknowledge")).toBe(true);
  });

  it("an older open import is quiet the same way", () => {
    setSystemTime(NOW);
    const older = { ...untouched, reported_at: "2026-08-01T00:00:00.000Z" };
    expect(quietImportLine(older)).toBe(QUIET_IMPORT_LINE);
    expect(visibleClocks(older, slaState(older)).escalation).toBeNull();
  });

  it("the Team Queue row still reads the same line", () => {
    expect(TEAM_QUEUE_COPY.notionLine).toBe("Imported from Notion. No clock.");
    expect(QUIET_IMPORT_LINE).toBe(TEAM_QUEUE_COPY.notionLine);
  });

  it("Home's My work shows the urgency only, no Escalated and no clock", () => {
    setSystemTime(NOW);
    expect(urgencyLabel(untouched)).toBe("P1");
  });
});

describe("after Take it the clocks start at that moment", () => {
  const takeAt = new Date("2026-11-09T17:00:00.000Z");
  const taken = {
    ...untouched,
    external_status: NOTION_LIVE_STATUS,
    status: "open",
    last_reopened_at: takeAt.toISOString(),
    ...reopenClocks("p1", takeAt),
  };

  it("shows no quiet line and keeps Acknowledge", () => {
    setSystemTime(new Date(takeAt.getTime() + 60_000));
    expect(quietImportLine(taken)).toBeNull();
    expect(hidesQuietAction(taken, "acknowledge")).toBe(false);
  });

  it("the response clock counts from the take time (P1: 3 minutes)", () => {
    setSystemTime(new Date(takeAt.getTime() + 60_000));
    const shown = visibleClocks(taken, slaState(taken));
    expect(shown.response?.minutes).toBe(2);
    expect(shown.response?.met).toBe(false);
  });

  it("escalation minutes count from the take time, not the Notion created date", () => {
    setSystemTime(new Date(takeAt.getTime() + 4 * 60_000));
    const shown = visibleClocks(taken, slaState(taken));
    expect(shown.escalation?.minutes).toBe(4);
  });
});

describe("a ticket that is not imported looks exactly as before", () => {
  const ordinary = {
    status: "open",
    priority: "p1",
    reported_at: "2026-11-09T16:50:00.000Z",
    acknowledged_at: null,
    action_started_at: null,
    response_due_at: "2026-11-09T16:53:00.000Z",
    action_due_at: "2026-11-09T16:55:00.000Z",
  };

  it("keeps its clocks, escalation and Acknowledge", () => {
    setSystemTime(NOW);
    const sla = slaState(ordinary);
    expect(visibleClocks(ordinary, sla)).toBe(sla);
    expect(sla.escalation?.minutes).toBe(10);
    expect(quietImportLine(ordinary)).toBeNull();
    expect(hidesQuietAction(ordinary, "acknowledge")).toBe(false);
  });
});
