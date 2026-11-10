import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, type FormEvent } from "react";
import { searchAvailability, downloadAvailabilityOptions } from "@/lib/availability-finder.functions";
import { offerPropertyToLead } from "@/lib/lead-offers.functions";
import { offeredPropertyIds, type LeadOffer } from "@/lib/lead-offers";
import { supabase } from "@/integrations/supabase/client";
import { AVAILABILITY_RADIUS_MILES, emailSummary, nextOption, rankAvailability, validStay, verifiedPublicListingUrl, visibleResults, type RankedOption } from "@/lib/availability-finder";
import { AMENITY_LABELS, AMENITY_SPECS, confirmedAmenities, petSummary, type AmenityKey } from "@/lib/property-facts";
import { formatMoney, internalQuoteLine, PRICE_ESTIMATE_NOTE, quoteSourceNote } from "@/lib/pricing";
import { AvailabilityMap } from "@/components/AvailabilityMap";
import { EmailComposer } from "@/components/EmailComposer";
import { InquirySourceForm } from "@/components/InquirySourceForm";
import { useInquirySources } from "@/hooks/useInquirySources";
import { searchSources } from "@/lib/inquiry-sources";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type FinderSearch = { checkIn?: string | undefined; checkOut?: string | undefined; location?: string | undefined; showUnavailable?: boolean | undefined; selected?: string | undefined; dogs?: number | undefined; cats?: number | undefined; guests?: number | undefined; minBedrooms?: number | undefined; amenities?: string | undefined; inquirySourceId?: string | undefined; leadId?: string | undefined };

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
    guests: countParam(search["guests"], 30),
    minBedrooms: countParam(search["minBedrooms"], 12),
    amenities: typeof search["amenities"] === "string" ? search["amenities"] : undefined,
    inquirySourceId: typeof search["inquirySourceId"] === "string" ? search["inquirySourceId"] : undefined,
    leadId: typeof search["leadId"] === "string" ? search["leadId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Availability Finder | ARHA Resolve" },
      { name: "description", content: "Find nearby ARHA homes for a proposed stay, recommended one at a time." },
      { property: "og:title", content: "Availability Finder | ARHA Resolve" },
      { property: "og:description", content: "Find nearby ARHA homes for a proposed stay, recommended one at a time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AvailabilityFinderPage,
});

function AvailabilityFinderPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { can, isLoading, isSupervisor } = useRole();
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
  const [guests, setGuests] = useState(String(search.guests ?? 0));
  const [minBedrooms, setMinBedrooms] = useState(String(search.minBedrooms ?? 0));
  const [amenities, setAmenities] = useState<AmenityKey[]>(parseAmenities(search.amenities));
  const [confirmUnlinked, setConfirmUnlinked] = useState<string | null>(null);
  // Session memory: homes already shown or declined this search are never repeated.
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [offeredId, setOfferedId] = useState<string | null>(null);
  const [offeredLeadId, setOfferedLeadId] = useState<string | null>(search.leadId ?? null);
  const [showAll, setShowAll] = useState(false);
  const [offerDialog, setOfferDialog] = useState<RankedOption | null>(null);
  const [who, setWho] = useState({ organization: "", contactName: "", phone: "", email: "" });
  const [offerSaving, setOfferSaving] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
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
    queryKey: ["availability-finder", search.checkIn, search.checkOut, search.location, search.dogs, search.cats, search.guests, search.minBedrooms, search.amenities, search.inquirySourceId],
    queryFn: () => find({ data: { checkIn: search.checkIn!, checkOut: search.checkOut!, location: search.location!, dogs: search.dogs ?? 0, cats: search.cats ?? 0, guests: search.guests ?? 0, minBedrooms: search.minBedrooms ?? 0, amenities: searchedAmenities, ...(search.inquirySourceId ? { inquirySourceId: search.inquirySourceId } : {}) } }),
    enabled: allowed && inputReady,
    retry: false,
  });
  const results = visibleResults(query.data?.results ?? [], Boolean(search.showUnavailable));
  // When the finder was opened from a lead, homes already offered on that lead
  // are never recommended again, whatever their outcome.
  const leadOffers = useQuery({
    queryKey: ["lead-offers", search.leadId],
    enabled: allowed && Boolean(search.leadId),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_properties")
        .select("id, lead_id, property_id, note, presented_at, added_by, created_at")
        .eq("lead_id", search.leadId!);
      if (error) throw error;
      return (data ?? []) as unknown as LeadOffer[];
    },
  });
  const alreadyOffered = offeredPropertyIds(leadOffers.data ?? []);
  const ranked = query.data ? rankAvailability(results, search.checkIn!, search.checkOut!) : [];
  const current = nextOption(ranked, [...seenIds, ...alreadyOffered]);
  const selectedId = current?.result.id ?? (results.some((row) => row.id === search.selected) ? search.selected! : null);
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
    setValidation(null); setChosen([]); setSeenIds([]); setOfferedId(null); setShowAll(false);
    const count = (value: string, max: number) => Math.min(max, Math.max(0, Math.trunc(Number(value) || 0)));
    const dogCount = count(dogs, 10);
    const catCount = count(cats, 10);
    const guestCount = count(guests, 30);
    const bedroomCount = count(minBedrooms, 12);
    void navigate({ search: {
      checkIn, checkOut, location: location.trim(), showUnavailable: false,
      ...(dogCount > 0 ? { dogs: dogCount } : {}),
      ...(catCount > 0 ? { cats: catCount } : {}),
      ...(guestCount > 0 ? { guests: guestCount } : {}),
      ...(bedroomCount > 0 ? { minBedrooms: bedroomCount } : {}),
      ...(amenities.length ? { amenities: amenities.join(",") } : {}),
      ...(typedSource ? { inquirySourceId: typedSource.id } : {}),
    } });
    setSourceEdit(null);
  }

  function offerCurrent(option: RankedOption) {
    setOfferError(null);
    setWho({ organization: "", contactName: "", phone: "", email: "" });
    setOfferDialog(option);
  }

  async function saveOffer(option: RankedOption) {
    setOfferSaving(true);
    setOfferError(null);
    try {
      const quote = option.result.sourceQuote
        ? { total: option.result.sourceQuote.total, currency: option.result.sourceQuote.currency }
        : { total: option.result.quote?.total ?? null, currency: option.result.quote?.currency ?? null };
      const saved = await offerPropertyToLead({
        data: {
          ...(search.leadId ? { leadId: search.leadId } : {}),
          propertyId: option.result.id,
          search: {
            location: search.location!, checkIn: search.checkIn!, checkOut: search.checkOut!,
            guests: search.guests ?? 0, dogs: search.dogs ?? 0, cats: search.cats ?? 0,
            minBedrooms: search.minBedrooms ?? 0,
            ...(search.inquirySourceId ? { inquirySourceId: search.inquirySourceId } : {}),
          },
          who: {
            organization: who.organization || undefined,
            contactName: who.contactName || undefined,
            phone: who.phone || undefined,
            email: who.email || undefined,
          },
          quoteTotal: quote.total, quoteCurrency: quote.currency,
        },
      });
      setConfirmUnlinked(null);
      setChosen([option.result.id]);
      setOfferedId(option.result.id);
      setOfferedLeadId(saved.leadId);
      setSeenIds((currentIds) => currentIds.includes(option.result.id) ? currentIds : [...currentIds, option.result.id]);
      setOfferDialog(null);
    } catch (error) {
      setOfferError(error instanceof Error ? error.message : "The offer could not be saved.");
    } finally {
      setOfferSaving(false);
    }
  }

  function showNext(option: RankedOption) {
    setSeenIds((currentIds) => currentIds.includes(option.result.id) ? currentIds : [...currentIds, option.result.id]);
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
      <label className="space-y-1 text-sm">Guests<Input type="number" min={0} max={30} value={guests} onChange={(e) => setGuests(e.target.value)} /></label>
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
    <Dialog open={Boolean(offerDialog)} onOpenChange={(open) => { if (!open) setOfferDialog(null); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Offer {offerDialog?.result.name}</DialogTitle></DialogHeader>
        {offerDialog && <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {search.leadId
              ? "This offer is added to the lead you came from, with today's quote saved with it."
              : "A lead is created for this search and this offer is recorded on it. Who asked is optional and can be filled in later."}
          </p>
          {!search.leadId && <div className="grid gap-2">
            <Input placeholder="Organization or inquiry source (optional)" value={who.organization} onChange={(e) => setWho((w) => ({ ...w, organization: e.target.value }))} />
            <Input placeholder="Contact name (optional)" value={who.contactName} onChange={(e) => setWho((w) => ({ ...w, contactName: e.target.value }))} />
            <Input placeholder="Phone (optional)" value={who.phone} onChange={(e) => setWho((w) => ({ ...w, phone: e.target.value }))} />
            <Input placeholder="Email (optional)" value={who.email} onChange={(e) => setWho((w) => ({ ...w, email: e.target.value }))} />
          </div>}
          {offerError && <p role="alert" className="text-destructive">{offerError}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={offerSaving} onClick={() => void saveOffer(offerDialog)}>
              {offerSaving ? "Saving…" : "Save offer"}
            </Button>
            {!search.leadId && (
              <Button type="button" variant="ghost" disabled={offerSaving} onClick={() => void saveOffer(offerDialog)}>
                Skip these and save offer
              </Button>
            )}
          </div>
        </div>}
      </DialogContent>
    </Dialog>
    {query.isPending && inputReady && <p role="status">Checking OwnerRez reservations and nearby properties…</p>}
    {query.error && <p role="alert" className="rounded border border-destructive p-4 text-destructive">{query.error instanceof Error ? query.error.message : "Search failed."} No availability result was issued.</p>}
    {query.data && !showAll && <>
      <p className="text-sm text-muted-foreground">{ranked.length} of {query.data.results.length} properties within {AVAILABILITY_RADIUS_MILES} miles can be offered{query.data.heldBack.length ? ` · ${query.data.heldBack.length} hidden because OwnerRez does not confirm what you asked for` : ""}</p>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,1fr)]">
        <AvailabilityMap results={results} selectedId={selectedId} onSelect={onSelect} />
        <div className="space-y-3" aria-label="Recommended property">
          {current && <article className="rounded-lg border bg-card p-4 ring-2 ring-primary">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{current.label}</p>
            <div className="mt-2 flex gap-3">
              {current.result.imageUrl && <img src={current.result.imageUrl} alt={current.result.name} className="h-24 w-28 rounded object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{current.result.name}</p>
                <p className="text-sm text-muted-foreground">{current.result.address} · {current.result.distanceMiles.toFixed(1)} miles</p>
                <p className="text-sm">{current.result.bedrooms ?? "Not set"} beds · {current.result.bathrooms ?? "Not set"} baths · sleeps {current.result.maxGuests ?? "Not set"}</p>
                <p className="text-sm text-muted-foreground">{petSummary(current.result.facts)}{confirmedAmenities(current.result.facts).length ? ` · ${confirmedAmenities(current.result.facts).map((key) => AMENITY_LABELS[key]).join(", ")}` : ""}</p>
              </div>
            </div>
            {current.result.sourceQuote
              ? <p className="mt-2 text-sm font-medium">{current.result.sourceQuote.sourceName} quote: {formatMoney(current.result.sourceQuote.total, current.result.sourceQuote.currency)}</p>
              : current.result.quote
                ? <p className="mt-2 text-sm font-medium">{internalQuoteLine(current.result.quote)}<span className="block text-xs font-normal text-muted-foreground">{quoteSourceNote(current.result.quote)} {PRICE_ESTIMATE_NOTE}</span></p>
                : <p className="mt-2 text-xs text-amber-700">{current.result.quoteUnavailable ?? "No price estimate available."}</p>}
            {current.tier === "rebook" && <div className="mt-2 text-sm">
              <p>Second step if the guest chooses it: re-book {current.shortStays === 1 ? "this stay" : "these stays"} at another home first.</p>
              <ul className="list-inside list-disc">{current.result.strConflicts.map((conflict, index) => <li key={`${conflict.arrival}-${index}`}>{conflict.arrival} to {conflict.departure}</li>)}</ul>
            </div>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={() => offerCurrent(current)}>Offer this property</Button>
              <Button type="button" variant="outline" onClick={() => showNext(current)}>Show the next option</Button>
            </div>
          </article>}
          {!current && ranked.length > 0 && <div className="rounded-lg border bg-card p-4 text-sm">
            <p>You have seen every matching home.</p>
            <Button type="button" variant="outline" className="mt-2" onClick={() => { setSeenIds([]); setOfferedId(null); }}>Start the list over</Button>
          </div>}
          {ranked.length === 0 && <p className="rounded border p-6 text-muted-foreground">No matching properties can be offered for these dates.</p>}
          {isSupervisor && ranked.length > 0 && <button type="button" className="text-sm text-primary underline" onClick={() => setShowAll(true)}>See all matches</button>}
        </div>
      </div>
      {offeredId && selectedResults.length > 0 && <div className="space-y-2 rounded-lg border bg-card p-4">
        <p className="text-sm font-semibold">Offering {selectedResults[0]!.name}</p>
        {offeredLeadId && <p className="text-sm text-muted-foreground">Saved on the lead. <Link to="/leads" className="text-primary underline">Open Leads</Link> to see it.</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void downloadPdf()} disabled={exporting}>{exporting ? "Preparing PDF…" : "Download Property Options PDF"}</Button>
          <EmailComposer
            context="property"
            recordId={selectedResults[0]!.id}
            label="Email these options"
            initialSubject={`Property options for ${search.checkIn} to ${search.checkOut}`}
            initialBody={emailSummary(selectedResults, search.checkIn!, search.checkOut!, search.location!)}
          />
        </div>
      </div>}
      {exportError && <p role="alert" className="text-destructive">{exportError}</p>}
      <p className="text-xs text-muted-foreground">Public listing links come from OwnerRez. Reservation conflicts remain internal; the PDF uses neutral final-confirmation language.</p>
    </>}
    {query.data && showAll && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{results.length} of {query.data.results.length} properties within {AVAILABILITY_RADIUS_MILES} miles · sorted by distance{query.data.heldBack.length ? ` · ${query.data.heldBack.length} hidden because OwnerRez does not confirm what you asked for` : ""}</p>
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="text-sm text-primary underline" onClick={() => setShowAll(false)}>Back to recommendations</button>
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
                <p className="text-sm">{row.bedrooms ?? "Not set"} beds · {row.bathrooms ?? "Not set"} baths · {row.maxGuests ?? "Not set"} guests</p>
                <p className="text-sm text-muted-foreground">{petSummary(row.facts)}{confirmedAmenities(row.facts).length ? ` · ${confirmedAmenities(row.facts).map((key) => AMENITY_LABELS[key]).join(", ")}` : ""}</p>
                {row.factsUnavailable && <p className="text-xs text-amber-700">{row.factsUnavailable}</p>}
                {row.quote
                  ? <p className="mt-1 text-sm font-medium">{internalQuoteLine(row.quote)}<span className="block text-xs font-normal text-muted-foreground">{quoteSourceNote(row.quote)} {PRICE_ESTIMATE_NOTE}</span></p>
                  : <p className="mt-1 text-xs text-amber-700">{row.quoteUnavailable ?? "No price estimate available."}</p>}
                {row.sourceQuote && <div className="mt-2 rounded border bg-muted/40 p-2 text-sm">
                  <p className="font-semibold">{row.sourceQuote.sourceName} quote: {formatMoney(row.sourceQuote.total, row.sourceQuote.currency)}</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {row.sourceQuote.lines.map((line, index) => <li key={`${line.label}-${index}`}>{line.label}: {formatMoney(line.amount, row.sourceQuote!.currency)}</li>)}
                    {row.sourceQuote.securityDeposit !== null && row.sourceQuote.securityDeposit > 0 &&
                      <li>Refundable security deposit: {formatMoney(row.sourceQuote.securityDeposit, row.sourceQuote.currency)}</li>}
                    {row.sourceQuote.referralCost !== null &&
                      <li>Internal only: referral cost {formatMoney(row.sourceQuote.referralCost, row.sourceQuote.currency)} ({row.sourceQuote.referralBasis}); we keep {formatMoney(row.sourceQuote.netAfterReferral ?? 0, row.sourceQuote.currency)}</li>}
                  </ul>
                  {row.sourceQuote.flags.map((flag) => <p key={flag} className="mt-1 text-xs text-amber-700">{flag}</p>)}
                </div>}
              </div>
            </div>
            <p className={`mt-3 font-semibold ${row.status === "conditional" ? "text-amber-700 dark:text-amber-400" : row.status === "available" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{row.status === "conditional" ? "Conditional: STR relocation required" : row.status === "available" ? "Available" : "Unavailable"}</p>
            {row.status === "conditional" && row.strConflicts.length > 0 && <div className="mt-1 text-sm"><p>This home can still be offered. Second step if the guest chooses it: {row.strConflicts.length} short stay{row.strConflicts.length === 1 ? "" : "s"} must be re-booked at another home before this stay can start.</p><ul className="list-inside list-disc">{row.strConflicts.map((conflict, index) => <li key={`${conflict.arrival}-${index}`}>{conflict.arrival} to {conflict.departure}</li>)}</ul></div>}
            {row.status === "unavailable" && <p className="mt-1 text-sm">Non-movable reservation or block overlaps the requested stay.</p>}
            {row.bookingUrl ? <a href={row.bookingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary underline">View public listing</a> : <p className="mt-2 text-sm text-amber-700">No verified public listing link. The PDF page for this home will carry no link.</p>}
            {row.status !== "unavailable" && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={chosen.includes(row.id)} onChange={(event) => {
              if (event.target.checked && !row.bookingUrl) { setConfirmUnlinked(row.id); return; }
              setConfirmUnlinked((currentId) => currentId === row.id ? null : currentId);
              setChosen((currentIds) => event.target.checked ? [...currentIds, row.id] : currentIds.filter((id) => id !== row.id));
            }} />Include in property options PDF</label>}
            {confirmUnlinked === row.id && <div role="alertdialog" aria-label="Add property anyway?" className="mt-2 rounded border border-amber-500 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
              <p>This home has no linked posting. Add property anyway?</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" onClick={() => { setChosen((currentIds) => currentIds.includes(row.id) ? currentIds : [...currentIds, row.id]); setConfirmUnlinked(null); }}>Yes</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setChosen((currentIds) => currentIds.filter((id) => id !== row.id)); setConfirmUnlinked(null); }}>No</Button>
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
