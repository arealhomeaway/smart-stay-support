import { describe, expect, it } from "bun:test";
import {
  addressInTitle,
  mapNotionPage,
  pickHomeByTitle,
  recentCutoff,
  type NotionPage,
} from "@/lib/notion-import/mapping";

// Rule (Emily, Nov 9; register N3/N5 default): a ticket linked to two homes takes
// the home whose address appears in the title; if none does, the first linked home.
// Fictional streets only.

const CUTOFF = recentCutoff(Date.parse("2026-11-08T18:00:00Z"));
const sel = (name: string | null) => ({ type: "select", select: name ? { name } : null });

function page(title: string, pids: string[]): NotionPage {
  return {
    id: "page-2h",
    url: "https://www.notion.so/page2h",
    created_time: "2026-10-30T12:00:00Z",
    last_edited_time: "2026-11-01T12:00:00Z",
    properties: {
      "Issue Description": { type: "title", title: [{ plain_text: title }] },
      "Issue Status": { type: "status", status: { name: "In progress" } },
      Priority: sel("Medium"),
      Assignee: sel("General"),
      "Property Address": { type: "relation", relation: pids.map((id) => ({ id })) },
      "Created Date": { type: "date", date: { start: "2026-10-30" } },
      "Will this be a claim?": sel("No"),
    },
  } as NotionPage;
}

const ctx = {
  staff: [],
  cutoff: CUTOFF,
  pidOwnerRez: new Map<string, string | null>([
    ["pid-a", "ORP111"],
    ["pid-b", "ORP222"],
    ["pid-gone", "ORP999"],
  ]),
  propertyByOwnerRez: new Map([
    ["111", "home-a"],
    ["222", "home-b"],
  ]),
  propertyStreets: new Map([
    ["home-a", "18000 Example Dr."],
    ["home-b", "2012 W Sample Way"],
  ]),
};

describe("a ticket linked to two homes", () => {
  it("takes the second linked home when only its address is in the title", () => {
    const out = mapNotionPage(page("VRBO - Guest at 2012 W Sample Way - Stained linens", ["pid-a", "pid-b"]), ctx);
    expect(out.ticket.property_id).toBe("home-b");
    expect(out.homeOwnerRezId).toBe("222");
    expect(out.homeFromTitle).toBe(true);
    expect(out.multipleHomes).toBe(true);
  });

  it("takes the first linked home when the title names neither", () => {
    const out = mapNotionPage(page("Stained linens", ["pid-a", "pid-b"]), ctx);
    expect(out.ticket.property_id).toBe("home-a");
    expect(out.homeOwnerRezId).toBe("111");
    expect(out.homeFromTitle).toBe(false);
  });

  it("takes the first linked home when the title names both", () => {
    const out = mapNotionPage(page("18000 Example Dr and 2012 W Sample Way", ["pid-a", "pid-b"]), ctx);
    expect(out.ticket.property_id).toBe("home-a");
    expect(out.homeFromTitle).toBe(true);
  });

  it("counts a house number alone when only one linked home has it", () => {
    const out = mapNotionPage(page("2012 - toilet running", ["pid-a", "pid-b"]), ctx);
    expect(out.ticket.property_id).toBe("home-b");
  });

  it("keeps one linked home exactly as before, whatever the title says", () => {
    const out = mapNotionPage(page("2012 W Sample Way", ["pid-a"]), ctx);
    expect(out.ticket.property_id).toBe("home-a");
    expect(out.homeFromTitle).toBe(false);
  });

  it("still notes the second home on the ticket for a check", () => {
    const out = mapNotionPage(page("VRBO - Guest at 2012 W Sample Way", ["pid-a", "pid-b"]), ctx);
    expect(out.ticket.description).toContain("Linked to more than one home in Notion. Please check the home.");
  });

  it("skips a linked home that is not in Resolve", () => {
    const out = mapNotionPage(page("Leak", ["pid-gone", "pid-b"]), ctx);
    expect(out.ticket.property_id).toBe("home-b");
  });
});

describe("address in a title", () => {
  it("matches the street with or without its street type and punctuation", () => {
    expect(addressInTitle("at 3712 N 39th St. - stains", "3712 N 39th St")).toBe("street");
    expect(addressInTitle("at 3712 N 39th - stains", "3712 N 39th St.")).toBe("street");
  });
  it("does not match a number inside a longer number", () => {
    expect(addressInTitle("Unit 120125 report", "2012 W Sample Way")).toBeNull();
  });
  it("a house number shared by both homes picks neither", () => {
    expect(pickHomeByTitle("2012 - leak", ["2012 Elm St", "2012 Oak St"])).toEqual({ index: 0, fromTitle: false });
  });
});
