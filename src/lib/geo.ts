/** Shared, client-safe map types. */
export type MapJob = {
  id: string;
  ticketId?: string | null;
  ref: number | null;
  title: string;
  priority: string;
  status: string;
  dueAt: string | null;
  vendorName: string | null;
  vendorStatus: string | null;
  workOrderId?: string | null;
  assigneeId?: string | null;
  team?: string | null;
  waitingOn?: string | null;
  escalated?: boolean;
  slaBreached?: boolean;
  dispatchState?: string | null;
  dispatchSyncedAt?: string | null;
  acceptanceState?: string | null;
  completionState?: string | null;
};

export type MapPin = {
  propertyId: string;
  name: string;
  address: string;
  market?: string | null;
  city?: string | null;
  state?: string | null;
  lat: number;
  lng: number;
  openJobs: MapJob[];
};

export function validCoordinates(lat: number | null, lng: number | null): boolean {
  return lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);
}

export function mapPinColor(pin: MapPin): string {
  const active = pin.openJobs.filter((job) => !["closed", "resolved"].includes(job.status));
  if (active.some((job) => job.priority === "p1")) return "#b42318";
  if (active.some((job) => job.priority === "p2")) return "#a85b00";
  if (active.some((job) => job.priority === "p3")) return "#087d70";
  return "#667085";
}

export function mostUrgentPriority(values: Array<string | null | undefined>): string {
  if (values.includes("p1")) return "p1";
  if (values.includes("p2")) return "p2";
  return "p3";
}

export function activeMapCount(pin: MapPin): number {
  return pin.openJobs.filter((job) => !["closed", "resolved"].includes(job.status)).length;
}

/** Use the property id and stored address, never untrusted free-form URL text. */
export function directionsUrl(pin: Pick<MapPin, "address" | "lat" | "lng">): string {
  const destination = pin.address.trim() || `${pin.lat},${pin.lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Web Mercator grid cells cluster nearby homes and separate as zoom rises. */
export function clusterMapPins(pins: MapPin[], zoom: number, cellSize = 72): MapPin[][] {
  const cells = new Map<string, MapPin[]>();
  const scale = (256 * 2 ** zoom) / cellSize;
  for (const pin of pins) {
    const lat = Math.max(-85, Math.min(85, pin.lat)) * Math.PI / 180;
    const x = ((pin.lng + 180) / 360) * scale;
    const y = ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * scale;
    const key = `${Math.floor(x)}:${Math.floor(y)}`;
    cells.set(key, [...(cells.get(key) ?? []), pin]);
  }
  return [...cells.values()];
}
