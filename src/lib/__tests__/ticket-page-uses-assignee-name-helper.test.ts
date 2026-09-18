import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Source-level guard (no DOM harness in this repo — see the other
 * __tests__ files) that the Ticket page's "Assigned to" display actually
 * routes through ticketAssigneeName() rather than an inline fallback that
 * could regress back to reading a loading profile lookup as Unassigned.
 */
describe("tickets.$ticketId.tsx — 'Assigned to' uses the no-intermediate-Unassigned helper", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../../routes/_authenticated/tickets.$ticketId.tsx"), "utf8");

  it("imports ticketAssigneeName from the shared tickets lib", () => {
    expect(src).toContain("ticketAssigneeName");
  });

  it('derives assigneeName from the helper, not an inline ?? "Unassigned" fallback', () => {
    expect(src).toContain("const assigneeName = ticketAssigneeName(ownerId, assignee);");
    expect(src).not.toContain('assignee?.full_name ?? assignee?.email ?? "Unassigned"');
  });
});
