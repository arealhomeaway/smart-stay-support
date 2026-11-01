import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  dayBucket,
  entrySummary,
  groupFeed,
  notificationLink,
  PAGE_SIZE,
  type FeedRow,
} from "@/lib/notification-feed";
import { markAllUnread, readUnreadKinds } from "@/lib/notification-feed-data";

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const P = U(900);
const row = (o: Partial<FeedRow>): FeedRow => ({
  id: U(Math.floor(Math.random() * 1e9)),
  kind: "ticket_assigned",
  title: "T",
  body: "Item · 1399 Foxtail Ln",
  link_path: null,
  priority: "normal",
  read_at: null,
  created_at: "2026-11-01T18:00:00Z",
  entity_type: null,
  entity_id: null,
  ...o,
});

/** Minimal fake of the staff_notifications table, scoped to one recipient. */
function fakeClient(rows: { id: string; user_id: string; kind: string; is_demo: boolean; read_at: string | null; retracted_at: string | null }[]) {
  const calls = { updates: 0 };
  const from = () => {
    const filters: [string, string, unknown][] = [];
    let patch: Record<string, unknown> | null = null;
    let range: [number, number] | null = null;
    const match = (r: Record<string, unknown>) =>
      filters.every(([op, k, v]) => (op === "is" ? r[k] === v : r[k] === v));
    const b: Record<string, unknown> = {
      select: () => b,
      update: (p: Record<string, unknown>) => {
        patch = p;
        calls.updates += 1;
        return b;
      },
      eq: (k: string, v: unknown) => (filters.push(["eq", k, v]), b),
      is: (k: string, v: unknown) => (filters.push(["is", k, v]), b),
      order: () => b,
      range: (a: number, z: number) => ((range = [a, z]), b),
      then: (res: (v: unknown) => void) => {
        const hit = rows.filter((r) => r.user_id === "me" && match(r));
        if (patch) {
          for (const r of hit) Object.assign(r, patch);
          return res({ error: null, count: hit.length });
        }
        const page = range ? hit.slice(range[0], range[1] + 1) : hit;
        return res({ data: page.map((r) => ({ kind: r.kind })), error: null });
      },
    };
    return b;
  };
  return { client: { from }, calls };
}

function many(n: number, extra: Partial<{ user_id: string; is_demo: boolean; read_at: string | null }> = {}) {
  return Array.from({ length: n }, (_, i) => ({
    id: U(i),
    user_id: "me",
    kind: "owner_collaboration",
    is_demo: false,
    read_at: null as string | null,
    retracted_at: null,
    ...extra,
  }));
}

describe("unread count and mark all", () => {
  it("counts every unread row, beyond one page and beyond 1000", async () => {
    const data = [...many(1056), ...many(5, { read_at: "x" }), ...many(7, { user_id: "other" }), ...many(3, { is_demo: true })];
    const { client } = fakeClient(data);
    expect(await readUnreadKinds(client, false)).toHaveLength(1056);
  });

  it("marks all 64 unread for the signed-in person in one call and nobody else's", async () => {
    const data = [...many(64), ...many(4, { user_id: "other" }), ...many(2, { is_demo: true })];
    const { client, calls } = fakeClient(data);
    expect(await markAllUnread(client, "me", false, "2026-11-01T00:00:00Z")).toBe(64);
    expect(calls.updates).toBe(1);
    expect(data.filter((r) => r.user_id === "me" && !r.is_demo && !r.read_at)).toHaveLength(0);
    expect(data.filter((r) => r.user_id === "other" && !r.read_at)).toHaveLength(4);
    expect(data.filter((r) => r.is_demo && !r.read_at)).toHaveLength(2);
    expect(await readUnreadKinds(client, false)).toHaveLength(0);
  });

  it("pages in 20s so the feed is never capped at 20", () => {
    expect(PAGE_SIZE).toBe(20);
    const src = readFileSync("src/hooks/useStaffNotifications.ts", "utf8");
    expect(src).not.toMatch(/\.limit\(20\)/);
    expect(src).toMatch(/getNextPageParam/);
  });
});

