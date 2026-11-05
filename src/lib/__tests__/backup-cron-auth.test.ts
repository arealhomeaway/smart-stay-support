import { describe, expect, it } from "bun:test";
import { backupCallerAllowed } from "@/lib/backup-cron-auth";

const good = "a".repeat(64);
const verify = async (t: string) => t === good;

describe("nightly backup trigger token", () => {
  it("rejects a missing token", async () => {
    expect(await backupCallerAllowed(null, verify)).toBe(false);
    expect(await backupCallerAllowed("", verify)).toBe(false);
  });
  it("rejects a wrong token", async () => {
    expect(await backupCallerAllowed("b".repeat(64), verify)).toBe(false);
  });
  it("rejects a short token without asking the database", async () => {
    let asked = false;
    expect(await backupCallerAllowed("short", async () => ((asked = true), true))).toBe(false);
    expect(asked).toBe(false);
  });
  it("rejects when the check fails", async () => {
    expect(await backupCallerAllowed(good, async () => { throw new Error("down"); })).toBe(false);
  });
  it("accepts the database token", async () => {
    expect(await backupCallerAllowed(good, verify)).toBe(true);
  });
});
