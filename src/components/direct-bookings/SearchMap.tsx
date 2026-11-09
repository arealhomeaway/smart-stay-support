/**
 * The Direct Bookings map. This is the only file that knows the map provider
 * (Leaflet with OpenStreetMap pictures, no key). It draws the search point,
 * the distance rings and one numbered pin per home from plain props; the
 * rules it follows live in src/lib/search-map.ts. Moving to Google Maps later
 * means replacing this file only.
 */
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  escapeHtml,
  labelRect,
  MAP_COPY,
  MILE_IN_METERS,
  PIN_GAP,
  pinAriaLabel,
  pinLabel,
  placeLabels,
  ringLabelPoint,
  ringSpecs,
  spreadPoints,
  tilesFailed,
  type MapCenter,
  type MapPin,
  type Rect,
} from "@/lib/search-map";

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

type Props = {
  center: MapCenter;
  /** The chosen search distance in miles. */
  distance: number;
  /** Every search distance offered (5, 10 and 20). */
  distances: readonly number[];
  pins: MapPin[];
  highlightedId: string | null;
  /** Centers the pin with this id; a new nonce centers it again. */
  focus: { id: string; nonce: number } | null;
  onPinTap: (id: string) => void;
  className?: string;
};

type PinLayers = { pin: Leaflet.Marker; label: Leaflet.Marker; leader: Leaflet.Polyline; data: MapPin };

