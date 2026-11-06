import { describe, expect, it, mock } from "bun:test";
import { unzipSync } from "fflate";

mock.module("@/integrations/lovable/appUserConnector", () => ({ callAsAppUser: async () => new Response("", { status: 500 }) }));
mock.module("../sharepoint-connection.server", () => ({ getServiceSharePointConnectionKey: async () => "k" }));

const { decidePhotoAccess, streamPhotoZip, startPhotoDownloadCore, sha256Hex } = await import("../marketing-photos.server");
const { marketingPhotosFolderPath, summarizePhotos, staffFolderResult, isPhotoCard, PHOTOS_NOT_READY } = await import("../marketing-photos");

const home = { address_line1: "624 Daniel Court", name: "624 Daniel Court", ownerrez_property_id: "123456" };

describe("who can download", () => {
  it("an owner can download only their own home", () => {
    expect(decidePhotoAccess({ isStaff: false, ownsHome: true, signedIn: true }).allow).toBe(true);
    expect(decidePhotoAccess({ isStaff: false, ownsHome: false, signedIn: true }).allow).toBe(false);
  });
  it("signed-out callers are refused", () => {
    expect(decidePhotoAccess({ isStaff: true, ownsHome: true, signedIn: false }).allow).toBe(false);
  });
  it("the download SQL checks ownership in the database too", async () => {
    const sql = await Bun.file("docs/pending/ao-marketing-photos/01_marketing_photo_downloads.sql").text();
    expect(sql.includes("public.is_staff(uid) OR public.owner_property_access(_property_id, uid)")).toBe(true);
    expect(sql.includes("d.started_at IS NULL AND d.expires_at > now()")).toBe(true);
  });
});

describe("folder and summary", () => {
  it("uses Homes/<address> (<OwnerRez ID>)/Marketing Photos", () => {
    expect(marketingPhotosFolderPath(home)).toBe("Homes/624 Daniel Court (123456)/Marketing Photos");
  });
  it("empty or missing folder means photos aren't ready", () => {
    expect(summarizePhotos([]).ready).toBe(false);
    expect(summarizePhotos(null).ready).toBe(false);
    expect(summarizePhotos([{ id: "1", name: "notes.docx", size: 5, modified: null }]).ready).toBe(false);
    expect(PHOTOS_NOT_READY).toBe("Photos aren't ready yet");
  });
  it("shows count and latest update date", () => {
    const s = summarizePhotos([
      { id: "1", name: "a.jpg", size: 10, modified: "2026-11-01T10:00:00Z" },
      { id: "2", name: "b.JPG", size: 20, modified: "2026-11-03T10:00:00Z" },
    ]);
    expect(s).toEqual({ ready: true, count: 2, bytes: 30, updatedAt: "2026-11-03T10:00:00Z", tooLarge: false });
  });
  it("staff get the folder link", () => {
    const r = staffFolderResult(home, "https://sp/folder", summarizePhotos([]));
    expect(r.url).toBe("https://sp/folder");
    expect(r.path).toBe("Documents/Homes/624 Daniel Court (123456)/Marketing Photos");
  });
  it("P14, P15 and P20 are photo cards", () => {
    for (const c of ["P14", "P15", "P20"]) expect(isPhotoCard(c)).toBe(true);
    expect(isPhotoCard("A31")).toBe(false);
  });
});

describe("streaming zip", () => {
  it("reads each photo only as the zip is consumed and produces a valid zip", async () => {
    const opened: string[] = [];
    const open = async (id: string) => {
      opened.push(id);
      return new ReadableStream<Uint8Array>({
        start(c) { c.enqueue(new TextEncoder().encode(`photo-${id}-part1`)); c.enqueue(new TextEncoder().encode("-part2")); c.close(); },
      });
    };
    const stream = streamPhotoZip(
      [
        { id: "1", name: "a.jpg", size: 1, modified: null },
        { id: "2", name: "a.jpg", size: 1, modified: null },
        { id: "3", name: "skip.txt", size: 1, modified: null },
      ],
      open,
    );
    expect(opened.length).toBe(0);
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(["a (2).jpg", "a.jpg"]);
    expect(new TextDecoder().decode(files["a.jpg"])).toBe("photo-1-part1-part2");
    expect(opened).toEqual(["1", "2"]);
  });
});

describe("download log", () => {
  it("logs the home, count and a hash of the single-use link", async () => {
    const calls: unknown[] = [];
    const r = await startPhotoDownloadCore({
      propertyId: "p1", count: 3, bytes: 99, token: "a".repeat(64),
      log: async (args) => { calls.push(args); return { error: null }; },
    });
    expect(r.url).toBe(`/api/public/marketing-photos/${"a".repeat(64)}`);
    expect(calls).toEqual([{ _property_id: "p1", _token_hash: await sha256Hex("a".repeat(64)), _file_count: 3, _total_bytes: 99 }]);
  });
  it("refuses to start when the log cannot be saved", async () => {
    await expect(startPhotoDownloadCore({ propertyId: "p1", count: 1, bytes: 1, log: async () => ({ error: { message: "x" } }) })).rejects.toThrow("Nothing was downloaded");
  });
});
