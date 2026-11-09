import { describe, expect, it } from "bun:test";
import { mapComment, mapPageNotes } from "@/lib/notion-import/mapping";

// Rule (Emily, Nov 9; register N1, N5): a ticket's page notes carry no date of
// their own, so they take the ticket's Notion created date. Comments keep their own date.

describe("page notes take the ticket's Notion created date", () => {
  it("uses the ticket created date for the page notes", () => {
    const row = mapPageNotes("page-1", "Carpet stain in the living room", "2026-10-28");
    expect(row.created_at).toBe("2026-10-28");
    expect(row.external_id).toBe("body:page-1");
    expect(row.author).toBe("Notion page notes");
  });

  it("never leaves the page notes with a blank date when the ticket has one", () => {
    expect(mapPageNotes("page-2", "Notes", "2026-10-22T14:05:00.000Z").created_at).not.toBe("");
  });

  it("a comment keeps its own Notion date, not the ticket date", () => {
    const c = mapComment({ id: "c1", created_time: "2026-10-30T09:00:00.000Z", rich_text: [] }, "Coordinator");
    expect(c.created_at).toBe("2026-10-30T09:00:00.000Z");
  });
});
