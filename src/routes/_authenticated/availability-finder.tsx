import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, type FormEvent } from "react";
import { searchAvailability, downloadAvailabilityOptions } from "@/lib/availability-finder.functions";
import { AVAILABILITY_RADIUS_MILES, emailSummary, validStay, verifiedPublicListingUrl, visibleResults } from "@/lib/availability-finder";
import { AvailabilityMap } from "@/components/AvailabilityMap";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";

type FinderSearch = { checkIn?: string | undefined; checkOut?: string | undefined; location?: string | undefined; showUnavailable?: boolean | undefined; selected?: string | undefined };
export const Route = createFileRoute("/_authenticated/availability-finder")({
  validateSearch: (search: Record<string, unknown>): FinderSearch => ({
    checkIn: typeof search["checkIn"] === "string" ? search["checkIn"] : undefined,
    checkOut: typeof search["checkOut"] === "string" ? search["checkOut"] : undefined,
    location: typeof search["location"] === "string" ? search["location"] : undefined,
    showUnavailable: search["showUnavailable"] === true || search["showUnavailable"] === "true",
    selected: typeof search["selected"] === "string" ? search["selected"] : undefined,
  }),
  component: AvailabilityFinderPage,
});

function AvailabilityFinderPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { can, isLoading } = useRole();
  const allowed = can("work_orders_internal");
  const find = useServerFn(searchAvailability);
  const downloadOptions = useServerFn(downloadAvailabilityOptions);
  const [checkIn, setCheckIn] = useState(search.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(search.checkOut ?? "");
  const [location, setLocation] = useState(search.location ?? "");
  const [validation, setValidation] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const inputReady = Boolean(search.location?.trim() && search.checkIn && search.checkOut && validStay(search.checkIn, search.checkOut));
  const query = useQuery({
    queryKey: ["availability-finder", search.checkIn, search.checkOut, search.location],
    queryFn: () => find({ data: { checkIn: search.checkIn!, checkOut: search.checkOut!, location: search.location! } }),
    enabled: allowed && inputReady,
    retry: false,
  });
  const results = visibleResults(query.data?.results ?? [], Boolean(search.showUnavailable));
  const selectedId = results.some((row) => row.id === search.selected) ? search.selected! : null;
  const onSelect = useCallback((id: string) => {
    void navigate({ search: (previous) => ({ ...previous, selected: id }) });
    document.getElementById(`availability-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [navigate]);
  const selectedResults = (query.data?.results ?? []).filter((row) => chosen.includes(row.id));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!location.trim()) { setValidation("Enter a city, ZIP code, address, or general location."); return; }
    if (!validStay(checkIn, checkOut)) { setValidation("Enter valid dates, with check-out after check-in."); return; }
    setValidation(null); setChosen([]);
    void navigate({ search: { checkIn, checkOut, location: location.trim(), showUnavailable: false } });
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
    {query.isPending && inputReady && <p role="status">Checking OwnerRez reservations and nearby properties…</p>}
    {query.error && <p role="alert" className="rounded border border-destructive p-4 text-destructive">{query.error instanceof Error ? query.error.message : "Search failed."} No availability result was issued.</p>}
    {query.data && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{results.length} of {query.data.results.length} properties within {AVAILABILITY_RADIUS_MILES} miles · sorted by distance</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(search.showUnavailable)} onChange={(event) => void navigate({ search: (previous) => ({ ...previous, showUnavailable: event.target.checked, selected: undefined }) })} />Show unavailable</label>
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
        <AvailabilityMap results={results} selectedId={selectedId} onSelect={onSelect} />
        <div className="max-h-[680px] space-y-3 overflow-y-auto" aria-label="Availability results">
          {results.map((row) => <article key={row.id} id={`availability-${row.id}`} className={`rounded-lg border bg-card p-4 ${selectedId === row.id ? "ring-2 ring-primary" : ""}`}>
            <div className="flex gap-3">
              {row.imageUrl && <img src={row.imageUrl} alt={row.name} className="h-24 w-28 rounded object-cover" />}
              <div className="min-w-0 flex-1"><button type="button" className="text-left font-semibold underline-offset-2 hover:underline" onClick={() => onSelect(row.id)}>{row.name}</button>
                <p className="text-sm text-muted-foreground">{row.address} · {row.distanceMiles.toFixed(1)} miles</p>
                <p className="text-sm">{row.bedrooms ?? "—"} beds · {row.bathrooms ?? "—"} baths · {row.maxGuests ?? "—"} guests</p>
              </div>
            </div>
            <p className={`mt-3 font-semibold ${row.status === "conditional" ? "text-amber-700 dark:text-amber-400" : row.status === "available" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{row.status === "conditional" ? "Conditional — STR relocation required" : row.status === "available" ? "Available" : "Unavailable"}</p>
            {row.status === "conditional" && <div className="mt-1 text-sm"><p>Operations must confirm and complete relocation before this property can be offered.</p><ul className="list-inside list-disc">{row.strConflicts.map((conflict, index) => <li key={`${conflict.arrival}-${index}`}>{conflict.arrival} to {conflict.departure}</li>)}</ul></div>}
            {row.status === "unavailable" && <p className="mt-1 text-sm">Non-movable reservation or block overlaps the requested stay.</p>}
            {row.bookingUrl ? <a href={row.bookingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary underline">View public listing</a> : <p className="mt-2 text-sm text-amber-700">No verified public listing link. PDF export is blocked for this property.</p>}
            {row.status !== "unavailable" && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.includes(row.id)} disabled={!row.bookingUrl} onChange={(event) => setChosen((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} />Include in property options PDF</label>}
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
