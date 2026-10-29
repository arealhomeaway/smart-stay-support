import { describe, expect, it } from "bun:test";
import { zipSync, strToU8 } from "fflate";
import { openZip, prepareUploadSelection, ZIP_OPEN_ERROR, ZIP_SINGLE_ERROR } from "../zip-upload";
import { FileUploadQueue } from "../file-upload-queue";
import { MAX_FILE_BYTES, validateFile } from "../attachments";
import { ownerProgramDisplay } from "../owner-program-display";
import { ownerHoursEligibility } from "../owner-hours-eligibility";
import { OpportunityCreationReceipt } from "../create-opportunity-priority";
const bytes = strToU8("photo bytes");
const archive = (entries: Record<string, Uint8Array>) => new File([zipSync(entries)], "photos.zip", { type: "application/zip" });
describe("ZIP selection", () => {
  it("flattens folders, skips metadata and unsupported types, retaining archive order", async () => {
    const selection = await prepareUploadSelection([archive({ "first.jpg": bytes, "nested/second.png": bytes, "bad.exe": bytes, "__MACOSX/hidden.jpg": bytes, ".hidden.jpg": bytes, "nested/.secret/hidden.png": bytes, "folder/": new Uint8Array() })], true);
    expect(selection.files.map(f => f.name)).toEqual(["first.jpg", "second.png"]);
    expect(selection.messages).toEqual(["1 files skipped: not a supported type."]);
    expect(selection.files.every(f => validateFile(f).ok)).toBe(true);
    expect(await selection.files[0]?.text()).toBe("photo bytes");
  });
  it("rejects a corrupt or truncated ZIP", async () => {
    await expect(openZip(new Blob(["not a zip"]))).rejects.toThrow(ZIP_OPEN_ERROR);
    const good = archive({ "photo.jpg": bytes });
    await expect(openZip(good.slice(0, good.size - 2))).rejects.toThrow(ZIP_OPEN_ERROR);
  });
  it("rejects encrypted ZIPs", async () => {
    const data = new Uint8Array(await archive({ "photo.jpg": bytes }).arrayBuffer());
    for (let i = 0; i < data.length - 9; i++) if (data[i] === 80 && data[i + 1] === 75 && data[i + 2] === 1 && data[i + 3] === 2) data[i + 8] = 1;
    await expect(openZip(new Blob([data]))).rejects.toThrow(ZIP_OPEN_ERROR);
  });
  it("does not apply the 250 MB limit to the ZIP itself", async () => {
    // Valid self-extracting ZIP: large prefix, small stored photo and corrected central offsets.
    const data = new Uint8Array(await archive({ "photo.jpg": bytes }).arrayBuffer());
    const view = new DataView(data.buffer), prefixSize = MAX_FILE_BYTES + 1;
    const end = data.length - 22, central = view.getUint32(end + 16, true);
    view.setUint32(central + 42, prefixSize, true);
    view.setUint32(end + 16, central + prefixSize, true);
    const large = new Blob([new Uint8Array(prefixSize), data]);
    const opened = await openZip(large);
    expect(large.size).toBeGreaterThan(250 * 1024 * 1024);
    const queue = new FileUploadQueue<File, string>(async f => f.name);
    queue.add(opened.files); queue.start();
    for (let i = 0; i < 50 && queue.busy; i++) await new Promise(r => setTimeout(r, 1));
    expect(queue.results()).toEqual(["photo.jpg"]);
  }, 30000);
  it("single-file slot refuses multiple supported files and accepts one with skipped types", async () => {
    await expect(openZip(archive({ "a.jpg": bytes, "b.png": bytes }), false)).rejects.toThrow(ZIP_SINGLE_ERROR);
    const opened = await openZip(archive({ "bad.exe": bytes, "nested/a.jpg": bytes }), false);
    expect(opened.files.map(f => f.name)).toEqual(["a.jpg"]);
    expect(opened.skipped).toBe(1);
  });
  it("an invalid ZIP does not cancel other selected files", async () => {
    const chosen = await prepareUploadSelection([new File(["bad"], "bad.zip"), new File([bytes], "good.jpg", { type: "image/jpeg" })], true);
    expect(chosen.files.map(f => f.name)).toEqual(["good.jpg"]);
    expect(chosen.messages).toEqual([ZIP_OPEN_ERROR]);
  });
});
describe("program display before start", () => {
  it("hides countdown before start without restricting enrolled participation", () => {
    expect(ownerProgramDisplay("2026-11-10", "2026-10-29")).toEqual({ futureStart: "2026-11-10", showCountdown: false });
    expect(ownerHoursEligibility({ status: "active" }, [{ inclusionStatus: "included", closingDate: "2026-11-10" }], "2026-10-29").eligible).toBe(true);
  });
  it("shows normal countdown on the start date", () => {
    expect(ownerProgramDisplay("2026-10-29", "2026-10-29").showCountdown).toBe(true);
  });
});
describe("creation Owner priority", () => {
  it("unchecked creation never changes priority", async () => {
    let calls = 0;
    await new OpportunityCreationReceipt().save({ id: null, send: true }, false, async () => ({ id: "created" }), async () => { calls++; });
    expect(calls).toBe(0);
  });
  it("checked creation saves using the existing attention action and retained ID on retry", async () => {
    const receipt = new OpportunityCreationReceipt(), ids: (string | null)[] = [], flags: unknown[] = [];
    let attempt = 0;
    const save = async (v: { id: string | null; send: boolean }) => { ids.push(v.id); return { id: "saved" }; };
    const attention = async (id: string, on: boolean) => { flags.push([id, on]); if (++attempt === 1) throw new Error("Priority failed"); };
    await expect(receipt.save({ id: null, send: true }, true, save, attention)).rejects.toThrow("Priority failed");
    await receipt.save({ id: null, send: true }, true, save, attention);
    expect(ids).toEqual([null, "saved"]);
    expect(flags).toEqual([["saved", true], ["saved", true]]);
  });
});