describe("grouping", () => {
  const now = new Date("2026-11-01T18:30:00Z"); // 12:30 pm Central, Nov 1
  it("buckets by Central day", () => {
    expect(dayBucket("2026-11-01T06:00:00Z", now)).toBe("Today"); // 1 am Central Nov 1
    expect(dayBucket("2026-11-01T04:00:00Z", now)).toBe("Yesterday"); // 11 pm Oct 31
    expect(dayBucket("2026-10-30T18:00:00Z", now)).toBe("Earlier");
  });
  it("collapses repeats of the same kind on the same item, same day", () => {
    const task = U(1);
    const rows = [
      row({ kind: "owner_collaboration", entity_id: task, body: "Task X · 1399 Foxtail Ln", created_at: "2026-11-01T17:00:00Z" }),
      row({ kind: "owner_collaboration", entity_id: task, body: "Task X · 1399 Foxtail Ln", created_at: "2026-11-01T16:00:00Z", read_at: "r" }),
      row({ kind: "owner_collaboration", entity_id: task, body: "Task X · 1399 Foxtail Ln", created_at: "2026-11-01T15:00:00Z" }),
      row({ kind: "ticket_assigned", entity_id: task, created_at: "2026-11-01T14:00:00Z" }),
      row({ kind: "owner_collaboration", entity_id: task, body: "Task X · 1399 Foxtail Ln", created_at: "2026-10-31T15:00:00Z" }),
    ];
    const g = groupFeed(rows, now);
    expect(g.map((x) => x.bucket)).toEqual(["Today", "Yesterday"]);
    expect(g[0]!.entries).toHaveLength(2);
    expect(g[0]!.entries[0]!.count).toBe(3);
    expect(g[0]!.entries[0]!.unreadIds).toHaveLength(2);
    expect(g[0]!.unreadIds).toHaveLength(3);
    expect(entrySummary(g[0]!.entries[0]!)).toBe("3 updates on 1399 Foxtail Ln: Task X");
  });
});

describe("link targets per kind", () => {
  const T = U(2);
  it("keeps exact stored links", () => {
    for (const [kind, link] of [
      ["ticket_assigned", `/tickets/${T}`],
      ["sla_action_breached", `/tickets/${T}`],
      ["closure_qa", `/tickets/${T}`],
      ["handoff_pending", `/tickets/${T}`],
      ["waiting_returned", `/tickets/${T}`],
      ["work_order_update", `/tickets/${T}`],
      ["claim_waiver", `/claims?claim=${T}`],
      ["vendor_no_acknowledgment", `/work-orders?open=${T}`],
      ["onboarding_task_comment", `/onboarding/${P}?tab=work&task=${T}`],
      ["owner_followup", `/property/${P}#active-owner`],
      ["cleaner_safeguard_digest", "/cleaner-hours"],
    ] as const) {
      expect(notificationLink(row({ kind, link_path: link, entity_id: T }))).toBe(link);
    }
  });
  it("sends approvals to the exact Task or Work Order, never the missing /approvals page", () => {
    const r = row({ kind: "approval_required", link_path: "/approvals", entity_type: "approval", entity_id: U(3) });
    expect(notificationLink(r, { kind: "onboarding_task", entity_id: T, property_id: P })).toBe(`/onboarding/${P}?tab=work&task=${T}`);
    expect(notificationLink(r, { kind: "work_order_supervisor", entity_id: T, property_id: P })).toBe(`/work-orders?open=${T}`);
    expect(notificationLink(r, null)).toBe("/oversight");
  });
  it("opens the specific homeowner item instead of the Tasks tab", () => {
    for (const kind of ["owner_collaboration", "owner_completion_review"]) {
      const r = row({ kind, entity_type: "work_item", entity_id: T, link_path: `/onboarding/${P}?tab=work` });
      expect(notificationLink(r)).toBe(`/onboarding/${P}?tab=work&opp=${T}`);
    }
  });
  it("derives a link when none was stored and refuses external ones", () => {
    expect(notificationLink(row({ entity_type: "ticket", entity_id: T }))).toBe(`/tickets/${T}`);
    expect(notificationLink(row({ link_path: "//evil.example" }))).toBeNull();
  });
});

describe("no change to recipients or email", () => {
  it("feed code only reads and marks read; never inserts or emails", () => {
    for (const f of ["src/hooks/useStaffNotifications.ts", "src/lib/notification-feed-data.ts", "src/routes/_authenticated/notifications.tsx", "src/components/NotificationBell.tsx"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toMatch(/\.insert\(|\.upsert\(|email_log|sendEmail|\.delete\(/);
      expect(s).not.toMatch(/user_id:\s/);
    }
  });
});
