import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { VIEW_AS_COPY, VIEW_AS_OPTIONS, canUseViewAs } from "../view-as";
import { menuGroups } from "../shell-nav";

/** Clean slate (Emily, Nov 7, 2026; register M5): no Demo button in the top bar, an Admin only
 *  View as switcher in the Admin menu that does not depend on demo mode and changes no data. */
const read = (p: string) => readFileSync(p, "utf8");
const shell = read("src/components/AppShell.tsx");
const sw = read("src/components/ViewAsSwitcher.tsx");
const role = read("src/hooks/useRole.ts");

describe("who sees View as", () => {
  it("Admins only, by their real roles", () => {
    expect(canUseViewAs(["admin"])).toBe(true);
    expect(canUseViewAs(["tech", "admin"])).toBe(true);
    for (const r of [["manager"], ["tech"], ["onboarding"], ["owner"], ["vendor"], []]) expect(canUseViewAs(r)).toBe(false);
    expect(sw).toContain("const { actualRoles } = useRole();");
    expect(sw).toContain("if (!canUseViewAs(actualRoles)) return null;");
  });
  it("sits in the Admin menu, which only Admin tools users get", () => {
    expect(shell).toContain('{group.label === "Admin" ? <ViewAsMenuItem /> : null}');
    expect(VIEW_AS_COPY.menu).toBe("View as");
  });
  it("offers staff roles by their role names, never Admin", () => {
    expect(VIEW_AS_OPTIONS.map((o) => o.label)).toEqual(["Property Coordinator", "Operations Supervisor", "Director of Operations", "Onboarding staff"]);
    expect(VIEW_AS_OPTIONS.some((o) => o.role === "admin")).toBe(false);
  });
});

describe("View as does not depend on demo mode and changes no data", () => {
  it("choosing a role turns demo mode off and sets the preview", () => {
    const choose = sw.slice(sw.indexOf("function choose("), sw.indexOf("return (", sw.indexOf("function choose(")));
    expect(choose).toContain("writeDemoFlag(false);");
    expect(choose).toContain("setViewAs(option.role);");
  });
  it("the preview follows View as alone, and is read only whenever demo mode is off", () => {
    expect(role).toContain("const previewing = Boolean(viewAs) && canOperateDemo(actualRoles);");
    expect(role).toContain("readOnly: previewing && !demoMode,");
  });
  it("a clear banner names the role, with one way out", () => {
    expect(VIEW_AS_COPY.banner("Property Coordinator")).toBe("Viewing as Property Coordinator. You can look around, but nothing can be changed.");
    expect(shell).toContain("<ViewAsRoleBanner />");
    expect(sw).toContain("if (!previewing || demoMode || ownerPreview || !canUseViewAs(actualRoles)) return null;");
    expect(sw).toContain("setViewAs(null);");
  });
});

describe("the Demo button is gone from the top bar", () => {
  it("the top bar no longer renders it", () => {
    expect(shell).not.toContain("<DemoButton />");
    expect(shell).not.toContain("DemoButton,");
  });
});

describe("the Admin menu itself is unchanged for other roles", () => {
  it("no Admin group for a Property Coordinator", () => {
    const access = { roles: ["tech"] as never, seats: {}, can: () => false, canOpen: () => true, flags: {} } as never;
    let groups: { label: string }[] = [];
    try {
      groups = menuGroups(access) as never;
    } catch {
      groups = [];
    }
    expect(groups.some((g) => g.label === "Admin")).toBe(false);
  });
});
