import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, type FormEvent } from "react";
import { searchAvailability, downloadAvailabilityOptions } from "@/lib/availability-finder.functions";
import { AVAILABILITY_RADIUS_MILES, emailSummary, needsStrRebook, rebookStepSummary, validStay, verifiedPublicListingUrl, visibleResults } from "@/lib/availability-finder";
import { AMENITY_LABELS, AMENITY_SPECS, confirmedAmenities, petSummary, type AmenityKey } from "@/lib/property-facts";
import { formatMoney, internalQuoteLine, PRICE_ESTIMATE_NOTE, quoteSourceNote } from "@/lib/pricing";
import { AvailabilityMap } from "@/components/AvailabilityMap";
import { EmailComposer } from "@/components/EmailComposer";
import { InquirySourceForm } from "@/components/InquirySourceForm";
import { useInquirySources } from "@/routes/_authenticated/inquiry-sources";
import { searchSources } from "@/lib/inquiry-sources";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FinderSearch = { checkIn?: string | undefined; checkOut?: string | undefined; location?: string | undefined; showUnavailable?: boolean | undefined; selected?: string | undefined; dogs?: number | undefined; cats?: number | undefined; minBedrooms?: number | undefined; amenities?: string | undefined; inquirySourceId?: string | undefined };

function countParam(value: unknown, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(max, Math.trunc(parsed)) : undefined;
}

const AMENITY_KEYS = AMENITY_SPECS.map((spec) => spec.key);
function parseAmenities(value: string | undefined): AmenityKey[] {
  return (value ?? "").split(",").filter((key): key is AmenityKey => (AMENITY_KEYS as string[]).includes(key));
}

