import { expect, it } from "bun:test";
import { compareArhaPriority } from "../v2-workflow.functions";

const o = (id: string, p: number | null, sent: string) => ({ id, owner_priority: p, sent_at: sent, created_at: sent });

it("appends new ARHA Opportunities to the bottom and keeps the curated order", () => {
  const A = o("A", 1, "2026-09-01"), B = o("B", 3, "2026-09-02"), C = o("C", 4, "2026-09-03");
  const D = o("D", 2, "2026-09-04"); // dragged between A and B
  const E = o("E", null, "2026-09-05");
  const F = o("F", null, "2026-09-06");
  expect([F, E, C, B, D, A].sort(compareArhaPriority).map((x) => x.id)).toEqual(["A", "D", "B", "C", "E", "F"]);
  expect([o("D", null, "2026-09-04"), A, B, C].sort(compareArhaPriority).map((x) => x.id)).toEqual(["A", "B", "C", "D"]);
});
