import { describe, expect, it } from "bun:test";
import {
  DEFAULT_EXPORT_SETTINGS,
  EXPORT_PART_ROWS,
  buildExportManifest,
  copiedFilePath,
  exportFoldersToPrune,
  filesToCopy,
  inExportWindow,
  isWeeklyNight,
  keptRange,
  notCopiedReason,
  readExportSettings,
  runResult,
  sharePointSafeSegment,
  tablePartName,
  usesParts,
  verifyExport,
  type ExportManifest,
  type StoredFile,
} from "@/lib/nightly-export";

const file = (bucket: string, name: string, etag = "e1", size = 10): StoredFile => ({
  bucket,
  name,
  size,
  etag,
  mimetype: "image/jpeg",
  updated_at: null,
  owner_type: null,
  owner_id: null,
  owner_label: null,
});

function manifest(over: Partial<ExportManifest> = {}): ExportManifest {
  return buildExportManifest({
    folder: "2026-11-10",
    kind: "nightly",
    weekly: false,
    started_at: "2026-11-10T08:00:00Z",
    tables: [
      { table: "tickets", rows: 90, rows_at_start: 90, rows_at_end: 91, sha256: "a", bytes: 100, withheld_columns: [], files: [{ name: "tickets.json", rows: 90, sha256: "a", bytes: 100 }] },
      { table: "audit_log", rows: 10, rows_at_start: 10, rows_at_end: 10, sha256: "b", bytes: 50, withheld_columns: [], files: [{ name: "audit_log.json", rows: 10, sha256: "b", bytes: 50 }] },
    ],
    other_files: [{ name: "tickets.csv", rows: 90, sha256: "c", bytes: 30 }],
    stored_files: { inventoried: 2, copied: 2, bytes_copied: 20, failed: [], not_copied: [] },
    ...over,
  });
}
const sizes = { "tables/tickets.json": 100, "tables/audit_log.json": 50, "tickets.csv": 30 };

describe("nightly export settings (Emily, Nov 9)", () => {
  it("keeps 30 nightly and 12 weekly folders unless the setting says otherwise", () => {
    expect(readExportSettings(undefined)).toEqual({ dailyKeep: 30, weeklyKeep: 12, weeklyDay: 0 });
    expect(readExportSettings({ daily_keep: 14, weekly_keep: 4, weekly_day: 6 })).toEqual({ dailyKeep: 14, weeklyKeep: 4, weeklyDay: 6 });
    expect(readExportSettings({ daily_keep: 0, weekly_keep: "x" })).toEqual(DEFAULT_EXPORT_SETTINGS);
  });

  it("works between 2 and 5 AM Central, in daylight and standard time", () => {
    expect(inExportWindow(new Date("2026-12-01T08:00:00Z"))).toBe(true); // 2:00 AM CST
    expect(inExportWindow(new Date("2026-12-01T10:55:00Z"))).toBe(true); // 4:55 AM CST
    expect(inExportWindow(new Date("2026-12-01T11:05:00Z"))).toBe(false); // 5:05 AM CST
    expect(inExportWindow(new Date("2026-12-01T07:00:00Z"))).toBe(false); // 1:00 AM CST
    expect(inExportWindow(new Date("2026-07-01T07:05:00Z"))).toBe(true); // 2:05 AM CDT
    expect(inExportWindow(new Date("2026-07-01T10:05:00Z"))).toBe(false); // 5:05 AM CDT
  });

  it("makes the Sunday night the weekly full copy", () => {
    expect(isWeeklyNight("2026-11-15")).toBe(true); // Sunday
    expect(isWeeklyNight("2026-11-16")).toBe(false);
    expect(isWeeklyNight("TEST export 2026-11-15_0000Z")).toBe(false);
  });
});

