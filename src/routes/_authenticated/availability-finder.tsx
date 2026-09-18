import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { searchAvailability, downloadAvailabilityOptions } from "@/lib/availability-finder.functions";
import { AVAILABILITY_RADIUS_MILES, emailSummary, validStay, verifiedPublicListingUrl } from "@/lib/availability-finder";
import { activeFinderFilters, DEFAULT_FINDER_FILTERS, filterFinderResults, parseFinderFilters, type FinderFilters } from "@/lib/availability-filters";
import { AvailabilityMap, type AvailabilityViewport } from "@/components/AvailabilityMap";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";

type FinderSearch = { checkIn?: string | undefined; checkOut?: string | undefined; location?: string | undefined;
  selected?: string | undefined; chosen?: string | undefined;
  minBedrooms?: number | undefined; minBathrooms?: number | undefined; minGuests?: number | undefined; pets?: FinderFilters["pets"] | undefined;
  propertyType?: string | undefined; status?: FinderFilters["status"] | undefined; radius?: FinderFilters["radius"] | undefined;
  amenities?: string | undefined; sort?: FinderFilters["sort"] | undefined; showUnavailable?: boolean | undefined;
  mapLat?: number | undefined; mapLng?: number | undefined; mapZoom?: number | undefined };
export const Route = createFileRoute("/_authenticated/availability-finder")({
  validateSearch: (search: Record<string, unknown>): FinderSearch => ({
    ...parseFinderFilters(search),
    checkIn: typeof search["checkIn"] === "string" ? search["checkIn"] : undefined,
    checkOut: typeof search["checkOut"] === "string" ? search["checkOut"] : undefined,
    location: typeof search["location"] === "string" ? search["location"] : undefined,
    selected: typeof search["selected"] === "string" ? search["selected"] : undefined,
    chosen: typeof search["chosen"] === "string" ? search["chosen"] : undefined,
    amenities: typeof search["amenities"] === "string" ? search["amenities"] : undefined,
    mapLat: Number.isFinite(Number(search["mapLat"])) && search["mapLat"] !== undefined ? Number(search["mapLat"]) : undefined,
    mapLng: Number.isFinite(Number(search["mapLng"])) && search["mapLng"] !== undefined ? Number(search["mapLng"]) : undefined,
    mapZoom: Number.isFinite(Number(search["mapZoom"])) && search["mapZoom"] !== undefined ? Number(search["mapZoom"]) : undefined,
  }),
  component: AvailabilityFinderPage,
});

function AvailabilityFinderPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { token: originToken } = useWorkspaceOrigin("Availability Finder");
  const { can, isLoading } = useRole();
  const allowed = can("work_orders_internal");
  const find = useServerFn(searchAvailability);
  const downloadOptions = useServerFn(downloadAvailabilityOptions);
  const [checkIn, setCheckIn] = useState(search.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(search.checkOut ?? "");
  const [location, setLocation] = useState(search.location ?? "");
  const [validation, setValidation] = useState<string | null>(null);
  const chosen = (search.chosen ?? "").split(",").filter(Boolean);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(() => activeFinderFilters(parseFinderFilters(search as Record<string, unknown>)).length > 0);
  const inputReady = Boolean(search.location?.trim() && search.checkIn && search.checkOut && validStay(search.checkIn, search.checkOut));
  const query = useQuery({
    queryKey: ["availability-finder", search.checkIn, search.checkOut, search.location],
    queryFn: () => find({ data: { checkIn: search.checkIn!, checkOut: search.checkOut!, location: search.location! } }),
    enabled: allowed && inputReady,
    retry: false,
  });
  const filters = useMemo(() => parseFinderFilters(search as Record<string, unknown>), [search.minBedrooms, search.minBathrooms,
    search.minGuests, search.pets, search.propertyType, search.status, search.radius, search.showUnavailable, search.sort, search.amenities]);
  const results = useMemo(() => filterFinderResults(query.data?.results ?? [], filters), [query.data?.results, filters]);
  const active = activeFinderFilters(filters);
  const propertyTypes = Array.from(new Set((query.data?.results ?? []).map((row) => row.propertyType).filter((type): type is string => Boolean(type)))).sort();
  const amenityOptions = Array.from(new Set((query.data?.results ?? []).flatMap((row) => row.amenities))).sort();
  const viewport: AvailabilityViewport | null = search.mapLat != null && search.mapLng != null && search.mapZoom != null &&
    Math.abs(search.mapLat) <= 90 && Math.abs(search.mapLng) <= 180 && search.mapZoom >= 1 && search.mapZoom <= 21
    ? { lat: search.mapLat, lng: search.mapLng, zoom: search.mapZoom } : null;
  const onViewportChange = useCallback((next: AvailabilityViewport) => {
    void navigate({ search: (previous) => ({ ...previous, mapLat: Number(next.lat.toFixed(5)), mapLng: Number(next.lng.toFixed(5)), mapZoom: next.zoom }), replace: true });
  }, [navigate]);
  const setFilter = (patch: Partial<FinderSearch>) => void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  const clearFilters = () => setFilter({ ...DEFAULT_FINDER_FILTERS, amenities: undefined });
  const setChosen = (next: string[]) => void navigate({ search: (previous) => ({ ...previous, chosen: next.length ? next.join(",") : undefined }), replace: true });
  const selectedId = results.some((row) => row.id === search.selected) ? search.selected! : null;
  const onSelect = useCallback((id: string) => {
    void navigate({ search: (previous) => ({ ...previous, selected: id }) });
    document.getElementById(`availability-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [navigate]);
  const selectedResults = results.filter((row) => chosen.includes(row.id));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!location.trim()) { setValidation("Enter a city, ZIP code, address, or general location."); return; }
    if (!validStay(checkIn, checkOut)) { setValidation("Enter valid dates, with check-out after check-in."); return; }
    setValidation(null);
    void navigate({ search: (previous) => ({ ...previous, checkIn, checkOut, location: location.trim(), selected: undefined, chosen: undefined,
      mapLat: undefined, mapLng: undefined, mapZoom: undefined }) });
  }

  async function downloadPdf() {
    setExportError(null);
    if (selectedResults.length === 0 || selectedResults.some((row) => !verifiedPublicListingUrl(row.bookingUrl))) {
      setExportError("Select one or more eligible properties with verified public listing links."); return;
    }
    setExporting(true);
    try {
      const file = await downloadOptions({ data: { checkIn: search.checkIn!, checkOut: search.checkOut!, location: search.location!, propertyIds: selectedResults.map((row) => row.id) } });
      const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: file.mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = file.filename; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setExportError(error instanceof Error ? error.message : "Could not generate the PDF."); }
    finally { setExporting(false); }
  }

  if (isLoading) return <p role="status" className="p-6">Checking access…</p>;
  if (!allowed) return <p role="alert" className="p-6">Availability Finder is for authorized Operations staff only.</p>;
  return <div className="space-y-6 p-4 md:p-6">
    <PageHeader title="Availability Finder" description="Find nearby properties for a proposed stay. OwnerRez reservations are checked live; final availability requires Operations confirmation." />
    <form onSubmit={submit} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
      <label className="space-y-1 text-sm">Check-in<Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required /></label>
      <label className="space-y-1 text-sm">Check-out<Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required /></label>
      <label className="space-y-1 text-sm">City, ZIP, address, or location<Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Dallas, TX" required /></label>
      <Button type="submit">Search 20 miles</Button>
      {validation && <p role="alert" className="text-destructive md:col-span-4">{validation}</p>}
    </form>
    <details className="rounded-lg border bg-card p-4" open={filtersOpen} onToggle={(event) => setFiltersOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">Filter properties {active.length ? `(${active.length} active)` : ""}</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">Minimum bedrooms<Input type="number" min="0" max="30" value={filters.minBedrooms || ""} placeholder="Any" onChange={(event) => setFilter({ minBedrooms: Number(event.target.value) || 0 })} /></label>
        <label className="space-y-1 text-sm">Minimum bathrooms<Input type="number" min="0" max="30" value={filters.minBathrooms || ""} placeholder="Any" onChange={(event) => setFilter({ minBathrooms: Number(event.target.value) || 0 })} /></label>
        <label className="space-y-1 text-sm">Minimum guests<Input type="number" min="0" max="30" value={filters.minGuests || ""} placeholder="Any" onChange={(event) => setFilter({ minGuests: Number(event.target.value) || 0 })} /></label>
        <label className="space-y-1 text-sm">Pet requirement<select aria-label="Pet requirement" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-foreground" value={filters.pets} onChange={(event) => setFilter({ pets: event.target.value as FinderFilters["pets"] })}>
          <option value="any">Any</option><option value="required">Pet-friendly required</option><option value="none">No pets needed</option>
        </select></label>
        <label className="space-y-1 text-sm">Property type<select aria-label="Property type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-foreground" value={filters.propertyType} onChange={(event) => setFilter({ propertyType: event.target.value })}>
          <option value="all">Any</option>{propertyTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select></label>
        <label className="space-y-1 text-sm">Availability<select aria-label="Availability classification" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-foreground" value={filters.status} onChange={(event) => setFilter({ status: event.target.value as FinderFilters["status"] })}>
          <option value="all">Available and conditional</option><option value="available">Available</option><option value="conditional">Conditional — STR relocation required</option><option value="unavailable">Unavailable</option>
        </select></label>
        <label className="space-y-1 text-sm">Distance<select aria-label="Distance" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-foreground" value={filters.radius} onChange={(event) => setFilter({ radius: Number(event.target.value) as FinderFilters["radius"] })}>
          {[5, 10, 15, 20].map((miles) => <option key={miles} value={miles}>{miles} miles</option>)}
        </select></label>
        <label className="space-y-1 text-sm">Sort<select aria-label="Sort properties" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-foreground" value={filters.sort} onChange={(event) => setFilter({ sort: event.target.value as FinderFilters["sort"] })}>
          <option value="distance">Distance</option><option value="bedrooms">Bedrooms</option><option value="guests">Guest capacity</option><option value="status">Availability</option>
        </select></label>
      </div>
      {amenityOptions.length > 0 ? <fieldset className="mt-4 flex flex-wrap gap-3"><legend className="mb-1 text-sm font-medium">Verified amenities</legend>
        {amenityOptions.map((amenity) => <label key={amenity} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filters.amenities.includes(amenity)} onChange={(event) => setFilter({ amenities: (event.target.checked ? [...filters.amenities, amenity] : filters.amenities.filter((value) => value !== amenity)).join(",") || undefined })} />{amenity}</label>)}
      </fieldset> : <p className="mt-3 text-xs text-muted-foreground">Pet policy, pet-count limits, and amenity values are not yet verified in the connected property data. A required pet-friendly filter excludes homes with unspecified policy.</p>}
      {active.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
        {active.map((item) => <button type="button" key={`${item.key}-${item.label}`} className="rounded-full border border-primary/50 bg-primary/10 px-2.5 py-1 text-xs text-primary" onClick={() => item.key === "amenities" ? setFilter({ amenities: filters.amenities.filter((value) => value !== item.label).join(",") || undefined }) : setFilter({ [item.key]: DEFAULT_FINDER_FILTERS[item.key] })}>{item.label} ×</button>)}
        <Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button>
      </div>}
    </details>
    {query.isPending && inputReady && <p role="status">Checking OwnerRez reservations and nearby properties…</p>}
    {query.error && <p role="alert" className="rounded border border-destructive p-4 text-destructive">{query.error instanceof Error ? query.error.message : "Search failed."} No availability result was issued.</p>}
    {query.data && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{results.length} matching of {query.data.results.length} properties within {AVAILABILITY_RADIUS_MILES} miles · sorted by {filters.sort}</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filters.showUnavailable} onChange={(event) => setFilter({ showUnavailable: event.target.checked })} />Show unavailable</label>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
        <AvailabilityMap key={`${search.checkIn}-${search.checkOut}-${search.location}`} results={results} selectedId={selectedId} onSelect={onSelect} viewport={viewport} onViewportChange={onViewportChange} />
        <div className="max-h-[680px] space-y-3 overflow-y-auto" aria-label="Availability results">
          {results.map((row) => <article key={row.id} id={`availability-${row.id}`} className={`rounded-lg border bg-card p-4 ${selectedId === row.id ? "ring-2 ring-primary" : ""}`}>
            <div className="flex gap-3">
              {row.imageUrl && <img src={row.imageUrl} alt={row.name} className="h-24 w-28 rounded object-cover" />}
              <div className="min-w-0 flex-1"><button type="button" className="text-left font-semibold underline-offset-2 hover:underline" onClick={() => onSelect(row.id)}>{row.name}</button>
                <p className="text-sm text-muted-foreground">{row.address} · {row.distanceMiles.toFixed(1)} miles</p>
                <p className="text-sm">{row.bedrooms ?? "—"} beds · {row.bathrooms ?? "—"} baths · {row.maxGuests ?? "—"} guests</p>
                <p className="text-sm text-muted-foreground">{row.propertyType ?? "Type not specified"} · Pets: {row.petFriendly === null ? "Not specified" : row.petFriendly ? "Pet-friendly" : "Not pet-friendly"}</p>
              </div>
            </div>
            <p className={`mt-3 font-semibold ${row.status === "conditional" ? "text-amber-700 dark:text-amber-400" : row.status === "available" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{row.status === "conditional" ? "Conditional — STR relocation required" : row.status === "available" ? "Available" : "Unavailable"}</p>
            {row.status === "conditional" && <div className="mt-1 text-sm"><p>Operations must confirm and complete relocation before this property can be offered.</p><ul className="list-inside list-disc">{row.strConflicts.map((conflict, index) => <li key={`${conflict.arrival}-${index}`}>{conflict.arrival} to {conflict.departure}</li>)}</ul></div>}
            {row.status === "unavailable" && <p className="mt-1 text-sm">Non-movable reservation or block overlaps the requested stay.</p>}
            {row.bookingUrl ? <a href={row.bookingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary underline">View public listing</a> : <p className="mt-2 text-sm text-amber-700">No verified public listing link. PDF export is blocked for this property.</p>}
            <Link to="/property/$propertyId" params={{ propertyId: row.id }} search={{ from: originToken } as never} className="ml-3 text-sm text-primary underline">Property details</Link>
            {row.status !== "unavailable" && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.includes(row.id)} disabled={!row.bookingUrl} onChange={(event) => setChosen(event.target.checked ? [...chosen, row.id] : chosen.filter((id) => id !== row.id))} />Include in property options PDF</label>}
          </article>)}
          {results.length === 0 && <p className="rounded border p-6 text-muted-foreground">No matching properties in this view.</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void downloadPdf()} disabled={!selectedResults.length || exporting}>{exporting ? "Preparing PDF…" : `Download Property Options PDF (${selectedResults.length})`}</Button>
        <Button variant="outline" disabled={!selectedResults.length} onClick={() => void navigator.clipboard.writeText(emailSummary(selectedResults, search.checkIn!, search.checkOut!, search.location!))}>Copy Email Summary</Button>
      </div>
      {exportError && <p role="alert" className="text-destructive">{exportError}</p>}
      <p className="text-xs text-muted-foreground">Public listing links come from OwnerRez. Reservation conflicts remain internal; the PDF uses neutral final-confirmation language.</p>
    </>}
  </div>;
}
