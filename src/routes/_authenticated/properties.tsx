import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Chip, EmptyState, LoadingRows, PageHeader } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPEN_STATUSES } from "@/lib/tickets";
import { listOwnerRezListings } from "@/lib/ownerrez.functions";
import { syncPropertyEnrichment } from "@/lib/property-enrichment.functions";
import { AddPropertyDialog } from "@/components/property/AddPropertyDialog";
import { RequireCapability } from "@/components/RequireCapability";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({
    meta: [
      { title: "Properties — Resolve Operations" },
      { name: "description", content: "Every managed home with access notes and its live issue count." },
      { property: "og:title", content: "Properties — Resolve Operations" },
      { property: "og:description", content: "Managed homes with access notes and live issue counts." },
    ],
  }),
  // Search and filters live in the URL so the list a coordinator built is
  // still there when they come back from a home.
  validateSearch: (raw: Record<string, unknown>): PropertySearch => {
    const out: PropertySearch = {};
    if (typeof raw["q"] === "string" && raw["q"]) out.q = raw["q"];
    if (typeof raw["market"] === "string" && raw["market"]) out.market = raw["market"];
    if (typeof raw["status"] === "string" && raw["status"]) out.status = raw["status"];
    return out;
  },
  component: () => (
    <RequireCapability capability="properties" title="Properties">
      <PropertiesPage />
    </RequireCapability>
  ),
});

type PropertySearch = { q?: string | undefined; market?: string | undefined; status?: string | undefined };


