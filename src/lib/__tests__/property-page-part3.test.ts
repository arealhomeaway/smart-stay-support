import { describe, expect, it } from "bun:test";
import {
  breezewayDescription,
  breezewayFileRoute,
  budgetSummaryLine,
  canEditDetail,
  detailSectionFor,
  detailsViewOnly,
  folderForCategory,
  myHomesState,
  optionLabel,
  safeReturnPath,
  searchDetailRows,
  taskDefaultFolder,
  uploadCategory,
  UPLOAD_FOLDERS,
  HOME_FOLDERS,
  vendorContactLinks,
  type DetailsViewer,
} from "../home-details";
import { followedHomeTasks, validateMyWorkSearch, FOLLOWED_HOMES } from "../onboarding-work-views";
import { oldTabPlace, pageTabFor, PAGE_TABS } from "../onboarding-home-page";

const nobody: DetailsViewer = {
  userId: "u1",
  isAdmin: false,
  isOnboardingDirector: false,
  isOperationsDirector: false,
  isSupervisor: false,
  isHomePm: false,
  isHomeDesigner: false,
  isHomeUtilities: false,
  canManageTeam: false,
};
const v = (o: Partial<DetailsViewer>): DetailsViewer => ({ ...nobody, ...o });

describe("3.1 Home details", () => {
  it("opens a section from ?section=, else Project", () => {
    expect(detailSectionFor("team")).toBe("team");
    expect(detailSectionFor("pid")).toBe("pid");
    expect(detailSectionFor("nope")).toBe("project");
  });
  it("staff not on the team and not Admin or a Director are view only and edit nothing", () => {
    expect(detailsViewOnly(nobody)).toBe(true);
    expect(detailsViewOnly(v({ isHomePm: true }))).toBe(false);
    expect(detailsViewOnly(v({ isOperationsDirector: true }))).toBe(false);
  });
  it("the home's PM edits project fields and dates and sets the committed date once", () => {
    const pm = v({ isHomePm: true });
    expect(canEditDetail(pm, "project")).toBe(true);
    expect(canEditDetail(pm, "dates")).toBe(true);
    expect(canEditDetail(pm, "committed_set")).toBe(true);
    expect(canEditDetail(pm, "committed_correct")).toBe(false);
  });
  it("correcting the committed date stays with the Supervisor and Admin (register O3)", () => {
    expect(canEditDetail(v({ isSupervisor: true }), "committed_correct")).toBe(true);
    expect(canEditDetail(v({ isAdmin: true }), "committed_correct")).toBe(true);
    expect(canEditDetail(v({ isOperationsDirector: true }), "committed_correct")).toBe(false);
  });
  it("Utilities edits Utilities and HOA, not Project", () => {
    const u = v({ isHomeUtilities: true });
    expect(canEditDetail(u, "utilities")).toBe(true);
    expect(canEditDetail(u, "hoa")).toBe(true);
    expect(canEditDetail(u, "project")).toBe(false);
  });
  it("stagers stay with the Director of Onboarding and Admin", () => {
    expect(canEditDetail(v({ isHomePm: true }), "stagers")).toBe(false);
    expect(canEditDetail(v({ isOnboardingDirector: true }), "stagers")).toBe(true);
  });
  it("search finds a field by label or value, and a code only by its label", () => {
    const rows = [
      { id: "a", section: "utilities" as const, label: "WiFi network", value: "ArhaGuest" },
      { id: "b", section: "utilities" as const, label: "Front door code", value: "4821", secret: true },
      { id: "c", section: "hoa" as const, label: "HOA notes", value: "Pool closes at 9" },
    ];
    expect(searchDetailRows(rows, "wifi").map((h) => h.rowId)).toEqual(["a"]);
    expect(searchDetailRows(rows, "4821")).toEqual([]);
    const code = searchDetailRows(rows, "door");
    expect(code.map((h) => h.rowId)).toEqual(["b"]);
    expect(code[0]!.snippet).toBeNull();
    expect(searchDetailRows(rows, "pool").map((h) => h.section)).toEqual(["hoa"]);
  });
});

describe("3.2 Files", () => {
  it("has six folders and nothing new goes into Other", () => {
    expect(HOME_FOLDERS.map((f) => f.label)).toEqual(["Design", "Agreements", "Estimates and invoices", "Photos", "Inspections", "Other"]);
    expect(UPLOAD_FOLDERS.map((f) => f.id)).not.toContain("other");
    expect(uploadCategory("other")).toBeNull();
  });
  it("Design's old buckets are groups inside Design, design photos inside Photos", () => {
    expect(folderForCategory("design_floor_plan")).toBe("design");
    expect(folderForCategory("design_mood_board")).toBe("design");
    expect(folderForCategory("design_photo")).toBe("photos");
    expect(folderForCategory("pma")).toBe("agreements");
    expect(folderForCategory(null)).toBe("other");
    expect(uploadCategory("design", "design_pick_list")).toBe("design_pick_list");
  });
  it("a Task's upload starts in the folder of its kind", () => {
    expect(taskDefaultFolder({ title: "Upload the floor plans" })).toBe("design");
    expect(taskDefaultFolder({ title: "Upload the inspection report" })).toBe("inspections");
    expect(taskDefaultFolder({ title: "Send the furniture invoice" })).toBe("estimates");
    expect(taskDefaultFolder({ title: "Call the owner" })).toBeNull();
  });
});

