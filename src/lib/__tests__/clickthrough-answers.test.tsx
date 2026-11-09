/**
 * Emily's answers on the fix batch and the map (Nov 9; register D1, D7, M1):
 * the place search failure line, Databases lit on the Vendors page, the
 * neutral block in the property page header and the map failure line.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { HomePhoto } from "@/components/property/HomePhoto";
import { DB_COPY, searchFailureMessage } from "@/lib/direct-bookings";
import { MAP_COPY } from "@/lib/search-map";
import { capabilitiesFor, type AccessSeats, type AppRole, type Capability } from "@/lib/permissions";
import { canOpenPath } from "@/lib/route-access";
import { onboardingOnlyMenu, operationsMenu, type MenuGroup, type NavAccess } from "@/lib/shell-nav";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const DOWN = "The place search is not working right now. Try again in a minute. If it keeps happening, send a help ticket.";

describe("1. Any other place search failure", () => {
  it("has its own line", () => {
    expect(DB_COPY.placeSearchDown).toBe(DOWN);
  });

  it("the Google Maps connection or lookup failing never says calendars", () => {
    for (const m of [
      "Google Maps isn't connected yet. Link it under Connectors and try again.",
      "Google Maps denied the lookup (403). Check the server key's restrictions.",
      "Google Maps lookup failed [500].",
      "Google Maps lookup failed [502].",
      "The Google Maps server key is referrer-restricted. In Google Cloud Console set that key's application restrictions to \"None\" or \"IP addresses\".",
      "The Google Maps server key doesn't allow the Geocoding API. Add it to that key's allowed-APIs list in Google Cloud Console.",
    ]) {
      expect(searchFailureMessage(new Error(m))).toBe(DOWN);
    }
  });

  it("place not found, busy and real calendar errors keep their own lines", () => {
    expect(searchFailureMessage(new Error(DB_COPY.placeNotFound))).toBe("We could not locate that place. Try a fuller address or ZIP code.");
    expect(searchFailureMessage(new Error("Google Maps quota reached. Try again later."))).toBe("The place search is busy. Try again in a minute.");
    expect(searchFailureMessage(new Error("Google Maps lookup failed [429]."))).toBe("The place search is busy. Try again in a minute.");
    expect(searchFailureMessage(new Error("OwnerRez returned a reservation without valid stay dates. Availability cannot be confirmed."))).toBe(
      "We could not check calendars. Try again.",
    );
    expect(searchFailureMessage(new Error("OwnerRez request failed [503]"))).toBe("We could not check calendars. Try again.");
  });
});

describe("2. On the Vendors page, Databases is lit in the left menu", () => {
  const PROFILES: Record<string, { roles: AppRole[]; seats: AccessSeats }> = {
    "Property Coordinator": { roles: ["tech"], seats: {} },
    "Operations Supervisor": { roles: ["manager"], seats: { opsSupervisor: true } },
    "Director of Operations": { roles: ["manager"], seats: { opsDirector: true } },
    "Director of Onboarding": { roles: ["onboarding"], seats: { onboardingDirector: true } },
    "Project Manager": { roles: ["onboarding"], seats: { projectManager: true } },
    Utilities: { roles: ["onboarding"], seats: { utilities: true } },
    "Finance lead": { roles: ["manager"], seats: { finance: true } },
    Admin: { roles: ["admin"], seats: {} },
  };
  const menus = (p: { roles: AppRole[]; seats: AccessSeats }): MenuGroup[] => {
    const access: NavAccess = {
      can: (c: Capability) => capabilitiesFor(p.roles, p.seats).has(c),
      canOpen: (path: string) => canOpenPath(path, p),
      flagEnabled: () => true,
    };
    return [...operationsMenu(access), ...onboardingOnlyMenu(access)];
  };
  // The same lit-line rule the shell applies to alsoActive pages.
  const lit = (alsoActive: string[] | undefined, path: string) =>
    (alsoActive ?? []).some((p) => path === p || path.startsWith(`${p}/`));

  for (const [name, p] of Object.entries(PROFILES)) {
    it(`${name}: every Databases line is lit on the Vendors page and a vendor's page, nothing else is`, () => {
      const items = menus(p).flatMap((g) => g.items);
      const databases = items.filter((i) => i.key === "databases");
      expect(databases.length).toBeGreaterThan(0);
      for (const path of ["/vendors", "/vendors/abc"]) {
        for (const d of databases) expect(lit(d.alsoActive, path)).toBe(true);
        for (const other of items.filter((i) => i.key !== "databases")) expect(lit(other.alsoActive, path)).toBe(false);
      }
      // Still no Vendors line in any menu.
      expect(items.map((i) => i.to)).not.toContain("/vendors");
    });
  }

  it("the shell lights a line from its alsoActive pages", () => {
    const shell = read("components/AppShell.tsx");
    expect(shell).toContain("(item.alsoActive ?? []).some(");
    expect(shell).toContain("(p) => activePathname === p || activePathname.startsWith(`${p}/`),");
  });
});

describe("3. Property page header with no photo", () => {
  it("shows the same neutral block as the cards, never a broken image", () => {
    const page = read("routes/_authenticated/property.$propertyId.tsx");
    const header = page.slice(page.indexOf("function PropertyHeader"));
    const block = header.slice(header.indexOf("<HomePhoto"), header.indexOf("/>", header.indexOf("<HomePhoto")) + 2);
    expect(block).toContain("url={p.photoUrl}");
    expect(block).toContain('className="h-44 w-full md:h-64"');
    expect(header).not.toContain("{p.photoUrl ? (");
    for (const url of [null, undefined, ""]) {
      const html = renderToStaticMarkup(<HomePhoto url={url} alt="815 E Fulton St" className="h-44 w-full md:h-64" />);
      expect(html).toBe('<div aria-hidden="true" data-photo="none" class="bg-muted h-44 w-full md:h-64"></div>');
    }
  });
});

describe("6. Map failure line", () => {
  it("says the homes are still listed", () => {
    expect(MAP_COPY.failed).toBe("The map could not load. The homes are still listed.");
    expect(MAP_COPY.failed).not.toContain("below");
  });
});
