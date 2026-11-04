import { describe, expect, it } from "bun:test";
import { BACKUP_EXPORTS, backupFolderName, foldersToPrune, isBackupHour, toCsv } from "@/lib/nightly-backup";

describe("nightly backup rules", () => {
  it("names the folder by Central date, not UTC", () => {
    expect(backupFolderName(new Date("2026-11-05T05:30:00Z"))).toBe("2026-11-04");
    expect(backupFolderName(new Date("2026-11-05T08:00:00Z"))).toBe("2026-11-05");
  });

  it("runs only at 2 a.m. Central in daylight and standard time", () => {
    expect(isBackupHour(new Date("2026-07-01T07:00:00Z"))).toBe(true); // CDT
    expect(isBackupHour(new Date("2026-07-01T08:00:00Z"))).toBe(false);
    expect(isBackupHour(new Date("2026-12-01T08:00:00Z"))).toBe(true); // CST
    expect(isBackupHour(new Date("2026-12-01T07:00:00Z"))).toBe(false);
  });

  it("exports the seven requested record types", () => {
    const t = BACKUP_EXPORTS.map((e) => e.table);
    for (const x of ["tickets", "ticket_activity", "work_orders", "claims", "guest_recovery", "expenses", "onboarding_tasks"])
      expect(t).toContain(x);
  });

  it("escapes commas, quotes, new lines and objects", () => {
    expect(toCsv([{ a: 'x,"y"', b: "l1\nl2", c: { k: 1 }, d: null }])).toBe(
      'a,b,c,d\r\n"x,""y""","l1\nl2","{""k"":1}",\r\n',
    );
  });

  it("keeps 60 days and only prunes dated folders it created", () => {
    const now = new Date("2026-11-05T08:00:00Z");
    const created = [
      { name: "2026-09-05", itemId: "a" }, // exactly 61 days back
      { name: "2026-09-06", itemId: "b" }, // 60 days back: kept
      { name: "Archive", itemId: "c" },
      { name: "2026-01-01", itemId: "" },
      { name: "2026-09-05", itemId: "a" },
    ];
    expect(foldersToPrune(created, now).map((f) => f.itemId)).toEqual(["a"]);
  });
});
