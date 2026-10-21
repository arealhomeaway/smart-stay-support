import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Simplification Pass 1 (approved by Emily, 2026-10-21): the Operations
 * sidebar is grouped as My day / Oversight / Team / Owners & Programs /
 * Reports / Admin. Grouped destinations (Work Map, Routine Work, Vendors,
 * Refunds & Credits…) moved out of the sidebar into top-of-page tab bars
 * (PAGE_TAB_GROUPS in lib/shell-nav.ts). This is a source-level regression
 * guard for that structure.
 */
describe("AppShell — Simplification Pass 1 sidebar structure", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../../components/AppShell.tsx"), "utf8");
  const shellNav = readFileSync(join(here, "../shell-nav.ts"), "utf8");

  const frontlineGroupMatch = src.match(/const frontlineGroup: NavGroup = \{[\s\S]*?\n\};/);
  const oversightGroupMatch = src.match(/\{\s*label: "Oversight",\s*items: \[[\s\S]*?\],\s*\},/);

  it("frontlineGroup ('My day') keeps the frontline destinations with one item per group", () => {
    expect(frontlineGroupMatch).not.toBeNull();
    const body = frontlineGroupMatch?.[0] ?? "";
    expect(body).toContain('to: "/dashboard"');
    expect(body).toContain('to: "/tickets"');
    expect(body).toContain('label: "My Work"');
    expect(body).toContain('to: "/team-queue"');
    expect(body).toContain('to: "/properties"');
    expect(body).toContain('to: "/work-orders"');
    expect(body).toContain('label: "Work Orders"');
    expect(body).toContain('to: "/claims"');
    expect(body).toContain('label: "Guest Claims & Refunds"');
    expect(body).toContain('to: "/inquiry-sources"');
    // Record work stays: the top-bar button hides on every /tickets page.
    expect(body).toContain('to: "/tickets/new"');
  });

  it("grouped destinations left the sidebar for top-of-page tabs", () => {
    const body = frontlineGroupMatch?.[0] ?? "";
    for (const gone of ["/map", "/availability-finder", "/routines", "/recovery", "/str-dispatch-check"])
      expect(body).not.toContain(`to: "${gone}"`);
    // The tab bars pick them up instead.
    for (const tab of ["/map", "/availability-finder", "/routines", "/recovery", "/str-dispatch-check", "/vendors"])
      expect(shellNav).toContain(`to: "${tab}"`);
  });

  it("the Oversight group holds Oversight, Onboarding, Program Oversight and Quarterly Reviews", () => {
    expect(oversightGroupMatch).not.toBeNull();
    const body = oversightGroupMatch?.[0] ?? "";
    expect(body).toContain('to: "/oversight"');
    expect(body).toContain('to: "/onboarding"');
    expect(body).toContain('to: "/owner-oversight"');
    expect(body).toContain('to: "/quarterly"');
  });

  it("Claims stays gated on claims_work, matching what the pages require", () => {
    const body = frontlineGroupMatch?.[0] ?? "";
    const claimsMatch = body.match(/\{\s*to: "\/claims",[\s\S]*?\},/);
    expect(claimsMatch?.[0]).toContain('capability: "claims_work"');
  });

  it("Ask the Coach and Help left the sidebar for the Help & Feedback menu", () => {
    expect(src).not.toContain('to: "/coach"');
    expect(src).not.toContain('to: "/welcome"');
    const help = readFileSync(join(here, "../../components/HelpFeedback.tsx"), "utf8");
    expect(help).toContain('to: "/coach"');
    expect(help).toContain('to: "/welcome"');
  });
});
