import { describe, expect, it } from "bun:test";
import {
  inScope,
  mapNotionPage,
  mapPriority,
  mapStatus,
  resolveAssignee,
  type NotionPage,
  type StaffUser,
} from "@/lib/notion-import/mapping";
import { matchesMyWorkView } from "@/lib/my-work";
import { isImportHeld, withoutImportHeld } from "@/lib/import-hold";

const NOW = Date.parse("2026-11-04T18:00:00Z");
const staff: StaffUser[] = [
  { id: "micah", full_name: "Micah Sinor", email: "micah.sinor@arealhomeaway.com" },
  { id: "romeo", full_name: "Romeo Canales", email: "romeo.canales@arealhomeaway.com" },
  { id: "mike", full_name: "Mike Cacatian", email: "mike@arealhomeaway.com" },
  { id: "james", full_name: "James Almario", email: "james.almario@arealhomeaway.com" },
];
const sel = (name: string | null) => ({ type: "select", select: name ? { name } : null });
const num = (n: number | null) => ({ type: "number", number: n });
const dt = (d: string | null) => ({ type: "date", date: d ? { start: d } : null });

function page(over: Record<string, unknown> = {}, meta: Partial<NotionPage> = {}): NotionPage {
  return {
    id: "page-1",
    url: "https://www.notion.so/page1",
    created_time: "2026-10-01T12:00:00Z",
    last_edited_time: "2026-10-20T12:00:00Z",
    properties: {
      "Issue Description": { type: "title", title: [{ plain_text: "Leaky faucet" }] },
      "Issue Status": { type: "status", status: { name: "In progress" } },
      Priority: sel("Medium"),
      Assignee: sel("Micah Sinor"),
      "Property Address": { type: "relation", relation: [{ id: "pid-1" }] },
      "Created Date": dt("2026-10-01"),
      "Due Date": dt("2026-10-05"),
      "Will this be a claim?": sel("No"),
      ...over,
    },
    ...meta,
  } as NotionPage;
}
const ctx = {
  staff,
  pidOwnerRez: new Map<string, string | null>([["pid-1", "ORP123456"], ["pid-owens", "ORP410153"]]),
  propertyByOwnerRez: new Map([["123456", "home-1"]]),
};

describe("priority (Emily decision 1)", () => {
  it("Urgent is P1, High is P2, Medium, Low and blank are P3", () => {
    expect(mapPriority("Urgent")).toBe("p1");
    expect(mapPriority("High")).toBe("p2");
    expect(mapPriority("Medium")).toBe("p3");
    expect(mapPriority("Low")).toBe("p3");
    expect(mapPriority(null)).toBe("p3");
  });
});

describe("status", () => {
  it("Pending Claim Review with Josh is in progress and waiting on claim review", () => {
    expect(mapStatus("Pending Claim Review with Josh")).toEqual({ status: "in_progress", waitingOnClaimReview: true });
    const t = mapNotionPage(page({ "Issue Status": { type: "status", status: { name: "Pending Claim Review with Josh" } } }), ctx).ticket;
    expect(t.waiting_on).toBe("other");
    expect(t.waiting_reason).toBe("claim review");
  });
  it("Done and Completed Same Day are closed", () => {
    expect(mapStatus("Done").status).toBe("closed");
    expect(mapStatus("Completed Same Day").status).toBe("closed");
  });
});

describe("assignees (Emily decision 2)", () => {
  it("the four named people map to their Resolve users", () => {
    for (const [n, id] of [["Micah Sinor", "micah"], ["Romeo Canales", "romeo"], ["Mike Cacatian", "mike"], ["James Almario", "james"]] as const) {
      expect(resolveAssignee(n, staff).userId).toBe(id);
    }
  });
  it("a person with no login is unassigned and reported, never guessed", () => {
    expect(resolveAssignee("Qym Fuenteblanca", staff)).toEqual({ userId: null, missingLogin: "Qym Fuenteblanca" });
    expect(resolveAssignee("Micah", staff)).toEqual({ userId: null, missingLogin: "Micah" });
    const out = mapNotionPage(page({ Assignee: sel("Avy Vergara") }), ctx);
    expect(out.ticket.assigned_to).toBeNull();
    expect(out.missingLogin).toBe("Avy Vergara");
  });
  it("matches a new login at run time by exact name", () => {
    const later = [...staff, { id: "qym", full_name: "Qym Fuenteblanca", email: "qym@arealhomeaway.com" }];
    expect(resolveAssignee("Qym Fuenteblanca", later).userId).toBe("qym");
  });
  it("General and blank are unassigned with nothing to report", () => {
    expect(resolveAssignee("General", staff)).toEqual({ userId: null, missingLogin: null });
    expect(resolveAssignee(null, staff)).toEqual({ userId: null, missingLogin: null });
  });
});

