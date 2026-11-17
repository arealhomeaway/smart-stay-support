/**
 * Insight, Monthly home records for one home (Admin, Nov 17): the home's month in sections, its
 * totals and what is missing, with downloads for the owner statement. Read only.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { RequireCapability } from "@/components/RequireCapability";
import { LoadError, PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { MissingList, MonthPicker, RecordLineRow, TotalsStrip, useMonthRecords } from "@/components/home-records/HomeRecordsParts";
import { downloadExport } from "@/lib/oversight-export";
import { homeRecordPdf } from "@/lib/home-records-export";
import {
  HR_COPY, SECTIONS, type HomeFilter, fileStem, homeCsv, homeTotals, isValidMonth, lastFullMonth, missingLines, monthLabel, sortLines,
} from "@/lib/home-records";

const DESCRIPTION = "One home's money for the month, line by line, with totals for the owner statement.";

export const Route = createFileRoute("/_authenticated/home-records/$propertyId")({
  validateSearch: (raw: Record<string, unknown>): { month?: string | undefined; show?: HomeFilter | undefined } => ({
    ...(isValidMonth(raw["month"]) ? { month: raw["month"] } : {}),
    // The all-homes filter, kept so All homes returns to the same list.
    ...(raw["show"] === "active" || raw["show"] === "onboarding" || raw["show"] === "all" ? { show: raw["show"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Home record for the month: Resolve" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Home record for the month: Resolve" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="home_records" title={HR_COPY.title}>
      <HomeRecordPage />
    </RequireCapability>
  ),
});

function HomeRecordPage() {
  const { propertyId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/home-records/$propertyId" });
  const month = search.month ?? lastFullMonth();
  const q = useMonthRecords(month);
  const home = q.data?.homes.find((h) => h.id === propertyId) ?? null;
  const label = home?.label ?? "Home";
  useShellPageLabel(label);
  const { originSearch } = useWorkspaceOrigin(`${label}, ${monthLabel(month)}`);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const lines = useMemo(() => sortLines((q.data?.lines ?? []).filter((l) => l.propertyId === propertyId)), [q.data, propertyId]);
  const totals = useMemo(() => homeTotals(lines), [lines]);
  const missing = useMemo(() => missingLines(lines), [lines]);
  const sections = SECTIONS.filter((s) => s.key !== "onboarding" || home?.kind === "onboarding" || lines.some((l) => l.section === "onboarding"));

  const pdf = async () => {
    setBusy(true);
    setFailed(false);
    try {
      downloadExport(`${fileStem(label, month)}.pdf`, "application/pdf", await homeRecordPdf(label, month, lines, { onboardingHome: home?.kind === "onboarding" }));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };
  const csv = () => downloadExport(`${fileStem(label, month)}.csv`, "text/csv;charset=utf-8", homeCsv(label, month, lines));

  return (
    <div className="space-y-5">
      <Link to="/home-records" search={{ month, ...(search.show ? { show: search.show } : {}) }} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden="true" /> All homes
      </Link>
      <PageHeader
        eyebrow={`${HR_COPY.title} · ${monthLabel(month)}`}
        title={label}
        actions={
          <>
            <Button className="min-h-11" onClick={() => void pdf()} disabled={!home || busy}>
              <Download className="size-4" aria-hidden="true" /> {busy ? "Preparing" : "Download for owner statement (PDF)"}
            </Button>
            <Button className="min-h-11" variant="outline" onClick={csv} disabled={!home}>
              <Download className="size-4" aria-hidden="true" /> CSV
            </Button>
          </>
        }
      />
      {failed ? <p role="alert" className="text-sm text-destructive">The PDF could not be made. Try again.</p> : null}
      <div className="lg:max-w-xs">
        <MonthPicker value={month} onChange={(m) => void navigate({ search: (prev) => ({ ...prev, month: m }), replace: true })} />
      </div>

      {q.isError ? <LoadError what="This home's record" onRetry={() => void q.refetch()} /> : null}
      {q.isPending ? <Skeleton className="h-64 w-full" /> : null}
      {q.data && !home ? <p className="text-sm text-muted-foreground">This home is not in Monthly home records.</p> : null}

      {q.data && home ? (
        <>
          <SectionCard title={`${HR_COPY.missingTitle} (${missing.length})`} tone={missing.length ? "attention" : "default"}>
            <MissingList lines={missing} origin={originSearch} />
          </SectionCard>
          <TotalsStrip totals={totals} withNet />
          {sections.map((s) => {
            const own = lines.filter((l) => l.section === s.key);
            return (
              <SectionCard key={s.key} title={`${s.label}${own.length ? ` (${own.length})` : ""}`}>
                {own.length ? (
                  <ul className="divide-y divide-border" data-section={s.key}>
                    {own.map((l) => (
                      <RecordLineRow key={l.id} line={l} origin={originSearch} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground" data-section={s.key}>{HR_COPY.noRecords}</p>
                )}
              </SectionCard>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
