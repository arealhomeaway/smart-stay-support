import { describe, expect, it as test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ALL_PROFILE_ITEMS,
  HOME_PROFILE_SECTIONS,
  REQUIRED_ITEMS,
  buildChanges,
  codesFor,
  displayValue,
  flagsFor,
  missingForHandoff,
  searchProfile,
  visibleItems,
  type ProfileContext,
} from "@/lib/home-profile";
import { pickProfileRaw } from "@/lib/property-hub.server";

const empty: ProfileContext = { property: {}, credentials: [], photos: [], links: [], system: {} };

const home: ProfileContext = {
  property: {
    nickname: "Calm and Cozy",
    bedrooms: 4,
    access: { lock_brand: "Yale", garage_remote: "Chamberlain 953EV" },
    systems: { breaker_panel_location: "Garage, left wall", smoke: { brand: "Kidde" } },
    fireplace: { present: true, model: "Heat & Glo SL-750" },
    sprinklers: { set_for_season: { value: true, as_of: "2026-08-30T04:11:00.000Z", source: "notion_pid" } },
    waste: { trash_days: ["Monday", "Thursday"] },
  },
  credentials: [
    { id: "c1", category: "alarm_security", label: "Alarm code" },
    { id: "c2", category: "gate_community", label: "Gate / community code" },
    { id: "c3", category: "streaming", label: "Roku PIN" },
  ],
  photos: [
    { id: "p1", itemKey: "smoke_model_photo", documentId: "d1", name: "smoke-label.jpg" },
    { id: "p2", itemKey: "fridge_filter_photos", documentId: "d2", name: "filter.jpg" },
  ],
  links: [],
  system: {},
};

