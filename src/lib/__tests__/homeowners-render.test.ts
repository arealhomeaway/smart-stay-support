import { expect, it } from "bun:test";
import { execFileSync } from "node:child_process";

it("renders real-program management for Admin and Onboarding Director, practice management, and denies Coordinator controls", async () => {
  const out = execFileSync("bun", ["run", "qa/homeowners-render.fixture.tsx"], { encoding: "utf8" });
  expect(out.split(": pass").length - 1).toBe(4);
});