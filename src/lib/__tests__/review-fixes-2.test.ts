import { describe, expect, it } from "bun:test";
import { behindItems, behindSince, endOfCentralDay, isCurrentOwnerItem, type OwnerItem } from "../owner-behind";
import { repairAlert, syncProgramFollowUps } from "../owner-followups.server";
import { contributionCount, fetchAllPages, filterContributions, isClocksFunctionMissing, runAoClocksGuarded, PAGE_SIZE } from "../ao-ui";

const now = new Date("2026-10-31T16:00:00Z");
const review = (o: Partial<OwnerItem>): OwnerItem => ({ id: "r", source: "review", status: "awaiting_owner", ...o });

describe("#2 owner-behind counts only items the owner can act on", () => {
  it("locked plan cards (prepared), drafts and scheduled items never count", () => {
    for (const status of ["prepared", "draft", "scheduled"])
      expect(isCurrentOwnerItem(review({ status, waitingSince: "2026-09-01T00:00:00Z" }), now)).toBe(false);
  });
  it("an item opening in the future is not counted yet", () => {
    expect(behindItems([review({ availableFrom: "2026-11-05T00:00:00Z", waitingSince: "2026-11-05T00:00:00Z" })], now)).toHaveLength(0);
  });
  it("waiting is measured from when the item opened, not creation", () => {
    // created long ago but unlocked 3 days ago: not behind
    expect(behindItems([review({ availableFrom: "2026-10-28T16:00:00Z", waitingSince: "2026-10-28T16:00:00Z" })], now)).toHaveLength(0);
    expect(behindItems([review({ availableFrom: "2026-10-20T16:00:00Z", waitingSince: "2026-10-20T16:00:00Z" })], now)).toHaveLength(1);
  });
});

