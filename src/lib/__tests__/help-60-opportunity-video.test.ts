import { describe, it, expect } from "bun:test";
import { zipSync } from "fflate";
import { prepareUploadSelection, ZIP_COMPRESSION_ERROR } from "../zip-upload";
import { FileUploadQueue } from "../file-upload-queue";
import { MAX_FILE_BYTES } from "../attachments";
const MB = 1024 * 1024;
const bytes = (n: number) => { const a = new Uint8Array(n); for (let i = 0; i < n; i += 65536) crypto.getRandomValues(a.subarray(i, Math.min(n, i + 65536))); return a; };
const sized = (name: string, type: string, size: number) => { const f = new File([], name, { type }); Object.defineProperty(f, "size", { value: size }); return f; };

describe("Help ticket 60: Opportunity video attachments", () => {
  it("keeps the 250 MB per-file limit", () => { expect(MAX_FILE_BYTES).toBe(250 * MB); });

  it("a ~58 MB ZIP with one video unpacks into that video, ready to upload", async () => {
    const zip = zipSync({ "walkthrough.mp4": [bytes(58 * MB) as Uint8Array<ArrayBuffer>, { level: 1 }] });
    const r = await prepareUploadSelection([new File([zip as BlobPart], "walkthrough.zip", { type: "application/x-zip-compressed" })], true);
    expect(r.messages).toEqual([]);
    expect(r.files.map(f => [f.name, f.type])).toEqual([["walkthrough.mp4", "video/mp4"]]);
  });

  it("a ZIP using Deflate64 says exactly why and what to do", async () => {
    const zip = zipSync({ "walkthrough.mp4": [bytes(1024), { level: 0 }] }); const v = new DataView(zip.buffer);
    for (let i = 0; i < zip.length - 4; i++) { const s = v.getUint32(i, true); if (s === 0x04034b50) v.setUint16(i + 8, 9, true); if (s === 0x02014b50) v.setUint16(i + 10, 9, true); }
    const r = await prepareUploadSelection([new File([zip as BlobPart], "w.zip")], true);
    expect(r.messages).toEqual([ZIP_COMPRESSION_ERROR]);
  });

  for (const mb0 of [60, 130, 250]) it(`a ${mb0} MB MP4 is accepted and uploads once started automatically`, async () => { const mb = mb0;
    const sent: number[] = [];
    const q = new FileUploadQueue<File, string>(async f => { sent.push(f.size); return "doc"; });
    q.add([sized("v.mp4", "video/mp4", mb * MB)]); q.start();
    await new Promise(r => setTimeout(r, 0));
    expect(q.snapshot()[0]?.status).toBe("done"); expect(sent).toEqual([mb * MB]);
  });

  it("a 251 MB MP4 is refused before upload with the link instruction", () => {
    const q = new FileUploadQueue<File, string>(async () => "doc");
    q.add([sized("v.mp4", "video/mp4", 251 * MB)]);
    expect(q.snapshot()[0]?.status).toBe("failed"); expect(/250 MB.*link/.test(q.snapshot()[0]?.reason ?? "")).toBe(true);
  });
});
