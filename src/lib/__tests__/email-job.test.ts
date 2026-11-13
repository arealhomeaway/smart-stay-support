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
it("records a failed part and continues to the next parts (Part 2, 2.7)", async () => {
  let subsequent = 0;
  const db = database();
  const result = await runEmailJob(db as never, [
    { name: "owner", run: async () => { throw new Error("provider failed"); } },
    { name: "staff", run: async () => ({ ok: false, notes: ["2 sends failed"] }) },
    { name: "pid_nightly_sync", run: async () => { subsequent++; return { ok: true }; } },
  ]);
  expect(result.ok).toBe(false);
  expect(result.errors).toEqual(["owner: provider failed", "staff: reported an unsuccessful result", "staff: 2 sends failed"]);
  expect(subsequent).toBe(1);
  expect(db.calls.filter((c) => c.name === "record_email_job_part").length).toBe(3);
  expect(db.calls.at(-1)?.name).toBe("finish_email_job_run");
});
it("does not finish a run whose part audit failed", async () => {
  const calls: string[] = [];
  const db = { rpc: async (name: string) => { calls.push(name); return { data: "run-1", error: name === "record_email_job_part" ? "audit failed" : null }; } };
  await expect(runEmailJob(db as never, [{ name: "staff", run: async () => ({ emailed: 0 }) }])).rejects.toThrow("unfinished run retained");
  expect(calls).toEqual(["begin_email_job_run", "record_email_job_part"]);
});
it("treats a part's explicit failure as a failed run", async () => {
  expect((await runEmailJob(database() as never, [{ name: "owner", run: async () => ({ ok: false }) }])).ok).toBe(false);
});