import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownRight, ArrowUpRight, Minus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequireCapability } from "@/components/RequireCapability";
import { getCommandCenter } from "@/lib/command-center.functions";
import type { Kpi, KpiStatus } from "@/lib/command-center";
import { CompanyHealthPanel } from "@/components/CompanyHealthPanel";
import { ReportingBaselineNote } from "@/components/ReportingBaselineNote";
import { LoadingPage, PageHeader, SectionBand, StatTile } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { usDateTime } from "@/lib/dates";

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

const STATUS_TONE: Record<KpiStatus, StatusTone> = {
  green: "resolved",
  yellow: "waiting",
  red: "escalated",
  unknown: "closed",
};

const STATUS_WORD: Record<KpiStatus, string> = {
  green: "On standard",
  yellow: "Watch",
  red: "Off standard",
  unknown: "No data",
};

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

  if (isLoading || !data) return <LoadingPage tiles={3} />;

  const allKpis = data.sections.flatMap((s) => s.kpis);
  const offStandard = allKpis.filter((k) => k.status === "red");
  const watch = allKpis.filter((k) => k.status === "yellow");
  const unavailable = allKpis.filter((k) => k.unavailable);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform Owner"
        title="Executive Command Center"
        description="Exceptions first. Every figure is calculated from live Resolve records — nothing is estimated. Where a source doesn't exist yet, the metric says so and names what's missing."
      />

      <ReportingBaselineNote className="max-w-3xl" />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Off standard"
          value={offStandard.length}
          tone={offStandard.length > 0 ? "critical" : "positive"}
          hint="Needs leadership attention now"
        />
        <StatTile
          label="Watch list"
          value={watch.length}
          tone={watch.length > 0 ? "attention" : "neutral"}
          hint="Trending the wrong way"
        />
        <StatTile
          label="Missing a data source"
          value={unavailable.length}
          tone="neutral"
          hint="Not counted as healthy or unhealthy"
        />
      </div>

      <CompanyHealthPanel data={data} />

      <div className="surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Filter label="Window">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((r) => (
                  <SelectItem key={r} value={String(r)}>
                    {r} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Filter>
          <Filter label="Market">
            <Picker
              value={market}
              onChange={setMarket}
              placeholder="All markets"
              options={data.filters.markets.map((m) => ({ value: m, label: m }))}
            />
          </Filter>
          <Filter label="Property">
            <Picker
              value={propertyId}
              onChange={setPropertyId}
              placeholder="All properties"
              wide
              options={data.filters.properties.map((p) => ({ value: p.id, label: p.name }))}
            />
          </Filter>
          <Filter label="Priority">
            <Picker
              value={priority}
              onChange={(v) => setPriority(v as "p1" | "p2" | "p3" | null)}
              placeholder="All priorities"
              options={[
                { value: "p1", label: "P1" },
                { value: "p2", label: "P2" },
                { value: "p3", label: "P3" },
              ]}
            />
          </Filter>
          <Filter label="Team">
            <Picker
              value={team}
              onChange={setTeam}
              placeholder="All teams"
              options={data.filters.teams.map((t) => ({ value: t, label: t }))}
            />
          </Filter>
          <Filter label="Vendor">
            <Picker
              value={vendorId}
              onChange={setVendorId}
              placeholder="All vendors"
              wide
              options={data.filters.vendors.map((v) => ({ value: v.id, label: v.name }))}
            />
          </Filter>
          <Button
            variant={exceptionsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setExceptionsOnly((v) => !v)}
          >
            {exceptionsOnly ? "Showing exceptions" : "Showing everything"}
          </Button>
        </div>
      </div>

      {offStandard.length > 0 && (
        <section className="surface border-coral/25">
          <div className="flex items-center gap-2 border-b border-coral/20 px-5 py-3.5">
            <TriangleAlert className="size-4 shrink-0 text-coral" aria-hidden="true" />
            <div>
              <h2 className="text-[1.0625rem] font-semibold tracking-tight text-coral">
                Needs leadership attention now
              </h2>
              <p className="text-[0.8125rem] text-muted-foreground">
                Red metrics across every area, in one place.
              </p>
            </div>
          </div>
          <div className="divide-y">
            {offStandard.map((k) => (
              <MetricRow key={k.key} kpi={k} />
            ))}
          </div>
        </section>
      )}

      {data.sections.map((section) => {
        const kpis = exceptionsOnly
          ? section.kpis.filter((k) => k.status !== "green")
          : section.kpis;
        if (!kpis.length) return null;
        return (
          <section key={section.key} className="space-y-2">
            <SectionBand title={section.label} hint={section.blurb} />
            <div className="surface divide-y">
              {kpis.map((k) => (
                <MetricRow key={k.key} kpi={k} />
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-2">
        <SectionBand title="Vendor coverage risk by market" />
        <div className="surface divide-y">
          {data.coverage.map((row) => (
            <div
              key={row.market}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <span className="font-medium">{row.market}</span>
              <span className="text-muted-foreground">
                {row.properties} propert{row.properties === 1 ? "y" : "ies"} · {row.vendors} vendor
                {row.vendors === 1 ? "" : "s"} with completed work
              </span>
              <StatusBadge tone={STATUS_TONE[row.risk]}>
                {row.risk === "green" ? "Covered" : row.risk === "yellow" ? "Thin" : "At risk"}
              </StatusBadge>
            </div>
          ))}
          {!data.coverage.length && (
            <p className="px-5 py-3 text-sm text-muted-foreground">No active properties yet.</p>
          )}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Generated {usDateTime(data.generatedAt)} · window {data.windowDays} days.
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
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MetricRow({ kpi }: { kpi: Kpi }) {
  const TrendIcon =
    kpi.trend === "up" ? ArrowUpRight : kpi.trend === "down" ? ArrowDownRight : Minus;
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.9375rem] font-semibold">{kpi.label}</p>
          <StatusBadge tone={STATUS_TONE[kpi.status]}>{STATUS_WORD[kpi.status]}</StatusBadge>
        </div>
        {kpi.unavailable ? (
          <p className="mt-1 text-xs text-muted-foreground">{kpi.unavailable}</p>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {kpi.target && <span>Target {kpi.target}</span>}
            {kpi.denominator && <span>Of {kpi.denominator}</span>}
            {kpi.previous != null && (
              <span className="flex items-center gap-1">
                <TrendIcon className="size-3" /> prior period{" "}
                {kpi.unit === "percent" ? `${kpi.previous.toFixed(1)}%` : Math.round(kpi.previous)}
              </span>
            )}
          </div>
        )}
        {kpi.note && <p className="mt-1 text-xs italic text-muted-foreground">{kpi.note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <p className="numeric text-xl font-semibold leading-none">{kpi.display}</p>
        {kpi.drill && (
          <Button asChild size="sm" variant="outline">
            <Link to={kpi.drill.to}>{kpi.drill.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
