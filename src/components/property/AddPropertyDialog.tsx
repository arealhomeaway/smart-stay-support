import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createPropertyManuallyFn,
  importOwnerRezPropertyFn,
  ownerRezOwnerPreviewFn,
  searchOwnerRezPropertiesFn,
} from "@/lib/property-intake.functions";
import { startOnboardingProjectFn } from "@/lib/onboarding.functions";
import { suggestedModules, type ModuleKey } from "@/lib/onboarding-scope";
import { startOwnerProgram } from "@/lib/owner-program.functions";
import { useRole } from "@/hooks/useRole";
import type { IntakeMatch, OwnerRezCandidate } from "@/lib/property-intake";

/** What a home starts with before anyone answers the scope questions. */
function defaultModules(): ModuleKey[] {
  return suggestedModules({ pool_spa: null, hoa: null });
}

/**
 * The two supported ways a home enters Resolve. Both create the same canonical
 * property, and neither starts onboarding — that stays a separate choice.
 */
export function AddPropertyDialog({
  trigger,
  disabled,
  onCreated,
}: {
  trigger?: React.ReactNode;
  disabled?: boolean;
  onCreated?: (propertyId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Outcome | null>(null);
  const qc = useQueryClient();

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
    await qc.invalidateQueries({ queryKey: ["properties"] });
    await qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
  };

  function finish(result: Outcome) {
    setDone(result);
    void refresh();
    if (result.status !== "duplicate") onCreated?.(result.property.id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setDone(null);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button disabled={disabled}>Add property</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a property to Resolve</DialogTitle>
          <DialogDescription>
            This creates the home record only. Onboarding is started separately from the home.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <OutcomePanel
            result={done}
            onClose={() => setOpen(false)}
            onAgain={() => setDone(null)}
          />
        ) : (
          <Tabs defaultValue="ownerrez" className="space-y-4">
            <TabsList>
              <TabsTrigger value="ownerrez">Import from OwnerRez</TabsTrigger>
              <TabsTrigger value="manual">Add manually</TabsTrigger>
            </TabsList>
            <TabsContent value="ownerrez">
              <OwnerRezImport onDone={finish} />
            </TabsContent>
            <TabsContent value="manual">
              <ManualForm onDone={finish} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Outcome = {
  status: string;
  property: IntakeMatch;
  /** True when the onboarding project and its plan were created here. */
  startedOnboarding?: boolean;
  activeOwner?: boolean;
  /** Steps after the home was created that did not complete. */
  problems?: string[];
};

function OutcomePanel({
  result,
  onClose,
  onAgain,
}: {
  result: Outcome;
  onClose: () => void;
  onAgain: () => void;
}) {
  const p = result.property;
  const { can } = useRole();
  const mayEnroll = can("owner_programs");
  const heading =
    result.status === "duplicate"
      ? "Already in Resolve"
      : result.status === "linked"
        ? "Linked to the existing home"
        : result.problems?.length
          ? "Home added — setup not finished"
          : result.startedOnboarding
            ? "Home added and onboarding started"
            : "Property created";
  return (
    <div className="space-y-4">
      <div className="surface space-y-1 p-4">
        <p className="eyebrow">{heading}</p>
        <p className="text-base font-medium">{p.name}</p>
        {p.address && <p className="text-sm text-muted-foreground">{p.address}</p>}
        <p className="text-xs text-muted-foreground">
          Lifecycle: {p.lifecycleStatus.replace(/_/g, " ")}
          {p.ownerRezId ? ` · OwnerRez ${p.ownerRezId}` : " · no OwnerRez link"}
        </p>
      </div>
      {result.problems && result.problems.length > 0 && (
        <div className="surface space-y-1 border-destructive/40 p-4 text-sm" role="alert">
          <p className="font-medium">The home was created, but these steps did not finish:</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {result.problems.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <p className="text-muted-foreground">
            You can finish them below — no need to add the home again.
          </p>
        </div>
      )}
      {result.status === "duplicate" ? (
        <p className="text-sm text-muted-foreground">
          This home is already in Resolve. If its onboarding plan was never started, choose{" "}
          <strong>Start onboarding</strong> to open it and start the plan.
        </p>
      ) : result.startedOnboarding ? (
        <p className="text-sm text-muted-foreground">
          The onboarding plan is ready.
          {result.activeOwner
            ? " The Active Owner program is a draft until somebody activates it."
            : ""}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Onboarding has not been started. Open the home and choose{" "}
          <strong>Start onboarding</strong> when you are ready.
        </p>
      )}
      {result.status !== "duplicate" && !result.activeOwner && mayEnroll && (
        <EnrollActiveOwner propertyId={p.id} name={p.name} />
      )}
      <div className="flex flex-wrap gap-2">
        <Button asChild onClick={onClose}>
          <Link to="/onboarding/$propertyId" params={{ propertyId: p.id }}>
            {result.startedOnboarding ? "Open onboarding" : "Start onboarding"}
          </Link>
        </Button>
        <Button asChild variant="outline" onClick={onClose}>
          <Link to="/property/$propertyId" params={{ propertyId: p.id }}>
            Open property
          </Link>
        </Button>
        <Button variant="ghost" onClick={onAgain}>
          Add another
        </Button>
      </div>
    </div>
  );
}

/**
 * Every home arrives standard. Participation is a deliberate choice, so it is
 * offered here rather than assumed — a supervisor can make it in the moment
 * instead of discovering later that the home was never enrolled.
 */
function EnrollActiveOwner({ propertyId, name }: { propertyId: string; name: string }) {
  const enroll = useServerFn(startOwnerProgram);
  const [enrolled, setEnrolled] = useState(false);
  const run = useMutation({
    mutationFn: () => enroll({ data: { propertyId, ownerName: "", ownerEmail: "" } }),
    onSuccess: () => {
      setEnrolled(true);
      toast.success(`${name} is enrolled in the Active Owner program.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (enrolled) {
    return (
      <div className="surface space-y-1 p-4 text-sm">
        <p className="font-medium">Enrolled in the Active Owner program</p>
        <p className="text-muted-foreground">
          The program is a draft. Activate it, and add the homeowner&apos;s details, on the home
          page or the program record.
        </p>
      </div>
    );
  }

  return (
    <div className="surface space-y-2 p-4">
      <p className="text-sm font-medium">Is this an Active Owner home?</p>
      <p className="text-sm text-muted-foreground">
        Standard is the default. Enrolling creates a draft participation program — participation
        only starts when you activate it.
      </p>
      <Button size="sm" variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
        {run.isPending ? "Enrolling…" : "Enroll in Active Owner"}
      </Button>
    </div>
  );
}

function OwnerRezImport({
  onDone,
}: {
  onDone: (r: { status: string; property: IntakeMatch }) => void;
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<OwnerRezCandidate | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [activeOwner, setActiveOwner] = useState(false);
  const { can } = useRole();
  const mayEnroll = can("owner_programs");
  const [owner, setOwner] = useState({ name: "", email: "", phone: "" });
  const [milestones, setMilestones] = useState<Milestones>(emptyMilestones);
  const search = useServerFn(searchOwnerRezPropertiesFn);
  const runImport = useServerFn(importOwnerRezPropertyFn);
  const loadOwner = useServerFn(ownerRezOwnerPreviewFn);
  const enrollOwner = useServerFn(startOwnerProgram);
  const startProject = useServerFn(startOnboardingProjectFn);

  const { data, isLoading } = useQuery({
    queryKey: ["ownerrez-candidates"],
    queryFn: () => search({ data: { query: "" } }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // The owner OwnerRez has on file, pre-filled so nobody retypes it. Blank
  // fields stay editable — this is the moment the owner record is created.
  const ownerFromOwnerRez = useQuery({
    queryKey: ["ownerrez-owner", selected?.listingId],
    enabled: Boolean(selected && !selected.existing),
    queryFn: () => loadOwner({ data: { listingId: selected!.listingId } }),
    retry: false,
  });

  useEffect(() => {
    const found = ownerFromOwnerRez.data;
    if (found) {
      setOwner({ name: found.name ?? "", email: found.email ?? "", phone: found.phone ?? "" });
    }
  }, [ownerFromOwnerRez.data]);

  const enroll = useMutation({
    mutationFn: async (input: { listingId: string; linkToPropertyId: string | null }) => {
      const result = await runImport({
        data: {
          ...input,
          isDemo,
          milestones: milestonePayload(milestones),
          owner: {
            name: owner.name || null,
            email: owner.email || null,
            phone: owner.phone || null,
          },
        },
      });
      if (result.status === "duplicate" || input.linkToPropertyId) return result;
      const propertyId = result.property.id;
      // The home now exists. Each later step reports its own outcome so a
      // failure never looks like "nothing happened".
      const problems: string[] = [];
      const wantsActiveOwner = activeOwner && mayEnroll;
      let enrolled = false;
      if (wantsActiveOwner) {
        try {
          await enrollOwner({
            data: { propertyId, ownerName: owner.name || "", ownerEmail: owner.email || "" },
          });
          enrolled = true;
        } catch (e) {
          problems.push(
            `Active Owner enrollment: ${e instanceof Error ? e.message : "could not be saved"}`,
          );
        }
      }
      let started = false;
      try {
        // One click: the project and its task plan exist before the modal closes.
        await startProject({
          data: {
            propertyId,
            branch: null,
            projectManager: null,
            director: null,
            plannedClosingOn: milestones.plannedClosingOn || null,
            possessionOn: milestones.accessOn || null,
            targetHandoffOn: null,
            furnishingScope: "full_furnishing",
            modules: enrolled ? [...defaultModules(), "active_owner" as const] : defaultModules(),
            poolLocation: "none",
            notes: null,
            externalRefs: {},
          },
        });
        started = true;
      } catch (e) {
        problems.push(
          `Onboarding plan: ${e instanceof Error ? e.message : "could not be started"}`,
        );
      }
      return { ...result, startedOnboarding: started, activeOwner: enrolled, problems };
    },

    onSuccess: (r) => onDone(r),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading OwnerRez listings…</p>;
  if (!data || !data.ok)
    return (
      <p className="text-sm text-destructive">
        {data?.ok === false ? data.error : "Could not reach OwnerRez."}
      </p>
    );

  const term = q.trim().toLowerCase();
  const items = data.items.filter((c) =>
    !term
      ? true
      : [c.name, c.address, c.city, c.state, c.postalCode, c.listingId]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term)),
  );

  if (selected) {
    const dupe = selected.existing;
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:underline"
          onClick={() => setSelected(null)}
        >
          ← Back to search
        </button>
        <div className="surface space-y-2 p-4">
          <p className="eyebrow">{selected.name}</p>
          <Row
            label="Address"
            value={
              [selected.address, selected.city, selected.state, selected.postalCode]
                .filter(Boolean)
                .join(", ") || null
            }
          />
          <Row label="OwnerRez property ID" value={selected.listingId} />
        </div>

        {dupe ? (
          <div className="surface space-y-2 p-4">
            <p className="eyebrow">Already in Resolve</p>
            <p className="text-sm">
              {dupe.name} is already linked to this OwnerRez listing. No second property will be
              created.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/property/$propertyId" params={{ propertyId: dupe.id }}>
                Open the existing property
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {selected.likely && (
              <div className="surface space-y-2 p-4">
                <p className="eyebrow">Possible match</p>
                <p className="text-sm">
                  {selected.likely.name} looks like the same home but has no OwnerRez link yet. Link
                  the listing to it instead of creating a second property.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={enroll.isPending}
                  onClick={() =>
                    enroll.mutate({
                      listingId: selected.listingId,
                      linkToPropertyId: selected.likely!.id,
                    })
                  }
                >
                  Link to {selected.likely.name}
                </Button>
              </div>
            )}

            <div className="surface space-y-3 p-4">
              <div>
                <p className="text-sm font-medium">Homeowner</p>
                <p className="text-xs text-muted-foreground">
                  {ownerFromOwnerRez.isFetching
                    ? "Checking OwnerRez for the owner on file…"
                    : ownerFromOwnerRez.data
                      ? "Brought in from OwnerRez. Correct anything that is wrong."
                      : "OwnerRez has no owner on file for this home. Add them here so the Active Owner switch has somebody to enrol."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Text
                  label="Name"
                  value={owner.name}
                  onChange={(v) => setOwner((p) => ({ ...p, name: v }))}
                />
                <Text
                  label="Email"
                  value={owner.email}
                  onChange={(v) => setOwner((p) => ({ ...p, email: v }))}
                />
                <Text
                  label="Phone"
                  value={owner.phone}
                  onChange={(v) => setOwner((p) => ({ ...p, phone: v }))}
                />
              </div>
            </div>

            <MilestoneFields value={milestones} onChange={setMilestones} />

            {mayEnroll && (
              <label className="surface flex cursor-pointer items-start gap-2 p-4 text-sm">
                <Checkbox
                  checked={activeOwner}
                  onCheckedChange={(v) => setActiveOwner(v === true)}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium">This is an Active Owner home</span>
                  <span className="block text-xs text-muted-foreground">
                    Creates a draft participation program. Participation counts only once it is
                    activated.
                  </span>
                </span>
              </label>
            )}

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isDemo} onCheckedChange={(v) => setIsDemo(v === true)} />
              Mark as a QA / test home (kept out of production reporting)
            </label>

            <Button
              disabled={enroll.isPending}
              onClick={() =>
                enroll.mutate({ listingId: selected.listingId, linkToPropertyId: null })
              }
            >
              {enroll.isPending ? "Setting the home up…" : "Start onboarding"}
            </Button>
            <p className="text-xs text-muted-foreground">
              This creates the home, its owner record and the full onboarding plan. Nothing is
              written back to OwnerRez.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search OwnerRez by name, address or ID"
        aria-label="Search OwnerRez properties"
      />
      <ul className="max-h-[45vh] divide-y divide-border overflow-y-auto rounded-md border border-border">
        {items.length === 0 && (
          <li className="p-3 text-sm text-muted-foreground">
            No OwnerRez listing matches that search.
          </li>
        )}
        {items.map((c) => (
          <li key={c.listingId}>
            {/* Choosing a home starts enrollment — no extra review step. */}
            <button
              type="button"
              disabled={Boolean(c.existing)}
              onClick={() => setSelected(c)}
              className="flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[c.address, c.city, c.state].filter(Boolean).join(", ") ||
                    `OwnerRez ${c.listingId}`}
                </span>
              </span>
              {c.existing && (
                <span className="shrink-0 text-xs text-muted-foreground">Already in Resolve</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const emptyMilestones = { plannedClosingOn: "", actualClosingOn: "", accessOn: "" };
type Milestones = typeof emptyMilestones;

/** Sent as nulls when blank — a date nobody knows yet is never invented. */
function milestonePayload(m: Milestones) {
  return {
    plannedClosingOn: m.plannedClosingOn || null,
    actualClosingOn: m.actualClosingOn || null,
    accessOn: m.accessOn || null,
  };
}

/**
 * The three dates the onboarding plan schedules itself from. Captured at
 * import so the plan arrives with real deadlines rather than empty due dates
 * somebody has to chase later. All optional, and editable on the home after.
 */
function MilestoneFields({
  value,
  onChange,
}: {
  value: Milestones;
  onChange: (next: Milestones) => void;
}) {
  const set = (k: keyof Milestones) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="surface space-y-3 p-4">
      <div>
        <p className="text-sm font-medium">Key dates (optional)</p>
        <p className="text-xs text-muted-foreground">
          Deadlines for onboarding work are calculated from these. You can add or change them later
          on the home.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <DateField
          label="Expected closing"
          value={value.plannedClosingOn}
          onChange={set("plannedClosingOn")}
        />
        <DateField
          label="Closing (if it has happened)"
          value={value.actualClosingOn}
          onChange={set("actualClosingOn")}
        />
        <DateField label="Access / keys" value={value.accessOn} onChange={set("accessOn")} />
      </div>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

const emptyManual = {
  name: "",
  addressLine1: "",
  unit: "",
  city: "",
  state: "",
  postalCode: "",
  market: "",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",

  ownerRezPropertyId: "",
};

function ManualForm({
  onDone,
}: {
  onDone: (r: { status: string; property: IntakeMatch }) => void;
}) {
  const [form, setForm] = useState(emptyManual);
  const [milestones, setMilestones] = useState<Milestones>(emptyMilestones);
  const [isDemo, setIsDemo] = useState(false);
  const create = useServerFn(createPropertyManuallyFn);

  const save = useMutation({
    mutationFn: () =>
      create({
        data: {
          name: form.name,
          addressLine1: form.addressLine1,
          unit: form.unit || null,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
          market: form.market || null,
          ownerRecordId: null,
          ownerName: form.ownerName || null,
          ownerEmail: form.ownerEmail || null,
          ownerPhone: form.ownerPhone || null,

          ownerRezPropertyId: form.ownerRezPropertyId || null,
          isDemo,
          milestones: milestonePayload(milestones),
        },
      }),
    onSuccess: (r) => onDone(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof typeof emptyManual) => (v: string) => setForm({ ...form, [k]: v });

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Text label="Property name" required value={form.name} onChange={set("name")} />
        <Text
          label="Street address"
          required
          value={form.addressLine1}
          onChange={set("addressLine1")}
        />
        <Text label="Unit" value={form.unit} onChange={set("unit")} />
        <Text label="City" required value={form.city} onChange={set("city")} />
        <Text label="State" required value={form.state} onChange={set("state")} />
        <Text label="ZIP" required value={form.postalCode} onChange={set("postalCode")} />
        <Text label="Market" value={form.market} onChange={set("market")} />
        <Text label="Owner name" value={form.ownerName} onChange={set("ownerName")} />
        <Text label="Owner email" value={form.ownerEmail} onChange={set("ownerEmail")} />
        <Text label="Owner phone" value={form.ownerPhone} onChange={set("ownerPhone")} />

        <Text
          label="OwnerRez property ID (optional)"
          value={form.ownerRezPropertyId}
          onChange={set("ownerRezPropertyId")}
        />
      </div>
      <MilestoneFields value={milestones} onChange={setMilestones} />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={isDemo} onCheckedChange={(v) => setIsDemo(v === true)} />
        Mark as a QA / test home (kept out of production reporting)
      </label>
      <Button type="submit" className="w-full" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Create property"}
      </Button>
      <p className="text-xs text-muted-foreground">
        An OwnerRez ID added here — now or later — links to this same home rather than creating a
        second one. Creating the property does not start onboarding.
      </p>
    </form>
  );
}

function Text({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