describe("tables", () => {
  it("writes a table in numbered parts only when it has more rows than one file holds", () => {
    expect(usesParts(EXPORT_PART_ROWS)).toBe(false);
    expect(usesParts(EXPORT_PART_ROWS + 1)).toBe(true);
    expect(tablePartName("tickets", null)).toBe("tickets.json");
    expect(tablePartName("breezeway_webhook_events", 2)).toBe("breezeway_webhook_events.part-002.json");
  });

  it("the manifest lists every table, sorted, with its rows and total", () => {
    const m = manifest();
    expect(m.tables.map((t) => t.table)).toEqual(["audit_log", "tickets"]);
    expect(m.table_count).toBe(2);
    expect(m.total_rows).toBe(100);
  });
});

describe("stored files", () => {
  it("copies every file on the weekly night and only new or changed files on other nights", () => {
    const files = [file("resolve-attachments", "ticket/1/a.jpg"), file("resolve-attachments", "ticket/1/b.jpg", "e2"), file("avatars", "u/p.png")];
    const copied = new Map([
      ["resolve-attachments/ticket/1/a.jpg", { etag: "e1", size: 10 }],
      ["resolve-attachments/ticket/1/b.jpg", { etag: "old", size: 10 }],
    ]);
    expect(filesToCopy(files, copied, false).map((f) => f.name)).toEqual(["ticket/1/b.jpg", "u/p.png"]);
    expect(filesToCopy(files, copied, true)).toHaveLength(3);
  });

  it("never copies the database backups or old database dumps, and says why in the inventory", () => {
    const files = [file("backups", "2026/x.json"), file("database_export_24_08_26", "a.backup"), file("help-feedback", "u/a.png")];
    expect(filesToCopy(files, new Map(), true).map((f) => f.bucket)).toEqual(["help-feedback"]);
    expect(notCopiedReason("backups")).toContain("Not copied");
    expect(notCopiedReason("database_export_17_09_26")).toContain("login system");
    expect(notCopiedReason("resolve-attachments")).toBeNull();
  });

  it("keeps each copied file under files/<store>/<path> with names SharePoint accepts", () => {
    expect(copiedFilePath({ bucket: "resolve-attachments", name: "ticket/1/a:b?.jpg" })).toBe("files/resolve-attachments/ticket/1/a_b_.jpg");
    expect(sharePointSafeSegment("name. ")).toBe("name");
    expect(sharePointSafeSegment("..")).toBe("_");
  });
});

describe("verify each run", () => {
  it("passes when the manifest reads back, every file is there and rows only grew", () => {
    const v = verifyExport({ manifest: manifest(), manifestMatches: true, tablesAtStart: ["tickets", "audit_log"], remoteSizes: sizes, live: { tickets: 93, audit_log: 10 } });
    expect(v.status).toBe("passed");
    expect(v.rows_added_since).toBe(3);
    expect(v.lines.find((l) => l.table === "tickets")?.state).toBe("grew");
  });

  it("fails when the manifest cannot be read back or has changed", () => {
    const v = verifyExport({ manifest: manifest(), manifestMatches: false, tablesAtStart: [], remoteSizes: sizes, live: {} });
    expect(v.status).toBe("failed");
  });

  it("fails when a table is missing from the export", () => {
    const v = verifyExport({ manifest: manifest(), manifestMatches: true, tablesAtStart: ["tickets", "audit_log", "claims"], remoteSizes: sizes, live: { tickets: 90, audit_log: 10, claims: 36 } });
    expect(v.status).toBe("failed");
    expect(v.reasons).toContain("Table claims is missing from the export.");
  });

  it("fails when a file is missing in SharePoint or has the wrong size", () => {
    expect(verifyExport({ manifest: manifest(), manifestMatches: true, tablesAtStart: [], remoteSizes: { ...sizes, "tables/tickets.json": 99 }, live: {} }).status).toBe("failed");
    const { "tickets.csv": _drop, ...noCsv } = sizes;
    expect(verifyExport({ manifest: manifest(), manifestMatches: true, tablesAtStart: [], remoteSizes: noCsv, live: {} }).status).toBe("failed");
  });

  it("fails when a table saved fewer rows than it had while the export ran", () => {
    const m = manifest();
    m.tables[1] = { ...m.tables[1]!, rows: 89, rows_at_start: 90, rows_at_end: 91 };
    m.tables[1]!.files[0]!.rows = 89;
    const v = verifyExport({ manifest: m, manifestMatches: true, tablesAtStart: [], remoteSizes: sizes, live: { tickets: 91 } });
    expect(v.status).toBe("failed");
  });

  it("fails when a stored file could not be copied", () => {
    const m = manifest({ stored_files: { inventoried: 2, copied: 1, bytes_copied: 10, failed: [{ bucket: "b", name: "n", reason: "x" }], not_copied: [] } });
    expect(verifyExport({ manifest: m, manifestMatches: true, tablesAtStart: [], remoteSizes: sizes, live: {} }).status).toBe("failed");
  });

  it("shows fewer live rows without failing, and lists tables added since the run started", () => {
    const v = verifyExport({ manifest: manifest(), manifestMatches: true, tablesAtStart: ["tickets", "audit_log"], remoteSizes: sizes, live: { tickets: 90, audit_log: 9, brand_new: 0 } });
    expect(v.status).toBe("passed");
    expect(v.lines.find((l) => l.table === "audit_log")?.state).toBe("fewer");
    expect(v.new_tables).toEqual(["brand_new"]);
  });
});

