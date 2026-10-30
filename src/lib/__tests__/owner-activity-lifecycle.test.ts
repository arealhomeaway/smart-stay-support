import { expect, it } from "bun:test";

it("actual program reads exclude archived reviews and the shared work predicate excludes retired items", async () => {
  const run = Bun.spawn(["bun", "test", "qa/owner-activity-lifecycle.fixture.ts"], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(run.stdout).text(), new Response(run.stderr).text(), run.exited]);
  expect(code).toBe(0);
  expect(out + err).toContain("3 pass");
});