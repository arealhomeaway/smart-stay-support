import { useEffect, useRef, useState } from "react";
/* Google Maps is injected by the hosted connector and has no local type package. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { activeMapCount, clusterMapPins, mapPinColor, type MapPin } from "@/lib/geo";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    google?: any;
    __resolveMapReady?: () => void;
  }
}

let loader: Promise<void> | null = null;

export function loadMaps() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve();
  if (loader) return loader;

  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
  const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
  if (!key) return Promise.reject(new Error("Google Maps isn't connected yet."));

  loader = new Promise<void>((resolve, reject) => {
    window.__resolveMapReady = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__resolveMapReady${
      channel ? `&channel=${channel}` : ""
    }`;
    script.async = true;
    script.onerror = () => {
      loader = null;
      reject(new Error("Google Maps failed to load."));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export type MapViewport = { lat: number; lng: number; zoom: number };

const DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1c2632" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d6e0e8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1c2632" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#354657" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#102a3e" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

type Props = {
  pins: MapPin[];
  onSelect: (pin: MapPin) => void;
  selectedPropertyId?: string | null;
  viewport?: MapViewport | null;
  onViewportChange?: (viewport: MapViewport) => void;
};

export function JobMap({ pins, onSelect, selectedPropertyId, viewport, onViewportChange }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const pinsRef = useRef(pins);
  const selectRef = useRef(onSelect);
  const viewportRef = useRef(onViewportChange);
  const selectedRef = useRef(selectedPropertyId);
  const initialViewport = useRef(viewport);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  pinsRef.current = pins;
  selectRef.current = onSelect;
  viewportRef.current = onViewportChange;
  selectedRef.current = selectedPropertyId;

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    loadMaps()
      .then(() => {
        if (cancelled || !container.current) return;
        const saved = initialViewport.current;
        const dark = () => document.documentElement.classList.contains("dark");
        mapRef.current = new window.google.maps.Map(container.current, {
          center: saved ? { lat: saved.lat, lng: saved.lng } : { lat: 32.7767, lng: -96.797 },
          zoom: saved?.zoom ?? 10,
          mapTypeControl: false,
          streetViewControl: false,
          styles: dark() ? DARK_STYLES : [],
        });
        mapRef.current.addListener("zoom_changed", draw);
        mapRef.current.addListener("idle", () => {
          const center = mapRef.current?.getCenter();
          if (center) viewportRef.current?.({
            lat: center.lat(), lng: center.lng(), zoom: mapRef.current.getZoom() ?? 10,
          });
        });
        observer = new MutationObserver(() => mapRef.current?.setOptions({ styles: dark() ? DARK_STYLES : [] }));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        if (!saved && pinsRef.current.length) {
          const bounds = new window.google.maps.LatLngBounds();
          pinsRef.current.forEach((pin) => bounds.extend({ lat: pin.lat, lng: pin.lng }));
          mapRef.current.fitBounds(bounds, 48);
        }
        draw();
        setReady(true);
      })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Map failed to load."); });
    return () => {
      cancelled = true;
      observer?.disconnect();
      markersRef.current.forEach((marker) => marker.setMap(null));
      if (mapRef.current) window.google?.maps?.event?.clearInstanceListeners(mapRef.current);
      mapRef.current = null;
    };
  }, [retry]);

  useEffect(() => {
    if (ready) draw();
  }, [pins, selectedPropertyId, ready]);

  function draw() {
    const g = window.google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    for (const group of clusterMapPins(pinsRef.current, mapRef.current.getZoom() ?? 10)) {
      const clustered = group.length > 1;
      const count = group.reduce((total, pin) => total + activeMapCount(pin), 0);
      const lat = group.reduce((total, pin) => total + pin.lat, 0) / group.length;
      const lng = group.reduce((total, pin) => total + pin.lng, 0) / group.length;
      const pin = group[0]!;
      const selected = !clustered && pin.propertyId === selectedRef.current;
      const marker = new g.maps.Marker({
        map: mapRef.current,
        position: { lat, lng },
        title: clustered ? `${group.length} properties, ${count} active issues` : `${pin.name} — ${count} active`,
        label: { text: clustered ? `${group.length} · ${count}` : String(count), color: "#ffffff", fontSize: "12px", fontWeight: "700" },
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: clustered ? 20 : selected ? 17 : 14,
          fillColor: clustered ? "#344c68" : mapPinColor(pin),
          fillOpacity: 1,
          strokeColor: selected ? "#f4d35e" : "#ffffff",
          strokeWeight: selected ? 4 : 2,
        },
      });
      marker.addListener("click", () => {
        if (clustered) {
          const bounds = new g.maps.LatLngBounds();
          group.forEach((member) => bounds.extend({ lat: member.lat, lng: member.lng }));
          mapRef.current.fitBounds(bounds, 64);
          if ((mapRef.current.getZoom() ?? 0) <= 16)
            mapRef.current.setZoom(Math.min(18, (mapRef.current.getZoom() ?? 10) + 2));
        } else selectRef.current(pin);
      });
      markersRef.current.push(marker);
    }
  }

  if (error) {
    return (
      <div role="alert" className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-foreground">
        <p>{error}</p>
        <Button size="sm" variant="outline" onClick={() => { setError(null); setRetry((value) => value + 1); }}>Try map again</Button>
      </div>
    );
  }

  return <div className="relative">
    {!ready && <div role="status" className="absolute inset-0 flex items-center justify-center rounded-lg bg-muted/40 text-sm text-foreground">Loading map…</div>}
    <div ref={container} aria-label="Operations work map" className="h-[min(70vh,720px)] min-h-[420px] w-full rounded-lg border border-border bg-muted" />
  </div>;
}
