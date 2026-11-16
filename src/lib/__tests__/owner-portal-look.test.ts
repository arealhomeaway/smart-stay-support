/**
 * Homeowner portal look (approved by the Admin, Nov 16): the four Opportunity groups by card code,
 * hours shown on a completed card, order of cards, the chat unread count, and one photo per card.
 */
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  completedLine,
  entriesForCard,
  newestCompletedFirst,
  newestOpenedFirst,
  portalGroupFor,
  PORTAL_GROUPS,
  portalOpensWhen,
} from "@/lib/owner-portal-look";
import { ownerUnread } from "@/lib/owner-chat-panel";

describe("portal groups by card code", () => {
  it("Marketing and social is exactly P07 P08 P12 P13 P14 P15 P19 P20", () => {
    expect(PORTAL_GROUPS.find((g) => g.id === "marketing")!.codes).toEqual(["P07", "P08", "P12", "P13", "P14", "P15", "P19", "P20"]);
  });
  it("Research and relationships is exactly N05 N06 N07 N08 N09 N12 P10 P16 P17 P18 P09 N16", () => {
    expect(PORTAL_GROUPS.find((g) => g.id === "research")!.codes).toEqual(["N05", "N06", "N07", "N08", "N09", "N12", "P10", "P16", "P17", "P18", "P09", "N16"]);
  });
  it("Home care is exactly N01 N02 N03 N04 N11 N13 P05", () => {
    expect(PORTAL_GROUPS.find((g) => g.id === "home_care")!.codes).toEqual(["N01", "N02", "N03", "N04", "N11", "N13", "P05"]);
  });
  it("Guest experience is exactly N14 A33 N10 A52 N15 N17 P11", () => {
    expect(PORTAL_GROUPS.find((g) => g.id === "guest")!.codes).toEqual(["N14", "A33", "N10", "A52", "N15", "N17", "P11"]);
  });
  it("P09 and N16 sit in Research and relationships; N15, N17 and P11 in Guest experience (Admin, Nov 16)", () => {
    expect(["P09", "N16"].map((c) => portalGroupFor(c))).toEqual(["research", "research"]);
    expect(["N15", "N17", "P11"].map((c) => portalGroupFor(c))).toEqual(["guest", "guest", "guest"]);
  });
  it("reads codes case-insensitively and leaves unnamed codes ungrouped", () => {
    expect(portalGroupFor("p07")).toBe("marketing");
    expect(portalGroupFor("A52")).toBe("guest");
    expect(portalGroupFor("X99")).toBeNull();
    expect(portalGroupFor(null)).toBeNull();
  });
});

describe("hours on a completed card", () => {
  const entries = [
    { minutes: 90, activity: "Draft your listing", propertyIds: ["h1"], entry_date: "2026-11-10" },
    { minutes: 60, activity: "draft your listing ", propertyIds: ["h2"], entry_date: "2026-11-11" },
    { minutes: 30, activity: "Something else", review_id: "r1", propertyIds: ["h1"], entry_date: "2026-11-12" },
    { minutes: 45, activity: "Draft your listing", superseded: true, propertyIds: ["h1"], entry_date: "2026-11-13" },
  ];
  it("counts entries for the card's title on the same home and its own owner item, never superseded ones", () => {
    const mine = entriesForCard(entries, { title: "Draft your listing", reviewId: "r1", propertyIds: ["h1"] });
    expect(mine.reduce((n, e) => n + e.minutes, 0)).toBe(120);
  });
  it("reads Completed Nov 14 · 2.5 hrs logged", () => {
    expect(completedLine("2026-11-14", 150)).toBe("Completed Nov 14 · 2.5 hrs logged");
    expect(completedLine(null, 60)).toBe("Completed · 1 hrs logged");
  });
});

describe("order", () => {
  it("new ones first; never-opened last", () => {
    const out = newestOpenedFirst([
      { title: "B", sentAt: "2026-11-01T10:00:00Z" },
      { title: "A", sentAt: null },
      { title: "C", sentAt: "2026-11-05T10:00:00Z" },
    ]);
    expect(out.map((x) => x.title)).toEqual(["C", "B", "A"]);
  });
  it("completed newest first", () => {
    const out = newestCompletedFirst([
      { title: "B", completedAt: "2026-11-01" },
      { title: "C", completedAt: "2026-11-09" },
    ]);
    expect(out.map((x) => x.title)).toEqual(["C", "B"]);
  });
});

describe("Chat with ARHA unread count", () => {
  it("adds only owner chats on the owner's homes; zero shows no count", () => {
    const rows = [
      { property_id: "h1", kind: "owner", unread: 2 },
      { property_id: "h1", kind: "team", unread: 5 },
      { property_id: "h9", kind: "owner", unread: 4 },
      { property_id: "h2", kind: "owner", unread: 1 },
    ];
    expect(ownerUnread(rows, [{ propertyId: "h1", name: "A" }, { propertyId: "h2", name: "B" }])).toBe(3);
    expect(ownerUnread([], [{ propertyId: "h1", name: "A" }])).toBe(0);
  });
});

describe("card photos", () => {
  const dir = join(process.cwd(), "src/assets/cards");
  const files = readdirSync(dir).filter((f) => f.endsWith(".jpg"));
  it("every grouped card code has its own photo", () => {
    const codes = new Set(files.map((f) => f.slice(0, 3).toUpperCase()));
    for (const g of PORTAL_GROUPS) for (const c of g.codes) expect(codes.has(c)).toBe(true);
  });
  it("no two cards share a photo", () => {
    const hashes = files.map((f) => createHash("sha256").update(readFileSync(join(dir, f))).digest("hex"));
    expect(new Set(hashes).size).toBe(files.length);
  });
});

describe("Coming soon wording", () => {
  it("reads the existing opens text as Opens when ...", () => {
    expect(portalOpensWhen("Locked until ARHA uploads the floor plan")).toBe("ARHA uploads the floor plan");
    expect(portalOpensWhen("Locked until the first booking is confirmed")).toBe("the first booking is confirmed");
    expect(portalOpensWhen("Draft open on day one; final step unlocks when ARHA shares the live link")).toBe("ARHA shares the live link");
    expect(portalOpensWhen("Open on day one")).toBe("our team finishes its part");
    expect(portalOpensWhen(null)).toBe("our team finishes its part");
  });
});

describe("owner chat files", () => {
  it("a homeowner's chat photo or video goes to Photos; any other file goes to Other", async () => {
    const { ownerChatFolder, ownerChatCategory } = await import("@/lib/owner-tab");
    expect([ownerChatFolder("image/jpeg"), ownerChatFolder("video/mp4"), ownerChatFolder("application/pdf")]).toEqual(["photos", "photos", "other"]);
    expect([ownerChatCategory("image/png"), ownerChatCategory("application/pdf")]).toEqual(["media", "other"]);
  });
});
