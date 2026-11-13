/**
 * 3.1 Add a home: one side panel, three steps. Replaces Add property and Start onboarding here.
 * Reuses the existing intake (OwnerRez import or manual), Start onboarding and Project Team actions;
 * the property is kept even when building the plan fails (the home then shows its no plan yet card).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createPropertyManuallyFn, importOwnerRezPropertyFn, searchOwnerRezPropertiesFn } from "@/lib/property-intake.functions";
import { startOnboardingProjectFn, updateOnboardingProjectFn } from "@/lib/onboarding.functions";
import { addUpcomingHomeFn, assignFromListFn, setProjectStagersFn, startUpcomingHomeFn } from "@/lib/onboarding-home.functions";
import { FURNISHING_SCOPES, SCOPE_MODULES, defaultModules, type FurnishingScope, type ModuleKey } from "@/lib/onboarding-scope";
import { formatPropertyLabel } from "@/lib/property-label";
import type { OwnerRezCandidate } from "@/lib/property-intake";
import type { HomeRow, OwnerRezRow, Person } from "@/lib/onboarding-home";

export type AddStart = { mode: "new" } | { mode: "upcoming"; row: HomeRow } | { mode: "ownerrez"; listing: OwnerRezRow };
export type AddResult = { propertyId: string; name: string; planBuilt: boolean; listingId: string | null; upcoming: boolean; problems: string[] };

type Pickers = { pm: Person[]; designer: Person[]; utilities: Person[]; director: Person[]; stager: Person[] };
type HomeChoice =
  | { kind: "listing"; listing: OwnerRezCandidate | { listingId: string; name: string }; existingId: string | null; label: string }
  | { kind: "existing"; propertyId: string; projectId: string | null; label: string; upcoming: boolean }
  | { kind: "manual"; label: string };

const blankManual = { name: "", addressLine1: "", unit: "", city: "", state: "", postalCode: "", ownerName: "", ownerEmail: "" };
const blankUpcoming = { addressLine1: "", unit: "", city: "", state: "", postalCode: "", closing: "", contact: "", note: "" };

function Field(p: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={p.id}>{p.label}</Label>
      <Input id={p.id} type={p.type ?? "text"} required={p.required} value={p.value} onChange={(e) => p.onChange(e.target.value)} className="min-h-11" />
    </div>
  );
}

function PersonSelect(p: { id: string; label: string; value: string; options: Person[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={p.id}>{p.label}</Label>
      <select id={p.id} value={p.value} onChange={(e) => p.onChange(e.target.value)} className="min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
        <option value="">Not assigned yet</option>
        {p.options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

export function AddHomePanel(p: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  start: AddStart;
  pickers: Pickers;
  directorDefault: Person | null;
  existing: HomeRow[];
  onDone: (r: AddResult) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [contract, setContract] = useState<"yes" | "no" | null>(null);
  const [choice, setChoice] = useState<HomeChoice | null>(null);
  const [typing, setTyping] = useState(false);
  const [manual, setManual] = useState(blankManual);
  const [upcoming, setUpcoming] = useState(blankUpcoming);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [team, setTeam] = useState({ pm: "", director: "", designer: "", utilities: "", stagers: [] as string[] });
  const [dates, setDates] = useState({ closing: "", handoff: "" });
  const [scope, setScope] = useState<FurnishingScope>("full_furnishing");
  const [modules, setModules] = useState<ModuleKey[]>(defaultModules());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());

  const search = useServerFn(searchOwnerRezPropertiesFn);
  const importHome = useServerFn(importOwnerRezPropertyFn);
  const manualHome = useServerFn(createPropertyManuallyFn);
  const startPlan = useServerFn(startOnboardingProjectFn);
  const updateProject = useServerFn(updateOnboardingProjectFn);
  const assign = useServerFn(assignFromListFn);
  const setStagers = useServerFn(setProjectStagersFn);
  const addUpcoming = useServerFn(addUpcomingHomeFn);
  const startUpcoming = useServerFn(startUpcomingHomeFn);

  // Each opening starts where it was asked to: a fresh search, an Upcoming home at step 2, or an OwnerRez home picked.
  useEffect(() => {
    if (!p.open) return;
    setError(null);
    setTeam({ pm: "", director: p.directorDefault?.id ?? "", designer: "", utilities: "", stagers: [] });
    setDates({ closing: "", handoff: "" });
    setManual(blankManual);
    setUpcoming(blankUpcoming);
    setTyping(false);
    setQuery("");
    if (p.start.mode === "upcoming") {
      const r = p.start.row;
      setContract("yes");
      setChoice({ kind: "existing", propertyId: r.propertyId, projectId: r.projectId, label: r.name, upcoming: true });
      setDates({ closing: r.closingOn ?? "", handoff: "" });
      setStep(2);
    } else if (p.start.mode === "ownerrez") {
      const l = p.start.listing;
      setContract("yes");
      setChoice(l.propertyId ? { kind: "existing", propertyId: l.propertyId, projectId: null, label: l.name, upcoming: false } : { kind: "listing", listing: { listingId: l.listingId, name: l.name }, existingId: null, label: l.name });
      setStep(2);
    } else {
      setContract(null);
      setChoice(null);
      setStep(1);
    }
  }, [p.open, p.start, p.directorDefault]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);
  const found = useQuery({
    queryKey: ["ownerrez-candidates", debounced],
    enabled: p.open && contract === "yes" && !typing && debounced.length > 0,
    queryFn: () => search({ data: { query: debounced } }),
    retry: false,
  });
  const items = found.data?.ok ? found.data.items : [];
  const existingById = useMemo(() => new Map(p.existing.map((r) => [r.propertyId, r] as const)), [p.existing]);

  const manualOk = manual.name.trim().length >= 2 && manual.addressLine1.trim().length >= 3 && manual.city.trim().length >= 2 && manual.state.trim().length >= 2 && manual.postalCode.trim().length >= 3;
  const upcomingOk = upcoming.addressLine1.trim().length >= 3 && upcoming.city.trim().length >= 2 && upcoming.state.trim().length >= 2 && upcoming.contact.trim().length >= 2;
  const nameOf = (list: Person[], id: string) => list.find((x) => x.id === id)?.name ?? "Not assigned yet";

  const finishUpcoming = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await addUpcoming({
        data: {
          requestId,
          addressLine1: upcoming.addressLine1,
          unit: upcoming.unit || null,
          city: upcoming.city,
          state: upcoming.state,
          postalCode: upcoming.postalCode || null,
          expectedClosing: upcoming.closing || null,
          contact: upcoming.contact,
          note: upcoming.note || null,
        },
      });
      p.onDone({ propertyId: r.property_id, name: upcoming.addressLine1, planBuilt: false, listingId: null, upcoming: true, problems: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The home was not added.");
    } finally {
      setBusy(false);
    }
  };

  const build = async () => {
    if (!choice) return;
    setBusy(true);
    setError(null);
    const problems: string[] = [];
    let propertyId: string | null = choice.kind === "existing" ? choice.propertyId : choice.kind === "listing" ? choice.existingId : null;
    let name = choice.label;
    try {
      // 1. The property, when it is new (the existing OwnerRez import or manual form).
      if (!propertyId && choice.kind === "listing") {
        const r = await importHome({ data: { listingId: choice.listing.listingId, linkToPropertyId: "likely" in choice.listing ? choice.listing.likely?.id ?? null : null, isDemo: false, milestones: { plannedClosingOn: dates.closing || null, actualClosingOn: null, accessOn: null }, owner: { name: null, email: null, phone: null } } });
        propertyId = r.property.id;
        name = formatPropertyLabel({ name: r.property.name, address_line1: r.property.address }).primary;
      } else if (!propertyId) {
        const r = await manualHome({ data: { name: manual.name, addressLine1: manual.addressLine1, unit: manual.unit || null, city: manual.city, state: manual.state, postalCode: manual.postalCode, market: null, ownerRecordId: null, ownerName: manual.ownerName || null, ownerEmail: manual.ownerEmail || null, ownerPhone: null, ownerRezPropertyId: null, isDemo: false, milestones: { plannedClosingOn: dates.closing || null, actualClosingOn: null, accessOn: null } } });
        propertyId = r.property.id;
        name = formatPropertyLabel({ name: r.property.name, address_line1: manual.addressLine1, unit: manual.unit }).primary;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The home was not added.");
      setBusy(false);
      return;
    }
    let planBuilt = false;
    try {
      // 2. The project and the Standard plan, as today's Start onboarding, in one step.
      const fields = {
        projectManager: team.pm || null,
        director: team.director || null,
        utilityManager: team.utilities || null,
        plannedClosingOn: dates.closing || null,
        targetHandoffOn: dates.handoff || null,
        furnishingScope: scope,
        modules,
      };
      if (choice.kind === "existing" && choice.upcoming && choice.projectId) {
        await startUpcoming({ data: { projectId: choice.projectId } });
        await updateProject({ data: { projectId: choice.projectId, ...fields, reason: "Set when the home went under contract" } });
      }
      const project = (await startPlan({ data: { propertyId: propertyId!, branch: null, templateId: null, possessionOn: null, poolLocation: "none", notes: null, externalRefs: {}, ...fields } })) as { id?: string } | null;
      planBuilt = true;
      const projectId = project?.id ?? (choice.kind === "existing" ? choice.projectId : null);
      if (projectId && team.designer) {
        try {
          await assign({ data: { projectId, role: "designer", userId: team.designer } });
        } catch (e) {
          problems.push(`Designer not set: ${e instanceof Error ? e.message : "try again on the home's page"}`);
        }
      }
      if (projectId && team.stagers.length) {
        try {
          await setStagers({ data: { projectId, vendorIds: team.stagers } });
        } catch (e) {
          problems.push(`Stager not set: ${e instanceof Error ? e.message : "try again"}`);
        }
      }
    } catch (e) {
      problems.push(`The plan was not built: ${e instanceof Error ? e.message : "try Start onboarding on the home"}`);
    }
    setBusy(false);
    p.onDone({ propertyId: propertyId!, name, planBuilt, listingId: p.start.mode === "ownerrez" ? p.start.listing.listingId : null, upcoming: false, problems });
  };

  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Add a home</SheetTitle>
          <SheetDescription className="numeric">Step {step} of 3</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          {step === 1 ? (
            <section className="space-y-4" aria-label="Find the home">
              <h3 className="font-semibold">1. Find the home</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Under contract">
                <Button type="button" className="min-h-11" variant={contract === "yes" ? "default" : "outline"} onClick={() => setContract("yes")}>
                  Under contract
                </Button>
                <Button type="button" className="min-h-11" variant={contract === "no" ? "default" : "outline"} onClick={() => setContract("no")}>
                  Not under contract yet
                </Button>
              </div>
              {contract === "yes" && !typing ? (
                <div className="space-y-2">
                  <Input aria-label="Search OwnerRez" placeholder="Search OwnerRez by address, name or number" value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-11" />
                  {!query.trim() ? null : debounced !== query.trim() || found.isPending ? (
                    <p className="text-sm text-muted-foreground">Searching OwnerRez…</p>
                  ) : found.data?.ok === false ? (
                    <p role="alert" className="text-sm text-destructive">{found.data.error}</p>
                  ) : items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No OwnerRez home matches.</p>
                  ) : (
                    <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border">
                      {items.map((c) => {
                        const label = formatPropertyLabel({ name: c.name, address_line1: c.address, unit: c.unit, city: c.city, state: c.state, postal_code: c.postalCode }).primary;
                        const there = c.existing ? existingById.get(c.existing.id) : null;
                        return (
                          <li key={c.listingId} className="flex flex-wrap items-center gap-2 px-2 py-2 text-sm">
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {c.existing ? (
                              <>
                                <span className="text-xs text-muted-foreground">Already in Resolve</span>
                                <Button asChild size="sm" variant="outline" className="min-h-11">
                                  <Link to="/onboarding/$propertyId" params={{ propertyId: c.existing.id }}>Open it</Link>
                                </Button>
                                {!there?.hasPlan ? (
                                  <Button size="sm" className="min-h-11" onClick={() => { setChoice({ kind: "existing", propertyId: c.existing!.id, projectId: there?.projectId ?? null, label, upcoming: there?.lifecycle === "upcoming" }); setStep(2); }}>
                                    Start its plan
                                  </Button>
                                ) : null}
                              </>
                            ) : (
                              <Button size="sm" className="min-h-11" onClick={() => { setChoice({ kind: "listing", listing: c, existingId: c.likely?.id ?? null, label }); setStep(2); }}>
                                Choose
                              </Button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <Button type="button" variant="link" className="min-h-11 px-0" onClick={() => setTyping(true)}>
                    Not in OwnerRez yet? Type it in
                  </Button>
                </div>
              ) : null}
              {contract === "yes" && typing ? (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (manualOk) { setChoice({ kind: "manual", label: manual.addressLine1 }); setStep(2); } }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="m-name" label="Property name" value={manual.name} onChange={(v) => setManual((f) => ({ ...f, name: v }))} required />
                    <Field id="m-street" label="Street address" value={manual.addressLine1} onChange={(v) => setManual((f) => ({ ...f, addressLine1: v }))} required />
                    <Field id="m-unit" label="Unit" value={manual.unit} onChange={(v) => setManual((f) => ({ ...f, unit: v }))} />
                    <Field id="m-city" label="City" value={manual.city} onChange={(v) => setManual((f) => ({ ...f, city: v }))} required />
                    <Field id="m-state" label="State" value={manual.state} onChange={(v) => setManual((f) => ({ ...f, state: v }))} required />
                    <Field id="m-zip" label="ZIP" value={manual.postalCode} onChange={(v) => setManual((f) => ({ ...f, postalCode: v }))} required />
                    <Field id="m-owner" label="Homeowner name" value={manual.ownerName} onChange={(v) => setManual((f) => ({ ...f, ownerName: v }))} />
                    <Field id="m-email" label="Homeowner email" type="email" value={manual.ownerEmail} onChange={(v) => setManual((f) => ({ ...f, ownerEmail: v }))} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" className="min-h-11" onClick={() => setTyping(false)}>Back to OwnerRez search</Button>
                    <Button type="submit" className="min-h-11" disabled={!manualOk}>Next</Button>
                  </div>
                </form>
              ) : null}
              {contract === "no" ? (
                <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (upcomingOk) void finishUpcoming(); }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="u-street" label="Street address" value={upcoming.addressLine1} onChange={(v) => setUpcoming((f) => ({ ...f, addressLine1: v }))} required />
                    <Field id="u-unit" label="Unit" value={upcoming.unit} onChange={(v) => setUpcoming((f) => ({ ...f, unit: v }))} />
                    <Field id="u-city" label="City" value={upcoming.city} onChange={(v) => setUpcoming((f) => ({ ...f, city: v }))} required />
                    <Field id="u-state" label="State" value={upcoming.state} onChange={(v) => setUpcoming((f) => ({ ...f, state: v }))} required />
                    <Field id="u-zip" label="ZIP" value={upcoming.postalCode} onChange={(v) => setUpcoming((f) => ({ ...f, postalCode: v }))} />
                    <Field id="u-closing" label="Expected closing" type="date" value={upcoming.closing} onChange={(v) => setUpcoming((f) => ({ ...f, closing: v }))} />
                  </div>
                  <Field id="u-contact" label="Owner or DFY contact" value={upcoming.contact} onChange={(v) => setUpcoming((f) => ({ ...f, contact: v }))} required />
                  <div className="space-y-1">
                    <Label htmlFor="u-note">Note (optional)</Label>
                    <Textarea id="u-note" maxLength={2000} value={upcoming.note} onChange={(e) => setUpcoming((f) => ({ ...f, note: e.target.value }))} />
                  </div>
                  {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
                  <Button type="submit" className="min-h-11" disabled={!upcomingOk || busy}>{busy ? "Adding…" : "Add as Upcoming"}</Button>
                </form>
              ) : null}
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-4" aria-label="Team and dates">
              <h3 className="font-semibold">2. Team and dates</h3>
              <p className="text-sm font-medium">{choice?.label}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <PersonSelect id="t-pm" label="PM" value={team.pm} options={p.pickers.pm} onChange={(v) => setTeam((t) => ({ ...t, pm: v }))} />
                <PersonSelect id="t-dir" label="Director" value={team.director} options={p.pickers.director.length ? p.pickers.director : p.directorDefault ? [p.directorDefault] : []} onChange={(v) => setTeam((t) => ({ ...t, director: v }))} />
                <PersonSelect id="t-des" label="Designer" value={team.designer} options={p.pickers.designer} onChange={(v) => setTeam((t) => ({ ...t, designer: v }))} />
                <PersonSelect id="t-util" label="Utilities" value={team.utilities} options={p.pickers.utilities} onChange={(v) => setTeam((t) => ({ ...t, utilities: v }))} />
              </div>
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Stager</legend>
                {p.pickers.stager.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No staging vendors yet.</p>
                ) : (
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {p.pickers.stager.map((v) => (
                      <li key={v.id}>
                        <label className="flex min-h-11 items-center gap-2 text-sm">
                          <Checkbox checked={team.stagers.includes(v.id)} onCheckedChange={(on) => setTeam((t) => ({ ...t, stagers: on ? [...t.stagers, v.id] : t.stagers.filter((x) => x !== v.id) }))} />
                          {v.name}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="d-close" label="Planned closing" type="date" value={dates.closing} onChange={(v) => setDates((d) => ({ ...d, closing: v }))} />
                <Field id="d-handoff" label="Target handoff" type="date" value={dates.handoff} onChange={(v) => setDates((d) => ({ ...d, handoff: v }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="d-scope">Furnishing scope</Label>
                <select id="d-scope" value={scope} onChange={(e) => setScope(e.target.value as FurnishingScope)} className="min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm">
                  {FURNISHING_SCOPES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Modules</legend>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {SCOPE_MODULES.map((m) => (
                    <li key={m.key}>
                      <label className="flex min-h-11 items-center gap-2 text-sm">
                        <Checkbox checked={modules.includes(m.key)} onCheckedChange={(on) => setModules((x) => (on ? [...x, m.key] : x.filter((k) => k !== m.key)))} />
                        {m.label}
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <div className="flex flex-wrap gap-2">
                {p.start.mode === "new" ? <Button variant="ghost" className="min-h-11" onClick={() => setStep(1)}>Back</Button> : null}
                <Button className="min-h-11" onClick={() => setStep(3)}>Next</Button>
              </div>
            </section>
          ) : null}

          {step === 3 && choice ? (
            <section className="space-y-4" aria-label="Review">
              <h3 className="font-semibold">3. Review</h3>
              <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Home</dt>
                <dd>{choice.label}{choice.kind === "listing" && !choice.existingId ? " (from OwnerRez)" : choice.kind === "manual" ? " (typed in)" : ""}</dd>
                <dt className="text-muted-foreground">PM</dt><dd>{nameOf(p.pickers.pm, team.pm)}</dd>
                <dt className="text-muted-foreground">Director</dt><dd>{nameOf(p.pickers.director.length ? p.pickers.director : p.directorDefault ? [p.directorDefault] : [], team.director)}</dd>
                <dt className="text-muted-foreground">Designer</dt><dd>{nameOf(p.pickers.designer, team.designer)}</dd>
                <dt className="text-muted-foreground">Utilities</dt><dd>{nameOf(p.pickers.utilities, team.utilities)}</dd>
                <dt className="text-muted-foreground">Stager</dt><dd>{team.stagers.length ? team.stagers.map((id) => nameOf(p.pickers.stager, id)).join(", ") : "Not assigned yet"}</dd>
                <dt className="text-muted-foreground">Closing</dt><dd className="numeric">{dates.closing || "Not set"}</dd>
                <dt className="text-muted-foreground">Target handoff</dt><dd className="numeric">{dates.handoff || "Not set"}</dd>
                <dt className="text-muted-foreground">Scope</dt><dd>{FURNISHING_SCOPES.find((f) => f.value === scope)?.label}</dd>
              </dl>
              {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" className="min-h-11" onClick={() => setStep(2)}>Back</Button>
                <Button className="min-h-11" disabled={busy} onClick={() => void build()}>{busy ? "Adding…" : "Add and build the plan"}</Button>
              </div>
            </section>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
