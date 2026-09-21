import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Navigation correction per the confirmed Ops operating model: Claims and
 * Guest recovery are frontline/team workflows — PCs and operations staff
 * perform this work directly — so they live under "My day", not
 * "Supervision". True supervisor functions (Oversight, Onboarding, Map)
 * stay put.
 *
 * This repo has no DOM rendering harness (see the other __tests__ files —
 * every one tests a plain function or, like this one, guards the wiring
 * at the source level), so this is a source-level regression guard: it
 * fails if either item drifts back under Supervision, or the nav gate
 * reverts to the stricter capability that hid the frontline items from
 * the very roles this correction is for.
 */
describe("AppShell — Claims and Guest recovery moved from Supervision to My day", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../../components/AppShell.tsx"), "utf8");

  const frontlineGroupMatch = src.match(/const frontlineGroup: NavGroup = \{[\s\S]*?\n\};/);
  const supervisionGroupMatch = src.match(
    /\{\s*label: "Supervision",\s*items: \[[\s\S]*?\],\s*\},/,
  );

  it("frontlineGroup ('My day') contains Claims and Guest recovery", () => {
    expect(frontlineGroupMatch).not.toBeNull();
    const body = frontlineGroupMatch?.[0] ?? "";
    expect(body).toContain('to: "/claims"');
    expect(body).toContain('label: "Claims"');
    expect(body).toContain('to: "/recovery"');
    expect(body).toContain('label: "Guest recovery"');
  });

  it("the Supervision group no longer contains Claims or Guest recovery", () => {
    expect(supervisionGroupMatch).not.toBeNull();
    const body = supervisionGroupMatch?.[0] ?? "";
    expect(body).not.toContain('to: "/claims"');
    expect(body).not.toContain('to: "/recovery"');
  });

  it("Supervision retains the true supervisor functions: Oversight and Onboarding", () => {
    const body = supervisionGroupMatch?.[0] ?? "";
    expect(body).toContain('to: "/oversight"');
    expect(body).toContain('to: "/onboarding"');
  });

  // The Work Map is day-to-day routing for the person doing the visits, so it
  // sits with the frontline work rather than with supervision.
  it("the Work Map lives in 'My day'", () => {
    const body = frontlineGroupMatch?.[0] ?? "";
    expect(body).toContain('to: "/map"');
    expect(body).toContain('label: "Work Map"');
  });


  it("Claims and Guest recovery are gated on claims_work, matching what the pages themselves already require — not the stricter claims_oversight that hid them from frontline roles", () => {
    const body = frontlineGroupMatch?.[0] ?? "";
    const claimsMatch = body.match(/\{\s*to: "\/claims",[\s\S]*?\},/);
    const recoveryMatch = body.match(/\{\s*to: "\/recovery",[\s\S]*?\},/);
    expect(claimsMatch?.[0]).toContain('capability: "claims_work"');
    expect(recoveryMatch?.[0]).toContain('capability: "claims_work"');
  });
});
