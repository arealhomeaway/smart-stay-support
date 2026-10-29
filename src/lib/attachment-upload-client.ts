import type { beginUploadFn, completeUploadFn } from "./attachments.functions";
import { uploadToSignedSlot } from "./signed-upload";

type Intent = Parameters<typeof beginUploadFn>[0]["data"];
/** Capture intent per selected file; retry finalization without re-sending stored bytes. */
export function createAttachmentUploader(
  begin: (input: { data: Intent }) => ReturnType<typeof beginUploadFn>,
  complete: (input: Parameters<typeof completeUploadFn>[0]) => ReturnType<typeof completeUploadFn>,
  intent: (file: File, key: string) => Intent,
) {
  const attempts = new Map<string, { input: Intent; bytesUploaded: boolean }>();
  return async (file: File, progress: (pct: number) => void, key: string) => {
    let attempt = attempts.get(key);
    if (!attempt) { attempt = { input: intent(file, key), bytesUploaded: false }; attempts.set(key, attempt); }
    const started = await begin({ data: attempt.input });
    if (!started.alreadyStored) {
      if (!attempt.bytesUploaded) {
        if (!started.token) throw new Error("The upload could not start.");
        try { await uploadToSignedSlot(started.path, started.token, file, progress); attempt.bytesUploaded = true; }
        catch (error) {
          // A failed intent cannot be reopened. A retry gets a fresh intent, not another live file.
          attempts.set(key, { input: { ...attempt.input, uploadKey: crypto.randomUUID() }, bytesUploaded: false });
          await complete({ data: { documentId: started.documentId, ok: false, fulfilsRequestId: attempt.input.fulfilsRequestId ?? null } });
          throw error;
        }
      }
      await complete({ data: { documentId: started.documentId, ok: true, fulfilsRequestId: attempt.input.fulfilsRequestId ?? null } });
    }
    return started.documentId;
  };
}