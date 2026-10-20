import { expect, it, mock } from "bun:test";
const records: Record<string, unknown>[] = [];
let deliveries = 0;
let auditFails = false;
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {
  rpc: async () => ({ data: true, error: null }),
  from: () => ({ insert: async (r: Record<string, unknown>) => { records.push(r); return { error: auditFails ? "failed" : null }; } }),
} }));
const { sendEmail } = await import("../email.server");
async function isolatedRun(run: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const key = process.env["LOVABLE_API_KEY"];
  const connection = process.env["MICROSOFT_OUTLOOK_API_KEY"];
  process.env["LOVABLE_API_KEY"] = "fake-unit-test-key";
  process.env["MICROSOFT_OUTLOOK_API_KEY"] = "fake-unit-test-connection";
  globalThis.fetch = (async () => { deliveries++; return new Response(null, { status: 202 }); }) as typeof fetch;
  records.length = 0; deliveries = 0; auditFails = false;
  try { await run(); } finally {
    globalThis.fetch = originalFetch;
    if (key === undefined) delete process.env["LOVABLE_API_KEY"]; else process.env["LOVABLE_API_KEY"] = key;
    if (connection === undefined) delete process.env["MICROSOFT_OUTLOOK_API_KEY"]; else process.env["MICROSOFT_OUTLOOK_API_KEY"] = connection;
  }
}
it("actual shared sender makes zero provider calls for demo and .invalid", async () => {
  await isolatedRun(async () => {
    for (const input of [{ to: "qa@anything.invalid" }, { to: "staff@arealhomeaway.com", isDemo: true }]) {
      expect((await sendEmail({ ...input, subject: "test", html: "test" })).status).toBe("skipped");
    }
    expect(deliveries).toBe(0);
    expect(records.every((r) => r["attempts"] === 0)).toBe(true);
  });
});
it("actual shared sender permits verified live delivery using a mocked provider only", async () => {
  await isolatedRun(async () => {
    expect((await sendEmail({ to: "staff@arealhomeaway.com", subject: "test", html: "test", jobRunId: "run", jobPart: "staff" })).status).toBe("sent");
    expect(deliveries).toBe(1);
    expect(records[0]?.["email_job_part"]).toBe("staff");
  });
});
it("a failed audit after provider acceptance never repeats the send", async () => {
  await isolatedRun(async () => {
    auditFails = true;
    await expect(sendEmail({ to: "staff@arealhomeaway.com", subject: "test", html: "test", jobRunId: "run" })).rejects.toThrow("audit unavailable");
    expect(deliveries).toBe(1);
  });
});