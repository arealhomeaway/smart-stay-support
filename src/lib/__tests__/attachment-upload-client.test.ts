import { describe, expect, it } from "bun:test";
import { createAttachmentUploader } from "../attachment-upload-client";
const file = new File(["fake"], "photo.jpg", { type: "image/jpeg" });
const intent = (f: File, key: string) => ({ entityType: "property" as const, entityId: "home", uploadKey: key, filename: f.name, mimeType: f.type, sizeBytes: f.size, category: null });
describe("existing upload retry path", () => {
  it("retries finalization without uploading bytes twice", async () => {
    let bytes = 0, completions = 0;
    const upload = createAttachmentUploader(async () => ({ documentId: "doc", alreadyStored: false as const, path: "path", token: "fake-test-token" }), async () => { completions++; if (completions === 1) throw new Error("Finalization failed"); return { ok: true as const }; }, intent, async () => { bytes++; });
    await expect(upload(file, () => {}, "key")).rejects.toThrow("Finalization failed");
    expect(await upload(file, () => {}, "key")).toBe("doc"); expect(bytes).toBe(1); expect(completions).toBe(2);
  });
  it("a failed transfer gets a fresh intent on retry and retains its original metadata", async () => {
    const keys: string[] = [], categories: (string | null | undefined)[] = []; let bytes = 0, category = "media";
    const upload = createAttachmentUploader(async ({ data }) => { keys.push(data.uploadKey); categories.push(data.category); return { documentId: "doc", alreadyStored: false as const, path: "path", token: "fake-test-token" }; }, async () => ({ ok: true as const }), (f, key) => ({ ...intent(f, key), category }), async () => { bytes++; if (bytes === 1) throw new Error("Transfer failed"); });
    await expect(upload(file, () => {}, "key")).rejects.toThrow("Transfer failed"); category = "other";
    expect(await upload(file, () => {}, "key")).toBe("doc"); expect(keys[0]).not.toBe(keys[1]); expect(categories).toEqual(["media", "media"]);
  });
});