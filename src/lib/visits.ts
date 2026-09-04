/**
 * Shared (browser-safe) helpers for geolocation-stamped site visits.
 *
 * A visit is the vendor physically being at the home: check in when they
 * arrive, check out when they leave. The phone's coordinates are compared to
 * the home's pin so a coordinator can see the visit really happened on site
 * without anyone chasing the vendor for a confirmation text.
 */

/** How close the phone has to be to the home's pin to count as "on site". */
export const ON_SITE_RADIUS_M = 250;

/** Readings looser than this are treated as unverified rather than trusted. */
export const MAX_TRUSTED_ACCURACY_M = 200;

export type Visit = {
  id: string;
  ticket_id: string;
  vendor_user_id: string;
  checked_in_at: string;
  check_in_distance_m: number | null;
  check_in_verified: boolean;
  checked_out_at: string | null;
  check_out_distance_m: number | null;
  check_out_verified: boolean;
  minutes_on_site: number | null;
  notes: string | null;
};

/** Straight-line distance between two coordinates, in metres. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function describeDistance(distance: number | null, verified: boolean) {
  if (distance == null) return "Location not captured";
  if (verified) return `At the home (${distance} m from the pin)`;
  if (distance <= ON_SITE_RADIUS_M) return `${distance} m from the pin — weak GPS signal`;
  return `${formatDistance(distance)} from the home`;
}

export function formatDistance(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

export function formatOnSite(minutes: number | null) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}

/** Reads the browser's position, with a friendly error the vendor can act on. */
export function readPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}
