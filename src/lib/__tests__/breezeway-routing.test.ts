/**
 * Breezeway-origin ticket routing, tested as the decision it makes.
 *
 * The weighted-queue choice and the after-hours window are pure functions, so
 * these assertions are about what the server will actually do — not about what
 * the queue happens to look like in one snapshot of the database.
 */
import { describe, expect, it } from "bun:test";
import { isWithinWindow, pickLightestCandidate } from "@/lib/breezeway-routing.server";

const none = new Map<string, string>();

describe("weighted Team B queue", () => {
  it("picks the lightest weighted load (P1=5, P2=3, P3=1)", () => {
    const winner = pickLightestCandidate(
      [
        { userId: "a", weight: 10 },
        { userId: "b", weight: 3 },
        { userId: "c", weight: 6 },
      ],
      none,
    );
    expect(winner?.userId).toBe("b");
  });

  it("breaks a tie by who was auto-routed longest ago", () => {
    const last = new Map([
      ["a", "2026-09-01T10:00:00Z"],
      ["b", "2026-09-01T08:00:00Z"],
    ]);
    const winner = pickLightestCandidate(
      [
        { userId: "a", weight: 4 },
        { userId: "b", weight: 4 },
      ],
      last,
    );
    expect(winner?.userId).toBe("b");
  });

  it("rotates: someone never auto-routed goes before someone who has been", () => {
    const last = new Map([["a", "2026-09-01T08:00:00Z"]]);
    const winner = pickLightestCandidate(
      [
        { userId: "a", weight: 4 },
        { userId: "z", weight: 4 },
      ],
      last,
    );
    expect(winner?.userId).toBe("z");
  });

  it("is deterministic when everything else ties", () => {
    const pick = () =>
      pickLightestCandidate(
        [
          { userId: "b", weight: 2 },
          { userId: "a", weight: 2 },
        ],
        none,
      )?.userId;
    expect(pick()).toBe("a");
    expect(pick()).toBe("a");
  });

  it("returns nothing when nobody on Team B is eligible, so the caller falls back", () => {
    expect(pickLightestCandidate([], none)).toBeNull();
  });
});

describe("after-hours window", () => {
  // 10 p.m. -> 8 a.m. Central, as stored in coverage_config.
  const start = 22 * 60;
  const end = 8 * 60;

  it("covers the overnight span across midnight", () => {
    expect(isWithinWindow(23 * 60, start, end)).toBe(true);
    expect(isWithinWindow(2 * 60, start, end)).toBe(true);
  });

  it("excludes the working day", () => {
    expect(isWithinWindow(9 * 60, start, end)).toBe(false);
    expect(isWithinWindow(21 * 60 + 59, start, end)).toBe(false);
  });

  it("handles a same-day window too", () => {
    expect(isWithinWindow(10 * 60, 9 * 60, 17 * 60)).toBe(true);
    expect(isWithinWindow(18 * 60, 9 * 60, 17 * 60)).toBe(false);
  });
});
