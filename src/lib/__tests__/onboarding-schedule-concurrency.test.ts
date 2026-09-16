import { expect, it } from "bun:test";
import { applyScheduleRecalc } from "../onboarding-schedule.server";
import type { AuditEntry } from "../audit.server";

function database(change?: Record<string, unknown>, count = 1) {
  const original = Array.from({ length: count }, (_, index) => ({
    id: "task-" + index,
    property_id: "home",
    title: "Inspection " + index,
    stage: "phase1_inspection",
    status: "open",
    due_on: "2026-09-19",
    schedule_anchor: "planned_closing",
    schedule_offset_days: 2,
    due_on_overridden: false,
    updated_at: "2026-09-16T12:00:00Z",
    archived_at: null,
  }));
  const current = original.map((row, index) => ({
    ...row,
    ...(index === count - 1 ? change : {}),
  }));
  const writes: string[] = [];
  const db = {
    rpc: async () => ({ data: true, error: null }),
    from: (table: string) => {
      let patch: Record<string, unknown> | undefined;
      const matches: ((row: Record<string, unknown>) => boolean)[] = [];
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => {
          matches.push((row) => row[key] === value);
          return query;
        },
        neq: (key: string, value: unknown) => {
          matches.push((row) => row[key] !== value);
          return query;
        },
        is: (key: string, value: unknown) => {
          matches.push((row) => row[key] === value);
          return query;
        },
        update: (value: Record<string, unknown>) => {
          patch = value;
          return query;
        },
        single: async () => ({
          data: {
            planned_closing_on: "2026-09-20",
            actual_closing_on: null,
            actual_access_on: null,
          },
          error: null,
        }),
        order: async () => ({ data: original, error: null }),
        maybeSingle: async () => {
          if (table !== "onboarding_tasks" || !patch) throw new Error("Unexpected write");
          const row = current.find((candidate) => matches.every((match) => match(candidate)));
          if (row) {
            Object.assign(row, patch);
            writes.push(row.id);
          }
          return { data: row ? { id: row.id } : null, error: null };
        },
      };
      return query;
    },
  };
  return { db, current, writes };
}

it("recalculation preserves task completion, manual overrides, archive and concurrent versions", async () => {
  for (const change of [
    { status: "complete" },
    { due_on_overridden: true },
    { archived_at: "2026-09-16T12:01:00Z" },
    { updated_at: "2026-09-16T12:01:00Z", due_on: "2026-09-28" },
    { property_id: "another-home" },
  ]) {
    const { db, current, writes } = database(change);
    const audit: AuditEntry[] = [];
    const message = await applyScheduleRecalc(
      db as never,
      "pm",
      { propertyId: "home", taskIds: ["task-0"] },
      async (entry) => {
        audit.push(entry);
      },
    ).then(
      () => "unsafe",
      (error: Error) => error.message,
    );
    expect(message).toContain("changed while dates were recalculated");
    expect(writes).toEqual([]);
    expect(audit).toEqual([]);
    expect(current[0]!.due_on).toBe(change.due_on ?? "2026-09-19");
  }
});

it("recalculation writes and records only the unchanged selected task", async () => {
  const { db, current, writes } = database();
  const audit: AuditEntry[] = [];
  expect(
    await applyScheduleRecalc(
      db as never,
      "pm",
      { propertyId: "home", taskIds: ["task-0"] },
      async (entry) => {
        audit.push(entry);
      },
    ),
  ).toEqual({ ok: true, applied: 1 });
  expect(current[0]!.due_on).toBe("2026-09-22");
  expect(writes).toEqual(["task-0"]);
  expect(audit[0]!.after).toEqual({
    applied: [{ taskId: "task-0", from: "2026-09-19", to: "2026-09-22" }],
  });
});

it("a later conflict retains an accurate audit for dates already saved", async () => {
  const { db, writes } = database({ status: "complete" }, 2);
  const audit: AuditEntry[] = [];
  const message = await applyScheduleRecalc(
    db as never,
    "pm",
    { propertyId: "home", taskIds: ["task-0", "task-1"] },
    async (entry) => {
      audit.push(entry);
    },
  ).then(
    () => "unsafe",
    (error: Error) => error.message,
  );
  expect(message).toContain("1 earlier date changes were saved and recorded");
  expect(writes).toEqual(["task-0"]);
  expect(audit[0]!.after).toEqual({
    applied: [{ taskId: "task-0", from: "2026-09-19", to: "2026-09-22" }],
  });
});
