import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { usCalendarDate } from "../dates";

describe("Active Owner calendar-date labels", () => {
  it("preserves enrollment, closing, program and participation dates", () => {
    for (const [value, label] of [
      ["2026-09-17", "09/17/2026"],
      ["2026-01-01", "01/01/2026"],
      ["2026-03-08", "03/08/2026"],
      ["2026-11-01", "11/01/2026"],
      ["2024-02-29", "02/29/2024"],
      ["2026-12-31", "12/31/2026"],
    ] as const) {
      expect(usCalendarDate(value)).toBe(label);
    }
  });

  it("uses the supplied fallback for missing or invalid calendar dates", () => {
    for (const value of [null, undefined, "", "2026-02-29", "2026-02-30", "2026-13-01"]) {
      expect(usCalendarDate(value, "Not set")).toBe("Not set");
    }
    expect(usCalendarDate(null)).toBe("—");
    expect(usCalendarDate("2026-9-17")).toBe("—");
    expect(usCalendarDate("2026-09-17T00:30:00Z")).toBe("—");
  });

  for (const [zone, timestampDate, timestampTime] of [
    ["America/Chicago", "09/16/2026", "7:30 PM"],
    ["UTC", "09/17/2026", "12:30 AM"],
    ["Pacific/Auckland", "09/17/2026", "12:30 PM"],
  ] as const) {
    it(`keeps civil dates fixed in ${zone} while preserving timestamp rendering`, () => {
      const moduleUrl = new URL("../dates.ts", import.meta.url).href;
      const script = `
        import { usCalendarDate, usDate, usDateTime } from ${JSON.stringify(moduleUrl)};
        const timestamp = "2026-09-17T00:30:00Z";
        process.stdout.write(JSON.stringify({
          closing: usCalendarDate("2026-09-17"),
          yearStart: usCalendarDate("2026-01-01"),
          timestampDate: usDate(timestamp),
          timestampDateTime: usDateTime(timestamp),
        }));
      `;
      const result = spawnSync(process.execPath, ["--eval", script], {
        env: { ...process.env, TZ: zone },
        encoding: "utf8",
      });
      expect(result.error).toBe(undefined);
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        closing: "09/17/2026",
        yearStart: "01/01/2026",
        timestampDate,
        timestampDateTime: `${timestampDate} · ${timestampTime}`,
      });
    });
  }
});
