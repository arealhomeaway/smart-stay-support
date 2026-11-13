/**
 * Property page Part 3 (3.3): Vendors and work. The home's vendors and stagers with trade,
 * Option 1, 2, 3 (Not ranked when none is recorded) and contact links, preferred first; Find a
 * vendor opens the vendor list on the home's market and trade and comes back to this exact place.
 * Below, Breezeway work as synced: N of M done and each work order, opening in Breezeway.
 * Nothing here sends anything.
 */
import { useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usDate } from "@/lib/dates";
import { homeBreezewayWorkFn, homeVendorsFn, type HomeVendor } from "@/lib/home-details.functions";
import { findVendorSearch, optionLabel, sortVendors, vendorContactLinks } from "@/lib/home-details";

const ALL = "__all";

export function FindVendorLink({ market, trade, label = "Find a vendor" }: { market: string | null; trade: string | null; label?: string }) {
  const here = useRouterState({ select: (s) => s.location.href });
  return (
    <Button asChild variant="outline" className="min-h-11">
      <Link to="/vendors" search={findVendorSearch({ market, trade, back: here }) as never}>{label}</Link>
    </Button>
  );
}

export function HomeVendorsTab({ propertyId, extra }: { propertyId: string; extra?: ReactNode }) {
  const vendorsFn = useServerFn(homeVendorsFn);
  const workFn = useServerFn(homeBreezewayWorkFn);
  const vendors = useQuery({ queryKey: ["home-vendors", propertyId], queryFn: () => vendorsFn({ data: { propertyId } }) });
  const work = useQuery({ queryKey: ["home-breezeway-work", propertyId], queryFn: () => workFn({ data: { propertyId } }) });
  const [trade, setTrade] = useState(ALL);
  const list = vendors.data?.vendors ?? [];
  const trades = useMemo(() => [...new Set(list.flatMap((v) => v.trades))].sort(), [list]);
  const shown = sortVendors(list.filter((v) => trade === ALL || v.trades.includes(trade)));
  const stagers = shown.filter((v) => v.stager);
  const onHome = shown.filter((v) => !v.stager && v.forThisHome);
  const market = shown.filter((v) => !v.stager && !v.forThisHome);
  const rows = work.data ?? [];
  const done = rows.filter((r) => r.done).length;

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-label="Vendors for this home">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 font-display text-xl">Vendors{vendors.data?.market ? ` · ${vendors.data.market}` : ""}</h2>
          <Select value={trade} onValueChange={setTrade}>
            <SelectTrigger className="h-11 w-52" aria-label="Trade"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Every trade</SelectItem>
              {trades.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <FindVendorLink market={vendors.data?.market ?? null} trade={trade === ALL ? null : trade} />
        </div>
        {vendors.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading vendors…</p>
        ) : vendors.isError ? (
          <p role="alert" className="text-sm text-destructive">Vendors could not be loaded.</p>
        ) : shown.length === 0 ? (
          <p className="surface p-4 text-sm text-muted-foreground">No vendors for this home yet.</p>
        ) : (
          <>
            <VendorGroup title="Stagers" rows={stagers} />
            <VendorGroup title="Set on this home" rows={onHome} />
            <VendorGroup title={vendors.data?.market ? `In ${vendors.data.market}` : "In this market"} rows={market} />
          </>
        )}
      </section>

      <section className="space-y-3" aria-label="Breezeway work">
        <h2 className="font-display text-xl">Breezeway work</h2>
        {work.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading work orders…</p>
        ) : work.isError ? (
          <p role="alert" className="text-sm text-destructive">Breezeway work could not be loaded.</p>
        ) : rows.length === 0 ? (
          <p className="surface p-4 text-sm text-muted-foreground">No Breezeway work orders on this home yet.</p>
        ) : (
          <>
            <p className="text-sm"><span className="numeric font-semibold">{done} of {rows.length}</span> done</p>
            <ul className="surface divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.scheduledDate ? usDate(r.scheduledDate) : "No date"} · {r.assignees.length ? r.assignees.join(", ") : "Not assigned"}
                    </p>
                  </div>
                  <Chip>{r.status ?? "Not set"}</Chip>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
                    Open in Breezeway <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {extra}
    </div>
  );
}

function VendorGroup({ title, rows }: { title: string; rows: HomeVendor[] }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold">{title} <span className="numeric font-normal text-muted-foreground">({rows.length})</span></h3>
      <ul className="surface divide-y divide-border">
        {rows.map((v) => (
          <li key={v.orgId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{v.name}</p>
              <p className="truncate text-xs text-muted-foreground">{v.trades.join(", ") || "Trade not set"}</p>
            </div>
            <Chip>{optionLabel(v.priority)}</Chip>
            <div className="flex flex-wrap gap-1">
              {vendorContactLinks({ phone: v.phone, email: v.email, preferred: v.preferred }).map((c) => (
                <Button key={c.method} asChild size="sm" variant={c.preferred ? "default" : "outline"} className="min-h-11">
                  <a href={c.href}>{c.label}{c.preferred ? " (preferred)" : ""}</a>
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
