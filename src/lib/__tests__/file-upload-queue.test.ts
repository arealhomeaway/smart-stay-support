import { describe, expect, it } from "bun:test";
import { FileUploadQueue } from "../file-upload-queue";
import { MAX_FILE_BYTES, OVERSIZE_LINK_MESSAGE, ZIP_UPLOAD_MESSAGE, validateFile } from "../attachments";
const photo = (name: string) => ({ name, type: "image/jpeg", size: 100 });
async function settled(queue: FileUploadQueue<ReturnType<typeof photo>, string>) {
  for (let i = 0; i < 100 && queue.busy; i++) await new Promise(resolve => setTimeout(resolve, 1));
  expect(queue.busy).toBe(false);
}
describe("multiple photos", () => {
  it("isolates a failure and attaches successes in selection order, not completion order", async () => {
    const queue = new FileUploadQueue(async file => {
      if (file.name === "bad.jpg") throw new Error("Connection lost");
      await new Promise(resolve => setTimeout(resolve, file.name === "first.jpg" ? 8 : 1));
      return file.name;
    });
    queue.add([photo("first.jpg"), photo("bad.jpg"), photo("last.jpg")]); queue.start(); await settled(queue);
    expect(queue.results()).toEqual(["first.jpg", "last.jpg"]);
    expect(queue.rows[1]?.reason).toBe("Connection lost");
  });
  it("never runs more than three uploads at once", async () => {
    let active = 0, peak = 0;
    const queue = new FileUploadQueue(async file => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 3)); active--; return file.name; });
    queue.add(Array.from({ length: 10 }, (_, i) => photo(`${i}.jpg`))); queue.start(); await settled(queue);
    expect(peak).toBe(3); expect(queue.results().length).toBe(10);
  });
  it("retries only the failed file, retaining its selected position and queue identity", async () => {
    const calls: string[] = [], keys: string[] = [];
    const queue = new FileUploadQueue(async (file, progress, key) => { calls.push(file.name); keys.push(key); progress(50); if (file.name === "retry.jpg" && calls.filter(n => n === file.name).length === 1) throw new Error("Try again"); return file.name; });
    queue.add([photo("retry.jpg"), photo("ok.jpg")]); queue.start(); await settled(queue);
    const failed = queue.rows[0]; if (!failed) throw new Error("Missing selected file");
    queue.retry(failed.id); await settled(queue);
    expect(calls).toEqual(["retry.jpg", "ok.jpg", "retry.jpg"]); expect(keys[0]).toBe(keys[2]);
    expect(queue.results()).toEqual(["retry.jpg", "ok.jpg"]); expect(failed.progress).toBe(100);
  });
  it("rejects ZIPs before any upload and gives the approved guidance", async () => {
    let calls = 0;
    const queue = new FileUploadQueue(async file => { calls++; return file.name; });
    queue.add([{ name: "photos.ZIP", size: 100, type: "application/zip" }]); queue.start(); await settled(queue);
    expect(calls).toBe(0); expect(queue.rows[0]?.reason).toBe(ZIP_UPLOAD_MESSAGE);
    expect(validateFile({ name: "photos", type: "application/x-zip-compressed", size: 100 })).toEqual({ ok: false, message: ZIP_UPLOAD_MESSAGE });
  });
  it("keeps the 250 MB per-file boundary and existing oversized guidance", async () => {
    let calls = 0;
    const queue = new FileUploadQueue(async file => { calls++; return file.name; });
    queue.add([{ ...photo("large.jpg"), size: MAX_FILE_BYTES + 1 }, { ...photo("allowed.jpg"), size: 250 * 1024 * 1024 }]); queue.start(); await settled(queue);
    expect(calls).toBe(1); expect(queue.rows[0]?.reason).toBe(OVERSIZE_LINK_MESSAGE);
    expect(queue.results()).toEqual(["allowed.jpg"]);
  });
});