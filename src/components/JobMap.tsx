import { useEffect, useRef, useState } from "react";
import type { MapPin } from "@/lib/geo.server";

declare global {
  interface Window {
    google?: any;
    __resolveMapReady?: () => void;
  }
}

let loader: Promise<void> | null = null;

function loadMaps() {
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
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });
  return loader;
}

/** Pin colour by the most urgent open job at that home. */
function pinColor(pin: MapPin) {
  if (pin.openJobs.length === 0) return "#8a8f8a";
  if (pin.openJobs.some((j) => j.priority === "p1")) return "#c2413a";
  if (pin.openJobs.some((j) => j.priority === "p2")) return "#d08a2c";
  return "#2f6f68";
}

type Props = { pins: MapPin[]; onSelect: (pin: MapPin) => void };

export function JobMap({ pins, onSelect }: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !container.current) return;
        mapRef.current ??= new window.google.maps.Map(container.current, {
          center: { lat: 32.7767, lng: -96.797 },
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
        });
        draw();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Map failed to load."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapRef.current) draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins]);

  function draw() {
    const g = window.google;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (pins.length === 0) return;

    const bounds = new g.maps.LatLngBounds();
    for (const pin of pins) {
      const marker = new g.maps.Marker({
        map: mapRef.current,
        position: { lat: pin.lat, lng: pin.lng },
        title: `${pin.name} — ${pin.openJobs.length} open`,
        label: pin.openJobs.length
          ? { text: String(pin.openJobs.length), color: "#ffffff", fontSize: "11px", fontWeight: "700" }
          : undefined,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: pin.openJobs.length ? 13 : 7,
          fillColor: pinColor(pin),
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => onSelect(pin));
      markersRef.current.push(marker);
      bounds.extend({ lat: pin.lat, lng: pin.lng });
    }
    mapRef.current.fitBounds(bounds, 48);
  }

  if (error) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  return <div ref={container} className="h-[420px] w-full rounded-lg border border-border" />;
}
