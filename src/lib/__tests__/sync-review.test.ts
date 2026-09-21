import { describe, expect, it as test } from "bun:test";
import {
  classifyEvent,
  detectDrift,
  driftKey,
  heldConflict,
  needsReview,
  sourceLabel,
  type MirrorSide,
} from "@/lib/sync-review";

const mirror = (over: Partial<MirrorSide> = {}): MirrorSide => ({
  taskId: 101,
  name: "Fix sink",
  status: "in_progress",
  stage: null,
  scheduledDate: "2026-03-04",
  propertyId: "p1",
  linkedTicketId: "t1",
  updatedAt: null,
  ...over,
});

describe("event classification", () => {
  test("unknown home is unplaced, not a failure", () => {
    expect(classifyEvent("ignored_other_property").bucket).toBe("unplaced");
  });

  test("a failed lookup can be tried again", () => {
    expect(classifyEvent("verify_failed").retryable).toBe(true);
  });

  test("duplicates and applied updates need no review", () => {
    expect(needsReview("duplicate")).toBe(false);
    expect(needsReview("processed")).toBe(false);
    expect(needsReview("verify_failed")).toBe(true);
  });

  test("an outcome we do not know is surfaced rather than hidden", () => {
    expect(needsReview("something_new")).toBe(true);
  });
});

describe("drift detection", () => {
  test("finished there, open here", () => {
    const items = detectDrift(mirror({ status: "completed" }), {
      ticketId: "t1",
      status: "in_progress",
      scheduledDate: "2026-03-04",
    });
    expect(items.map((i) => i.kind)).toEqual(["finished_there_open_here"]);
  });

  test("closed here, open there", () => {
    const items = detectDrift(mirror({ status: "in_progress" }), {
      ticketId: "t1",
      status: "closed",
      scheduledDate: "2026-03-04",
    });
    expect(items.map((i) => i.kind)).toEqual(["closed_here_open_there"]);
  });

  test("different day in each system", () => {
    const items = detectDrift(mirror(), {
      ticketId: "t1",
      status: "in_progress",
      scheduledDate: "2026-03-06",
    });
    expect(items[0]?.kind).toBe("date_differs");
    expect(items[0]?.resolveValue).toBe("2026-03-06");
    expect(items[0]?.externalValue).toBe("2026-03-04");
  });

  test("a live job with no ticket is flagged; a finished one is not", () => {
    expect(detectDrift(mirror({ linkedTicketId: null }), null)[0]?.kind).toBe("unlinked");
    expect(detectDrift(mirror({ linkedTicketId: null, status: "completed" }), null)).toEqual([]);
  });

  test("agreement produces nothing", () => {
    expect(
      detectDrift(mirror({ status: "completed" }), {
        ticketId: "t1",
        status: "resolved",
        scheduledDate: "2026-03-04",
      }),
    ).toEqual([]);
  });
});

describe("held conflicts", () => {
  test("a difference is always recorded open, never auto-applied", () => {
    const item = detectDrift(mirror({ status: "completed" }), {
      ticketId: "t1",
      status: "in_progress",
      scheduledDate: null,
    })[0]!;
    const held = heldConflict(item);
    expect(held.status).toBe("open");
    expect(held.system).toBe("breezeway");
    expect(held.field_key).toBe(driftKey(item));
    expect(held.resolve_value).toBe("in_progress");
    expect(held.external_value).toBe("completed");
  });

  test("the key is stable for the same job and field", () => {
    expect(driftKey({ taskId: 7, field: "status" } as never)).toBe("breezeway_task:7:status");
  });

  test("source labels read plainly", () => {
    expect(sourceLabel("breezeway")).toBe("Take the Breezeway value");
    expect(sourceLabel(null)).toBe("Not decided");
  });
});