describe("home, lists and category", () => {
  it("matches the home by OwnerRez ID with the ORP prefix dropped", () => {
    const t = mapNotionPage(page(), ctx).ticket;
    expect(t.property_id).toBe("home-1");
    expect(t.import_hold).toBeNull();
  });
  it("no home goes to Needs a home", () => {
    const t = mapNotionPage(page({ "Property Address": { type: "relation", relation: [] } }), ctx).ticket;
    expect(t.property_id).toBeNull();
    expect(t.import_hold).toBe("needs_home");
  });
  it("21036 Owens Rd goes to Needs a home with the former property tag and no home", () => {
    const out = mapNotionPage(page({ "Property Address": { type: "relation", relation: [{ id: "pid-owens" }] } }), ctx);
    expect(out.ticket.property_id).toBeNull();
    expect(out.ticket.import_hold).toBe("needs_home");
    expect(out.ticket.description).toContain("Former property: 21036 Owens Rd");
  });
  it("open tickets created in 2025 go to Backlog review; closed ones do not", () => {
    const old = { "Created Date": dt("2025-06-01") };
    expect(mapNotionPage(page(old), ctx).ticket.import_hold).toBe("backlog_review");
    expect(mapNotionPage(page({ ...old, "Issue Status": { type: "status", status: { name: "Done" } } }), ctx).ticket.import_hold).toBeNull();
  });
});

describe("notes block, link and claim (Emily decision 4)", () => {
  it("unmapped fields and the Notion link go in the Imported from Notion block", () => {
    const t = mapNotionPage(
      page({ "Submitted by:": sel("Josh"), Market: sel("OKC"), "Completed by": { type: "people", people: [{ name: "Romeo" }] }, "Guest Informed?": sel("Yes") }),
      ctx,
    ).ticket;
    expect(t.description).toContain("Imported from Notion");
    expect(t.description).toContain("Submitted by: Josh");
    expect(t.description).toContain("Market: OKC");
    expect(t.description).toContain("Completed by: Romeo");
    expect(t.description).toContain("Guest informed: Yes");
    expect(t.external_id).toBe("page-1");
    expect(t.external_url).toBe("https://www.notion.so/page1");
  });
  it("creates a claim only when Will this be a claim? is Yes, carrying the amounts", () => {
    expect(mapNotionPage(page(), ctx).ticket.claim).toBeNull();
    const c = mapNotionPage(
      page({
        "Will this be a claim?": sel("Yes"),
        "Claim Filed?": sel("Yes"),
        "Total Damages $ (not including management fee)": num(420),
        "Reimbursed Amount $ ": num(100),
        "Is the claim less than $75?": sel("No"),
        "Management/Operational Fee (20% or $30 - whichever is higher)": num(84),
      }),
      ctx,
    ).ticket.claim!;
    expect(c.estimated_amount).toBe(420);
    expect(c.recovered_amount).toBe(100);
    expect(c.stage).toBe("gathering");
    expect(c.notes).toContain("Is the claim less than $75: No");
    expect(c.notes).toContain("Management/Operational Fee: $84.00");
  });
});

describe("scope", () => {
  it("open now, or created or edited in the last 30 days", () => {
    const oldClosed = { "Issue Status": { type: "status", status: { name: "Done" } }, "Created Date": dt("2025-01-01") };
    expect(inScope(page(), NOW)).toBe(true);
    expect(inScope(page(oldClosed, { created_time: "2025-01-01T00:00:00Z", last_edited_time: "2025-02-01T00:00:00Z" }), NOW)).toBe(false);
    expect(inScope(page(oldClosed, { created_time: "2025-01-01T00:00:00Z", last_edited_time: "2026-10-30T00:00:00Z" }), NOW)).toBe(true);
  });
});

describe("held imports stay out of queues (Emily decision 5)", () => {
  const held = { id: "t1", status: "in_progress", priority: "p3", assigned_to: "micah", import_hold: "backlog_review" };
  it("is absent from My Work even when assigned to me", () => {
    expect(matchesMyWorkView(held as never, "active", "micah")).toBe(false);
    expect(matchesMyWorkView({ ...held, import_hold: null } as never, "active", "micah")).toBe(true);
  });
  it("is filtered from Team Queue and dashboards", () => {
    expect(withoutImportHeld([held, { ...held, id: "t2", import_hold: "needs_home" }, { ...held, id: "t3", import_hold: null }]).map((t) => t.id)).toEqual(["t3"]);
    expect(isImportHeld({})).toBe(false);
  });
});
