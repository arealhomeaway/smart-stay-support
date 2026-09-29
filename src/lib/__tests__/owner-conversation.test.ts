import { expect, it } from "bun:test";
import { buildThread, conversationState } from "../owner-conversation";

const msg = (id: string, author_type: string, at: string, event: string | null = null) => ({ id, author_type, author_name: author_type, body: id, event, created_at: at });

it("derives who acts next from the last non-system message and never drops history", () => {
  const legacy = [{ kind: "feedback", decision: null, text: "Builder warranty", at: "2026-09-25T19:00:00Z", by: "Victor" }];
  expect(conversationState("open", buildThread([], []))).toBe("waiting_on_homeowner");
  expect(conversationState("open", buildThread(legacy, []))).toBe("staff_action");
  const t1 = buildThread(legacy, [msg("s1", "staff", "2026-09-26T00:00:00Z")]);
  expect(conversationState("open", t1)).toBe("waiting_on_homeowner");
  const t2 = buildThread(legacy, [msg("s1", "staff", "2026-09-26T00:00:00Z"), msg("h1", "homeowner", "2026-09-27T00:00:00Z")]);
  expect(conversationState("open", t2)).toBe("staff_action");
  const t3 = buildThread(legacy, [msg("s1", "staff", "2026-09-26T00:00:00Z"), msg("x", "system", "2026-09-28T00:00:00Z", "resolved")]);
  expect(conversationState("complete", t3)).toBe("resolved");
  const t4 = buildThread(legacy, [msg("s1", "staff", "2026-09-26T00:00:00Z"), msg("x", "system", "2026-09-28T00:00:00Z", "resolved"), msg("y", "system", "2026-09-29T00:00:00Z", "reopened")]);
  expect(conversationState("open", t4)).toBe("waiting_on_homeowner");
  expect(t4.map((e) => e.id)).toEqual(["r0", "s1", "x", "y"]);
});