describe("folders kept", () => {
  const nights = Array.from({ length: 120 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 6, 1 + i));
    const name = d.toISOString().slice(0, 10);
    return { name, itemId: `id-${name}`, weekly: d.getUTCDay() === 0 };
  });

  it("keeps the newest 30 nightly folders and the newest 12 weekly folders", () => {
    const pruned = exportFoldersToPrune(nights, DEFAULT_EXPORT_SETTINGS);
    const kept = nights.filter((n) => !pruned.some((p) => p.itemId === n.itemId));
    const newest30 = nights.slice(-30).map((n) => n.name);
    for (const n of newest30) expect(kept.map((k) => k.name)).toContain(n);
    const weekly = nights.filter((n) => n.weekly).slice(-12).map((n) => n.name);
    for (const n of weekly) expect(kept.map((k) => k.name)).toContain(n);
    expect(kept.length).toBe(new Set([...newest30, ...weekly]).size);
  });

  it("never touches a test folder or a folder it did not record", () => {
    const pruned = exportFoldersToPrune(
      [...nights, { name: "TEST export 2026-01-01_0000Z", itemId: "t", weekly: false }, { name: "Archive", itemId: "a", weekly: false }],
      { dailyKeep: 1, weeklyKeep: 0, weeklyDay: 0 },
    );
    expect(pruned.some((p) => p.itemId === "t" || p.itemId === "a")).toBe(false);
  });
});

describe("export check page", () => {
  it("names each run Passed, Failed, Running or Not checked", () => {
    expect(runResult({ phase: "done", status: "succeeded", verify_status: "passed" })).toBe("Passed");
    expect(runResult({ phase: "done", status: "failed", verify_status: "failed" })).toBe("Failed");
    expect(runResult({ phase: "files", status: "running", verify_status: null })).toBe("Running");
    expect(runResult({ phase: null, status: "succeeded", verify_status: null })).toBe("Not checked");
  });

  it("reports the oldest and newest folder still kept", () => {
    const r = keptRange([
      { folder_name: "2026-11-09", folder_item_id: "b", pruned_at: null },
      { folder_name: "2026-11-04", folder_item_id: "a", pruned_at: null },
      { folder_name: "2026-10-01", folder_item_id: "z", pruned_at: "2026-11-01T00:00:00Z" },
      { folder_name: "TEST export 2026-11-10_0400Z", folder_item_id: "t", pruned_at: null },
    ]);
    expect(r).toEqual({ oldest: "2026-11-04", newest: "2026-11-09", count: 2 });
  });
});
