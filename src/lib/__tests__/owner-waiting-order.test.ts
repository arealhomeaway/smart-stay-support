import { describe, expect, it } from "bun:test";
import { WaitingOrderDraft, sentStaffOrder, savedWaitingOrder } from "../owner-waiting-order";
import type { OwnerTabItem } from "../onboarding-cleanup";
const item = (id: string, kind: "request" | "review" = "request"): OwnerTabItem => ({ id, kind, title: id, status: "sent", sentAt: null, completedAt: null, ownerAt: null, staffAt: null, activity: "" });
describe("waiting Opportunity order", () => {
  it("Save sends one complete order and the waiting list reads it back", async () => {
    const draft = new WaitingOrderDraft(["a", "b"], true); draft.move(1, 0);
    const calls: string[][] = [];
    const saved = await draft.save(["a", "attention", "b"], async ids => { calls.push(ids); });
    expect(calls).toEqual([["b", "attention", "a"]]);
    expect(savedWaitingOrder([item("a"), item("b")], saved).map(i => i.id)).toEqual(["b", "a"]);
  });
  it("Cancel restores the previous order without a write", () => {
    const draft = new WaitingOrderDraft(["a", "b", "c"], true); draft.move(2, 0); draft.cancel();
    expect(draft.ids).toEqual(["a", "b", "c"]);
  });
  it("up/down moves stay bounded and are the same action used by keyboard controls", () => {
    const draft = new WaitingOrderDraft(["a", "b", "c"], true); draft.move(1, 0);
    expect(draft.ids).toEqual(["b", "a", "c"]); draft.move(0, 1);
    expect(draft.ids).toEqual(["a", "b", "c"]); draft.move(0, -1); draft.move(2, 3);
    expect(draft.ids).toEqual(["a", "b", "c"]);
  });
  it("read-only users cannot move or save", async () => {
    let writes = 0; const draft = new WaitingOrderDraft(["a", "b"], false); draft.move(0, 1);
    expect(draft.ids).toEqual(["a", "b"]);
    await expect(draft.save(["a", "b"], async () => { writes++; })).rejects.toThrow("permission"); expect(writes).toBe(0);
  });
  it("failed saves keep the edits for another attempt", async () => {
    const draft = new WaitingOrderDraft(["a", "b"], true); draft.move(0, 1);
    await expect(draft.save(["a", "b"], async () => { throw new Error("Denied"); })).rejects.toThrow("Denied");
    expect(draft.ids).toEqual(["b", "a"]);
  });
  it("released activities and Library items stay after staff items in their original order", () => {
    expect(savedWaitingOrder([item("review", "review"), item("library"), item("a"), item("b")], ["b", "a"]).map(i => i.id)).toEqual(["b", "a", "review", "library"]);
  });
  it("saved homeowner priority beats creation date; nonstaff and unsent records are excluded", () => {
    const base = { source: "arha", status: "sent", sent_at: null, created_at: "2026-10-01" };
    expect(sentStaffOrder([{ ...base, id: "a", owner_priority: 2 }, { ...base, id: "b", owner_priority: 1, created_at: "2026-10-28" }, { ...base, id: "draft", status: "draft", owner_priority: 0 }, { ...base, id: "library", source: "library", owner_priority: 0 }]).map(o => o.id)).toEqual(["b", "a"]);
  });
});