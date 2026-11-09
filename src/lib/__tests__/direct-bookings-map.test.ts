/**
 * Direct Bookings real map (Emily, Nov 9): OpenStreetMap pictures through
 * one provider file, the search point, 5, 10 and 20 mile rings with labels,
 * numbered pins with labels that never hide each other, map and cards
 * connected, the attribution, the failure message and phone friendly moves.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatMiles,
  MAP_COPY,
  noLocationLine,
  PIN_GAP,
  pinAriaLabel,
  pinLabel,
  ringLabelPoint,
  ringSpecs,
  splitMappable,
  spreadPoints,
  tilesFailed,
} from "@/lib/search-map";
import { SEARCH_DISTANCES } from "@/lib/direct-bookings";

const SRC = fileURLToPath(new URL("../../", import.meta.url));
const read = (p: string) => readFileSync(join(SRC, p), "utf8");
const MAP_FILE = "components/direct-bookings/SearchMap.tsx";
const PAGE = "routes/_authenticated/direct-bookings.$requestId.tsx";

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("1. Rings, labels and the straight line note", () => {
  it("one ring per distance, only the chosen one solid, each labelled", () => {
    const rings = ringSpecs(10, SEARCH_DISTANCES);
    expect(rings.map((r) => [r.miles, r.chosen, r.label])).toEqual([
      [5, false, "5 miles"],
      [10, true, "10 miles"],
      [20, false, "20 miles"],
    ]);
    expect(Math.round(rings[2]!.meters)).toBe(32187);
  });
  it("ring labels sit due north at the ring", () => {
    expect(ringLabelPoint({ lat: 36, lng: -95.8 }, 20)).toEqual({ lat: 36 + 20 / 69, lng: -95.8 });
  });
  it("pin label shows the address and the distance in miles", () => {
    expect(pinLabel({ address: "815 E Fulton St", distanceMiles: 2.6 })).toBe("815 E Fulton St · 2.6 miles");
    expect(formatMiles(1)).toBe("1 mile");
    expect(pinAriaLabel({ number: 3, address: "815 E Fulton St", distanceMiles: 2.6 })).toBe("Home 3: 815 E Fulton St, 2.6 miles away");
  });
  it("wording", () => {
    expect(MAP_COPY.straightLine).toBe("Distances are straight line, not driving.");
    expect(MAP_COPY.failed).toBe("The map could not load. The homes are listed below.");
    expect(MAP_COPY.attribution).toBe("© OpenStreetMap contributors");
    for (const text of Object.values(MAP_COPY)) {
      expect(text).not.toContain("—");
      expect(text.toLowerCase()).not.toContain("seat");
    }
  });
  it("homes without a location are named under the map, never dropped silently", () => {
    const { onMap, offMap } = splitMappable([{ lat: 1, lng: 2 }, { lat: Number.NaN, lng: 2 }]);
    expect(onMap.length).toBe(1);
    expect(offMap.length).toBe(1);
    expect(noLocationLine([])).toBeNull();
    expect(noLocationLine([4])).toBe("Home 4 has no map location.");
    expect(noLocationLine([2, 5])).toBe("Homes 2 and 5 have no map location.");
  });
});

describe("2. Pins that overlap are spread so none hides another", () => {
  const minPair = (m: Map<string, { x: number; y: number }>) => {
    const pts = [...m.values()];
    let min = Infinity;
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i]!;
        const b = pts[j]!;
        min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y));
      }
    return min;
  };
  it("six homes on the very same spot all end up apart", () => {
    const pts = Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, x: 100, y: 100 }));
    expect(minPair(spreadPoints(pts))).toBeGreaterThan(PIN_GAP - 0.5);
  });
  it("a tight cluster next to a lone pin ends up apart", () => {
    const pts = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 5, y: 3 },
      { id: "c", x: 9, y: -2 },
      { id: "d", x: 30, y: 0 },
    ];
    expect(minPair(spreadPoints(pts))).toBeGreaterThan(PIN_GAP - 0.5);
  });
  it("pins already far apart do not move", () => {
    const out = spreadPoints([{ id: "a", x: 0, y: 0 }, { id: "b", x: 200, y: 0 }]);
    expect(out.get("a")).toEqual({ x: 0, y: 0 });
    expect(out.get("b")).toEqual({ x: 200, y: 0 });
  });
  it("the same input always gives the same layout", () => {
    const pts = Array.from({ length: 4 }, (_, i) => ({ id: `h${i}`, x: 50 + i, y: 50 }));
    expect([...spreadPoints(pts)]).toEqual([...spreadPoints(pts)]);
  });
});

describe("4. Failure rule", () => {
  it("fails only when nothing loaded and pictures error or time out", () => {
    expect(tilesFailed({ loaded: 0, errors: 2, timedOut: false })).toBe(true);
    expect(tilesFailed({ loaded: 0, errors: 0, timedOut: true })).toBe(true);
    expect(tilesFailed({ loaded: 0, errors: 1, timedOut: false })).toBe(false);
    expect(tilesFailed({ loaded: 3, errors: 9, timedOut: true })).toBe(false);
  });
});

describe("5. One provider file", () => {
  const src = read(MAP_FILE);
  it("uses the installed Leaflet package and OpenStreetMap pictures, no key, no web script", () => {
    expect(JSON.parse(read("../package.json")).dependencies.leaflet).toBeTruthy();
    expect(src).toContain('import("leaflet")');
    expect(src).toContain('import("leaflet/dist/leaflet.css")');
    expect(src).toContain("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(src).toContain("OpenStreetMap</a> contributors");
    expect(src).not.toMatch(/unpkg|cdnjs|jsdelivr|<script/);
    expect(src).not.toMatch(/googleapis|maps\.google|apiKey|api_key|key=/i);
  });
  it("keeps the pictures light: no wide preloading", () => {
    expect(src).toContain("keepBuffer: 1");
    expect(src).toContain("updateWhenIdle: true");
  });
  it("no other file in the app imports Leaflet", () => {
    const root = SRC.replace(/\/$/, "");
    const users = filesUnder(root)
      .filter((f) => !f.includes("__tests__"))
      .filter((f) => /from "leaflet"|import\("leaflet"\)/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(root.length + 1));
    expect(users).toEqual([MAP_FILE]);
  });
  it("the page draws the map only through that file", () => {
    const page = read(PAGE);
    expect(page).toContain('import { SearchMap } from "@/components/direct-bookings/SearchMap"');
    expect(page).not.toContain("function HomesMap");
    expect(page).toContain("distances={SEARCH_DISTANCES}");
  });
});

describe("3 and 6. Cards and map connected, phone friendly", () => {
  const src = read(MAP_FILE);
  const page = read(PAGE);
  it("a pin tap lights up and scrolls to its card", () => {
    expect(src).toContain('pin.on("click", () => tapRef.current(p.id))');
    expect(page).toContain("onPinTap={showCard}");
    expect(page).toMatch(/const showCard = [\s\S]*?setHighlightedId\(id\);[\s\S]*?scrollIntoView/);
  });
  it("a card's number and Show on map center its pin", () => {
    expect(page).toContain("aria-label={`Show home ${i + 1} on the map`}");
    expect(page).toContain("{MAP_COPY.showOnMap}");
    expect(page.match(/onClick=\{\(\) => showPin\(h\.id\)\}/g)?.length).toBe(2);
    expect(src).toContain("map.setView([target.lat, target.lng]");
  });
  it("picked homes look different on the map", () => {
    expect(src).toContain('"is-picked": p.picked');
    expect(src).toContain("group-[.is-picked]/pin:bg-primary");
  });
  it("one finger scrolls the page on a phone, the wheel never zooms", () => {
    expect(src).toContain("scrollWheelZoom: false");
    expect(src).toContain("dragging: !coarse");
    expect(src).toContain("touchZoom: true");
    expect(src).toContain("keyboard: true");
  });
  it("tall enough, 44px controls and pins", () => {
    expect(src).toContain("h-[360px]");
    expect(src).toContain("md:h-[420px]");
    expect(src.match(/className="size-11 bg-card shadow"/g)?.length).toBe(2);
    expect(src).toContain("iconSize: [44, 44]");
    expect(page).toContain('className="h-11 self-start px-0 text-primary"');
  });
  it("the failure message replaces a blank panel", () => {
    expect(src).toContain("{MAP_COPY.failed}");
    expect(src).toContain("{MAP_COPY.loading}");
  });
});
