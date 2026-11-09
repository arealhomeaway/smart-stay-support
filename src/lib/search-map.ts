/**
 * Direct Bookings map rules that do not depend on the map provider: ring
 * list, pin labels, spreading pins that sit close together and when the map
 * counts as failed. The provider file (src/components/direct-bookings/SearchMap.tsx)
 * only draws what these rules return, so a move to another provider changes
 * that one file.
 */

export const MILE_IN_METERS = 1609.344;
/** Minimum distance in screen pixels between two numbered pins. */
export const PIN_GAP = 40;

export const MAP_COPY = {
  region: "Map of the search place and homes",
  attribution: "© OpenStreetMap contributors",
  failed: "The map could not load. The homes are listed below.",
  loading: "Loading the map…",
  straightLine: "Distances are straight line, not driving.",
  twoFingers: "Use two fingers to move the map.",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  showOnMap: "Show on map",
} as const;

export type MapCenter = { lat: number; lng: number; label: string };
export type MapPin = {
  id: string;
  number: number;
  lat: number;
  lng: number;
  address: string;
  distanceMiles: number;
  picked: boolean;
};

export function formatMiles(miles: number): string {
  return miles === 1 ? "1 mile" : `${miles} miles`;
}

/** The label beside each numbered pin. */
export function pinLabel(pin: Pick<MapPin, "address" | "distanceMiles">): string {
  return `${pin.address} · ${formatMiles(pin.distanceMiles)}`;
}

export function pinAriaLabel(pin: Pick<MapPin, "number" | "address" | "distanceMiles">): string {
  return `Home ${pin.number}: ${pin.address}, ${formatMiles(pin.distanceMiles)} away`;
}

/** One ring per search distance; the chosen one is solid, the others dashed. */
export function ringSpecs(chosen: number, distances: readonly number[]) {
  return distances.map((miles) => ({ miles, chosen: miles === chosen, label: formatMiles(miles), meters: miles * MILE_IN_METERS }));
}

/** Where a ring's label sits: the top of the ring, due north of the center. */
export function ringLabelPoint(center: { lat: number; lng: number }, miles: number) {
  return { lat: center.lat + miles / 69, lng: center.lng };
}

/** Homes without a map location cannot get a pin; the cards still list them. */
export function splitMappable<T extends { lat: number; lng: number }>(items: T[]) {
  const onMap: T[] = [];
  const offMap: T[] = [];
  for (const item of items) (Number.isFinite(item.lat) && Number.isFinite(item.lng) ? onMap : offMap).push(item);
  return { onMap, offMap };
}

export function noLocationLine(numbers: number[]): string | null {
  if (numbers.length === 0) return null;
  if (numbers.length === 1) return `Home ${numbers[0]} has no map location.`;
  return `Homes ${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]} have no map location.`;
}

/**
 * Pushes screen points apart until every pair is at least `gap` pixels apart,
 * so no numbered pin ever hides another. Points already far apart do not move.
 * Deterministic: the same input always gives the same layout.
 */
export function spreadPoints(points: { id: string; x: number; y: number }[], gap = PIN_GAP) {
  const pts = points.map((p) => ({ id: p.id, x: p.x, y: p.y }));
  const n = pts.length;
  for (let round = 0; round < 300; round++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pts[i]!;
        const b = pts[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= gap - 0.01) continue;
        if (d < 0.01) {
          const angle = (2 * Math.PI * (i * n + j)) / (n * n || 1) - Math.PI / 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d = 1;
        } else {
          dx /= d;
          dy /= d;
        }
        const push = (gap - Math.min(d, gap)) / 2 + 0.05;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return new Map(pts.map((p) => [p.id, { x: p.x, y: p.y }]));
}

/** The map counts as failed when no map picture has loaded and pictures error or time out. */
export function tilesFailed(state: { loaded: number; errors: number; timedOut: boolean }): boolean {
  return state.loaded === 0 && (state.errors >= 2 || state.timedOut);
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
