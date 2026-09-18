import type { AvailabilityResult, AvailabilityStatus } from "./availability-finder";

export type PetRequirement = "any" | "required" | "none";
export type FinderSort = "distance" | "bedrooms" | "guests" | "status";
export type FinderFilters = {
  minBedrooms: number;
  minBathrooms: number;
  minGuests: number;
  pets: PetRequirement;
  propertyType: string;
  status: "all" | AvailabilityStatus;
  radius: 5 | 10 | 15 | 20;
  amenities: string[];
  sort: FinderSort;
  showUnavailable: boolean;
};
export const DEFAULT_FINDER_FILTERS: FinderFilters = {
  minBedrooms: 0, minBathrooms: 0, minGuests: 0, pets: "any", propertyType: "all",
  status: "all", radius: 20, amenities: [], sort: "distance", showUnavailable: false,
};

function minimum(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 30 ? number : 0;
}
export function parseFinderFilters(raw: Record<string, unknown>): FinderFilters {
  const radius = Number(raw["radius"]);
  const status = raw["status"];
  const pets = raw["pets"];
  const sort = raw["sort"];
  return {
    minBedrooms: minimum(raw["minBedrooms"]), minBathrooms: minimum(raw["minBathrooms"]), minGuests: minimum(raw["minGuests"]),
    pets: pets === "required" || pets === "none" ? pets : "any",
    propertyType: typeof raw["propertyType"] === "string" && raw["propertyType"].length <= 80 ? raw["propertyType"] : "all",
    status: status === "available" || status === "conditional" || status === "unavailable" ? status : "all",
    radius: radius === 5 || radius === 10 || radius === 15 ? radius : 20,
    amenities: typeof raw["amenities"] === "string" ? raw["amenities"].split(",").filter(Boolean).slice(0, 8) : [],
    sort: sort === "bedrooms" || sort === "guests" || sort === "status" ? sort : "distance",
    showUnavailable: raw["showUnavailable"] === true || raw["showUnavailable"] === "true",
  };
}

export function filterFinderResults(results: AvailabilityResult[], filters: FinderFilters) {
  const order = { available: 0, conditional: 1, unavailable: 2 };
  return results.filter((row) => {
    if (row.distanceMiles > filters.radius) return false;
    if (filters.status !== "all" && row.status !== filters.status) return false;
    if (filters.status === "all" && !filters.showUnavailable && row.status === "unavailable") return false;
    if (filters.minBedrooms && (row.bedrooms == null || row.bedrooms < filters.minBedrooms)) return false;
    if (filters.minBathrooms && (row.bathrooms == null || row.bathrooms < filters.minBathrooms)) return false;
    if (filters.minGuests && (row.maxGuests == null || row.maxGuests < filters.minGuests)) return false;
    // No pets needed does not exclude pet-friendly homes. Required fails closed on unknown policy.
    if (filters.pets === "required" && row.petFriendly !== true) return false;
    if (filters.propertyType !== "all" && row.propertyType !== filters.propertyType) return false;
    if (filters.amenities.some((amenity) => !row.amenities.includes(amenity))) return false;
    return true;
  }).sort((a, b) => {
    if (filters.sort === "bedrooms") return (b.bedrooms ?? -1) - (a.bedrooms ?? -1) || a.distanceMiles - b.distanceMiles;
    if (filters.sort === "guests") return (b.maxGuests ?? -1) - (a.maxGuests ?? -1) || a.distanceMiles - b.distanceMiles;
    if (filters.sort === "status") return order[a.status] - order[b.status] || a.distanceMiles - b.distanceMiles;
    return a.distanceMiles - b.distanceMiles;
  });
}

export function activeFinderFilters(filters: FinderFilters) {
  const active: { key: keyof FinderFilters; label: string }[] = [];
  if (filters.minBedrooms) active.push({ key: "minBedrooms", label: `${filters.minBedrooms}+ bedrooms` });
  if (filters.minBathrooms) active.push({ key: "minBathrooms", label: `${filters.minBathrooms}+ bathrooms` });
  if (filters.minGuests) active.push({ key: "minGuests", label: `${filters.minGuests}+ guests` });
  if (filters.pets !== "any") active.push({ key: "pets", label: filters.pets === "required" ? "Pet-friendly required" : "No pets needed" });
  if (filters.propertyType !== "all") active.push({ key: "propertyType", label: filters.propertyType });
  if (filters.status !== "all") active.push({ key: "status", label: filters.status === "conditional" ? "Conditional" : filters.status });
  if (filters.radius !== 20) active.push({ key: "radius", label: `${filters.radius} miles` });
  if (filters.showUnavailable) active.push({ key: "showUnavailable", label: "Show unavailable" });
  for (const amenity of filters.amenities) active.push({ key: "amenities", label: amenity });
  return active;
}
