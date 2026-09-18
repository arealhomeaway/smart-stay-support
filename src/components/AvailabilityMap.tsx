import { useEffect, useRef, useState } from "react";
import { loadMaps } from "./JobMap";
import type { AvailabilityResult } from "@/lib/availability-finder";
/* Google Maps comes from the hosted connector, as it does for Work Map. */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type AvailabilityViewport = { lat: number; lng: number; zoom: number };
type Props = { results: AvailabilityResult[]; selectedId: string | null; onSelect: (id: string) => void;
  viewport?: AvailabilityViewport | null; onViewportChange?: (viewport: AvailabilityViewport) => void };
const colors = { available: "#087d70", conditional: "#b77900", unavailable: "#667085" };
const DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1c2632" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d6e0e8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1c2632" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#354657" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#102a3e" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

export function AvailabilityMap({ results, selectedId, onSelect, viewport, onViewportChange }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const viewportRef = useRef(onViewportChange);
  const initialViewport = useRef(viewport);
  const population = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  viewportRef.current = onViewportChange;
  useEffect(() => {
    let disposed = false;
    let observer: MutationObserver | null = null;
    loadMaps().then(() => {
      if (disposed || !container.current) return;
      const g = window.google;
      const dark = () => document.documentElement.classList.contains("dark");
      map.current = new g.maps.Map(container.current, { center: initialViewport.current ? { lat: initialViewport.current.lat, lng: initialViewport.current.lng } : { lat: 32.7767, lng: -96.797 }, zoom: initialViewport.current?.zoom ?? 10, mapTypeControl: false, streetViewControl: false, styles: dark() ? DARK_STYLES : [] });
      map.current.addListener("idle", () => {
        const center = map.current?.getCenter();
        if (center) viewportRef.current?.({ lat: center.lat(), lng: center.lng(), zoom: map.current.getZoom() ?? 10 });
      });
      observer = new MutationObserver(() => map.current?.setOptions({ styles: dark() ? DARK_STYLES : [] }));
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      setReady(true);
    }).catch((reason: unknown) => { if (!disposed) setError(reason instanceof Error ? reason.message : "Map could not load."); });
    return () => { disposed = true; observer?.disconnect(); markers.current.forEach((marker) => marker.setMap(null)); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current || !window.google) return;
    const g = window.google;
    markers.current.forEach((marker) => marker.setMap(null));
    markers.current = results.map((result) => {
      const selected = selectedId === result.id;
      const marker = new g.maps.Marker({
        map: map.current, position: { lat: result.lat, lng: result.lng }, title: `${result.name} — ${result.status}`,
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: selected ? 16 : 12,
          fillColor: colors[result.status], fillOpacity: 1, strokeColor: selected ? "#f4d35e" : "#ffffff", strokeWeight: selected ? 4 : 2 },
      });
      marker.addListener("click", () => onSelect(result.id));
      return marker;
    });
    const nextPopulation = results.map((row) => row.id).join(",");
    if (results.length && !population.current && !initialViewport.current) {
      const bounds = new g.maps.LatLngBounds();
      results.forEach((result) => bounds.extend({ lat: result.lat, lng: result.lng }));
      map.current.fitBounds(bounds, 48);
    }
    population.current = nextPopulation;
  }, [results, selectedId, onSelect, ready]);
  if (error) return <p role="alert" className="rounded border p-6">{error}</p>;
  return <div ref={container} aria-label="Availability Finder map" className="h-[440px] w-full rounded-lg border bg-muted" />;
}
