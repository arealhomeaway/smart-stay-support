/**
 * What a closure-evidence requirement actually asks for.
 *
 * `work_types.required_closure_evidence` is written as a sentence ("Photo of
 * the completed repair", "Confirmation from the guest"). QA found that a
 * coordinator could satisfy a photo requirement by typing a sentence into the
 * evidence box, so Resolve now reads the requirement and decides whether a real
 * attachment is needed.
 */

const FILE_WORDS =
  /\b(photo|photos|photograph|picture|pictures|image|images|video|videos|receipt|receipts|invoice|invoices|attachment|attachments|upload|uploads|scan|scans|document|documents|pdf|screenshot|screenshots)\b/i;

/** True when the requirement asks for a photo, file or other attachment. */
export function requiresPhotoOrFile(requirement: string | null | undefined): boolean {
  if (!requirement) return false;
  return FILE_WORDS.test(requirement);
}

export type EvidenceResponseKind = "text" | "description" | "file" | "qualifying_photo";

/** What the coordinator has actually provided against a requirement. */
export function evidenceResponseKinds(input: {
  text?: string | null;
  fileCount?: number;
  imageCount?: number;
}): EvidenceResponseKind[] {
  const kinds: EvidenceResponseKind[] = [];
  const text = String(input.text ?? "").trim();
  if (text) kinds.push("text", "description");
  if ((input.fileCount ?? 0) > 0) kinds.push("file");
  if ((input.imageCount ?? 0) > 0) kinds.push("qualifying_photo");
  return kinds;
}

/**
 * Is the closure-evidence requirement satisfied?
 *
 * A description alone is never enough for a photo/file requirement.
 */
export function closureEvidenceSatisfied(input: {
  requirement: string | null | undefined;
  text?: string | null;
  fileCount?: number;
}): boolean {
  if (!input.requirement || !String(input.requirement).trim()) return true;
  const hasText = String(input.text ?? "").trim().length > 0;
  if (requiresPhotoOrFile(input.requirement)) return (input.fileCount ?? 0) > 0;
  return hasText;
}
