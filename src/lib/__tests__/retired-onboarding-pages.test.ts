import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Route as Transitions } from "../../routes/_authenticated/onboarding.transitions";
import { Route as TransitionsSub } from "../../routes/_authenticated/onboarding.transitions.$";
import { Route as Utilities } from "../../routes/_authenticated/onboarding.utilities";
import { Route as UtilitiesSub } from "../../routes/_authenticated/onboarding.utilities.$";
import { DEPARTMENTS } from "../shell-nav";

function thrown(fn: () => unknown): any {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe("retired Transitions and Utilities & Accounts pages", () => {
  for (const [name, route] of [
    ["transitions", Transitions],
    ["transitions sub-path", TransitionsSub],
    ["utilities", Utilities],
    ["utilities sub-path", UtilitiesSub],
  ] as const) {
    it(`${name} permanently redirects to the Onboarding home list`, () => {
      const beforeLoad = (route.options as any).beforeLoad as () => unknown;
      const r = thrown(beforeLoad);
      expect(r?.options?.to).toBe("/onboarding");
      expect(r?.options?.statusCode).toBe(301);
    });
  }

  it("menus no longer list either page", () => {
    const text = JSON.stringify(DEPARTMENTS);
    expect(text).not.toContain("/onboarding/utilities");
    expect(text).not.toContain("/onboarding/transitions");
    expect(text).not.toContain("Utilities & Accounts");
  });

  it("no remaining code links to the old addresses", () => {
    const hits: string[] = [];
    const allowed = /onboarding\.(transitions|utilities)(\.\$)?\.tsx$|routeTree\.gen\.ts$|retired-onboarding-pages\.test\.ts$/;
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f) && !allowed.test(p)) {
          if (/onboarding\/(transitions|utilities)/.test(readFileSync(p, "utf8"))) hits.push(p);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});
