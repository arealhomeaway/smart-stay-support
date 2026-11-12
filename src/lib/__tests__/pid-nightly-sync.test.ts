import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { PID_MAPPING_V1 } from "@/lib/pid-sync/mapping-v1";
import { homeWrites, planPidRefresh, type PidPage, type PidSnapshot } from "@/lib/pid-sync/plan";
import { CREDENTIAL_FIELD_RULES, planCredential } from "@/lib/pid-sync/credentials-plan";
import { extraValue, pidExtraFields } from "@/lib/pid-sync/extras";
import { pidSyncDue, pidSyncPassAction, centralDate } from "@/lib/pid-sync/schedule";
import { reviewRows } from "@/lib/pid-sync/run.server";

/** Nightly PID copy rules (approved by the Admin, Nov 12, 2026). Pure; no Notion, no database. */

const HOME = "00000000-0000-4000-8000-0000000000a1";
const PAGE = "page-1";
const rt = (s: string) => ({ type: "rich_text", rich_text: s ? [{ plain_text: s }] : [] });
const num = (n: number | null) => ({ type: "number", number: n });
const page = (props: Record<string, any>, edited = "2026-11-11T10:00:00.000Z"): PidPage => ({
  id: PAGE,
  last_edited_time: edited,
  properties: { Property: { type: "title", title: [{ plain_text: "101 Test Way" }] }, "OwnerRez Internal ID": rt("ORP500001"), ...props },
});
const snapshot = (prop: Record<string, any>, over: Partial<PidSnapshot> = {}): PidSnapshot => ({
  properties: [{ id: HOME, name: "101 Test Way", ownerrez_property_id: "500001", is_demo: false, ...prop }],
  provenance: [],
  edits: [],
  links: [],
  ...over,
});
const prov = (field_key: string, value_source = "notion_pid", updated_at = "2026-09-01T12:00:00+00:00") => ({ property_id: HOME, field_key, value_source, as_of: updated_at, updated_at });
const plan = (p: PidPage, s: PidSnapshot) => planPidRefresh([p], s, { withholdRedacted: true }).homes[0]!;
const change = (h: ReturnType<typeof plan>, field: string) => h.changes.find((c) => c.field === field);

describe("the mapping is the approved Sep 1 mapping", () => {
  it("matches every row of docs/pending/pid-import-mapping-v1.md", () => {
    const md = readFileSync("docs/pending/pid-import-mapping-v1.md", "utf8");
    const rows = md.split("\n").filter((l) => l.startsWith("| ")).map((l) => l.split("|").map((s) => s.trim())).filter((c) => c.length >= 13 && /^\d+$/.test(c[1]!));
    expect(rows).toHaveLength(166);
    expect(PID_MAPPING_V1.map((m) => [m.i, m.name, m.action, m.target, m.authority])).toEqual(rows.map((c) => [Number(c[1]), c[2]!.replace(/\*\*/g, ""), c[7]!, c[6]!, c[8]!]));
  });
});

describe("overwrite rule: a value changed in Resolve is never overwritten", () => {
  const p = page({ "Property Nickname": rt("New name") });

  it("updates a value that still came from the PID and nobody changed", () => {
    const h = plan(p, snapshot({ nickname: "Old name" }, { provenance: [prov("nickname")] }));
    expect(change(h, "nickname")).toMatchObject({ kind: "update", current: "Old name", notion: "New name" });
    expect(homeWrites(h).map((w) => w.field)).toEqual(["nickname"]);
  });

  it("puts an edit made in Resolve after the copy on the review list", () => {
    const h = plan(p, snapshot({ nickname: "Typed in Resolve" }, { provenance: [prov("nickname")], edits: [{ property_id: HOME, field_key: "nickname", at: "2026-10-01T00:00:00+00:00" }] }));
    expect(change(h, "nickname")).toMatchObject({ kind: "conflict", conflictWith: "Resolve" });
    expect(homeWrites(h)).toHaveLength(0);
    expect(reviewRows(h).map((r) => r.kind)).toContain("resolve_changed");
  });

  it("never overwrites a value another source set", () => {
    const h = plan(p, snapshot({ nickname: "Staff" }, { provenance: [prov("nickname", "staff_entry")] }));
    expect(change(h, "nickname")?.kind).toBe("conflict");
    expect(homeWrites(h)).toHaveLength(0);
  });

  it("never overwrites a value that no longer matches what the last copy wrote", () => {
    const h = plan(p, snapshot({ nickname: "Changed quietly" }, { provenance: [prov("nickname")], changedSinceCopy: new Set([`${HOME}|nickname`]) }));
    expect(change(h, "nickname")?.kind).toBe("conflict");
    expect(homeWrites(h)).toHaveLength(0);
  });

  it("never writes an OwnerRez field; a difference is listed", () => {
    const h = plan(page({ Bedrooms: num(5) }), snapshot({ bedrooms: 4 }, { provenance: [prov("market")] }));
    expect(change(h, "bedrooms")).toMatchObject({ kind: "conflict", conflictWith: "OwnerRez" });
    expect(homeWrites(h).some((w) => w.field === "bedrooms")).toBe(false);
  });

  it("never changes the home's status set in Resolve", () => {
    const h = plan(page({ Status: { type: "select", select: { name: "In Preparation" } } }), snapshot({ lifecycle_status: "handoff" }, { provenance: [prov("lifecycle_status")] }));
    expect(change(h, "lifecycle_status")?.kind).toBe("conflict");
    expect(homeWrites(h)).toHaveLength(0);
  });

  it("fills a blank field on a home never copied before", () => {
    const h = plan(p, snapshot({ nickname: null }));
    expect(change(h, "nickname")).toMatchObject({ kind: "fill", notion: "New name" });
  });
});

