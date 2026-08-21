import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowUpRight, Minus, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequireCapability } from "@/components/RequireCapability";
import { getCommandCenter } from "@/lib/command-center.functions";
import { STATUS_TONE, type Kpi } from "@/lib/command-center";
import { CompanyHealthPanel } from "@/components/CompanyHealthPanel";

export const Route = createFileRoute("/_authenticated/command-center")({
  head: () => ({
    meta: [
      { title: "Executive Command Center — Resolve" },
      {
        name: "description",
        content:
          "Exception-first company health for A Real Home Away: operations, vendors, homeowners, onboarding and data quality, from real records only.",
      },
      { property: "og:title", content: "Executive Command Center — Resolve" },
      {
        property: "og:description",
        content: "One screen for what is off-standard right now, with drill-down to the records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="command_center" title="Command center is for Platform Owners">
      <CommandCenter />
    </RequireCapability>
  ),
  errorComponent: () => (
    <p className="text-muted-foreground">The command center could not be loaded.</p>
  ),
});

const RANGES = [7, 30, 90, 180] as const;
const ALL = "__all";

function CommandCenter() {
  const load = useServerFn(getCommandCenter);
  const [days, setDays] = useState<number>(30);
  const [market, setMarket] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [priority, setPriority] = useState<"p1" | "p2" | "p3" | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [exceptionsOnly, setExceptionsOnly] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["command-center", days, market, propertyId, priority, team, vendorId],
    queryFn: () => load({ data: { days, market, propertyId, priority, team, vendorId } }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const allKpis = data.sections.flatMap((s) => s.kpis);
  const offStandard = allKpis.filter((k) => k.status === "red");
  const watch = allKpis.filter((k) => k.status === "yellow");
  const unavailable = allKpis.filter((k) => k.unavailable);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Platform Owner</p>
        <h1 className="font-display text-3xl font-semibold">Executive Command Center</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Exceptions first. Every figure is calculated from live records in Resolve — nothing here is
          estimated. Where a source does not exist yet the metric says so and names the missing feed.
        </p>
      </header>

      <CompanyHealthPanel data={data} />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <Filter label="Window">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r} value={String(r)}>{r} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Filter>
          <Filter label="Market">
            <Picker value={market} onChange={setMarket} placeholder="All markets"
              options={data.filters.markets.map((m) => ({ value: m, label: m }))} />
          </Filter>
          <Filter label="Property">
            <Picker value={propertyId} onChange={setPropertyId} placeholder="All properties" wide
              options={data.filters.properties.map((p) => ({ value: p.id, label: p.name }))} />
          </Filter>
          <Filter label="Priority">
            <Picker value={priority} onChange={(v) => setPriority(v as "p1" | "p2" | "p3" | null)} placeholder="All priorities"
              options={[
                { value: "p1", label: "P1" },
                { value: "p2", label: "P2" },
                { value: "p3", label: "P3" },
              ]} />
          </Filter>
          <Filter label="Team">
            <Picker value={team} onChange={setTeam} placeholder="All teams"
              options={data.filters.teams.map((t) => ({ value: t, label: t }))} />
          </Filter>
          <Filter label="Vendor">
            <Picker value={vendorId} onChange={setVendorId} placeholder="All vendors" wide
              options={data.filters.vendors.map((v) => ({ value: v.id, label: v.name }))} />
          </Filter>
          <Button
            variant={exceptionsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setExceptionsOnly((v) => !v)}
          >
            {exceptionsOnly ? "Showing exceptions" : "Showing everything"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Headline label="Off standard" value={offStandard.length} tone="red" />
        <Headline label="Watch list" value={watch.length} tone="yellow" />
        <Headline label="Metrics needing a data source" value={unavailable.length} tone="unknown" />
      </div>

      {offStandard.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="size-4 text-destructive" /> Needs leadership attention now
            </CardTitle>
            <CardDescription>Red metrics across every area, in one place.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {offStandard.map((k) => <KpiCard key={k.key} kpi={k} />)}
          </CardContent>
        </Card>
      )}

      {data.sections.map((section) => {
        const kpis = exceptionsOnly
          ? section.kpis.filter((k) => k.status !== "green")
          : section.kpis;
        if (!kpis.length) return null;
        return (
          <section key={section.key} className="space-y-3">
            <div>
              <h2 className="font-display text-xl font-semibold">{section.label}</h2>
              <p className="text-sm text-muted-foreground">{section.blurb}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {kpis.map((k) => <KpiCard key={k.key} kpi={k} />)}
            </div>
          </section>
        );
      })}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Vendor coverage risk by market</h2>
        <Card>
          <CardContent className="divide-y pt-6">
            {data.coverage.map((row) => (
              <div key={row.market} className="flex items-center justify-between py-2 text-sm">
                <span className="font-medium">{row.market}</span>
                <span className="text-muted-foreground">
                  {row.properties} propert{row.properties === 1 ? "y" : "ies"} · {row.vendors} vendor
                  {row.vendors === 1 ? "" : "s"} with completed work
                </span>
                <Badge variant="outline" className={STATUS_TONE[row.risk]}>
                  {row.risk === "green" ? "Covered" : row.risk === "yellow" ? "Thin" : "At risk"}
                </Badge>
              </div>
            ))}
            {!data.coverage.length && (
              <p className="py-2 text-sm text-muted-foreground">No active properties yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <p className="text-xs text-muted-foreground">
        Generated {new Date(data.generatedAt).toLocaleString()} · window {data.windowDays} days.
      </p>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function Picker({
  value,
  onChange,
  options,
  placeholder,
  wide,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  wide?: boolean;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger className={wide ? "w-56" : "w-40"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Headline({ label, value, tone }: { label: string; value: number; tone: keyof typeof STATUS_TONE }) {
  return (
    <Card className={value > 0 ? STATUS_TONE[tone] : undefined}>
      <CardContent className="pt-6">
        <p className="text-3xl font-semibold">{value}</p>
        <p className="text-sm">{label}</p>
      </CardContent>
    </Card>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const TrendIcon = kpi.trend === "up" ? ArrowUpRight : kpi.trend === "down" ? ArrowDownRight : Minus;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium">{kpi.label}</CardTitle>
          <Badge variant="outline" className={STATUS_TONE[kpi.status]}>
            {kpi.status === "unknown" ? "No data" : kpi.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="font-display text-2xl font-semibold">{kpi.display}</p>
        {kpi.unavailable ? (
          <p className="text-xs text-muted-foreground">{kpi.unavailable}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {kpi.target && <span>Target {kpi.target}</span>}
              {kpi.previous != null && (
                <span className="flex items-center gap-1">
                  <TrendIcon className="size-3" /> prior period {kpi.unit === "percent"
                    ? `${kpi.previous.toFixed(1)}%`
                    : Math.round(kpi.previous)}
                </span>
              )}
            </div>
            {kpi.denominator && <p className="text-xs text-muted-foreground">Of {kpi.denominator}</p>}
          </>
        )}
        {kpi.note && <p className="text-xs italic text-muted-foreground">{kpi.note}</p>}
        {kpi.drill && (
          <Button asChild size="sm" variant="outline">
            <Link to={kpi.drill.to}>{kpi.drill.label}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
