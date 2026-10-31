import { describe, expect, it } from "bun:test";
import { syncHomeFollowUp } from "../owner-followups.server";

type Row = Record<string, unknown>;
function fakeDb(opts: { tasks?: Row[]; project?: Row | null; seat?: string; cover?: string | null; missing?: boolean }) {
  const inserts: { table: string; row: Row }[] = [];
  const db = {
    rpc: async (name: string) => {
      if (name === "seat_holder") return { data: opts.seat ?? "seat-holder", error: null };
      return { data: opts.cover ? [{ kind: "cover", user_id: opts.cover }] : [], error: null };
    },
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const k of ["select", "eq", "order", "limit", "is"]) q[k] = () => q;
      q.maybeSingle = async () => ({ data: opts.project ?? null, error: null });
      q.insert = (row: Row) => {
        inserts.push({ table, row });
        const r = { select: () => r, single: async () => ({ data: { id: "task-1" }, error: null }),
          then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res) };
        return r;
      };
      q.then = (res: (v: unknown) => unknown) =>
        Promise.resolve(opts.missing ? { data: null, error: { code: "PGRST205" } } : { data: opts.tasks ?? [], error: null }).then(res);
      return q;
    },
  };
  return { db, inserts };
}
const items = [{ id: "r", source: "review" as const, status: "awaiting_owner", respondBy: "2026-10-01" }];
const home = { programId: "p", propertyId: "h", ownerName: "Matt", isDemo: false, items };
const now = new Date("2026-10-31T16:00:00Z");

describe("owner follow-up sync", () => {
  it("onboarding home notifies its Project Manager once, in-app only", async () => {
    const { db, inserts } = fakeDb({ project: { project_manager: "pm", director: "dir", ops_accepted_at: null, status: "active" } });
    const r = await syncHomeFollowUp(db as never, home, now);
    expect(r).toMatchObject({ action: "create", assignee: "pm" });
    const note = inserts.find((i) => i.table === "staff_notifications")!.row;
    expect(note.email_status).toBe("skipped");
    expect(note.link_path).toBe("/property/h#active-owner");
    expect(inserts.filter((i) => i.table === "owner_followup_tasks")).toHaveLength(1);
  });
  it("after handoff uses the cover when one is active", async () => {
    const { db } = fakeDb({ project: { project_manager: "pm", director: null, ops_accepted_at: "2026-10-01", status: "active" }, cover: "cover" });
    expect(await syncHomeFollowUp(db as never, home, now)).toMatchObject({ assignee: "cover", reason: "followup_cover" });
  });
  it("no duplicate while one is open", async () => {
    const { db, inserts } = fakeDb({ tasks: [{ status: "open", closed_at: null }] });
    expect((await syncHomeFollowUp(db as never, home, now)).action).toBe("keep");
    expect(inserts).toHaveLength(0);
  });
  it("archived items create nothing", async () => {
    const { db, inserts } = fakeDb({});
    await syncHomeFollowUp(db as never, { ...home, items: [{ ...items[0]!, archivedAt: "2026-10-29" }] }, now);
    expect(inserts).toHaveLength(0);
  });
  it("does nothing before the staged table exists", async () => {
    const { db, inserts } = fakeDb({ missing: true });
    expect((await syncHomeFollowUp(db as never, home, now)).action).toBe("not_ready");
    expect(inserts).toHaveLength(0);
  });
});
