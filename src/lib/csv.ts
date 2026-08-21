/**
 * A small, strict CSV reader.
 *
 * Exports out of Notion and spreadsheets wrap commas and newlines in quotes,
 * so splitting on commas mangles them. This walks the text properly instead.
 */

/** Splits CSV text into rows of cells. Handles quotes, escaped quotes and newlines inside fields. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");

  const endCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.length > 0)) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      endCell();
    } else if (ch === "\r") {
      // handled by the \n that follows
    } else if (ch === "\n") {
      endRow();
    } else {
      cell += ch;
    }
  }
  endRow();
  return rows;
}

/** Reads a CSV with a header row into keyed records. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      if (key) record[key] = cells[index] ?? "";
    });
    return record;
  });
}
