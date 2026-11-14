/**
 * One rule for history lines written after a save. The save itself is the
 * main fact; the history line is written next. When the history line fails,
 * the screen must say so instead of a plain success, and must not undo or
 * repeat the save (that would double it on retry).
 */

/** The shape every database write returns. */
export type WriteResult = { error: { message: string } | null | unknown };

/**
 * Writes a history line, trying once more if the first try fails.
 * Returns true only when a try saved with no error.
 */
export async function writeHistoryLine(write: () => PromiseLike<WriteResult>): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await write();
      if (!r.error) return true;
    } catch {
      // try again, then report
    }
  }
  return false;
}

export const HISTORY_MISSED = "the history line did not save";

/** What the toast says after a save: plain success, or a warning naming what is missing. */
export function savedToast(done: string, historySaved: boolean): { tone: "success" | "warning"; message: string } {
  const base = done.replace(/[.!]\s*$/, "");
  return historySaved
    ? { tone: "success", message: `${base}.` }
    : { tone: "warning", message: `${base}, but ${HISTORY_MISSED}.` };
}
