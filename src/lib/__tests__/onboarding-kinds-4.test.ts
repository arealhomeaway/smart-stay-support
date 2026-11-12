/**
 * Nov 12 small fix batch: 38 Files placement by kind, 39 "Needs a file before sending" on the
 * drawer (the rule the Send buttons read) and on the server (Send to the homeowner and Send email),
 * 40 the Owner Type / Status line under the onboarding home header.
 */
import { describe, expect, it } from "bun:test";
import { PostgrestClient } from "@supabase/postgrest-js";
import { ATTACH_FILE_FIRST, TASK_KINDS, filesPlacement, kindSettings, sendNeedsFile } from "../onboarding-task-kinds";
import { headerFactsLine } from "../onboarding-board";
import { sendTaskToOwner } from "../onboarding.server";
import { sendTaskToOwnerInput } from "../onboarding.functions";
import { taskEmailFileGate } from "../task-file-gate.server";

describe("38 Files placement", () => {
  it("moves Files to the bottom for the send, email, approval, outside, vendor and fill in kinds", () => {
    for (const k of ["send_to_owner", "email", "approval", "outside_resolve", "vendor_request", "fill_in"] as const)
      expect(filesPlacement(k)).toBe("bottom");
  });
  it("keeps Files where it is for Do it and Upload files, and none on a work order", () => {
    expect(filesPlacement("do_it")).toBe("top");
    expect(filesPlacement("upload_files")).toBe("top");
    expect(filesPlacement("work_order")).toBe("none");
  });
  it("places every kind", () => {
    expect(TASK_KINDS.map(filesPlacement).every((p) => ["top", "bottom", "none"].includes(p))).toBe(true);
  });
});

describe("39 Needs a file before sending: the drawer rule", () => {
  it("is off by default and kept only when ticked", () => {
    expect(kindSettings({}).requireFile).toBe(undefined);
    expect(kindSettings({ requireFile: true }).requireFile).toBe(true);
    expect(kindSettings({ requireFile: "yes" }).requireFile).toBe(undefined);
    expect(kindSettings({ requireFile: false }).requireFile).toBe(undefined);
  });
  it("holds Send with the line until the Task has a file", () => {
    expect(ATTACH_FILE_FIRST).toBe("Attach the file first.");
    expect(sendNeedsFile({ requireFile: true }, 0)).toBe("Attach the file first.");
    expect(sendNeedsFile({ requireFile: true }, 1)).toBeNull();
    expect(sendNeedsFile({}, 0)).toBeNull();
  });
});

/* ------------------------------------------------ server: a client shaped like supabase-js */

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

const TASK = "11111111-1111-4111-8111-111111111111";
const HOME = "a0000000-0000-4000-8000-00000000a001";
const ADMIN = "22222222-2222-4222-8222-222222222222";

function backend(opts: { requireFile: boolean; files: number }) {
  const sends: unknown[] = [];
  const fileQueries: string[] = [];
  const task = {
    id: TASK, property_id: HOME, assigned_to: null, title: "Send cost projections", detail: null, due_on: null,
    is_demo: true, requires_owner_approval: true, owner_approval_status: "pending", status: "open",
    kind_settings: opts.requireFile ? { requireFile: true } : {},
  };
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
  const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const path = url.pathname.replace("/rest/v1/", "");
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (path === "rpc/is_onboarding_staff" || path === "rpc/is_supervisor") return json(true);
    if (path === "onboarding_tasks") return json(task);
    if (path === "documents") {
      fileQueries.push(url.search);
      return new Response(null, { status: 200, headers: { "content-range": `*/${opts.files}` } });
    }
    if (path === "rpc/send_task_to_owner_item") {
      if (String(body._note ?? "").trim()) sends.push(body);
      return json({ sent: true, review_id: "review-1", completed: true });
    }
    return json({ message: `unexpected request ${path}` }, 500);
  };
  return { client: new SupabaseShapedClient("https://example.test", fetchImpl as typeof fetch), sends, fileQueries };
}

const payload = () =>
  sendTaskToOwnerInput.parse({ taskId: TASK, note: "Please review the cost projections attached here.", version: "", documentIds: [], respondBy: null });

describe("39 Needs a file before sending: the server refuses", () => {
  it("refuses Send to the homeowner with the same line when the Task has no file, and sends nothing", async () => {
    const b = backend({ requireFile: true, files: 0 });
    await expect(sendTaskToOwner(b.client as never, ADMIN, payload())).rejects.toThrow("Attach the file first.");
    expect(b.sends).toHaveLength(0);
    // Counts only this Task's stored, live files.
    expect(b.fileQueries[0]).toContain("entity_type=eq.onboarding_task");
    expect(b.fileQueries[0]).toContain(`entity_id=eq.${TASK}`);
    expect(b.fileQueries[0]).toContain("upload_status=eq.stored");
    expect(b.fileQueries[0]).toContain("archived_at=is.null");
  });
  it("sends once the Task has a file", async () => {
    const b = backend({ requireFile: true, files: 1 });
    expect(await sendTaskToOwner(b.client as never, ADMIN, payload())).toMatchObject({ ok: true, completed: true });
    expect(b.sends).toHaveLength(1);
  });
  it("sends as before when the step does not need a file", async () => {
    const b = backend({ requireFile: false, files: 0 });
    expect(await sendTaskToOwner(b.client as never, ADMIN, payload())).toMatchObject({ ok: true });
    expect(b.fileQueries).toHaveLength(0);
  });
  it("refuses a Send email from the Task the same way; vendor requests and other records are not held", async () => {
    const b = backend({ requireFile: true, files: 0 });
    await expect(taskEmailFileGate(b.client as never, { context: "onboarding_task", recordId: TASK })).rejects.toThrow("Attach the file first.");
    expect(await taskEmailFileGate(b.client as never, { context: "onboarding_task", recordId: TASK, vendorOrgId: HOME })).toBe(undefined);
    expect(await taskEmailFileGate(b.client as never, { context: "ticket", recordId: TASK })).toBe(undefined);
    const ok = backend({ requireFile: true, files: 2 });
    expect(await taskEmailFileGate(ok.client as never, { context: "onboarding_task", recordId: TASK })).toBe(undefined);
  });
});

describe("40 Owner Type and Status line", () => {
  it("leaves out a value already shown as a chip, and the line goes when nothing is left", () => {
    expect(headerFactsLine({ ownerType: "Active Owner", status: null, chips: ["Design", "Active Owner", "On track"] })).toBeNull();
    expect(headerFactsLine({ ownerType: "Active Owner", status: "Waiting for Design", chips: ["Active Owner"] })).toBe("Status: Waiting for Design");
  });
  it("shows nothing for a value not set, never Not set", () => {
    expect(headerFactsLine({ ownerType: "Standard DFY", status: "", chips: [] })).toBe("Owner Type: Standard DFY");
    expect(headerFactsLine({ ownerType: null, status: null, chips: [] })).toBeNull();
  });
});