describe("#7 respond-by goes overdue at the end of the due date in Central time", () => {
  it("CDT: Oct 30 ends at 05:00 UTC Oct 31", () => {
    expect(endOfCentralDay("2026-10-30").toISOString()).toBe("2026-10-31T05:00:00.000Z");
  });
  it("CST: Dec 1 ends at 06:00 UTC Dec 2", () => {
    expect(endOfCentralDay("2026-12-01").toISOString()).toBe("2026-12-02T06:00:00.000Z");
  });
  it("daylight saving end day (Nov 1, 2026) and start day (Mar 8, 2026)", () => {
    expect(endOfCentralDay("2026-11-01").toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(endOfCentralDay("2026-10-31").toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(endOfCentralDay("2026-03-08").toISOString()).toBe("2026-03-09T05:00:00.000Z");
    expect(endOfCentralDay("2026-03-07").toISOString()).toBe("2026-03-08T06:00:00.000Z");
  });
  it("not overdue at 7 pm Central on the due date; overdue just after midnight Central", () => {
    const item = review({ respondBy: "2026-10-30" });
    expect(behindItems([item], new Date("2026-10-31T00:00:00Z"))).toHaveLength(0);
    expect(behindItems([item], new Date("2026-10-31T05:00:01Z"))).toHaveLength(1);
    expect(behindSince(item, now)?.toISOString()).toBe("2026-10-31T05:00:00.000Z");
  });
});

function programDb(reviews: Record<string, unknown>[], homes: string[]) {
  const followups: string[] = [];
  const chain = (data: unknown) => {
    const q: Record<string, unknown> = {};
    for (const k of ["select", "eq", "order", "limit", "is"]) q[k] = () => q;
    q["single"] = async () => ({ data, error: null });
    q["maybeSingle"] = async () => ({ data: null, error: null });
    q["then"] = (res: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(res);
    return q;
  };
  return {
    followups,
    db: {
      rpc: async (n: string) => ({ data: n === "seat_holder" ? "seat" : [], error: null }),
      from: (t: string) => {
        if (t === "owner_programs") return chain({ owner_name: "Matt", is_demo: true });
        if (t === "owner_program_properties") return chain(homes.map((property_id) => ({ property_id })));
        if (t === "owner_reviews") return chain(reviews);
        if (t === "work_items") return chain([]);
        if (t === "onboarding_projects") return chain(null);
        if (t === "owner_followup_tasks") {
          const q = chain([]) as Record<string, unknown>;
          q["eq"] = (_c: string, v: string) => { followups.push(v); return q; };
          q["insert"] = (row: Record<string, unknown>) => { followups.push(`create:${row["property_id"]}`); return { select: () => ({ single: async () => ({ data: { id: "t" }, error: null }) }) }; };
          return q;
        }
        return { insert: async () => ({ error: null }) };
      },
    },
  };
}

describe("#6 follow-up home mapping", () => {
  const old = { status: "awaiting_owner", respond_by: "2026-10-01", available_from: null, created_at: "2026-09-01T00:00:00Z", archived_at: null };
  it("items with no home go to the first home", async () => {
    const { db, followups } = programDb([{ id: "a", property_id: null, ...old }], ["h1", "h2"]);
    await syncProgramFollowUps(db as never, "p", now);
    expect(followups).toContain("create:h1");
    expect(followups).not.toContain("create:h2");
  });
  it("items from a home no longer enrolled are skipped", async () => {
    const { db, followups } = programDb([{ id: "a", property_id: "gone", ...old }], ["h1", "h2"]);
    await syncProgramFollowUps(db as never, "p", now);
    expect(followups.filter((f) => f.startsWith("create:"))).toHaveLength(0);
  });
});

describe("#5 open follow-up with no alert gets it repaired", () => {
  const fake = (existing: unknown[]) => {
    const inserted: Record<string, unknown>[] = [];
    const q: Record<string, unknown> = {};
    for (const k of ["select", "eq", "limit"]) q[k] = () => q;
    q["then"] = (res: (v: unknown) => unknown) => Promise.resolve({ data: existing, error: null }).then(res);
    q["insert"] = async (row: Record<string, unknown>) => { inserted.push(row); return { error: null }; };
    return { db: { from: () => q }, inserted };
  };
  const task = { id: "t1", assigned_to: "u1", title: "Reach out", link_path: "/property/h#active-owner", no_project_manager: false };
  it("missing alert is created once, in-app only", async () => {
    const { db, inserted } = fake([]);
    expect(await repairAlert(db as never, task, false)).toBe(true);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ user_id: "u1", entity_id: "t1", entity_type: "owner_followup_task", email_status: "skipped" });
  });
  it("existing alert is left alone", async () => {
    const { db, inserted } = fake([{ id: "n" }]);
    expect(await repairAlert(db as never, task, false)).toBe(false);
    expect(inserted).toHaveLength(0);
  });
});

describe("#8 plan clock job guard", () => {
  it("skips only when ao_process_clocks itself is missing", async () => {
    expect(isClocksFunctionMissing({ code: "PGRST202", message: "Could not find the function public.ao_process_clocks without parameters in the schema cache" })).toBe(true);
    expect(isClocksFunctionMissing({ code: "42883", message: "function public.ao_process_clocks() does not exist" })).toBe(true);
    expect(await runAoClocksGuarded({ rpc: async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.ao_process_clocks" } }) } as never)).toEqual({ skipped: true });
  });
  it("a missing table or helper inside the clock is a job error", async () => {
    for (const error of [
      { code: "42P01", message: 'relation "public.ao_home_plan_cards" does not exist' },
      { code: "42883", message: "function private.ao_add_business_days(date, integer) does not exist" },
      { code: "P0001", message: "boom" },
    ]) {
      expect(isClocksFunctionMissing(error)).toBe(false);
      await expect(runAoClocksGuarded({ rpc: async () => ({ data: null, error }) } as never)).rejects.toThrow();
    }
  });
});

describe("#3 verify badge filter and #4 paging", () => {
  const rows = [
    { id: "1", planCardId: "pc1", card: "Paint", cardCode: "A01", home: "12 Oak", member: "Rachel", submittedAt: "2026-10-30T00:00:00Z", values: {} },
    { id: "2", planCardId: "pc2", card: "Paint", cardCode: "A01", home: "12 Oak", member: "Matt", submittedAt: "2026-10-30T00:00:00Z", values: {} },
  ];
  it("plan-card filter shows exactly that submission", () => {
    expect(filterContributions(rows, { card: "all", home: "all", from: "", to: "", q: "", planCard: "pc2" }).map((r) => r.id)).toEqual(["2"]);
  });
  it("reads every page past 2,000 rows", async () => {
    const total = 2 * PAGE_SIZE + 345;
    const r = await fetchAllPages<number>(async (from, to) => ({ data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i), error: null }));
    expect(r.available && r.data.length).toBe(total);
  });
  it("visible count", () => {
    expect(contributionCount(2345, 2345)).toBe("2345 answers");
    expect(contributionCount(1, 2345)).toBe("Showing 1 of 2345 answers");
  });
});
