import { useState } from "react";
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
  searchOwnerRezPropertiesFn,
} from "@/lib/property-intake.functions";
import type { IntakeMatch, OwnerRezCandidate } from "@/lib/property-intake";

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
  const [done, setDone] = useState<{ status: string; property: IntakeMatch } | null>(null);
  const qc = useQueryClient();

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
    await qc.invalidateQueries({ queryKey: ["properties"] });
    await qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
  };

  function finish(result: { status: string; property: IntakeMatch }) {
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
      <DialogTrigger asChild>{trigger ?? <Button disabled={disabled}>Add property</Button>}</DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a property to Resolve</DialogTitle>
          <DialogDescription>
            This creates the home record only. Onboarding is started separately from the home.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <Outcome result={done} onClose={() => setOpen(false)} onAgain={() => setDone(null)} />
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

function Outcome({
  result,
  onClose,
  onAgain,
}: {
  result: { status: string; property: IntakeMatch };
  onClose: () => void;
  onAgain: () => void;
}) {
  const p = result.property;
  const heading =
    result.status === "duplicate"
      ? "Already in Resolve"
      : result.status === "linked"
        ? "Linked to the existing home"
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
      <p className="text-sm text-muted-foreground">
        Onboarding has not been started. Open the home and choose <strong>Start onboarding</strong> when
        you are ready.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild onClick={onClose}>
          <Link to="/property/$propertyId" params={{ propertyId: p.id }}>
            Open property
          </Link>
        </Button>
        <Button asChild variant="outline" onClick={onClose}>
          <Link to="/onboarding/$propertyId" params={{ propertyId: p.id }}>
            Start onboarding
          </Link>
        </Button>
        <Button variant="ghost" onClick={onAgain}>
          Add another
        </Button>
      </div>
    </div>
  );
}

function OwnerRezImport({ onDone }: { onDone: (r: { status: string; property: IntakeMatch }) => void }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<OwnerRezCandidate | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const search = useServerFn(searchOwnerRezPropertiesFn);
  const runImport = useServerFn(importOwnerRezPropertyFn);

  const { data, isLoading } = useQuery({
    queryKey: ["ownerrez-candidates"],
    queryFn: () => search({ data: { query: "" } }),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const doImport = useMutation({
    mutationFn: (input: { listingId: string; linkToPropertyId: string | null }) =>
      runImport({ data: { ...input, isDemo } }),
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
        <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => setSelected(null)}>
          ← Back to search
        </button>
        <div className="surface space-y-2 p-4">
          <p className="eyebrow">Import preview</p>
          <Row label="Property name" value={selected.name} />
          <Row label="Address" value={selected.address} />
          <Row label="City / state / ZIP" value={[selected.city, selected.state, selected.postalCode].filter(Boolean).join(", ")} />
          <Row label="OwnerRez property ID" value={selected.listingId} />
        </div>

        {dupe ? (
          <div className="surface space-y-2 p-4">
            <p className="eyebrow">Already in Resolve</p>
            <p className="text-sm">
              {dupe.name} is already linked to this OwnerRez listing. No second property will be created.
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
                  {selected.likely.name} looks like the same home but has no OwnerRez link yet. Link the
                  listing to it instead of creating a second property.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={doImport.isPending}
                  onClick={() =>
                    doImport.mutate({
                      listingId: selected.listingId,
                      linkToPropertyId: selected.likely!.id,
                    })
                  }
                >
                  Link to {selected.likely.name}
                </Button>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isDemo} onCheckedChange={(v) => setIsDemo(v === true)} />
              Mark as a QA / test home (kept out of production reporting)
            </label>
            <Button
              disabled={doImport.isPending}
              onClick={() => doImport.mutate({ listingId: selected.listingId, linkToPropertyId: null })}
            >
              {doImport.isPending ? "Importing…" : "Create property in Resolve"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Importing does not start onboarding and does not change anything in OwnerRez.
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
          <li className="p-3 text-sm text-muted-foreground">No OwnerRez listing matches that search.</li>
        )}
        {items.map((c) => (
          <li key={c.listingId} className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[c.address, c.city, c.state].filter(Boolean).join(", ") || `OwnerRez ${c.listingId}`}
              </p>
            </div>
            {c.existing ? (
              <span className="shrink-0 text-xs text-muted-foreground">Already in Resolve</span>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setSelected(c)}>
                Review
              </Button>
            )}
          </li>
        ))}
      </ul>
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
  ownerRezPropertyId: "",
};

function ManualForm({ onDone }: { onDone: (r: { status: string; property: IntakeMatch }) => void }) {
  const [form, setForm] = useState(emptyManual);
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
          ownerRezPropertyId: form.ownerRezPropertyId || null,
          isDemo,
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
        <Text label="Street address" required value={form.addressLine1} onChange={set("addressLine1")} />
        <Text label="Unit" value={form.unit} onChange={set("unit")} />
        <Text label="City" required value={form.city} onChange={set("city")} />
        <Text label="State" required value={form.state} onChange={set("state")} />
        <Text label="ZIP" required value={form.postalCode} onChange={set("postalCode")} />
        <Text label="Market" value={form.market} onChange={set("market")} />
        <Text label="Owner name" value={form.ownerName} onChange={set("ownerName")} />
        <Text label="Owner email" value={form.ownerEmail} onChange={set("ownerEmail")} />
        <Text
          label="OwnerRez property ID (optional)"
          value={form.ownerRezPropertyId}
          onChange={set("ownerRezPropertyId")}
        />
      </div>
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
