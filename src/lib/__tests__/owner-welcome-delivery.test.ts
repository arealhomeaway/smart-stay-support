import { expect, it, mock } from "bun:test";

let sendResult: { status: string; error?: string } = { status: "sent" };
const sent: string[] = [];
mock.module("../email.server", () => ({
  sendEmail: async (m: { to: string }) => { sent.push(m.to); return sendResult; },
  emailShell: () => "<html/>",
}));
const { drainOwnerWelcomes, retryOwnerWelcome } = await import("../owner-welcome.server");

type Row = Record<string, unknown>;
function db(review: "draft" | "approved", rows: Row[]) {
  const table = (name: string) => {
    const filters: [string, unknown][] = [];
    let patch: Row | null = null;
    const match = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
    const q: Record<string, unknown> = {
      select: () => q, order: () => q, is: () => q,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      update: (p: Row) => { patch = p; return q; },
      maybeSingle: async () => {
        if (name === "app_settings") return { data: { value: { subject: "S", body: "Hello there, a body long enough", video: null, version: 3, review } } };
        if (name === "profiles") return { data: { full_name: "Demo Owner" } };
        return { data: match()[0] ? { ...match()[0] } : null };
      },
      limit: async () => ({ data: match().map((r) => ({ ...r })) }),
      then: (res: (v: unknown) => void) => {
        if (name === "owner_program_properties") return res({ data: [] });
        const hit = match();
        if (patch) hit.forEach((r) => Object.assign(r, patch));
        return res({ data: hit.map((r) => ({ ...r })), error: null });
      },
    };
    return q;
  };
  return { from: table } as never;
}
const row = (o: Row = {}) => ({ id: "w1", program_id: "p", owner_user_id: "u", recipient: "owner@realmail.com", attempts: 0, status: "queued", is_demo: false, ...o });

it("unapproved wording sends nothing", async () => {
  sent.length = 0;
  const r = await drainOwnerWelcomes(db("draft", [row()]));
  expect(r.sent).toBe(0);
  expect(sent).toEqual([]);
});

it("demo welcomes are never picked up", async () => {
  sent.length = 0;
  await drainOwnerWelcomes(db("approved", [row({ is_demo: true })]));
  expect(sent).toEqual([]);
});

it("a failure stays visible as failed and is not resent on the next pass", async () => {
  sent.length = 0; sendResult = { status: "failed", error: "Mailbox down" };
  const rows: Row[] = [row()];
  await drainOwnerWelcomes(db("approved", rows));
  expect(rows[0]!["status"]).toBe("failed");
  expect(rows[0]!["error_message"]).toBe("Mailbox down");
  await drainOwnerWelcomes(db("approved", rows));
  expect(sent.length).toBe(1);
});

it("retry re-queues only a confirmed failure, once", async () => {
  const rows: Row[] = [row({ status: "failed" })];
  expect((await retryOwnerWelcome(db("approved", rows), "w1")).requeued).toBe(true);
  expect(rows[0]!["status"]).toBe("queued");
  sendResult = { status: "sent" }; sent.length = 0;
  await drainOwnerWelcomes(db("approved", rows));
  expect(sent.length).toBe(1);
  expect(rows[0]!["status"]).toBe("sent");
});

it("an uncertain 'sending' row is never re-queued", async () => {
  await expect(retryOwnerWelcome(db("approved", [row({ status: "sending" })]), "w1")).rejects.toThrow("not delivered");
});

it("demo rows cannot be retried into sending", async () => {
  await expect(retryOwnerWelcome(db("approved", [row({ status: "failed", is_demo: true })]), "w1")).rejects.toThrow("Demo");
});
