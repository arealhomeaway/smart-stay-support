import { expect, it } from "bun:test";
import { execFileSync } from "node:child_process";

it("actual program reads exclude archived reviews and the shared work predicate excludes retired items", async () => {
  const out = execFileSync("bun", ["run", "qa/owner-activity-lifecycle.fixture.ts"], { encoding: "utf8" });
  expect(out).toContain("activity checks complete");
});