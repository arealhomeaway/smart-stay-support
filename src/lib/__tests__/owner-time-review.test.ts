import { describe, expect, it } from "bun:test";
import { loadTimeReviewQueue, reviewTimeEntry } from "../owner-review.server";
import {
  captureOwnerTimeReview,
  ownerTimeReviewChanged,
  ownerTimeReviewInput,
  type TimeReviewRow,
} from "../owner-time-review";

function entry(): TimeReviewRow {
  return {
    id: "entry",
    programId: "program",
    ownerName: "Owner",
    entryDate: "2026-09-10",
    minutes: 60,
    phase: "ongoing",
    activity: "Reviewed repair results",
    activityCategory: "maintenance",
    output: "Read the completed repair report",
    reviewStatus: "submitted",
    reviewNote: null,
    reviewedAt: null,
    reviewVersion: "displayed-version",
    flagged: false,
    propertyNames: ["Lake home", "Hill home"],
    createdAt: "2026-09-10T15:00:00Z",
  };
}

async function failure(result: Promise<unknown>) {
  return result.then(
    () => "unexpected success",
    (error: Error) => error.message,
  );
}

describe("versioned participation review", () => {
  it("retains the entry, decision and note when background data changes", () => {
    const displayed = entry();
    const draft = captureOwnerTimeReview(displayed, "returned", "Please explain the outcome.");
    displayed.reviewVersion = "changed-version";
    displayed.reviewStatus = "flagged";
    displayed.reviewNote = "Another reviewer needs clarification";
    displayed.minutes = 90;
    displayed.propertyNames[0] = "Renamed home";
    expect(draft.entry.reviewVersion).toBe("displayed-version");
    expect(draft.entry.minutes).toBe(60);
    expect(draft.entry.propertyNames).toEqual(["Lake home", "Hill home"]);
    expect(draft.entry.reviewNote).toBe(null);
    expect(draft.decision).toBe("returned");
    expect(draft.note).toBe("Please explain the outcome.");
    expect(ownerTimeReviewChanged(draft, displayed)).toBe(true);
  });

  it("requires explicit rereview for changed context even if a Property rename keeps the entry version", () => {
    const current = entry();
    const draft = captureOwnerTimeReview(current, "flagged", "Retained reason");
    current.propertyNames = ["Renamed home", "Hill home"];
    expect(ownerTimeReviewChanged(draft, current)).toBe(true);
    const reviewed = captureOwnerTimeReview(current, draft.decision, draft.note);
    expect(ownerTimeReviewChanged(reviewed, current)).toBe(false);
    expect(reviewed.note).toBe("Retained reason");
    expect(reviewed.decision).toBe("flagged");
    expect(draft.entry.propertyNames).toEqual(["Lake home", "Hill home"]);
  });

  it("detects a disappeared or differently reviewed entry but tolerates link-order-only refreshes", () => {
    const current = entry();
    const draft = captureOwnerTimeReview(current);
    expect(ownerTimeReviewChanged(draft, undefined)).toBe(true);
    expect(ownerTimeReviewChanged(draft, { ...current, reviewVersion: "new-version" })).toBe(true);
    expect(
      ownerTimeReviewChanged(draft, { ...current, propertyNames: ["Hill home", "Lake home"] }),
    ).toBe(false);
  });

  it("forwards the exact displayed version to one atomic RPC without fresh reads or separate history writes", async () => {
    const calls: unknown[] = [];
    const db = {
      from: () => {
        throw new Error("Unexpected direct table access");
      },
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data: "entry", error: null };
      },
    };
    const input = ownerTimeReviewInput(
      captureOwnerTimeReview(entry(), "approved", " Reviewed carefully "),
    );
    expect(await reviewTimeEntry(db as never, "reviewer", input)).toEqual({ ok: true });
    expect(calls).toEqual([
      {
        name: "review_owner_time_entry",
        args: {
          _entry_id: "entry",
          _expected_version: "displayed-version",
          _decision: "approved",
          _note: "Reviewed carefully",
        },
      },
    ]);
  });

  it("does not retry stale, authorization or atomic-history errors or alter a draft", async () => {
    for (const message of [
      "The entry changed",
      "Only a supervisor can review",
      "History insert failed",
    ]) {
      let calls = 0;
      const draft = captureOwnerTimeReview(entry(), "returned", "Please clarify the result");
      const db = {
        from: () => {
          throw new Error("Unexpected direct table access");
        },
        rpc: async () => {
          calls++;
          return { data: null, error: new Error(message) };
        },
      };
      expect(
        await failure(reviewTimeEntry(db as never, "reviewer", ownerTimeReviewInput(draft))),
      ).toBe(message);
      expect(calls).toBe(1);
      expect(draft.entry.reviewVersion).toBe("displayed-version");
      expect(draft.note).toBe("Please clarify the result");
      expect(draft.decision).toBe("returned");
    }
  });

  it("rejects absent or mismatched receipts without reporting a successful decision", async () => {
    for (const data of [null, "another-entry"]) {
      const db = { rpc: async () => ({ data, error: null }) };
      expect(
        await failure(
          reviewTimeEntry(
            db as never,
            "reviewer",
            ownerTimeReviewInput(captureOwnerTimeReview(entry())),
          ),
        ),
      ).toContain("could not be recorded");
    }
  });

  it("requires the displayed version and a reason for return/flag before calling the writer", async () => {
    const db = {
      rpc: async () => {
        throw new Error("Unexpected write");
      },
    };
    const input = ownerTimeReviewInput(captureOwnerTimeReview(entry()));
    expect(
      await failure(reviewTimeEntry(db as never, "reviewer", { ...input, expectedVersion: "" })),
    ).toContain("current entry");
    for (const decision of ["returned", "flagged"] as const) {
      expect(
        await failure(
          reviewTimeEntry(db as never, "reviewer", { ...input, decision, note: "   " }),
        ),
      ).toContain("requires a reason");
    }
  });

  it("loads the stored review version into the displayed review queue", async () => {
    const selected: string[] = [];
    const db = {
      from: (table: string) => {
        const values =
          table === "owner_time_entries"
            ? [
                {
                  id: "entry",
                  program_id: "program",
                  entry_date: "2026-09-10",
                  minutes: 60,
                  phase: "ongoing",
                  activity: "Reviewed repair results",
                  activity_category: "maintenance",
                  output: "Read the repair report",
                  review_status: "submitted",
                  review_note: null,
                  reviewed_at: null,
                  review_version: "stored-version",
                  flagged: false,
                  created_at: "2026-09-10T15:00:00Z",
                },
              ]
            : table === "owner_programs"
              ? [{ id: "program", owner_name: "Owner" }]
              : [
                  {
                    entry_id: "entry",
                    property_id: "home",
                    properties: { name: "Lake home", nickname: null },
                  },
                ];
        const query = {
          select: (columns: string) => {
            if (table === "owner_time_entries") selected.push(columns);
            return query;
          },
          eq: () => query,
          order: () => query,
          in: () => query,
          limit: () => query,
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: values, error: null }).then(resolve),
        };
        return query;
      },
    };
    const rows = await loadTimeReviewQueue(db as never);
    expect(selected[0]).toContain("review_version");
    expect(rows.length).toBe(1);
    expect(rows[0]?.reviewVersion).toBe("stored-version");
    expect(rows[0]?.propertyNames).toEqual(["Lake home"]);
  });
});