describe("Home Profile registry (register P1)", () => {
  test("the ten sections in Notion's order", () => {
    expect(HOME_PROFILE_SECTIONS.map((s) => s.title)).toEqual([
      "Home Inspections & Pending Maintenance",
      "Quick Overview",
      "Entry & Access Details",
      "Home Profile",
      "Onboarding & Setup",
      "Security & Monitoring",
      "Home Systems & Features",
      "Pool and Hot Tub",
      "Property, Vendor, and Neighborhood Details",
      "Maintenance & Upkeep",
    ]);
  });

  test("every board label is present, with its marks", () => {
    const by = new Map(ALL_PROFILE_ITEMS.map((i) => [i.label, i]));
    const board = [
      "Inspections Executed", "Home Inspection Schedule", "Inspection Requests",
      "Property Address", "Property Nickname", "Airbnb Name", "Bedrooms", "Bathrooms", "Square Footage", "Property Built Year", "Occupancy Limit", "Property Tier", "Parking", "Greater Area",
      "Smart Lock Brand", "Access Codes", "Keys in Garage Lockbox", "Garage Trim Lockbox Code", "Garage Keypad Code", "Gate Code", "Key Access Hole for Emergencies", "Photo Front Door Lock System", "Garage Remote Brand & Model", "Mailbox Number", "Mailbox Location Photo", "Cluster Mailbox?", "Closet Supply Box Location", "Closet Supply Box Code",
      "Home Has Fireplace?", "Fireplace Type", "Fireplace Brand & Model Number", "Gas Fireplace Switch Location", "Fireplace Instructions", "Interior Paint", "Home Grill", "Office or Workstation?", "TV Specs", "Location of TVs?", "Furniture Package", "Furniture Warranty Expiration Date",
      "WiFi Network Name", "WiFi Password", "Confirmed Wifi has a split network", "Router Location", "Yale Smart Module", "Builder Warranty?", "Builder Warranty Expiration Date", "Builder Warranty Claim Info", "Furniture Pick List Link",
      "Alarm", "Alarm Code", "Security Cameras", "Security Camera Feed", "Cameras Monitoring Plan", "Monitoring Plan Exp. Date", "Smoke Detector Brand", "Smoke Detectors Power Type", "Smoke Detectors Battery Type", "Detectors Batteries Change Date", "Smoke Detector Model Number Photo", "Carbon Monoxide Detector Installed?", "Location of Carbon Monoxide Detector",
      "Breaker Box Location", "Indoor Water Shutoff Location", "Outdoor Water Shutoff Location", "Sprinkler System Brand", "Sprinkler System Location", "Sprinkler Control Panel Photo", "Sprinkler System Status", "Sprinkler System Set for Season?", "House has a 5 Year Old Fridge Water Filter", "Refrigerator Water Filter", "Photos of Refrigerator Water Filter and Type", "Storm Shelter Location & Access",
      "Backyard Pool / Hot Tub", "Heated Pool?", "Pool Heater Details", "Photo of Pool Heater", "Backyard Pool Season", "Backyard Pool Service Schedule", "Hot Tub Control Panel Location",
      "Neighborhood Name", "HOA?", "HOA Notes (General)", "Covenants", "Neighborhood Amenities?", "Neighborhood Amenities Access Information", "Strict Trash Rules", "Trash Day", "Recycling Day", "Holiday Trash Day", "Number of Trash Carts", "Mowing", "Mowing Day",
      "Air Filter Sizes", "Last Edit", "Last Edit By", "Added By", "Added On",
    ];
    expect(board.length).toBe(99);
    for (const l of board) expect(by.has(l)).toBe(true);
    for (const l of board) expect(by.get(l)?.judged).not.toBe(true);
    const codes = ["Access Codes", "Garage Trim Lockbox Code", "Garage Keypad Code", "Gate Code", "Closet Supply Box Code", "WiFi Password", "Alarm Code"];
    for (const l of codes) expect(flagsFor(by.get(l)!).code).toBe(true);
    for (const l of ["Furniture Pick List Link", "Security Camera Feed", "Covenants"]) expect(flagsFor(by.get(l)!).link).toBe(true);
    for (const l of ["Last Edit", "Last Edit By", "Added By", "Added On"]) expect(flagsFor(by.get(l)!).system).toBe(true);
    expect(REQUIRED_ITEMS.map((i) => i.label).sort()).toEqual(
      [
        "Alarm Code",
        "Breaker Box Location",
        "Fireplace Brand & Model Number",
        "Garage Remote Brand & Model",
        "Photos of Refrigerator Water Filter and Type",
        "Smoke Detector Model Number Photo",
      ].sort(),
    );
  });

  test("keys are unique so Go to it and Jump to land on one place", () => {
    const keys = ALL_PROFILE_ITEMS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    const ids = HOME_PROFILE_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Show empty fields", () => {
  test("off hides empty fields; on shows every label", () => {
    const entry = HOME_PROFILE_SECTIONS.find((s) => s.id === "entry")!;
    const shown = visibleItems(entry, home, false).map((i) => i.label);
    expect(shown).toContain("Smart Lock Brand");
    expect(shown).toContain("Gate Code");
    expect(shown).not.toContain("Mailbox Number");
    expect(visibleItems(entry, home, true).length).toBe(entry.items.length);
    expect(visibleItems(entry, empty, false)).toEqual([]);
  });

  test("stored shapes read as plain words", () => {
    const item = (label: string) => ALL_PROFILE_ITEMS.find((i) => i.label === label)!;
    expect(displayValue(item("Home Has Fireplace?"), home)).toBe("Yes");
    expect(displayValue(item("Trash Day"), home)).toBe("Monday, Thursday");
    expect(displayValue(item("Sprinkler System Set for Season?"), home)).toBe("Yes");
    expect(displayValue(item("Smoke Detector Brand"), home)).toBe("Kidde");
  });
});

describe("Search this home never shows a code", () => {
  test("a code matches only by its label and carries no value", () => {
    const hits = searchProfile("alarm code", home);
    expect(hits.map((h) => h.label)).toContain("Alarm Code");
    for (const h of hits.filter((h) => h.label === "Alarm Code")) expect(h.snippet).toBeNull();
  });

  test("search reads values and says where they are", () => {
    const hits = searchProfile("kidde", home);
    expect(hits).toEqual([
      { sectionId: "security", sectionTitle: "Security & Monitoring", itemKey: "smoke_brand", label: "Smoke Detector Brand", snippet: "Kidde" },
    ]);
  });

  test("the page data holds no code and no free text that could carry one", () => {
    const raw = pickProfileRaw({
      access_notes: "lockbox 1234",
      wifi_notes: "password hunter2",
      notes: "x",
      secret_ciphertext: "abc",
      nickname: "N",
    });
    expect(Object.keys(raw)).not.toContain("access_notes");
    expect(Object.keys(raw)).not.toContain("wifi_notes");
    expect(Object.keys(raw)).not.toContain("notes");
    expect(Object.keys(raw)).not.toContain("secret_ciphertext");
    expect(JSON.stringify(raw)).not.toContain("1234");
  });

  test("codes come only through the logged Show; the profile never paints a stored value", () => {
    const tab = readFileSync("src/components/property/HomeProfileTab.tsx", "utf8");
    expect(tab).toContain('action: "reveal"');
    expect(tab).toContain('"••••••"');
    expect(tab).not.toContain('action: "copy"');
  });

  test("leftover codes still show, under Other codes", () => {
    const other = ALL_PROFILE_ITEMS.find((i) => i.key === "other_codes")!;
    expect(codesFor(other, home).map((c) => c.label)).toEqual(["Roku PIN"]);
  });
});

describe("Missing for handoff", () => {
  test("the banner count is the required labels still empty", () => {
    expect(missingForHandoff(empty).length).toBe(REQUIRED_ITEMS.length);
    expect(REQUIRED_ITEMS.length).toBe(6);
    // home has garage remote, fireplace model, alarm code, breaker box, both photos
    expect(missingForHandoff(home).map((m) => m.item.label)).toEqual([]);
    const noAlarm = { ...home, credentials: home.credentials.filter((c) => c.id !== "c1") };
    expect(missingForHandoff(noAlarm).map((m) => m.item.label)).toEqual(["Alarm Code"]);
  });
});

describe("Editing", () => {
  test("only changed, editable items become changes, in the stored shape", () => {
    const entry = HOME_PROFILE_SECTIONS.find((s) => s.id === "entry")!;
    const changes = buildChanges(entry, { lock_brand: "Schlage", garage_remote: "Chamberlain 953EV", key_storage: "Front, Back" }, home);
    expect(changes).toEqual([
      { key: "lock_brand", label: "Smart Lock Brand", target: "json", column: "access", path: ["lock_brand"], value: "Schlage" },
      { key: "key_storage", label: "Keys in Garage Lockbox", target: "json", column: "access", path: ["key_storage"], value: ["Front", "Back"] },
    ]);
  });

  test("static system fields are never editable", () => {
    const m = HOME_PROFILE_SECTIONS.find((s) => s.id === "maintenance")!;
    expect(buildChanges(m, { last_edit: "x", added_by: "y" }, home)).toEqual([]);
  });

  test("the database save accepts exactly the items on the page, no more and no less", () => {
    const sql = readFileSync("docs/pending/property-page/03_strict_profile_items.sql", "utf8");
    const m = sql.match(/v_allowed constant jsonb := '(\{.*?\})'::jsonb/s);
    expect(m).not.toBeNull();
    const allowed = JSON.parse(m![1]!) as Record<string, string>;
    const expected: Record<string, string> = {};
    for (const i of ALL_PROFILE_ITEMS) {
      const s = i.src;
      if (s.kind === "column") expected[i.key] = `column:${s.column}`;
      else if (s.kind === "json") expected[i.key] = `json:${s.column}:${s.path.join(".")}`;
      else if (s.kind === "link" && s.editable) expected[i.key] = `link:${s.sourceField}`;
      else if (s.kind === "code") expected[i.key] = "code";
    }
    expect(allowed).toEqual(expected);
    for (const v of Object.values(allowed).filter((x) => x.startsWith("json:"))) expect(v).not.toContain(" ");
  });

  test("the save function writes only the listed columns and keeps codes out", () => {
    const sql = readFileSync("docs/pending/property-page/02_home_profile_edits.sql", "utf8");
    expect(sql).toContain("That item cannot be edited here.");
    expect(sql).not.toMatch(/'name'\s*,\s*'text'/);
    expect(sql).not.toContain("property_credentials SET");
    expect(sql).toContain("history only, never the value");
  });
});
