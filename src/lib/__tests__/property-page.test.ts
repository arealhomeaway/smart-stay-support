import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  PROPERTY_TABS,
  canAddHome,
  filterHomes,
  handoffBanner,
  headerLine,
  moreMenuItems,
  propertyTabsFor,
  resolveTab,
  splitActivity,
  stageLabel,
  firmLabelFromTitle,
  type MoreMenuState,
} from "@/lib/property-page";

const read = (p: string) => readFileSync(p, "utf8");
const LIST = read("src/routes/_authenticated/properties.tsx");
const PAGE = read("src/routes/_authenticated/property.$propertyId.tsx");

describe("Properties list (board PropertiesList)", () => {
  const homes = [
    { id: "a", lifecycle: "active_operations", market: "Tulsa", openTickets: 2, searchText: "5020 S 168th E Ave Tulsa" },
    { id: "b", lifecycle: "onboarding", market: "OKC", openTickets: 0, searchText: "16216 Whistle Creek Edmond" },
    { id: "c", lifecycle: "active_operations", market: "OKC", openTickets: 0, searchText: "2321 NW 158th" },
  ];

  test("each filter narrows the list", () => {
    expect(filterHomes(homes, {}).map((h) => h.id)).toEqual(["a", "b", "c"]);
    expect(filterHomes(homes, { q: "whistle" }).map((h) => h.id)).toEqual(["b"]);
    expect(filterHomes(homes, { market: "OKC" }).map((h) => h.id)).toEqual(["b", "c"]);
    expect(filterHomes(homes, { status: "operations" }).map((h) => h.id)).toEqual(["a", "c"]);
    expect(filterHomes(homes, { status: "onboarding" }).map((h) => h.id)).toEqual(["b"]);
    expect(filterHomes(homes, { open: true }).map((h) => h.id)).toEqual(["a"]);
    expect(filterHomes(homes, { q: "nowhere" })).toEqual([]);
  });

  test("the list screen carries the board's filters, count line and empty text", () => {
    for (const text of [
      '"Find a home"',
      "All markets",
      "<SelectItem value=\"operations\">Operations</SelectItem>",
      "<SelectItem value=\"onboarding\">Onboarding</SelectItem>",
      "Only homes with open tickets",
      "homeCountLine(visible.length)",
      'title="No homes match"',
      "Clear",
      "Add a label to many homes",
      "Label to add",
      "Choose a label",
      "Select all shown",
      "picked",
      "Apply",
      "Cancel",
    ])
      expect(LIST).toContain(text);
  });

  test("Add a home: only Onboarding roles and Admin, never a coordinator or Supervisor", () => {
    expect(canAddHome({ roles: ["tech"], onboardingDirector: false })).toBe(false);
    expect(canAddHome({ roles: ["manager"], onboardingDirector: false })).toBe(false);
    expect(canAddHome({ roles: ["onboarding"], onboardingDirector: false })).toBe(true);
    expect(canAddHome({ roles: ["manager"], onboardingDirector: true })).toBe(true);
    expect(canAddHome({ roles: ["admin"], onboardingDirector: false })).toBe(true);
    expect(canAddHome({ roles: ["admin"], onboardingDirector: false, readOnly: true })).toBe(false);
  });

  test("removed items are gone from the list", () => {
    for (const gone of ["Work Map", "Portfolio", "Refresh property info", "practice homes", "OwnerRez listing", "listOwnerRezListings", '"Live"', ">Live<"])
      expect(LIST).not.toContain(gone);
  });

  test("status words say Operations, never active operations", () => {
    expect(stageLabel("active_operations")).toBe("Operations");
    expect(stageLabel("onboarding")).toBe("Onboarding");
    expect(LIST.toLowerCase()).not.toContain("active operations");
  });

  test("the first import reads (30D FIRM) as the label 30-day firm", () => {
    expect(firmLabelFromTitle("5020 S.168th E Ave (30D FIRM)")).toBe("30-day firm");
    expect(firmLabelFromTitle("16216 Whistle Creek (30D Firm)")).toBe("30-day firm");
    expect(firmLabelFromTitle("2321 NW 158th (30D)")).toBeNull();
    expect(firmLabelFromTitle("1 Main St")).toBeNull();
  });
});

