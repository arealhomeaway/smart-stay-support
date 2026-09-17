import { expect, it } from "bun:test";
import { ownerReviewFixture } from "./owner-program-reader-fixture";
import {
  parseOwnerParticipation,
  readOwnerParticipation,
} from "../owner-participation-reader.server";

it("excludes staff context and unknown future columns at the owner transport boundary", () => {
  const review = parseOwnerParticipation(
    "reviews",
    ownerReviewFixture({ staff_context: "SECRET", internal_email: "SECRET" }),
  );
  expect(review.staff_context).toBe(null);
  expect(JSON.stringify(review).includes("SECRET")).toBe(false);
  const badge = parseOwnerParticipation("badges", {
    code: "first_step",
    awarded_at: "2026-01-02",
    trigger_rule: "Recorded activity",
    needs_review: false,
    supporting: "SECRET",
    review_note: "SECRET",
  });
  expect(JSON.stringify(badge).includes("SECRET")).toBe(false);
  const alert = parseOwnerParticipation("alerts", {
    id: "alert",
    kind: "ticket_opened",
    priority: "p3",
    ticket_id: null,
    review_id: null,
    read_at: null,
    created_at: "2026-01-02",
    title: "Property update",
    body: "Review current details",
    email_error: "SECRET",
    action_path: "SECRET",
  });
  expect(JSON.stringify(alert).includes("SECRET")).toBe(false);
});

it("loads every projected record under a smaller backend cap with an exact count", async () => {
  const all = Array.from({ length: 505 }, (_, i) => ({
    id: String(i),
    item: ownerReviewFixture({ id: String(i) }),
  }));
  const offsets: number[] = [];
  const db = {
    rpc(name: string, args: unknown, options: unknown) {
      expect(name).toBe("read_owner_participation");
      expect(args).toEqual({ _section: "reviews", _program_id: "program", _preview: false });
      expect(options).toEqual({ count: "exact" });
      const q = {
        order: () => q,
        range: async (from: number) => {
          offsets.push(from);
          return { data: all.slice(from, from + 100), count: all.length, error: null };
        },
      };
      return q;
    },
  };
  expect((await readOwnerParticipation(db as never, "reviews", "program")).data.length).toBe(505);
  expect(offsets).toEqual([0, 100, 200, 300, 400, 500]);
});
