/**
 * Insight, Monthly home records (Admin, Nov 17): one row per home for the month with its totals
 * and what is missing. Read only. Admin, the Directors, the Operations Supervisor and the Finance lead.
 * Rules: src/lib/home-records.ts. Reads: src/lib/home-records.data.ts.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadError, PageHeader, SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, SELECT_CLASS } from "@/components/trackers/parts";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { MissingList, MonthPicker, TotalsStrip, useMonthRecords } from "@/components/home-records/HomeRecordsParts";
import { downloadExport } from "@/lib/oversight-export";
import {
  HOME_FILTERS, HR_COPY, allHomesCsv, homeTotals, isValidMonth, lastFullMonth, missingLines, moneyText, monthLabel, homeSummaries,
  type HomeFilter,
} from "@/lib/home-records";

const DESCRIPTION = "Every home's money for the month: repairs, refunds, claims, expenses and owner decisions, with what is missing.";

export const Route = createFileRoute("/_authenticated/home-records/")({
  validateSearch: (raw: Record<string, unknown>): { month?: string | undefined; show?: HomeFilter | undefined } => ({
    ...(isValidMonth(raw["month"]) ? { month: raw["month"] } : {}),
    ...(raw["show"] === "active" || raw["show"] === "onboarding" || raw["show"] === "all" ? { show: raw["show"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Monthly home records: Resolve" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Monthly home records: Resolve" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="home_records" title={HR_COPY.title}>
      <AllHomesPage />
    </RequireCapability>
  ),
});

function AllHomesPage() {
  useShellPageLabel(HR_COPY.title);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/home-records/" });
  const month = search.month ?? lastFullMonth();
  const show: HomeFilter = search.show ?? "active";
  const q = useMonthRecords(month);
  const { originSearch } = useWorkspaceOrigin(HR_COPY.title);
  const [allMissing, setAllMissing] = useState(false);

  const view = useMemo(() => {
    if (!q.data) return null;
    const summaries = homeSummaries(q.data.homes, q.data.lines, show);
    const ids = new Set(summaries.map((s) => s.propertyId));
    const lines = q.data.lines.filter((l) => ids.has(l.propertyId));
    return { summaries, lines, missing: missingLines(lines), totals: homeTotals(lines), labels: Object.fromEntries(q.data.homes.map((h) => [h.id, h.label])) };
  }, [q.data, show]);

  const set = (next: { month?: string; show?: HomeFilter }) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });

  const downloadAll = () => {
    if (!q.data || !view) return;
    const homes = q.data.homes.filter((h) => show === "all" || h.kind === show);
    downloadExport(`monthly-home-records-${month}.csv`, "text/csv;charset=utf-8", allHomesCsv(month, homes, view.lines));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insight"
        title={HR_COPY.title}
        description={HR_COPY.hint}
        actions={
          <Button className="min-h-11" variant="outline" onClick={downloadAll} disabled={!view}>
            <Download className="size-4" aria-hidden="true" /> Download all homes
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
        <MonthPicker value={month} onChange={(m) => set({ month: m })} />
        <Field label="Homes">
          <select className={SELECT_CLASS} value={show} onChange={(e) => set({ show: e.target.value as HomeFilter })} data-filter="homes">
            {HOME_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {q.isError ? <LoadError what="Monthly home records" onRetry={() => void q.refetch()} /> : null}
      {q.isPending ? <Skeleton className="h-64 w-full" /> : null}

      {view ? (
        <>
          <TotalsStrip totals={view.totals} withNet={false} />
          <SectionCard title={`${HR_COPY.missingTitle} (${view.missing.length})`} tone={view.missing.length ? "attention" : "default"}>
            <MissingList lines={view.missing} origin={originSearch} homeLabels={view.labels} {...(allMissing ? {} : { limit: 12 })} />
            {view.missing.length > 12 ? (
              <Button variant="ghost" className="mt-2 min-h-11" onClick={() => setAllMissing((v) => !v)}>
                {allMissing ? "Show fewer" : `Show all ${view.missing.length}`}
              </Button>
            ) : null}
          </SectionCard>
          <SectionCard title={`${monthLabel(month)}: ${view.summaries.length} homes`}>
            {view.summaries.length === 0 ? (
              <EmptyState title="No homes in this view" />
            ) : (
              <ul className="divide-y divide-border" data-homes-list="">
                {view.summaries.map((h) => (
                  <li key={h.propertyId} className="py-1" data-home={h.propertyId} data-missing={h.missing}>
                    <Link
                      to="/home-records/$propertyId"
                      params={{ propertyId: h.propertyId }}
                      search={{ month }}
                      className="block min-h-11 rounded-md px-2 py-2 hover:bg-muted"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <span className="min-w-0 break-words font-medium">{h.label}</span>
                        <span className="flex flex-wrap items-center gap-2">
                          {h.kind === "onboarding" ? <StatusBadge tone="context">Onboarding</StatusBadge> : null}
                          {h.missing > 0 ? (
                            <StatusBadge tone="escalated">{h.missing} missing</StatusBadge>
                          ) : h.lines > 0 ? (
                            <StatusBadge tone="resolved">Nothing missing</StatusBadge>
                          ) : (
                            <span className="text-sm text-muted-foreground">{HR_COPY.noRecords}</span>
                          )}
                        </span>
                      </div>
                      {h.lines > 0 ? (
                        <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">
                          Billed to owner {moneyText(h.totals.billedToOwner)} · Paid by ARHA {moneyText(h.totals.paidByArha)} · Refunds and credits{" "}
                          {moneyText(h.totals.refunds)} · Recovered {moneyText(h.totals.recovered)} · {h.lines} {h.lines === 1 ? "record" : "records"}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}
