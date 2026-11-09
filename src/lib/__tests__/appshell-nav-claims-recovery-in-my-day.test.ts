import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { can, type AppRole } from "../permissions";
import { canOpenPath } from "../route-access";
import { operationsMenu, PAGE_TAB_GROUPS } from "../shell-nav";

/**
 * Menu cleanup (approved by Emily, Nov 8 2026) replaced Simplification Pass 1:
 * the Operations menu is My day / Team / Homes and owners / Insight / Admin.
 * Grouped destinations (Routine Work, Refunds & Credits, Supervisor check...)
 * still live as top-of-page tabs (PAGE_TAB_GROUPS in lib/shell-nav.ts).
 * Checked through the real permission model, not the file text.
 */
const menuFor = (roles: AppRole[]) =>
  operationsMenu({ can: (c) => can(roles, c), canOpen: (p) => canOpenPath(p, { roles }) });
const myDay = (roles: AppRole[]) => menuFor(roles).find((g) => g.label === "My day")?.items ?? [];

describe("AppShell menu: My day and tab pages", () => {
  it("My day keeps Home and Team Queue first, and Record work stays in the top bar only", () => {
    const items = myDay(["tech"]);
    expect(items.slice(0, 2).map((i) => i.to)).toEqual(["/dashboard", "/team-queue"]);
    expect(items.map((i) => i.to)).not.toContain("/tickets/new");
  });

  it("grouped destinations stay out of the menu and on the tab bars", () => {
    const all = menuFor(["admin"]).flatMap((g) => g.items.map((i) => i.to));
    for (const gone of ["/map", "/availability-finder", "/routines", "/recovery", "/str-dispatch-check"])
      expect(all).not.toContain(gone);
    const tabs = PAGE_TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.to));
    for (const tab of ["/map", "/routines", "/recovery", "/vendors"]) expect(tabs).toContain(tab);
  });

  // Register M2 (Nov 8): Guest Claims & Refunds stayed until Databases existed. Now it hides
  // behind the claims_menu switch; the page still opens by link and keeps its claims_work rule.
  it("Guest Claims & Refunds is hidden behind its switch, still gated on claims_work and reachable by link", () => {
    expect(myDay(["tech"]).map((i) => i.to)).not.toContain("/claims");
    const on = operationsMenu({ can: (c) => can(["tech"], c), canOpen: (p) => canOpenPath(p, { roles: ["tech"] }), flagEnabled: (k) => k === "claims_menu" })
      .find((g) => g.label === "My day")!.items;
    const claims = on.find((i) => i.to === "/claims");
    expect(claims?.label).toBe("Guest Claims & Refunds");
    expect(claims?.capability).toBe("claims_work");
    expect(on[on.length - 1]?.to).toBe("/claims");
    expect(canOpenPath("/claims", { roles: ["tech"] })).toBe(true);
    expect(myDay(["onboarding"]).map((i) => i.to)).not.toContain("/claims");
  });

  it("Ask the Coach and Help left the menu for the Help & Feedback menu", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, "../../components/AppShell.tsx"), "utf8");
    expect(src).not.toContain('to: "/coach"');
    expect(src).not.toContain('to: "/welcome"');
    const help = readFileSync(join(here, "../../components/HelpFeedback.tsx"), "utf8");
    expect(help).toContain('to="/coach"');
    expect(help).toContain('to="/welcome"');
  });
});