export const Route = createFileRoute("/_authenticated/availability-finder")({
  validateSearch: (search: Record<string, unknown>): FinderSearch => ({
    checkIn: typeof search["checkIn"] === "string" ? search["checkIn"] : undefined,
    checkOut: typeof search["checkOut"] === "string" ? search["checkOut"] : undefined,
    location: typeof search["location"] === "string" ? search["location"] : undefined,
    showUnavailable: search["showUnavailable"] === true || search["showUnavailable"] === "true",
    selected: typeof search["selected"] === "string" ? search["selected"] : undefined,
    dogs: countParam(search["dogs"], 10),
    cats: countParam(search["cats"], 10),
    minBedrooms: countParam(search["minBedrooms"], 12),
    amenities: typeof search["amenities"] === "string" ? search["amenities"] : undefined,
    inquirySourceId: typeof search["inquirySourceId"] === "string" ? search["inquirySourceId"] : undefined,
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
  const [dogs, setDogs] = useState(String(search.dogs ?? 0));
  const [cats, setCats] = useState(String(search.cats ?? 0));
  const [minBedrooms, setMinBedrooms] = useState(String(search.minBedrooms ?? 0));
  const [amenities, setAmenities] = useState<AmenityKey[]>(parseAmenities(search.amenities));
  const [confirmUnlinked, setConfirmUnlinked] = useState<string | null>(null);
  const sources = useInquirySources();
  const sourceList = sources.data ?? [];
  const [addingSource, setAddingSource] = useState(false);
  const [sourceEdit, setSourceEdit] = useState<string | null>(null);
  const searchedSource = sourceList.find((entry) => entry.id === search.inquirySourceId) ?? null;
  // Until the coordinator types, the box shows whatever source the current search used.
  const sourceName = sourceEdit ?? searchedSource?.name ?? "";
  const setSourceName = (next: string) => setSourceEdit(next);
  // The typed name is matched against the list; anything unmatched simply prices without a source.
  const typedSource = sourceList.find((entry) => entry.name.toLowerCase() === sourceName.trim().toLowerCase()) ?? null;
  const searchedAmenities = parseAmenities(search.amenities);
  const inputReady = Boolean(search.location?.trim() && search.checkIn && search.checkOut && validStay(search.checkIn, search.checkOut));
  const query = useQuery({
    queryKey: ["availability-finder", search.checkIn, search.checkOut, search.location, search.dogs, search.cats, search.minBedrooms, search.amenities, search.inquirySourceId],
    queryFn: () => find({ data: { checkIn: search.checkIn!, checkOut: search.checkOut!, location: search.location!, dogs: search.dogs ?? 0, cats: search.cats ?? 0, minBedrooms: search.minBedrooms ?? 0, amenities: searchedAmenities, ...(search.inquirySourceId ? { inquirySourceId: search.inquirySourceId } : {}) } }),
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
  const selectableIds = results.filter((row) => row.status !== "unavailable").map((row) => row.id);
  const allSelectableChosen = selectableIds.length > 0 && selectableIds.every((id) => chosen.includes(id));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!location.trim()) { setValidation("Enter a city, ZIP code, address, or general location."); return; }
    if (!validStay(checkIn, checkOut)) { setValidation("Enter valid dates, with check-out after check-in."); return; }
    setValidation(null); setChosen([]);
    const count = (value: string, max: number) => Math.min(max, Math.max(0, Math.trunc(Number(value) || 0)));
    const dogCount = count(dogs, 10);
    const catCount = count(cats, 10);
    const bedroomCount = count(minBedrooms, 12);
    void navigate({ search: {
      checkIn, checkOut, location: location.trim(), showUnavailable: false,
      ...(dogCount > 0 ? { dogs: dogCount } : {}),
      ...(catCount > 0 ? { cats: catCount } : {}),
      ...(bedroomCount > 0 ? { minBedrooms: bedroomCount } : {}),
      ...(amenities.length ? { amenities: amenities.join(",") } : {}),
      ...(typedSource ? { inquirySourceId: typedSource.id } : {}),
    } });
    setSourceEdit(null);
  }

  async function downloadPdf() {
    setExportError(null);
    if (selectedResults.length === 0) {
      setExportError("Select one or more properties to include."); return;
    }
    if (selectedResults.some((row) => row.bookingUrl && !verifiedPublicListingUrl(row.bookingUrl))) {
      setExportError("A selected property has an unverified listing link. Correct it in OwnerRez before export."); return;
    }
    setExporting(true);
    try {
      // The document is never left spinning: if the build takes too long, say so.
      const file = await Promise.race([
        downloadOptions({ data: { checkIn: search.checkIn!, checkOut: search.checkOut!, location: search.location!, propertyIds: selectedResults.map((row) => row.id), ...(search.inquirySourceId ? { inquirySourceId: search.inquirySourceId } : {}) } }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("The PDF took too long to build. Try again, or with fewer properties.")), 60000)),
      ]);
      const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
      const blob = new Blob([bytes], { type: file.mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
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
      <label className="space-y-1 text-sm">Dogs<Input type="number" min={0} max={10} value={dogs} onChange={(e) => setDogs(e.target.value)} /></label>
      <label className="space-y-1 text-sm">Cats<Input type="number" min={0} max={10} value={cats} onChange={(e) => setCats(e.target.value)} /></label>
      <label className="space-y-1 text-sm">Bedrooms (minimum)<Input type="number" min={0} max={12} value={minBedrooms} onChange={(e) => setMinBedrooms(e.target.value)} /></label>
      <fieldset className="space-y-2 text-sm md:col-span-3">
        <legend>Must have</legend>
        <div className="flex flex-wrap gap-2">
          {AMENITY_SPECS.map((spec) => {
            const on = amenities.includes(spec.key);
            return <button key={spec.key} type="button" aria-pressed={on} onClick={() => setAmenities((current) => on ? current.filter((key) => key !== spec.key) : [...current, spec.key])} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>{spec.label}</button>;
          })}
        </div>
      </fieldset>
      <div className="space-y-1 text-sm md:col-span-3">
        <label htmlFor="inquiry-source">Inquiry source (company or portal)</label>
        <div className="flex flex-wrap items-center gap-2">
          <Input id="inquiry-source" className="max-w-sm" list="inquiry-source-options" value={sourceName} placeholder="Search sources, e.g. ALE or Sirva"
            onChange={(event) => setSourceName(event.target.value)} />
          <datalist id="inquiry-source-options">
            {searchSources(sourceList, sourceName).map((entry) => <option key={entry.id} value={entry.name}>{entry.sourceType ?? ""}</option>)}
          </datalist>
          <Button type="button" variant="outline" onClick={() => setAddingSource(true)}>Add inquiry source</Button>
        </div>
        {sourceName.trim() && !typedSource
          ? <p className="text-xs text-amber-700">No source matches that name yet. Pick one from the list or add it, or search without a source for nightly rates only.</p>
          : typedSource
            ? <p className="text-xs text-muted-foreground">Quotes use {typedSource.name}&apos;s fees, discount and deposit settings.</p>
            : <p className="text-xs text-muted-foreground">Leave blank to see nightly rates only.</p>}
      </div>
      {validation && <p role="alert" className="text-destructive md:col-span-4">{validation}</p>}
    </form>
    <Dialog open={addingSource} onOpenChange={setAddingSource}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Add inquiry source</DialogTitle></DialogHeader>
        <InquirySourceForm onCancel={() => setAddingSource(false)} onSaved={async (id) => {
          setAddingSource(false);
          const refreshed = await sources.refetch();
          setSourceName(refreshed.data?.find((entry) => entry.id === id)?.name ?? "");
        }} />
      </DialogContent>
    </Dialog>
    {query.isPending && inputReady && <p role="status">Checking OwnerRez reservations and nearby properties…</p>}
    {query.error && <p role="alert" className="rounded border border-destructive p-4 text-destructive">{query.error instanceof Error ? query.error.message : "Search failed."} No availability result was issued.</p>}
    {query.data && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{results.length} of {query.data.results.length} properties within {AVAILABILITY_RADIUS_MILES} miles · sorted by distance{query.data.heldBack.length ? ` · ${query.data.heldBack.length} hidden because OwnerRez does not confirm what you asked for` : ""}</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allSelectableChosen} disabled={selectableIds.length === 0} onChange={(event) => {
            setConfirmUnlinked(null);
            setChosen(event.target.checked ? selectableIds : []);
          }} />Check all matching ({selectableIds.length})</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(search.showUnavailable)} onChange={(event) => void navigate({ search: (previous) => ({ ...previous, showUnavailable: event.target.checked, selected: undefined }) })} />Show unavailable</label>
        </div>
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
                <p className="text-sm text-muted-foreground">{petSummary(row.facts)}{confirmedAmenities(row.facts).length ? ` · ${confirmedAmenities(row.facts).map((key) => AMENITY_LABELS[key]).join(", ")}` : ""}</p>
                {row.factsUnavailable && <p className="text-xs text-amber-700">{row.factsUnavailable}</p>}
                {row.quote
                  ? <p className="mt-1 text-sm font-medium">{internalQuoteLine(row.quote)}<span className="block text-xs font-normal text-muted-foreground">{quoteSourceNote(row.quote)} {PRICE_ESTIMATE_NOTE}</span></p>
                  : <p className="mt-1 text-xs text-amber-700">{row.quoteUnavailable ?? "No price estimate available."}</p>}
              </div>
            </div>
            <p className={`mt-3 font-semibold ${row.status === "conditional" ? "text-amber-700 dark:text-amber-400" : row.status === "available" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{row.status === "conditional" ? "Conditional — STR relocation required" : row.status === "available" ? "Available" : "Unavailable"}</p>
            {needsStrRebook(row) && <div className="mt-1 text-sm"><p>This home can still be offered. Second step if the guest chooses it: {rebookStepSummary(row)}</p><ul className="list-inside list-disc">{row.strConflicts.map((conflict, index) => <li key={`${conflict.arrival}-${index}`}>{conflict.arrival} to {conflict.departure}</li>)}</ul></div>}
            {row.status === "unavailable" && <p className="mt-1 text-sm">Non-movable reservation or block overlaps the requested stay.</p>}
            {row.bookingUrl ? <a href={row.bookingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary underline">View public listing</a> : <p className="mt-2 text-sm text-amber-700">No verified public listing link. The PDF page for this home will carry no link.</p>}
            {row.status !== "unavailable" && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.includes(row.id)} onChange={(event) => {
              if (event.target.checked && !row.bookingUrl) { setConfirmUnlinked(row.id); return; }
              setConfirmUnlinked((current) => current === row.id ? null : current);
              setChosen((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id));
            }} />Include in property options PDF</label>}
            {confirmUnlinked === row.id && <div role="alertdialog" aria-label="Add property anyway?" className="mt-2 rounded border border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <p>This home has no linked posting. Add property anyway?</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" onClick={() => { setChosen((current) => current.includes(row.id) ? current : [...current, row.id]); setConfirmUnlinked(null); }}>Yes</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setChosen((current) => current.filter((id) => id !== row.id)); setConfirmUnlinked(null); }}>No</Button>
              </div>
            </div>}
          </article>)}
          {results.length === 0 && <p className="rounded border p-6 text-muted-foreground">No matching properties in this view.</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void downloadPdf()} disabled={!selectedResults.length || exporting}>{exporting ? "Preparing PDF…" : `Download Property Options PDF (${selectedResults.length})`}</Button>
        <EmailComposer
          context="property"
          recordId={selectedResults[0]?.id ?? ""}
          label={`Email these options (${selectedResults.length})`}
          disabled={!selectedResults.length}
          initialSubject={`Property options for ${search.checkIn} to ${search.checkOut}`}
          initialBody={selectedResults.length ? emailSummary(selectedResults, search.checkIn!, search.checkOut!, search.location!) : ""}
        />
      </div>
      {exportError && <p role="alert" className="text-destructive">{exportError}</p>}
      <p className="text-xs text-muted-foreground">Public listing links come from OwnerRez. Reservation conflicts remain internal; the PDF uses neutral final-confirmation language.</p>
    </>}
  </div>;
}
