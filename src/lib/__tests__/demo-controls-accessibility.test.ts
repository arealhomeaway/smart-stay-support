import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

/**
 * Accessibility guard for the three Demo controls: the header Demo button,
 * the same control inside the navigation menu, and Leave demo in the demo
 * banner.
 *
 * This repo has no DOM rendering harness (see the other __tests__ files —
 * every one tests a plain function or guards wiring at the source level),
 * so these are source-level regression guards. They fail if a control
 * loses its accessible name, its on/off state, its visible focus ring,
 * its keyboard activation, or its 44px touch target.
 */
describe("Demo controls — accessibility", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, "../../components/PortalSwitcher.tsx"), "utf8");
  const shell = readFileSync(join(here, "../../components/AppShell.tsx"), "utf8");

  const block = (name: string) => {
    const match = src.match(new RegExp(`export function ${name}\\(\\)[\\s\\S]*?\\n\\}`));
    expect(match).not.toBeNull();
    return match?.[0] ?? "";
  };

  const headerButton = () => block("DemoButton");
  const menuItem = () => block("DemoSidebarItem");
  const banner = () => block("ViewAsBanner");

  describe("header Demo button", () => {
    it("is a real button element from the design system", () => {
      expect(headerButton()).toContain("<Button");
    });

    it("has an accessible name even when only the icon is shown", () => {
      const body = headerButton();
      expect(body).toContain("aria-label=");
      expect(body).toContain("Enter the demo environment");
      expect(body).toContain("Leave the demo environment");
    });

    it("announces whether demo mode is currently on", () => {
      expect(headerButton()).toContain("aria-pressed={demoMode}");
    });

    it("shows a visible focus ring for keyboard users", () => {
      const body = headerButton();
      expect(body).toContain("focus-visible:ring-2");
      expect(body).toContain("focus-visible:ring-offset-2");
    });

    it("keeps a 44px touch target on small screens", () => {
      const body = headerButton();
      expect(body).toContain("min-h-11");
      expect(body).toContain("min-w-11");
    });

    it("hides the decorative icons from screen readers", () => {
      const icons = headerButton().match(/aria-hidden="true"/g) ?? [];
      expect(icons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("navigation menu Demo item", () => {
    it("is rendered in the app navigation, so it is reachable when collapsed", () => {
      expect(shell).toContain("DemoSidebarItem");
      expect(shell).toContain("<DemoSidebarItem />");
    });

    it("has an accessible name and a tooltip for the collapsed icon-only state", () => {
      const body = menuItem();
      expect(body).toContain("aria-label=");
      expect(body).toContain("tooltip={label}");
    });

    it("announces whether demo mode is currently on", () => {
      expect(menuItem()).toContain("aria-pressed={demoMode}");
    });

    it("activates with both Enter and Space", () => {
      const body = menuItem();
      expect(body).toContain("onKeyDown=");
      expect(body).toContain('event.key === " "');
      expect(body).toContain('event.key === "Enter"');
      expect(body).toContain("event.preventDefault()");
    });

    it("shows a visible focus ring against the menu background", () => {
      const body = menuItem();
      expect(body).toContain("focus-visible:ring-2");
      expect(body).toContain("focus-visible:ring-sidebar-ring");
      expect(body).toContain("focus-visible:ring-offset-2");
    });

    it("keeps a 44px row height on touch screens", () => {
      expect(menuItem()).toContain("h-11");
    });

    it("closes the mobile menu when used, so focus is not left behind it", () => {
      expect(menuItem()).toContain("setOpenMobile(false)");
    });
  });

  describe("Leave demo control in the demo banner", () => {
    it("has an explicit accessible name", () => {
      expect(banner()).toContain('aria-label="Leave the demo environment"');
    });

    it("shows a visible focus ring for keyboard users", () => {
      const body = banner();
      expect(body).toContain("focus-visible:ring-2");
      expect(body).toContain("focus-visible:ring-offset-2");
    });

    it("keeps a 44px touch target on small screens", () => {
      expect(banner()).toContain("min-h-11");
    });
  });
});
