import { expect, it } from "bun:test";

it("renders real-program management for Admin and Onboarding Director, practice management, and denies Coordinator controls", async () => {
  const run = Bun.spawn(["bun", "run", "qa/homeowners-render.fixture.tsx"], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(run.stdout).text(), new Response(run.stderr).text(), run.exited]);
  expect({ code, err }).toEqual({ code: 0, err: "" });
  expect(out.split(": pass").length - 1).toBe(4);
});