describe("Property page (board Properties)", () => {
  test("the exact tab list, in order, for every staff role; nothing for homeowners or vendors", () => {
    const names = [
      "Home Profile",
      "Inspections",
      "Onboarding Information",
      "House Items",
      "Utilities",
      "Vendors",
      "Owner and Contacts",
      "Operations",
      "Reviews",
      "Surveys",
      "Documents and Media",
      "Activity",
    ];
    expect(PROPERTY_TABS.map((t) => t.label)).toEqual(names);
    expect(propertyTabsFor({ staff: true, properties: true }).map((t) => t.label)).toEqual(names);
    expect(propertyTabsFor({ staff: false, properties: false })).toEqual([]);
  });

  test("old tab links land on the new tabs", () => {
    expect(resolveTab(undefined)).toBe("profile");
    expect(resolveTab("overview")).toBe("profile");
    expect(resolveTab("files")).toBe("documents");
    expect(resolveTab("handoff")).toBe("onboarding");
    expect(resolveTab("approvals")).toBe("onboarding");
    expect(resolveTab("activity")).toBe("activity");
  });

  const base: MoreMenuState = {
    staff: true,
    readOnly: false,
    onboarding: false,
    activeOwner: false,
    canMoveToOnboarding: true,
    canEnrollActiveOwner: true,
    canChangeOwner: true,
    canCorrectClosing: true,
  };

  test("More menu items by state", () => {
    expect(moreMenuItems(base)).toEqual([
      "photos_folder",
      "change_owner",
      "move_to_onboarding",
      "enroll_active_owner",
      "correct_closing",
    ]);
    expect(moreMenuItems({ ...base, onboarding: true })).not.toContain("move_to_onboarding");
    expect(moreMenuItems({ ...base, activeOwner: true })).not.toContain("enroll_active_owner");
    expect(moreMenuItems({ ...base, canCorrectClosing: false })).not.toContain("correct_closing");
    expect(moreMenuItems({ ...base, canEnrollActiveOwner: false })).not.toContain("enroll_active_owner");
    expect(moreMenuItems({ ...base, readOnly: true })).toEqual(["photos_folder"]);
    expect(moreMenuItems({ ...base, staff: false })).toEqual([]);
  });

  test("banner wording by home and department", () => {
    expect(handoffBanner({ onboarding: true, department: "operations", missing: 4, carriedOver: 0 })).toEqual({
      title: "Handoff review: 4 items are still missing",
      button: "See what is missing",
      note: "This home is still in onboarding. The onboarding team fills in missing information. You can edit if you need to, but it is not expected.",
      target: "missing",
    });
    expect(handoffBanner({ onboarding: true, department: "onboarding", missing: 1, carriedOver: 0 })?.title).toBe(
      "Before handoff: 1 item still to fill in",
    );
    expect(handoffBanner({ onboarding: true, department: "onboarding", missing: 1, carriedOver: 0 })?.button).toBe("Fill them in");
    expect(handoffBanner({ onboarding: false, department: "operations", missing: 6, carriedOver: 3 })).toMatchObject({
      title: "3 items carried over from onboarding at handoff",
      button: "See the carry-over items",
    });
    expect(handoffBanner({ onboarding: false, department: "operations", missing: 6, carriedOver: 0 })).toBeNull();
  });

  test("the one line under the address", () => {
    expect(headerLine({ onboarding: false, handedOffOn: "09/22/2026", projectManager: null, handoffOn: null, carriedOver: 0 })).toBe(
      "Operating home, handed off 09/22/2026",
    );
    expect(headerLine({ onboarding: true, handedOffOn: null, projectManager: "Pat", handoffOn: "12/01/2026", carriedOver: 0 })).toBe(
      "Onboarding home · Project Manager Pat · handoff 12/01/2026",
    );
    expect(headerLine({ onboarding: false, handedOffOn: null, projectManager: null, handoffOn: null, carriedOver: 2 })).toBe(
      "Operating home · 2 items carried over",
    );
  });

  test("activity: last 30 days first, full history on request", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    const rows = [
      { id: "1", at: "2026-11-08T12:00:00Z" },
      { id: "2", at: "2026-09-01T12:00:00Z" },
      { id: "3", at: "2026-10-20T12:00:00Z" },
    ];
    const s = splitActivity(rows, now);
    expect(s.recent.map((r) => r.id)).toEqual(["1", "3"]);
    expect(s.older.map((r) => r.id)).toEqual(["2"]);
    expect(PAGE).toContain("Show the last 30 days");
    expect(PAGE).toContain("Show the full history (");
  });

  test("removed items are gone from the page and nothing says sample", () => {
    for (const gone of [
      "SendToOwner",
      "OverviewTab",
      "PropertyFilesTab",
      "ApprovalsTab",
      "ActiveOwnerPanel",
      "Waiting on you",
      "Handoff gates open",
      "Documents you can see",
      "Unassigned tasks\"",
      "Property hub",
      "BackControl",
    ])
      expect(PAGE).not.toContain(gone);
    for (const src of [PAGE, LIST]) {
      expect(src.toLowerCase()).not.toContain("sample");
      expect(src).not.toMatch(/\bseat\b/);
      expect(src).not.toContain("—");
    }
    // Email owner stays in the Owner card; one Back link comes from the shell.
    expect(PAGE).toContain('label="Email owner"');
  });
});
