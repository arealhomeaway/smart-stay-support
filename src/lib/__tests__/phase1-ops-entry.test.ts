import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");
describe("Phase 1 Operations entry points", () => {
  it("top-bar Record work shows on My Work and Ticket pages", () => {
    // The rule moved into shell-nav's topBarWorkActions, which AppShell uses.
    const s = read("src/lib/shell-nav.ts");
    expect(read("src/components/AppShell.tsx")).toContain("topBarWorkActions(");
    expect(s).not.toContain('!pathname.startsWith("/tickets");');
    expect(s).toContain('pathname !== "/tickets/new"');
  });
  it("Home and My Work no longer link to the issue form", () => {
    expect(read("src/routes/_authenticated/dashboard.tsx")).not.toContain('to="/tickets/new"');
    expect(read("src/routes/_authenticated/tickets.index.tsx")).not.toContain('to="/tickets/new"');
  });
  it("choosing a routine opens it without saving", () => {
    const s = read("src/routes/_authenticated/routines.tsx");
    const chooser = s.slice(s.indexOf("function RunRoutineDialog"));
    expect(chooser).not.toContain(".insert(");
    const d = read("src/components/routines/RoutineDrawer.tsx");
    expect(d).toContain("if (row.draft)");
    expect(d).toContain("if (!row || row.draft) return;");
  });
});