export function SearchMap({ center, distance, distances, pins, highlightedId, focus, onPinTap, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const libRef = useRef<typeof Leaflet | null>(null);
  const pinLayers = useRef<Map<string, PinLayers>>(new Map());
  const tapRef = useRef(onPinTap);
  tapRef.current = onPinTap;
  const orderRef = useRef<{ highlightedId: string | null; picked: Set<string> }>({ highlightedId: null, picked: new Set() });
  orderRef.current = { highlightedId, picked: new Set(pins.filter((p) => p.picked).map((p) => p.id)) };
  const placeRef = useRef<() => void>(() => {});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [touch, setTouch] = useState(false);

  // Create the map once, after the page has loaded in the browser.
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let observer: ResizeObserver | undefined;
    (async () => {
      try {
        const [mod] = await Promise.all([import("leaflet"), import("leaflet/dist/leaflet.css")]);
        const L = ((mod as unknown as { default?: typeof Leaflet }).default ?? mod) as typeof Leaflet;
        if (disposed || !box.current) return;
        const coarse = window.matchMedia("(pointer: coarse)").matches;
        setTouch(coarse);
        // On a phone one finger scrolls the page and two fingers move the map;
        // the mouse wheel always scrolls the page.
        const map = L.map(box.current, {
          zoomControl: false,
          scrollWheelZoom: false,
          dragging: !coarse,
          touchZoom: true,
          keyboard: true,
          zoomSnap: 0.5,
        });
        map.attributionControl.setPrefix(false);
        map.createPane("dbRings").style.zIndex = "410";
        map.createPane("dbLabels").style.zIndex = "620";
        map.createPane("dbPins").style.zIndex = "650";
        const state = { loaded: 0, errors: 0, timedOut: false };
        const tiles = L.tileLayer(TILE_URL, { maxZoom: 19, keepBuffer: 1, updateWhenIdle: true, attribution: ATTRIBUTION });
        tiles.on("tileload", () => {
          state.loaded += 1;
          setFailed(false);
        });
        tiles.on("tileerror", () => {
          state.errors += 1;
          if (tilesFailed(state)) setFailed(true);
        });
        tiles.addTo(map);
        timer = setTimeout(() => {
          state.timedOut = true;
          if (tilesFailed(state)) setFailed(true);
        }, 10_000);
        observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(box.current);
        mapRef.current = map;
        libRef.current = L;
        setReady(true);
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      pinLayers.current.clear();
    };
  }, []);

  const pinKey = pins.map((p) => `${p.id}:${p.number}:${p.lat}:${p.lng}:${p.address}:${p.distanceMiles}`).join("|");

  // Draw the search point, rings and pins, and fit them all in view.
  useEffect(() => {
    const map = mapRef.current;
    const L = libRef.current;
    if (!ready || !map || !L) return;
    const at: Leaflet.LatLngTuple = [center.lat, center.lng];
    // The view is set first, so every marker is on the map straight away.
    let bounds = L.latLng(at).toBounds(distance * 2 * MILE_IN_METERS);
    for (const p of pins) bounds = bounds.extend([p.lat, p.lng]);
    map.fitBounds(bounds, { padding: [28, 28], animate: false });
    const group = L.layerGroup().addTo(map);

    for (const ring of ringSpecs(distance, distances)) {
      L.circle(at, {
        radius: ring.meters,
        pane: "dbRings",
        interactive: false,
        weight: ring.chosen ? 3 : 2,
        dashArray: ring.chosen ? undefined : "6 8",
        fill: ring.chosen,
        fillOpacity: 1,
        className: ring.chosen ? "stroke-primary fill-primary/10" : "stroke-primary/50",
      }).addTo(group);
      const top = ringLabelPoint(center, ring.miles);
      L.marker([top.lat, top.lng], {
        pane: "dbLabels",
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<span data-ring-label="${ring.miles}" class="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold ${ring.chosen ? "text-primary" : "text-muted-foreground"} shadow-sm">${escapeHtml(ring.label)}</span>`,
        }),
      }).addTo(group);
    }

    L.marker(at, {
      pane: "dbPins",
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000,
      icon: L.divIcon({
        className: "",
        iconSize: [0, 0],
        html: `<span data-search-point class="absolute -left-2.5 -top-2.5 size-5 rounded-sm border-[3px] border-background bg-foreground shadow"></span><span data-search-label class="absolute left-4 -top-3 whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-xs font-semibold text-background shadow">${escapeHtml(center.label)}</span>`,
      }),
    }).addTo(group);

    const layers = new Map<string, PinLayers>();
    for (const p of pins) {
      const pin = L.marker([p.lat, p.lng], {
        pane: "dbPins",
        keyboard: true,
        title: pinAriaLabel(p),
        icon: L.divIcon({
          className: "group/pin",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
          html: `<span class="m-1 flex size-9 items-center justify-center rounded-full border-2 border-background bg-card text-sm font-bold text-primary shadow-md ring-primary group-[.is-picked]/pin:bg-primary group-[.is-picked]/pin:text-primary-foreground group-[.is-highlighted]/pin:ring-4 group-[.is-highlighted]/pin:ring-amber">${p.number}</span>`,
        }),
      }).addTo(group);
      pin.on("click", () => tapRef.current(p.id));
      const describe = () => {
        const el = pin.getElement();
        el?.setAttribute("role", "button");
        el?.setAttribute("aria-label", pinAriaLabel(p));
        el?.setAttribute("data-home-pin", String(p.number));
      };
      pin.on("add", describe);
      describe();
      const label = L.marker([p.lat, p.lng], {
        pane: "dbLabels",
        keyboard: false,
        icon: L.divIcon({
          className: "group/label",
          iconSize: [0, 0],
          html: `<span data-pin-label="${p.number}" class="invisible absolute left-0 top-0 whitespace-nowrap rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm group-[.is-picked]/label:border-primary">${escapeHtml(pinLabel(p))}</span>`,
        }),
      }).addTo(group);
      label.on("click", () => tapRef.current(p.id));
      const leader = L.polyline([at, at], { pane: "dbRings", interactive: false, weight: 1.5, className: "stroke-foreground/60" }).addTo(group);
      layers.set(p.id, { pin, label, leader, data: p });
    }
    pinLayers.current = layers;

    // Pins that sit close together are spread apart, with a thin line back to
    // the true spot, every time the zoom changes.
    const place = () => {
      const all = [...layers.values()];
      const spread = spreadPoints(
        all.map(({ data }) => {
          const pt = map.latLngToLayerPoint([data.lat, data.lng]);
          return { id: data.id, x: pt.x, y: pt.y };
        }),
        PIN_GAP,
      );
      for (const { pin, label, leader, data } of all) {
        const s = spread.get(data.id);
        if (!s) continue;
        const real = map.latLngToLayerPoint([data.lat, data.lng]);
        const shown = map.layerPointToLatLng(L.point(s.x, s.y));
        pin.setLatLng(shown);
        label.setLatLng(shown);
        const movedFar = Math.hypot(real.x - s.x, real.y - s.y) > 4;
        leader.setLatLngs(movedFar ? [[data.lat, data.lng], shown] : []);
      }
      // Labels go where they cover nothing; the highlighted and picked homes first.
      const frame = map.getContainer().getBoundingClientRect();
      const blocked: Rect[] = [...map.getContainer().querySelectorAll("[data-search-point], [data-search-label], [data-ring-label]")].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - frame.left, y: r.top - frame.top, w: r.width, h: r.height };
      });
      const { highlightedId: lit, picked } = orderRef.current;
      const rank = (id: string) => (id === lit ? 0 : picked.has(id) ? 1 : 2);
      const ordered = [...all].sort((a, b) => rank(a.data.id) - rank(b.data.id) || a.data.number - b.data.number);
      const items = ordered.map(({ pin, label, data }) => {
        const pt = map.latLngToContainerPoint(pin.getLatLng());
        const span = label.getElement()?.firstElementChild as HTMLElement | null;
        return { id: data.id, x: pt.x, y: pt.y, w: span?.offsetWidth ?? 0, h: span?.offsetHeight ?? 0, span };
      });
      const sides = placeLabels(items, blocked);
      for (const item of items) {
        if (!item.span) continue;
        const side = sides.get(item.id) ?? null;
        item.span.classList.toggle("invisible", side === null);
        if (!side) continue;
        const r = labelRect({ x: 0, y: 0 }, item, side);
        item.span.style.left = `${r.x}px`;
        item.span.style.top = `${r.y}px`;
      }
    };
    placeRef.current = place;

    place();
    map.on("zoomend", place);
    return () => {
      map.off("zoomend", place);
      placeRef.current = () => {};
      group.remove();
      pinLayers.current = new Map();
    };
    // pinKey stands for pins' position and wording; picked and highlighted
    // states are updated below without redrawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, center.lat, center.lng, center.label, distance, distances.join(","), pinKey]);

  // Picked and highlighted pins look different, without moving the view.
  useEffect(() => {
    if (!ready) return;
    for (const p of pins) {
      const layers = pinLayers.current.get(p.id);
      if (!layers) continue;
      const on = { "is-picked": p.picked, "is-highlighted": p.id === highlightedId };
      for (const el of [layers.pin.getElement(), layers.label.getElement()]) {
        if (!el) continue;
        for (const [name, value] of Object.entries(on)) el.classList.toggle(name, value);
      }
      layers.pin.setZIndexOffset(p.id === highlightedId ? 500 : p.picked ? 200 : 0);
      layers.pin.getElement()?.setAttribute("aria-pressed", String(p.id === highlightedId));
    }
    placeRef.current();
  }, [ready, pins, highlightedId, pinKey]);

  // Center the pin a card asked for.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    const target = pins.find((p) => p.id === focus.id);
    if (!target) return;
    map.setView([target.lat, target.lng], Math.max(map.getZoom(), 13));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focus?.id, focus?.nonce]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div role="region" aria-label={MAP_COPY.region} className="relative h-[360px] overflow-hidden rounded-xl border border-border bg-secondary md:h-[420px]">
        <div ref={box} data-search-map className="absolute inset-0 bg-secondary font-sans" />
        {ready && !failed ? (
          <div className="absolute left-2 top-2 z-[1000] flex flex-col gap-1.5">
            <Button type="button" variant="outline" size="icon" aria-label={MAP_COPY.zoomIn} className="size-11 bg-card shadow" onClick={() => mapRef.current?.zoomIn()}>
              <Plus className="size-5" />
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label={MAP_COPY.zoomOut} className="size-11 bg-card shadow" onClick={() => mapRef.current?.zoomOut()}>
              <Minus className="size-5" />
            </Button>
          </div>
        ) : null}
        {!ready && !failed ? (
          <div className="absolute inset-0 z-[1100] flex items-center justify-center text-sm text-muted-foreground">{MAP_COPY.loading}</div>
        ) : null}
        {failed ? (
          <div role="status" data-map-failed className="absolute inset-0 z-[1100] flex items-center justify-center bg-secondary p-6 text-center text-sm text-foreground">
            {MAP_COPY.failed}
          </div>
        ) : null}
      </div>
      <span className="text-xs text-muted-foreground">
        {MAP_COPY.straightLine}
        {touch ? ` ${MAP_COPY.twoFingers}` : ""}
      </span>
    </div>
  );
}
