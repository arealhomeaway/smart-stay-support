import { describe, expect, it } from "bun:test";
import {
  PACE_HOLD_KINDS,
  paceEmailBody,
  paceHoldActive,
  paceHoldLine,
  withoutHeldPaceAlerts,
} from "../pace-hold";

const NOW = Date.parse("2026-11-21T18:00:00Z");
const IN_7_DAYS = "2026-11-28T18:00:00Z";

const candidates = [
  { alertKind: "progress_pace" },
  { alertKind: "progress_checkpoint" },
  { alertKind: "progress_milestone" },
  { alertKind: "progress_quiet" },
  { alertKind: "progress_celebration" },
  { alertKind: "progress_deadline" },
];

describe("pace emails held after a correction", () => {
  it("holds exactly the pace, checkpoint, milestone and quiet notices", () => {
    expect([...PACE_HOLD_KINDS]).toEqual([
      "progress_pace",
      "progress_checkpoint",
      "progress_milestone",
      "progress_quiet",
    ]);
  });

  it("during the hold, celebration and final days notices still go", () => {
    const kept = withoutHeldPaceAlerts(candidates, IN_7_DAYS, NOW).map((c) => c.alertKind);
    expect(kept).toEqual(["progress_celebration", "progress_deadline"]);
  });

  it("with no hold, or once the hold date has passed, every notice goes as before", () => {
    expect(withoutHeldPaceAlerts(candidates, null, NOW)).toHaveLength(6);
    expect(withoutHeldPaceAlerts(candidates, "2026-11-21T17:59:00Z", NOW)).toHaveLength(6);
    expect(paceHoldActive(IN_7_DAYS, Date.parse("2026-11-28T18:00:01Z"))).toBe(false);
  });

  it("the team line names the Central date pace emails resume", () => {
    expect(paceHoldLine(IN_7_DAYS, NOW)).toBe("Hours corrected. Pace emails resume Nov 28.");
    // 2:00 AM UTC on Nov 29 is still Nov 28 in Central time.
    expect(paceHoldLine("2026-11-29T02:00:00Z", NOW)).toBe("Hours corrected. Pace emails resume Nov 28.");
    expect(paceHoldLine(null, NOW)).toBeNull();
    expect(paceHoldLine("2026-11-20T00:00:00Z", NOW)).toBeNull();
  });

  it("the pace email states her real hours and the recommended pace", () => {
    expect(paceEmailBody(42.05, 54.02)).toBe(
      "You have 42.05 hours logged. The recommended pace for this point in your program is 54.02 hours. If you have done anything you haven't logged yet, now is a good time to add it.",
    );
  });
});