describe("3.3 Vendors and work", () => {
  it("an empty option reads Not ranked", () => {
    expect(optionLabel(1)).toBe("Option 1");
    expect(optionLabel(3)).toBe("Option 3");
    expect(optionLabel(null)).toBe("Not ranked");
  });
  it("the preferred contact comes first and is marked", () => {
    const links = vendorContactLinks({ phone: "(214) 555-0100", email: "a@b.co", preferred: "email" });
    expect(links[0]).toMatchObject({ method: "email", preferred: true });
    expect(links.map((l) => l.method)).toEqual(["email", "call", "text"]);
  });
  it("Find a vendor returns only to a home's Onboarding view", () => {
    const id = "0b1f8a52-5c1e-4a3c-9d0e-2f6b8c7a1d11";
    expect(safeReturnPath(`/onboarding/${id}?tab=vendors`)).toBe(`/onboarding/${id}?tab=vendors`);
    expect(safeReturnPath(`/onboarding/${id}?tab=tasks&task=${id}`)).toBe(`/onboarding/${id}?tab=tasks&task=${id}`);
    expect(safeReturnPath("https://evil.example/onboarding")).toBeNull();
    expect(safeReturnPath("//evil.example")).toBeNull();
  });
});

describe("3.4 Budget summary line", () => {
  const money = (n: number | null | undefined) => `$${n ?? 0}`;
  it("reads approved, spent, left and invoice", () => {
    expect(budgetSummaryLine({ approved: 10000, spent: 2500, remaining: 7500, over: false }, "Sent", money)).toBe(
      "Approved $10000 · Spent $2500 · $7500 left · Invoice Sent",
    );
  });
  it("says over and Not set when so", () => {
    expect(budgetSummaryLine({ approved: 100, spent: 150, remaining: -50, over: true }, null, money)).toBe(
      "Approved $100 · Spent $150 · Over by $50 · Invoice Not set",
    );
  });
});

describe("3.5 Add to my homes", () => {
  it("a home on your team reads Yours; others Add or Remove", () => {
    expect(myHomesState({ assigned: true, following: false })).toBe("yours");
    expect(myHomesState({ assigned: false, following: true })).toBe("following");
    expect(myHomesState({ assigned: false, following: false })).toBe("add");
  });
  it("My Tasks can show the homes you follow", () => {
    expect(validateMyWorkSearch({ home: FOLLOWED_HOMES }).home).toBe(FOLLOWED_HOMES);
    const tasks = [
      { id: "1", property_id: "h1", assigned_to: "x" },
      { id: "2", property_id: "h2", assigned_to: "me" },
      { id: "3", property_id: "h1", assigned_to: null },
    ];
    const followed = new Set(["h1"]);
    expect(followedHomeTasks(tasks, followed, "me", "me").map((t) => t.id)).toEqual(["1", "3"]);
    expect(followedHomeTasks(tasks, followed, "unassigned", "me").map((t) => t.id)).toEqual(["3"]);
    expect(followedHomeTasks(tasks, followed, "x", "me").map((t) => t.id)).toEqual(["1"]);
  });
});

describe("3.8 Breezeway", () => {
  it("sends the full step text with the note signed by name", () => {
    expect(breezewayDescription("Hang the art.\nUse the level.", "Bring the ladder", "Kati")).toBe(
      "Hang the art.\nUse the level.\n\nNote from Kati: Bring the ladder",
    );
    expect(breezewayDescription("Hang the art.", "", "Kati")).toBe("Hang the art.");
  });
  it("photos upload; other files go as links", () => {
    expect(breezewayFileRoute({ mime_type: "image/jpeg", size_bytes: 1000 })).toBe("upload");
    expect(breezewayFileRoute({ mime_type: "application/pdf", size_bytes: 1000 })).toBe("link");
    expect(breezewayFileRoute({ mime_type: "image/png", size_bytes: 20 * 1024 * 1024 })).toBe("link");
  });
});

describe("More tab removed", () => {
  it("no tab is More and its old links open the new places", () => {
    expect(PAGE_TABS.map((t) => t.value)).not.toContain("more" as never);
    expect(pageTabFor("more")).toBe("details");
    expect(oldTabPlace("design")).toEqual({ folder: "design" });
    expect(oldTabPlace("findings")).toEqual({ section: "inspections" });
  });
});
