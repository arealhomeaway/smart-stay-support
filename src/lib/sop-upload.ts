import { z } from "zod";
import { playbookContentSchema } from "./playbook-editing";
import { SITUATIONS } from "./situations";
import { CHECKLIST_CATEGORIES } from "./ticket-checklists";

export const SOP_MAX_BYTES = 20 * 1024 * 1024;
export const SOP_UPLOAD_HINT = "Upload an SOP here to turn it into a playbook.";
export const SOP_NOT_SAVED = "Saved nothing. Try again or check Admin > Integrations";
export function validateSopFile(file: { name: string; size: number }) {
  if (file.size > SOP_MAX_BYTES) throw new Error("File too large. Choose a file of 20 MB or less.");
  if (file.size === 0) throw new Error("This file is empty. Choose a Word or PDF file.");
  if (!/\.(docx|pdf)$/i.test(file.name)) throw new Error("Choose a Word (.docx) or PDF file.");
  if (/[\\/:*?"<>|\x00-\x1f]/.test(file.name)) throw new Error("Rename the file without special characters and try again.");
}
export function sopVersionName(name: string, version: number) {
  const dot = name.lastIndexOf(".");
  return `${name.slice(0, dot)} v${version}${name.slice(dot)}`;
}
export const sopDraftSchema = z.object({
  previousPlaybookId: z.string().uuid().nullable(),
  situations: z.array(z.string()).refine((ids) => ids.every((id) => SITUATIONS.some((s) => s.id === id))),
  checklistCategories: z.array(z.string()).refine((ids) => ids.every((id) => CHECKLIST_CATEGORIES.some((s) => s.id === id))),
  content: playbookContentSchema,
});
export const sopDraftsSchema = z.object({ drafts: z.array(sopDraftSchema).min(1).max(40) });
export type SopDraft = z.infer<typeof sopDraftSchema>;
export type SopReceipt = { sopId: string; title: string; version: number; draftIds: string[] };
export type SopLink = { title: string; version: number; file_url: string; latest_version: number };
export function sopNeedsReview(link: SopLink | null | undefined, status: string) {
  return Boolean(link && link.latest_version > link.version && status !== "retired");
}

/** All external work precedes the one transactional commit. Cleanup never guesses after an uncertain commit. */
export async function performSopUpload(deps: {
  generate: () => Promise<SopDraft[]>;
  reserve: () => Promise<{ id: string; version: number }>;
  upload: (version: number) => Promise<{ id: string; driveId: string; url: string }>;
  commit: (id: string, file: { id: string; driveId: string; url: string }, drafts: SopDraft[]) => Promise<SopReceipt>;
  receipt: (id: string) => Promise<SopReceipt | null>;
  removeFile: (file: { id: string; driveId: string }) => Promise<void>;
  abort: (id: string) => Promise<void>;
}): Promise<SopReceipt> {
  const drafts = sopDraftsSchema.parse({ drafts: await deps.generate() }).drafts;
  const reservation = await deps.reserve();
  let file: { id: string; driveId: string; url: string } | undefined;
  try {
    file = await deps.upload(reservation.version);
    try { return await deps.commit(reservation.id, file, drafts); }
    catch (error) {
      let receipt: SopReceipt | null;
      try { receipt = await deps.receipt(reservation.id); }
      catch { throw new Error("Could not confirm the save. Check Playbooks before trying again."); }
      if (receipt) return receipt;
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Could not confirm")) throw error;
    try { if (file) await deps.removeFile(file); await deps.abort(reservation.id); }
    catch { throw new Error("Cleanup could not be confirmed. Check Admin > Integrations before trying again."); }
    throw new Error(SOP_NOT_SAVED);
  }
}