function PropertiesPage() {
  const qc = useQueryClient();
  const [enriching, setEnriching] = useState(false);

  const fetchListings = useServerFn(listOwnerRezListings);
  const { data: ownerRez } = useQuery({
    queryKey: ["ownerrez-listings"],
    queryFn: () => fetchListings(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const runEnrichment = useServerFn(syncPropertyEnrichment);

  async function refreshInfo() {
    setEnriching(true);
    try {
      const res = await runEnrichment();
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setEnriching(false);
    }
  }

  async function linkListing(propertyId: string, listingId: string) {
    const { error } = await supabase
      .from("properties")
      .update({
        ownerrez_property_id: listingId === "none" ? null : listingId,
        ownerrez_synced_at: new Date().toISOString(),
      })
      .eq("id", propertyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(listingId === "none" ? "Unlinked from OwnerRez." : "Linked to OwnerRez.");
    await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
  }

  const { data, isLoading } = useQuery({
    queryKey: ["properties-with-counts"],
    queryFn: async () => {
      const [properties, tickets, owners] = await Promise.all([
        supabase.from("properties").select("*").order("name"),
        supabase.from("tickets").select("id, property_id, status").eq("is_demo", false).is("archived_at", null),
        supabase.from("property_owners").select("id, name"),
      ]);
      if (properties.error) throw properties.error;
      const ownerName = new Map((owners.data ?? []).map((o) => [o.id, o.name]));
      return { properties: properties.data ?? [], tickets: tickets.data ?? [], ownerName };
    },
  });

  // Page-local finding. Staff should never have to reach for the global
  // command bar just to open a home they already know the name of.
  const navigate = Route.useNavigate();
  const params = Route.useSearch();
  const find = params.q ?? "";
  const marketFilter = params.market ?? "all";
  const statusFilter = params.status ?? "all";
  const setParam = (patch: PropertySearch) =>
    void navigate({
      search: (prev: PropertySearch) => {
        const next: PropertySearch = { ...prev, ...patch };
        if (!next.q) delete next.q;
        if (!next.market || next.market === "all") delete next.market;
        if (!next.status || next.status === "all") delete next.status;
        return next;
      },
      replace: true,
    });
  const setFind = (v: string) => setParam({ q: v || undefined });
  const setMarketFilter = (v: string) => setParam({ market: v });
  const setStatusFilter = (v: string) => setParam({ status: v });

  const markets = Array.from(
    new Set((data?.properties ?? []).map((p) => p.market).filter((m): m is string => Boolean(m))),
  ).sort();

  const q = find.trim().toLowerCase();
  const visible = (data?.properties ?? []).filter((p) => {
    if (marketFilter !== "all" && p.market !== marketFilter) return false;
    if (statusFilter === "open") {
      const has = (data?.tickets ?? []).some(
        (t) => t.property_id === p.id && OPEN_STATUSES.includes(t.status),
      );
      if (!has) return false;
    } else if (statusFilter !== "all" && p.lifecycle_status !== statusFilter) {
      return false;
    }
    if (!q) return true;
    const owner = p.owner_record_id ? (data?.ownerName.get(p.owner_record_id) ?? "") : "";
    // Searchable identity only — never notes, and never anything that could
    // carry a credential.
    return [
      p.name,
      p.nickname,
      p.listing_alias,
      p.address_line1,
      p.unit,
      p.city,
      p.state,
      p.postal_code,
      p.market,
      p.neighborhood,
      owner,
      p.ownerrez_property_id,
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });


  const { originSearch } = useWorkspaceOrigin(
    "Properties",
    visible.map((p) => ({ id: p.id, label: p.nickname ?? p.name, sub: p.market ?? undefined })),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Portfolio"
        title="Properties"
        description="Every ticket, project and owner action links back to one of these homes."
        actions={
        <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={refreshInfo} disabled={enriching}>
          {enriching ? "Refreshing…" : "Refresh property info & photos"}
        </Button>
        <AddPropertyDialog />
        </div>

        }
      />

      {/* Page-local finder. Address, name, market, neighbourhood, owner or
          OwnerRez ID — no global search round trip. */}
      <div className="surface flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find a property — address, name, market, neighbourhood, owner or OwnerRez ID"
            aria-label="Find a property"
            className="pl-9"
          />
        </div>
        <Select value={marketFilter} onValueChange={setMarketFilter}>
          <SelectTrigger className="w-44" aria-label="Filter by market">
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Has open tickets</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="in_preparation">In preparation</SelectItem>
            <SelectItem value="offboarded">Offboarded</SelectItem>
          </SelectContent>
        </Select>
        <span className="numeric shrink-0 text-sm text-muted-foreground">
          {isLoading ? "…" : `${visible.length} of ${data?.properties.length ?? 0}`}
        </span>
      </div>

      {isLoading || !data ? (
        <LoadingRows rows={4} />
      ) : data.properties.length === 0 ? (
        <EmptyState
          title="No properties yet."
          hint="Add your first home to start logging tickets against it."
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No property matches that search."
          hint="Try part of the street address, the nickname, the market or the owner's name."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const all = data.tickets.filter((t) => t.property_id === p.id);
            const openCount = all.filter((t) => OPEN_STATUSES.includes(t.status)).length;
            const owner = p.owner_record_id ? data.ownerName.get(p.owner_record_id) : null;
            return (
              <Card key={p.id} className="overflow-hidden shadow-card transition-shadow hover:shadow-raised">
                <div className="relative">
                  {p.primary_photo_url ? (
                    <img
                      src={p.primary_photo_url}
                      alt={`${p.nickname ?? p.name} — listing photo`}
                      className="h-40 w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-sunken text-xs text-muted-foreground">
                      No listing photo on file
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
                    {p.lifecycle_status && p.lifecycle_status !== "live" && (
                      <Chip className={cn(stateChip("waiting"), "backdrop-blur")}>
                        {p.lifecycle_status.replace(/_/g, " ")}
                      </Chip>
                    )}
                    {openCount > 0 && (
                      <Chip className={cn(stateChip("blocked"), "backdrop-blur")}>
                        {openCount} open
                      </Chip>
                    )}
                  </div>
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    <Link
                      to="/property/$propertyId"
                      params={{ propertyId: p.id }}
                      search={originSearch}
                      className="hover:text-primary hover:underline"
                    >
                      {p.nickname ?? p.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {[p.address_line1, p.unit, p.city, p.state].filter(Boolean).join(", ") || "No address on file"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                    {p.market && <span>{p.market}</span>}
                    {p.neighborhood && <span>· {p.neighborhood}</span>}
                    {owner && <span>· {owner}</span>}
                  </div>
                  <p className="numeric text-muted-foreground">
                    {openCount} open · {all.length} total tickets
                  </p>

                  <div className="space-y-1 border-t border-border pt-3">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      OwnerRez listing
                    </Label>
                    {ownerRez?.ok ? (
                      <Select
                        value={p.ownerrez_property_id ?? "none"}
                        onValueChange={(v) => linkListing(p.id, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Not linked" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not linked</SelectItem>
                          {ownerRez.data.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                              {l.location ? ` — ${l.location}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {ownerRez?.error ?? "Checking OwnerRez…"}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