describe("blank rule: a blank in Notion never clears a value", () => {
  it("leaves the Resolve value alone when the PID field is empty", () => {
    const h = plan(page({ "Property Nickname": rt("") }), snapshot({ nickname: "Keep me" }, { provenance: [prov("nickname")] }));
    expect(h.changes.some((c) => c.field === "nickname")).toBe(false);
    expect(homeWrites(h)).toHaveLength(0);
  });
  it("keeps the last From the PID value when the field is now empty", () => {
    expect(extraValue(num(null), new Map())).toBeNull();
    expect(extraValue(rt(""), new Map())).toBeNull();
    expect(extraValue({ type: "files", files: [] }, new Map())).toBeNull();
  });
  it("never clears a code when the PID code field is empty", () => {
    const rule = CREDENTIAL_FIELD_RULES.find((r) => r.field === "Gate Code")!;
    expect(planCredential("", rule, [{ id: "c1", source: "notion_pid", active: true, updated_at: "x", secret: "1234" }]).op).toBe("skip");
    expect(planCredential("N/A", rule, []).op).toBe("skip");
  });
});

describe("credential rule: codes go only to the protected vault", () => {
  const gate = CREDENTIAL_FIELD_RULES.find((r) => r.field === "Gate Code")!;

  it("never carries a code field into the property values, the review list or From the PID", () => {
    const h = plan(page({ "Gate Code": rt("#4821"), "WiFi Password": rt("Sunny2024!") }), snapshot({}));
    const text = JSON.stringify({ c: h.changes, r: reviewRows(h), w: h.withheld });
    expect(text).not.toContain("4821");
    expect(text).not.toContain("Sunny2024");
    expect(pidExtraFields({ "Gate Code": "rich_text", "WiFi Password": "rich_text", Owner: "relation" })).toEqual(["Owner"]);
  });

  it("files a new code, updates the PID's own code, and keeps a code changed in Resolve", () => {
    expect(planCredential("4821", gate, []).op).toBe("insert");
    expect(planCredential("4821", gate, [{ id: "c1", source: "notion_pid", active: true, updated_at: "t", secret: "4821" }]).op).toBe("same");
    expect(planCredential("9999", gate, [{ id: "c1", source: "notion_pid", active: true, updated_at: "t", secret: "4821" }])).toEqual({ op: "update", id: "c1", expectedUpdatedAt: "t" });
    expect(planCredential("9999", gate, [{ id: "c1", source: "staff_entry", active: true, updated_at: "t", secret: "4821" }]).op).toBe("kept");
    expect(planCredential("9999", gate, [{ id: "c1", source: "notion_pid", active: false, updated_at: "t", secret: "4821" }]).op).toBe("kept");
  });

  it("withholds text that may hold a code and keeps it out of the review list", () => {
    const h = plan(page({ "Neighborhood Amenities Access Information": rt("Clubhouse. The Pool Code is: 42909") }), snapshot({}));
    const notes = PID_MAPPING_V1.find((m) => m.name === "Neighborhood Amenities Access Information");
    if (!notes) throw new Error("mapping row missing");
    expect(homeWrites(h)).toHaveLength(0);
    expect(h.withheld).toHaveLength(1);
    expect(h.withheld[0]!.notionRaw).toContain("42909");
    expect(JSON.stringify(reviewRows(h))).not.toContain("42909");
  });

  it("withholds text the Sep 1 scrub had to redact instead of copying the marker", () => {
    const h = plan(page({ "Neighborhood Amenities Access Information": rt("Front door passcode 7781 then push") }), snapshot({}));
    expect(homeWrites(h)).toHaveLength(0);
    expect(h.withheld[0]?.side).toBe("Notion");
  });
});

describe("From the PID fields", () => {
  it("lists PID fields with no place on the page; formulas and buttons stay out", () => {
    const f = pidExtraFields({ Owner: "relation", "Base Price": "number", "Home ID": "formula", "Archive this Property": "button", "Property Nickname": "rich_text", City: "rich_text", "Front Photo": "files", "Garage Remote Photo": "files" });
    expect(f).toEqual(["Base Price", "Garage Remote Photo", "Owner"]);
  });
  it("shows linked records by title and photo fields by count", () => {
    const titles = new Map([["abc123", "Jane Owner"]]);
    expect(extraValue({ type: "relation", relation: [{ id: "abc-123" }] }, titles)).toEqual({ type: "list", items: ["Jane Owner"] });
    expect(extraValue({ type: "files", files: [{}, {}] }, titles)).toEqual({ type: "files", count: 2 });
  });
});

describe("schedule: 2 AM Central, once a night, resumes an unfinished run", () => {
  const at = (iso: string) => new Date(iso);
  it("starts only in the 2 AM Central hour", () => {
    expect(pidSyncDue(at("2026-11-13T08:05:00Z"), null)).toBe(true); // 2:05 AM CST
    expect(pidSyncDue(at("2026-11-13T09:05:00Z"), null)).toBe(false); // 3:05 AM
    expect(pidSyncDue(at("2026-07-13T07:05:00Z"), null)).toBe(true); // 2:05 AM CDT
    expect(pidSyncDue(at("2026-11-13T08:30:00Z"), "2026-11-13T08:05:00Z")).toBe(false);
  });
  it("continues a run that is still going and closes one that never finished", () => {
    expect(pidSyncPassAction(at("2026-11-13T08:40:00Z"), { status: "processing", created_at: "2026-11-13T08:05:00Z" })).toBe("continue");
    expect(pidSyncPassAction(at("2026-11-13T15:00:00Z"), { status: "processing", created_at: "2026-11-13T08:05:00Z" })).toBe("close_stale");
    expect(centralDate(at("2026-11-13T08:05:00Z"))).toBe("2026-11-13");
  });
});
