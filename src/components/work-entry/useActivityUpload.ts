import { useServerFn } from "@tanstack/react-start";
import { beginUploadFn, completeUploadFn } from "@/lib/attachments.functions";
import { validateFile } from "@/lib/attachments";

/**
 * Uploads Property Activity files through the shared Resolve attachment path
 * (property-level record, Operations shelf). Same checks as every other upload.
 * Returns the stored document ids to link on the activity entry.
 */
export function useActivityUpload() {
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  return async (propertyId: string, files: File[], onProgress?: (msg: string) => void): Promise<string[]> => {
    const ids: string[] = [];
    for (const file of files) {
      const check = validateFile({ name: file.name, type: file.type, size: file.size });
      if (!check.ok) throw new Error(check.message);
      onProgress?.(`Uploading ${file.name}…`);
      const started = await begin({
        data: {
          entityType: "property",
          entityId: propertyId,
          uploadKey: crypto.randomUUID(),
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          category: "operations",
          note: "Property Activity attachment",
        },
      });
      if (!started.alreadyStored) {
        try {
          const { uploadToSignedSlot } = await import("@/lib/signed-upload");
          await uploadToSignedSlot(started.path, started.token!, file);
        } catch (err) {
          await complete({ data: { documentId: started.documentId, ok: false } });
          throw err instanceof Error ? err : new Error("The upload did not finish.");
        }
        await complete({ data: { documentId: started.documentId, ok: true } });
      }
      ids.push(started.documentId);
    }
    return ids;
  };
}
