// Nov 12 small fix batch, items 1 to 3. Values come from the approved request.
import { describe, expect, it } from "bun:test";
import { PostgrestClient } from "@supabase/postgrest-js";
import { ownerItemApproval } from "../owner-item-approval";
import { boardGroup, boardView, type BoardItem } from "../owner-opportunity-board";
import { kindSettings, outsideOwnerMessage } from "../onboarding-task-kinds";

/** Shaped like supabase-js SupabaseClient: rpc() reads `this.rest`. */
class SupabaseShapedClient {
  rest: PostgrestClient;
  calls: { fn: string; body: unknown }[] = [];
  constructor() {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const fn = String(input).split("/rpc/")[1]!.split("?")[0]!;
      this.calls.push({ fn, body: JSON.parse(String(init?.body ?? "{}")) });
      const body = fn === "owner_item_is_approval" ? true : { approved: true };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    };
    this.rest = new PostgrestClient("http://db.test/rest/v1", { fetch: fetchImpl as typeof fetch });
  }
  rpc(fn: string, args: Record<string, unknown> = {}) {
    return this.rest.rpc(fn, args);
  }
}
const REVIEW = "fa6e3a8c-48fb-4371-b6d5-8dd6d9e29d6d";

describe("item 1: Approve and Ask a question reach the homeowner's panel", () => {
  it("a detached rpc loses its connection (the cause of the hidden buttons)", async () => {
    const client = new SupabaseShapedClient();
    const detached = client.rpc as unknown as (fn: string, a: Record<string, unknown>) => Promise<unknown>;
    expect(() => detached("owner_item_is_approval", { _review_id: REVIEW })).toThrow("rest");
  });
  it("the panel's check asks the database and reads true for an approval item", async () => {
    const client = new SupabaseShapedClient();
    expect(await ownerItemApproval(client).isApproval(REVIEW)).toBe(true);
    expect(client.calls).toEqual([{ fn: "owner_item_is_approval", body: { _review_id: REVIEW } }]);
  });
  it("pressing Approve records it through owner_item_approve", async () => {
    const client = new SupabaseShapedClient();
    await ownerItemApproval(client).approve(REVIEW);
    expect(client.calls).toEqual([{ fn: "owner_item_approve", body: { _review_id: REVIEW } }]);
  });
  it("a refused approval reports the database's reason", async () => {
    const client = { rpc: async () => ({ data: null, error: { message: "This item does not ask for an approval." } }) };
    await expect(ownerItemApproval(client).approve(REVIEW)).rejects.toThrow("This item does not ask for an approval.");
  });
});

describe("item 2: With ARHA shows in every tab", () => {
  const item = (o: Partial<BoardItem>): BoardItem => ({
    key: o.id ?? "x", source: "review", id: "x", title: "T", propertyIds: [], from: "", summary: "", cover: "",
    sentAt: null, answerBy: null, deadline: null, needsAnswer: false, newReply: false, optional: false, locked: false, finished: false, ...o,
  });
  const items = [
    item({ id: "answered", propertyIds: ["h1"], needsAnswer: true, withArha: true }),
    item({ id: "waiting", propertyIds: ["h2"], needsAnswer: true }),
  ];
  it("an owner answer with no staff reply sits in With ARHA", () => {
    expect(boardGroup(items[0]!)).toBe("with_arha");
  });
  it("All homes: just what needs you shows With ARHA too", () => {
    const v = boardView(items, "all");
    expect(v.answer.map((i) => i.id)).toEqual(["waiting"]);
    expect(v.with_arha.map((i) => i.id)).toEqual(["answered"]);
  });
  it("a single home's tab and a one-home owner both show it", () => {
    expect(boardView(items, "h1").with_arha.map((i) => i.id)).toEqual(["answered"]);
    expect(boardView(items, null).with_arha.map((i) => i.id)).toEqual(["answered"]);
    expect(boardView(items, "h2").with_arha).toEqual([]);
  });
  it("a staff reply moves it back to Needs your answer", () => {
    expect(boardGroup(item({ needsAnswer: true, withArha: true, newReply: true }))).toBe("answer");
  });
});

describe("item 3: Done outside Resolve owner wording", () => {
  it("default wording with the document name and place, live program", () => {
    expect(outsideOwnerMessage({ where: "docusign", documentName: "management agreement", liveProgram: true })).toBe(
      "Your management agreement was sent to you through DocuSign. Please check your email, then review and sign it. Once it's signed, come back here and log your time.",
    );
  });
  it("the log time sentence shows only with a live Active Owner program", () => {
    expect(outsideOwnerMessage({ where: "houzz_pro", documentName: "design proposal", liveProgram: false })).toBe(
      "Your design proposal was sent to you through Houzz Pro. Please check your email, then review and sign it.",
    );
  });
  it("the document name falls back to document", () => {
    expect(outsideOwnerMessage({ where: "quickbooks", documentName: "  ", liveProgram: false })).toBe(
      "Your document was sent to you through QuickBooks. Please check your email, then review and sign it.",
    );
  });
  it("a filled Owner message replaces the default, with the same fill-ins", () => {
    expect(outsideOwnerMessage({ where: "docusign", documentName: "lease", ownerMessage: "Sign the [document] in {where} today.", liveProgram: true })).toBe(
      "Sign the lease in DocuSign today.",
    );
  });
  it("Document name and Owner message are kept on the step settings", () => {
    expect(kindSettings({ where: "docusign", documentName: " W-9 ", ownerMessage: " Sign the [document]. " })).toEqual({
      where: "docusign", documentName: "W-9", ownerMessage: "Sign the [document].",
    });
    expect(kindSettings({ documentName: "", ownerMessage: "" })).toEqual({});
  });
});
