/**
 * "Send to the homeowner" end to end through the code path the Task drawer button uses:
 * the button's exact payload, the server function's input schema, sendTaskToOwner, and a
 * client shaped exactly like supabase-js SupabaseClient: real PostgrestClient underneath, and
 * from()/rpc() methods that read `this.rest` as SupabaseClient does. (Another test file
 * replaces the @supabase/supabase-js module for the whole run, so it is not imported here.)
 * Only the network is faked; it answers send_task_to_owner_item the way the live function does.
 */
import { expect, it } from "bun:test";
import { PostgrestClient } from "@supabase/postgrest-js";

class SupabaseShapedClient {
  rest: PostgrestClient;
  constructor(url: string, fetchImpl: typeof fetch) {
    this.rest = new PostgrestClient(`${url}/rest/v1`, { fetch: fetchImpl });
  }
  from(table: string) {
    return this.rest.from(table);
  }
  rpc(fn: string, args: Record<string, unknown> = {}, options = {}) {
    return this.rest.rpc(fn, args, options);
  }
}
import { sendTaskToOwner } from "../onboarding.server";
import { sendTaskToOwnerInput } from "../onboarding.functions";

const TASK = "11111111-1111-4111-8111-111111111111";
const HOME = "a0000000-0000-4000-8000-00000000a001";
const ADMIN = "22222222-2222-4222-8222-222222222222";

function fakeBackend() {
  const db = {
    task: { id: TASK, property_id: HOME, assigned_to: null, title: "Send cost projections", detail: null,
      due_on: null, is_demo: true, requires_owner_approval: false, owner_approval_status: null, status: "open" },
    ownerReviews: [] as { id: string; respond_by: string | null; recommendation: string }[],
    sends: [] as { review_id: string; task_id: string; note: string }[],
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const path = url.pathname.replace("/rest/v1/", "");
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path === "rpc/is_onboarding_staff" || path === "rpc/is_supervisor") return json(true);
    if (path === "onboarding_tasks") return json(db.task);
    if (path === "rpc/send_task_to_owner_item") {
      // Mirrors the live function's checks and writes.
      if (db.task.status === "complete") return json({ code: "P0001", message: "This task is already complete." }, 400);
      if (String(body._note ?? "").trim().length < 5)
        return json({ code: "P0001", message: "Write what you are asking the homeowner, at least a sentence." }, 400);
      const rid = `review-${db.ownerReviews.length + 1}`;
      db.ownerReviews.push({ id: rid, respond_by: body._respond_by ?? null, recommendation: body._note });
      db.sends.push({ review_id: rid, task_id: body._task_id, note: body._note });
      db.task.status = "complete";
      return json({ sent: true, review_id: rid, completed: true });
    }
    return json({ message: `unexpected request ${path}` }, 500);
  };
  const client = new SupabaseShapedClient("https://example.test", fetchImpl as typeof fetch);
  return { db, client };
}

it("sends a Task to the homeowner: owner item, send record, answer-by date, Task complete", async () => {
  const { db, client } = fakeBackend();
  // The exact payload SendToHomeownerSection sends, including version: "".
  const data = sendTaskToOwnerInput.parse({
    taskId: TASK,
    note: "Please review the repair and improvement cost projections attached.",
    version: "",
    documentIds: [],
    respondBy: "2099-12-01",
  });
  const result = await sendTaskToOwner(client as never, ADMIN, data);

  expect(result).toMatchObject({ ok: true, completed: true, channel: "in_app", reviewId: "review-1" });
  expect(db.ownerReviews).toHaveLength(1);
  expect(db.ownerReviews[0]?.respond_by).toBe("2099-12-01");
  expect(db.sends).toEqual([{ review_id: "review-1", task_id: TASK, note: data.note }]);
  expect(db.task.status).toBe("complete");
});

it("accepts the button's blank version and no answer-by date", () => {
  const data = sendTaskToOwnerInput.parse({
    taskId: TASK, note: "Please review the projections.", version: "", documentIds: [], respondBy: null,
  });
  expect(data.version).toBe("");
  expect(data.respondBy).toBeNull();
});
