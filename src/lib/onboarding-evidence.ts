/**
 * The one evidence rule for onboarding steps (Kati ticket 65).
 *
 * A step that needs evidence is satisfied by EITHER a stored file on the step
 * OR a typed note of at least five characters that says where the proof is.
 * A step never blocks completion because a file cannot be uploaded.
 * Pure and browser-safe: the drawer, the guided card, releaseState and the
 * server save all read this one rule.
 */
export const EVIDENCE_NOTE_MIN = 5;

export const EVIDENCE_PROBLEM =
  "Add a note that says where the proof is (at least 5 characters), or attach a file.";

export function evidenceNoteOk(note: string | null | undefined): boolean {
  return (note ?? "").trim().length >= EVIDENCE_NOTE_MIN;
}

export function evidenceSatisfied(input: {
  note: string | null | undefined;
  fileCount?: number | null | undefined;
}): boolean {
  return evidenceNoteOk(input.note) || (input.fileCount ?? 0) > 0;
}

/** The note saved when a file alone is the proof, so the record still says what proves it. */
export function fileEvidenceNote(fileName: string | null | undefined): string {
  const name = (fileName ?? "").trim();
  return name ? `Proof is the attached file: ${name}` : "Proof is the attached file.";
}

/** One shared bulk note, plus the file and the catch-up date when given. */
export function bulkEvidenceText(input: {
  note: string;
  fileName?: string | null | undefined;
  doneOn?: string | null | undefined;
}): string {
  const parts = [input.note.trim()];
  if (input.fileName?.trim()) parts.push(`File: ${input.fileName.trim()}`);
  if (input.doneOn) parts.push(`Done before Resolve on ${input.doneOn}.`);
  return parts.filter(Boolean).join("\n");
}

/** Why a bulk completion cannot be saved yet, or null when it can. */
export function bulkCompleteProblem(input: {
  note: string;
  hasFile: boolean;
  doneBeforeResolve: boolean;
  doneOn: string | null;
  today: string;
  count: number;
}): string | null {
  if (input.count < 1) return "Tick at least one task.";
  if (!evidenceSatisfied({ note: input.note, fileCount: input.hasFile ? 1 : 0 })) return EVIDENCE_PROBLEM;
  if (input.doneBeforeResolve) {
    if (!input.doneOn) return "Pick the date the work was done.";
    if (input.doneOn > input.today) return "The date the work was done cannot be in the future.";
  }
  return null;
}
