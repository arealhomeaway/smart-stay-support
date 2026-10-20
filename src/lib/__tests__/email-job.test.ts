import { expect, it } from "bun:test";
import { runEmailJob } from "../email-job.server";
function database(startError = false) {
  const calls: { name: string; args: unknown }[] = [];
  return { calls, rpc: async (name: string, args: unknown) => {
    calls.push({ name, args });
    return { data: name === "begin_email_job_run" ? "run-1" : { email_counts: { staff: 0 } }, error: startError ? "unavailable" : null };
  } };
}
it("records start, each part, and finish with run attribution", async () => {
  const db = database();
  const result = await runEmailJob(db as never, [{ name: "staff", run: async (id) => { expect(id).toBe("run-1"); return { emailed: 0 }; } }]);
  expect(result.ok).toBe(true);
  expect(db.calls.map((c) => c.name)).toEqual(["begin_email_job_run", "record_email_job_part", "finish_email_job_run"]);
});
it("stops work when audit start fails", async () => {
  let executed = 0;
  await expect(runEmailJob(database(true) as never, [{ name: "staff", run: async () => { executed++; } }])).rejects.toThrow("no work started");
  expect(executed).toBe(0);
});
it("records errors and never runs subsequent parts after failure", async () => {
  let subsequent = 0;
  const result = await runEmailJob(database() as never, [
    { name: "owner", run: async () => { throw new Error("provider failed"); } },
    { name: "staff", run: async () => { subsequent++; } },
  ]);
  expect(result.ok).toBe(false); expect(result.errors).toEqual(["owner: provider failed"]); expect(subsequent).toBe(0);
});