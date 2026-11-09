import { formatPropertyLabel, matchesPropertySearch } from "@/lib/property-label";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmptyState, LoadingRows, PageHeader } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { openTicketsForTotal } from "@/lib/notion-ticket-display";
import { AddPropertyDialog } from "@/components/property/AddPropertyDialog";
import { RequireCapability } from "@/components/RequireCapability";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { applyTestDataFilter } from "@/lib/test-data";
import { useRole } from "@/hooks/useRole";
import { LabelChip, useLabelList } from "@/components/property/PropertyLabels";
import {
  canAddHome,
  departmentFor,
  filterHomes,
  homeCountLine,
  isOnboardingHome,
  stageLabel,
  type ListFilter,
} from "@/lib/property-page";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({
    meta: [
      { title: "Properties | Resolve" },
      { name: "description", content: "Every home ARHA looks after, with its stage, labels and open tickets." },
      { property: "og:title", content: "Properties | Resolve" },
      { property: "og:description", content: "Every home ARHA looks after, with its stage, labels and open tickets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Search and filters live in the URL so the list a person built is still
  // there when they come back from a home.
  validateSearch: (raw: Record<string, unknown>): PropertySearch => {
    const out: PropertySearch = {};
    if (typeof raw["q"] === "string" && raw["q"]) out.q = raw["q"];
    if (typeof raw["market"] === "string" && raw["market"]) out.market = raw["market"];
    if (raw["status"] === "operations" || raw["status"] === "onboarding") out.status = raw["status"];
    if (raw["open"] === true || raw["open"] === "true") out.open = true;
    return out;
  },
  component: () => (
    <RequireCapability capability="properties" title="Properties">
      <PropertiesPage />
    </RequireCapability>
  ),
});

type PropertySearch = ListFilter;

function PropertiesPage() {
  const qc = useQueryClient();
  const role = useRole();
  const navigate = Route.useNavigate();
  const params = Route.useSearch();
  const labelList = useLabelList();

  const { data, isLoading } = useQuery({
    queryKey: ["properties-with-counts"],
    queryFn: async () => {
      const [properties, tickets, owners, labels, carry, programs] = await Promise.all([
        supabase.from("properties").select("*").order("name"),
        supabase
          .from("tickets")
          .select("id, property_id, status, reported_at, external_source, external_status")
          .eq("is_demo", false)
          .is("archived_at", null),
        supabase.from("property_owners").select("id, name"),
        supabase
          .from("property_label_assignments")
          .select("property_id, property_labels(id, name)")
          .is("removed_at", null),
        supabase.from("handoff_carryovers").select("property_id"),
        supabase
          .from("owner_program_properties")
          .select("property_id, owner_programs(status)")
          .is("archived_at", null),
      ]);
      if (properties.error) throw properties.error;
      const ownerName = new Map((owners.data ?? []).map((o) => [o.id, o.name]));
      const labelsByHome = new Map<string, { id: string; name: string }[]>();
      for (const row of labels.data ?? []) {
        const l = row.property_labels as unknown as { id: string; name: string } | null;
        if (!l) continue;
        labelsByHome.set(row.property_id, [...(labelsByHome.get(row.property_id) ?? []), l]);
      }
      const carriedByHome = new Map<string, number>();
      for (const row of carry.data ?? [])
        carriedByHome.set(row.property_id, (carriedByHome.get(row.property_id) ?? 0) + 1);
      const activeOwner = new Set<string>();
      for (const row of programs.data ?? []) {
        const status = (row.owner_programs as unknown as { status: string } | null)?.status;
        if (status && status !== "complete") activeOwner.add(row.property_id);
      }
      return {
        properties: properties.data ?? [],
        tickets: tickets.data ?? [],
        ownerName,
        labelsByHome,
        carriedByHome,
        activeOwner,
      };
    },
  });

  const setParam = (patch: Partial<PropertySearch>) =>
    void navigate({
      search: (prev: PropertySearch) => {
        const next: PropertySearch = { ...prev, ...patch };
        if (!next.q) delete next.q;
        if (!next.market) delete next.market;
        if (!next.status) delete next.status;
        if (!next.open) delete next.open;
        return next;
      },
      replace: true,
    });

  const homes = useMemo(() => {
    if (!data) return [];
    return applyTestDataFilter(data.properties, false, (p) => p).map((p) => {
      const all = data.tickets.filter((t) => t.property_id === p.id);
      const owner = p.owner_record_id ? (data.ownerName.get(p.owner_record_id) ?? "") : "";
      const label = formatPropertyLabel(p);
      const labels = data.labelsByHome.get(p.id) ?? [];
      return {
        p,
        id: p.id,
        lifecycle: p.lifecycle_status,
        market: p.market,
        openTickets: openTicketsForTotal(all).length,
        carried: data.carriedByHome.get(p.id) ?? 0,
        activeOwner: data.activeOwner.has(p.id),
        labels,
        totalTickets: all.length,
        photo: homePhotoUrl(p),
        title: label.primary,
        place: [p.city, p.state].filter(Boolean).join(", ") || p.market || "",
        line: homeFactsLine(p),
        // Searchable identity only, never notes or anything that could carry a code.
        searchText: [
          label.primary,
          label.secondary,
          p.name,
          p.nickname,
          p.listing_alias,
          p.address_line1,
          p.city,
          p.market,
          p.neighborhood,
          owner,
          p.ownerrez_property_id,
          ...labels.map((l) => l.name),
        ]
          .filter(Boolean)
          .join(" "),
        matches: (q: string) => matchesPropertySearch(p, q),
      };
    });
  }, [data]);

  const markets = useMemo(
    () => Array.from(new Set(homes.map((h) => h.market).filter((m): m is string => Boolean(m)))).sort(),
    [homes],
  );

  const visible = filterHomes(homes, params);
  const filtered = Boolean(params.q || params.market || params.status || params.open);

  const department = departmentFor({ onboardingOnly: role.onboardingOnly });
  const { originSearch } = useWorkspaceOrigin(
    "Properties",
    visible.map((h) => ({ id: h.id, label: h.title, sub: h.market ?? undefined })),
  );

  // Admin: add a label to many homes.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLabel, setBulkLabel] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkDone, setBulkDone] = useState<string | null>(null);

  async function applyBulk() {
    setBulkBusy(true);
    try {
      const { data: n, error } = await supabase.rpc("property_label_add", {
        _label_id: bulkLabel,
        _property_ids: [...picked],
      });
      if (error) throw error;
      const name = (labelList.data ?? []).find((l) => l.id === bulkLabel)?.name ?? "The label";
      setBulkDone(`${name} added to ${n} home${n === 1 ? "" : "s"}.`);
      setBulkOpen(false);
      setPicked(new Set());
      setBulkLabel("");
      await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
      await qc.invalidateQueries({ queryKey: ["property-labels"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The label could not be added.");
    } finally {
      setBulkBusy(false);
    }
  }

  const total = homes.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description={isLoading ? "Loading homes…" : `${homeCountLine(total)} we look after.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {role.isAdmin && !role.readOnly ? (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setBulkOpen((v) => !v);
                  setBulkDone(null);
                }}
              >
                Add a label to many homes
              </Button>
            ) : null}
            {canAddHome({ roles: role.roles, onboardingDirector: role.isOnboardingDirector, readOnly: role.readOnly }) ? (
              <AddPropertyDialog trigger={<Button className="min-h-11">Add a home</Button>} />
            ) : null}
          </div>
        }
      />

      {bulkOpen ? (
        <div className="surface space-y-3 p-4" aria-label="Add a label to many homes">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="bulk-label">Label to add</Label>
              <Select value={bulkLabel} onValueChange={setBulkLabel}>
                <SelectTrigger id="bulk-label" className="min-h-11 w-56">
                  <SelectValue placeholder="Choose a label" />
                </SelectTrigger>
                <SelectContent>
                  {(labelList.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setPicked(new Set(visible.map((h) => h.id)))}
            >
              Select all shown
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{homeCountLine(picked.size)} picked</p>
          <div className="flex gap-2">
            <Button
              className="min-h-11"
              disabled={!bulkLabel || picked.size === 0 || bulkBusy}
              onClick={() => void applyBulk()}
            >
              {bulkBusy ? "Applying…" : "Apply"}
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => {
                setBulkOpen(false);
                setPicked(new Set());
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      {bulkDone ? (
        <p role="status" className="text-sm">
          {bulkDone}
        </p>
      ) : null}

      <div className="surface flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={params.q ?? ""}
            onChange={(e) => setParam({ q: e.target.value || undefined })}
            placeholder="Find a home"
            aria-label="Find a home"
            className="min-h-11 pl-9"
          />
        </div>
        <Select value={params.market ?? "all"} onValueChange={(v) => setParam({ market: v === "all" ? undefined : v })}>
          <SelectTrigger className="min-h-11 w-44" aria-label="Market">
            <SelectValue placeholder="All markets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All markets</SelectItem>
            {markets.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={params.status ?? "all"}
          onValueChange={(v) => setParam({ status: v === "operations" || v === "onboarding" ? v : undefined })}
        >
          <SelectTrigger className="min-h-11 w-40" aria-label="Status">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="operations">Operations</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Switch checked={params.open === true} onCheckedChange={(v) => setParam({ open: v || undefined })} />
          Only homes with open tickets
        </label>
        <span className="numeric shrink-0 text-sm text-muted-foreground">
          {isLoading ? "…" : homeCountLine(visible.length)}
        </span>
        {filtered ? (
          <Button
            variant="ghost"
            className="min-h-11"
            onClick={() => setParam({ q: undefined, market: undefined, status: undefined, open: undefined })}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {isLoading || !data ? (
        <LoadingRows rows={4} />
      ) : visible.length === 0 ? (
        <EmptyState title="No homes match" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((h) => {
            const toOnboarding = department === "onboarding" && isOnboardingHome(h.lifecycle);
            return (
              <PropertyListCard
                key={h.id}
                address={h.title}
                photoUrl={h.photo}
                stage={stageLabel(h.lifecycle)}
                onboarding={isOnboardingHome(h.lifecycle)}
                place={h.place}
                facts={h.line}
                activeOwner={h.activeOwner}
                labels={h.labels}
                carried={h.carried}
                openTickets={h.openTickets}
                totalTickets={h.totalTickets}
                picker={
                  bulkOpen ? (
                    <span className="inline-flex rounded-md bg-card p-1 shadow-sm">
                      <Checkbox
                        className="size-6"
                        aria-label={`Pick ${h.title}`}
                        checked={picked.has(h.id)}
                        onCheckedChange={(v) =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            if (v === true) next.add(h.id);
                            else next.delete(h.id);
                            return next;
                          })
                        }
                      />
                    </span>
                  ) : null
                }
                title={
                  toOnboarding ? (
                    <Link
                      to="/onboarding/$propertyId"
                      params={{ propertyId: h.id }}
                      className="inline-flex min-h-11 items-center hover:text-primary hover:underline"
                    >
                      {h.title}
                    </Link>
                  ) : (
                    <Link
                      to="/property/$propertyId"
                      params={{ propertyId: h.id }}
                      search={originSearch}
                      className="inline-flex min-h-11 items-center hover:text-primary hover:underline"
                    >
                      {h.title}
                    </Link>
                  )
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
