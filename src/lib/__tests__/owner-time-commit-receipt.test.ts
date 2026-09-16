import { expect, it } from "bun:test";
import { logOwnerTime } from "../owner-portal.server";
import { recordTimeCorrection } from "../owner-program.server";

it("returns the committed time receipt without fallible follow-up writes or reads", async () => {
  let committed = false;
  const db = {
    from(table: string) {
      if (committed) throw new Error("Read service became unavailable after commit");
      const row =
        table === "owner_reviews"
          ? { id: "opportunity", property_id: null, status: "returned", task_type: "program_wide" }
          : table === "owner_programs"
            ? { owner_user_id: "owner", status: "active", started_on: "2026-01-01" }
            : [];
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: row, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve(resolve({ data: row, error: null })),
      };
      return query;
    },
    async rpc(
      name: string,
      args: { _entry: { confirmed: boolean; phase: string; ownerUpdateRevision: number } },
    ) {
      expect(name).toBe("log_owner_time_entry");
      expect(args._entry.confirmed).toBe(true);
      expect(args._entry.phase).toBe("onboarding");
      expect(args._entry.ownerUpdateRevision).toBe(3);
      committed = true;
      return { data: "committed-entry", error: null };
    },
  };
  const result = await logOwnerTime(db as never, "owner", {
    programId: "program",
    phase: "onboarding",
    entryDate: "2026-01-01",
    minutes: 25,
    activity: "Reviewed plan",
    activityCategory: "planning",
    output: "Read revision 3",
    comments: "",
    attachmentPath: null,
    reviewId: "opportunity",
    ticketId: null,
    propertyIds: [],
    confirmed: true,
    ownerUpdateRevision: 3,
  });
  expect(result).toEqual({ ok: true, entryId: "committed-entry", awarded: [] });
});

it("returns the committed correction receipt even if the next aggregate read would fail", async () => {
  let committed = false;
  const db = {
    from() {
      if (committed) throw new Error("Aggregate unavailable after commit");
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: { id: "original", program_id: "program" }, error: null }),
      };
      return query;
    },
  };
  const admin = {
    async rpc(name: string, args: { _entry_id: string; _actor_id: string }) {
      expect(name).toBe("correct_owner_time_entry");
      expect(args._entry_id).toBe("original");
      expect(args._actor_id).toBe("supervisor");
      committed = true;
      return { data: "correction", error: null };
    },
  };
  expect(
    await recordTimeCorrection(
      db as never,
      "supervisor",
      {
        entryId: "original",
        minutes: 20,
        reason: "Corrected actual minutes",
      },
      admin as never,
    ),
  ).toEqual({ ok: true, entryId: "correction" });
});
