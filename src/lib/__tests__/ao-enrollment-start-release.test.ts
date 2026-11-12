// Item 2 (Nov 12): owner activities come only from the automated homeowner plan; the old manual release is refused.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { OWNER_ACTIVITIES_FROM_PLAN, refuseManualOwnerRelease } from "@/lib/owner-plan-source";

describe("manual owner activity release is retired", () => {
  it("refuses with the plan message", () => {
    expect(() => refuseManualOwnerRelease()).toThrow("Owner activities now come from the homeowner plan automatically.");
    expect(OWNER_ACTIVITIES_FROM_PLAN).toBe("Owner activities now come from the homeowner plan automatically.");
  });
  it("the seedOwnerRoadmap server function refuses before any database call", () => {
    const src = readFileSync("src/lib/owner-program.functions.ts", "utf8");
    const start = src.indexOf("export const seedOwnerRoadmap");
    const body = src.slice(start, src.indexOf("export const", start + 10));
    expect(body).toContain("refuseManualOwnerRelease()");
    expect(body).not.toContain("programActivityRelease");
    expect(body).not.toContain("rpc(");
  });
  it("the program page no longer offers the release", () => {
    const page = readFileSync("src/routes/_authenticated/owner-programs.tsx", "utf8");
    expect(page).not.toContain("ProgramActivityRelease");
  });
});
