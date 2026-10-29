import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { formatPropertyLabel } from "@/lib/property-label";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadingRows, PageHeader, SectionCard, SegmentedControl, StatTile } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { saveOwnerReportFile } from "@/lib/owner-report-download";
import {
  DRAFT_LABEL,
  REPORT_DISCLAIMER,
  hrs,
  reconciles,
  timeLabel,
  totalText,
  type StrReport,
  PROGRAM_LEVEL_NOTE,
  ownerBreakdown,
} from "@/lib/str-report";
import {
  strReportContext,
  strReportExport,
  strReportPreview,
  strReportRelease,
  strReportRevise,
} from "@/lib/str-report.functions";

export const Route = createFileRoute("/_authenticated/str-participation-report")({
  validateSearch: z.object({ property: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "STR Participation & Work Activity Report — Resolve" },
      { name: "description", content: "Internal STR property participation and work activity report with versioned final owner reports." },
      { property: "og:title", content: "STR Participation & Work Activity Report — Resolve" },
      { property: "og:description", content: "Owner participation and non-owner work activity for an STR property, with source detail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="str_participation_report" title="Only Admins and the Director of Operations can open participation reports">
      <ReportPage />
    </RequireCapability>
  ),
});

type Ctx = {
  property: { id: string; name: string } | null;
  tracking: { from: string; active: boolean } | null;
  programs: { id: string; ownerName: string | null; status: string; periodStart: string | null; periodEnd: string | null }[];
  versions: {
    id: string; programId: string; version: number; status: "pending_review" | "released" | "superseded";
    periodStart: string; periodEnd: string; generatedAt: string; releasedAt: string | null; supersededAt: string | null;
    revisionReason: string | null; exclusionNote: string | null;
    blockers: { date: string; person: string; workType: string; reference: string }[];
  }[];
  sources: { label: string; active: boolean; category: string }[];
};

const STATUS_LABEL = { pending_review: "Pending final review", released: "Current owner version", superseded: "Superseded (kept internally)" };

function ReportPage() {
  const { property } = Route.useSearch();
  const navigate = useNavigate();
  const homes = useQuery({
    queryKey: ["str-report", "homes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cleaner_hours_properties").select("property_id, properties(name, address_line1, unit, city, state, postal_code)");
      if (error) throw error;
      return (data ?? []).map((r) => ({ id: r.property_id, name: formatPropertyLabel(r.properties).primary }));
    },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insight · STR cleaner time"
        title="Property Participation Report"
        description="Owner participation and non-owner work activity for an STR property, with the source behind every total."
        actions={
          <select aria-label="Property" className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={property ?? ""} onChange={(e) => void navigate({ to: "/str-participation-report", search: { property: e.target.value || undefined } })}>
            <option value="">Choose an STR property…</option>
            {(homes.data ?? []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        }
      />
      {property ? <PropertyReport propertyId={property} /> : <EmptyState title="Choose an STR property" hint="Pick an enrolled STR home to generate its participation report." />}
    </div>
  );
}

function PropertyReport({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const getCtx = useServerFn(strReportContext);
  const ctx = useQuery({ queryKey: ["str-report", "ctx", propertyId], queryFn: () => getCtx({ data: { propertyId } }) as unknown as Promise<Ctx> });
  const [programId, setProgramId] = useState<string>("");
  const [mode, setMode] = useState<"program" | "year" | "custom">("program");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [incOwner, setIncOwner] = useState(true);
  const [incNon, setIncNon] = useState(true);
  const [appendix, setAppendix] = useState(true);

  const program = ctx.data?.programs.find((p) => p.id === programId);
  useEffect(() => {
    if (!programId && ctx.data?.programs[0]) setProgramId(ctx.data.programs[0].id);
  }, [ctx.data, programId]);

  const period = useMemo(() => {
    if (mode === "program") return program?.periodStart && program.periodEnd ? { from: program.periodStart, to: program.periodEnd } : null;
    if (mode === "year") return { from: `${year}-01-01`, to: `${year}-12-31` };
    return from && to ? { from, to } : null;
  }, [mode, program, year, from, to]);

  const filters = period ? { propertyId, programId: programId || null, from: period.from, to: period.to, includeOwner: incOwner, includeNonOwner: incNon } : null;
  const runPreview = useServerFn(strReportPreview);
  const preview = useQuery({
    queryKey: ["str-report", "preview", filters],
    enabled: Boolean(filters),
    queryFn: () => runPreview({ data: filters! }),
  });
  const runExport = useServerFn(strReportExport);
  const [busy, setBusy] = useState<string | null>(null);
  const exportFile = async (format: "pdf" | "csv", reportId?: string) => {
    setBusy(`${format}${reportId ?? ""}`);
    try {
      saveOwnerReportFile(await runExport({ data: reportId ? { format, appendix: true, reportId } : { format, appendix, filters: filters! } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export");
    } finally {
      setBusy(null);
    }
  };

  if (ctx.isLoading) return <LoadingRows />;
  if (ctx.error) return <EmptyState title="Could not load this property" hint={(ctx.error as Error).message} />;
  const c = ctx.data!;
  const r = preview.data;
  const outsideProgram = mode !== "program";

  return (
    <div className="space-y-6">
      <SectionCard title="Filters" description="Defaults to the Active Owner program period with all supported activity. A broader range is for internal review only — owner reports always use the finalized program period.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Program</span>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2" value={programId} onChange={(e) => setProgramId(e.target.value)}>
              {c.programs.length === 0 ? <option value="">No Active Owner program for this home</option> : null}
              {c.programs.map((p) => (
                <option key={p.id} value={p.id}>{p.ownerName ?? "Owner"} · {p.status} · {p.periodStart ?? "not started"} to {p.periodEnd ?? "n/a"}</option>
              ))}
            </select>
          </label>
          <div className="space-y-1 text-sm">
            <span className="text-muted-foreground">Reporting period</span>
            <SegmentedControl ariaLabel="Reporting period" value={mode} onChange={setMode}
              options={[{ value: "program", label: "Program period" }, { value: "year", label: "Calendar year" }, { value: "custom", label: "Custom range" }]} />
            {mode === "year" ? <Input className="mt-2 w-28" type="number" value={year} onChange={(e) => setYear(e.target.value)} /> : null}
            {mode === "custom" ? (
              <div className="mt-2 flex gap-2"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2"><Switch checked={incOwner} onCheckedChange={setIncOwner} /> Include owner participation</label>
          <label className="flex items-center gap-2"><Switch checked={incNon} onCheckedChange={setIncNon} /> Include non-owner work</label>
          <label className="flex items-center gap-2"><Switch checked={appendix} onCheckedChange={setAppendix} /> Include detailed activity appendix</label>
        </div>
      </SectionCard>

      {!filters ? <EmptyState title="Choose a reporting period" /> : preview.isLoading ? <LoadingRows /> : preview.error ? (
        <EmptyState title="Could not build the report" hint={(preview.error as Error).message} />
      ) : r ? (
        <ReportView report={r} appendix={appendix} internal
          banner={r.draft ? DRAFT_LABEL : outsideProgram ? "INTERNAL REVIEW RANGE — not an owner-facing final report" : "Internal preview of a completed program — owners see only released versions below"}
          actions={
            <div className="flex gap-2">
              <Button onClick={() => void exportFile("pdf")} disabled={busy !== null}>
                {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}{r.draft ? "Export draft PDF" : "Export PDF"}
              </Button>
              <Button variant="outline" onClick={() => void exportFile("csv")} disabled={busy !== null}>
                <Download className="mr-2 h-4 w-4" /> Export Detailed CSV
              </Button>
            </div>
          } />
      ) : null}

      <Versions ctx={c} propertyId={propertyId} busy={busy} onExport={exportFile}
        onChanged={() => void qc.invalidateQueries({ queryKey: ["str-report"] })} />

      <SectionCard title="Data sources">
        <p className="mb-2 text-sm text-muted-foreground">Supported now: owner participation entries, Breezeway housekeeping (Cleaner Safeguard ledger) and approved off-Breezeway cleans.</p>
        <ul className="flex flex-wrap gap-2 text-xs">
          {c.sources.map((s) => (
            <li key={s.label}><Badge variant={s.active ? "default" : "outline"}>{s.label}{s.active ? "" : " · future-ready, not yet feeding"}</Badge></li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

export function ReportView({ report: r, appendix, internal, banner, actions }: {
  report: StrReport; appendix: boolean; internal?: boolean; banner?: string; actions?: React.ReactNode;
}) {
  const ok = reconciles(r);
  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />{r.property.name}</span>}
      description={`${r.owner.name} · Program ${r.program.startedOn ?? "n/a"} to ${r.program.endsOn ?? "n/a"} · Reporting ${r.period.from} to ${r.period.to}${r.version ? ` · Version ${r.version}` : ""}`}
      actions={actions}
    >
      <div className="space-y-5">
        {banner ? <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive">{banner}</p> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          {r.include.owner ? ownerBreakdown(r).map(([k, v]) => <StatTile key={k} label={k} value={v} />) : null}
        </div>
        {r.include.owner ? <p className="text-xs text-muted-foreground">{r.programLevelNote ?? PROGRAM_LEVEL_NOTE}</p> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          {r.include.nonOwner ? <StatTile label="Non-owner supported time" value={`${hrs(r.totals.nonOwnerSupportedMinutes)?.toFixed(2)} hrs`} hint="Individuals only" /> : null}
          {internal ? <StatTile label="Under review" value={r.totals.underReview} tone={r.totals.underReview ? "attention" : "neutral"} hint="Not in finalized totals" /> : null}
        </div>
        {r.underReviewNote ? <p className="text-sm">{r.underReviewNote}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Person</th><th>Work type</th><th>Source</th><th>Activities</th><th>Time type</th><th>Total</th></tr></thead>
            <tbody>
              {r.summary.map((s, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-1.5">{s.person}</td><td>{s.workType}</td><td className="text-muted-foreground">{s.source}</td>
                  <td>{s.activities}{internal && s.underReview ? <span className="text-muted-foreground"> (+{s.underReview} under review)</span> : null}</td>
                  <td>{timeLabel(s)}</td><td>{totalText(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.summary.length === 0 ? <p className="py-3 text-sm text-muted-foreground">No activity recorded in this period.</p> : null}
        </div>
        {internal ? <p className={ok ? "text-xs text-muted-foreground" : "text-xs font-semibold text-destructive"}>{ok ? "Summary totals reconcile exactly to the appendix records." : "Summary does not reconcile to the appendix — do not release."}</p> : null}
        {appendix ? (
          <div className="overflow-x-auto">
            <p className="eyebrow mb-2">Detailed activity appendix</p>
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1">Date</th><th>Person</th><th>Work type</th><th>Activity</th><th>Source</th><th>Reference</th><th>Time type</th><th>Duration</th><th>Status</th>{internal ? <th>Internal source</th> : null}</tr></thead>
              <tbody>
                {r.rows.map((x, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1">{x.date}</td><td>{x.person}</td><td>{x.workType}</td><td>{x.description}</td><td>{x.source}</td>
                    <td>{x.reference}{x.correction ? " · corrected" : ""}</td><td>{timeLabel(x)}</td>
                    <td>{x.minutes == null ? "—" : `${hrs(x.minutes)?.toFixed(2)} h`}</td>
                    <td>{x.status === "provisional" ? <Badge variant="outline">Under review</Badge> : "Final"}</td>
                    {internal ? <td className="font-mono text-[10px] text-muted-foreground">{internalRef(x.internal)}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="text-xs leading-relaxed text-muted-foreground">{r.disclaimer || REPORT_DISCLAIMER}</p>
      </div>
    </SectionCard>
  );
}

function internalRef(i: Record<string, string | number | boolean | null> | undefined) {
  if (!i) return "";
  if (i["kind"] === "cleaner_ledger") return i["breezewayTaskId"] ? `Breezeway Task ${String(i["breezewayTaskId"])}` : `Ledger ${String(i["id"]).slice(0, 8)}`;
  if (i["kind"] === "owner_time_entry") return `Owner entry ${String(i["id"]).slice(0, 8)}`;
  return `Work record ${String(i["id"]).slice(0, 8)}${i["sourceRef"] ? ` · ${String(i["sourceRef"])}` : ""}`;
}

function Versions({ ctx, propertyId, busy, onExport, onChanged }: {
  ctx: Ctx; propertyId: string; busy: string | null; onExport: (f: "pdf" | "csv", id?: string) => Promise<void>; onChanged: () => void;
}) {
  const release = useServerFn(strReportRelease);
  const revise = useServerFn(strReportRevise);
  const [note, setNote] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const completed = ctx.programs.filter((p) => p.status === "completed");
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      const res = (await fn()) as { created?: boolean; message?: string } | undefined;
      if (res && res.created === false) toast.info(res.message ?? "No change");
      else toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <SectionCard title="Final owner report versions"
      description="Version 1 is created automatically when the program is marked Completed. Released versions are frozen; a correction creates a new version and keeps the prior one internally.">
      {ctx.versions.length === 0 ? <EmptyState title="No final report yet" hint="It will be created automatically when the program is marked Completed." /> : (
        <ul className="space-y-3">
          {ctx.versions.map((v) => (
            <li key={v.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <strong>Version {v.version}</strong>
                  <Badge variant={v.status === "released" ? "default" : "outline"}>{STATUS_LABEL[v.status]}</Badge>
                  <span className="text-muted-foreground">{v.periodStart} to {v.periodEnd} · generated {v.generatedAt.slice(0, 10)}{v.releasedAt ? ` · released ${v.releasedAt.slice(0, 10)}` : ""}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void onExport("pdf", v.id)}>PDF</Button>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void onExport("csv", v.id)}>CSV</Button>
                </div>
              </div>
              {v.revisionReason ? <p className="mt-1 text-xs text-muted-foreground">Reason: {v.revisionReason}</p> : null}
              {v.exclusionNote ? <p className="mt-1 text-xs text-muted-foreground">Released with records excluded: {v.exclusionNote}</p> : null}
              {v.status === "pending_review" ? (
                <div className="mt-3 space-y-2">
                  <p className="font-medium">Records preventing release ({v.blockers.length}):</p>
                  <ul className="list-disc pl-5 text-xs">
                    {v.blockers.map((b, i) => <li key={i}>{b.date} · {b.person} · {b.workType} · {b.reference}</li>)}
                  </ul>
                  <p className="text-xs text-muted-foreground">Resolve these under STR cleaner time, then release. To release with them excluded from finalized totals, give a reason (25+ characters).</p>
                  <Textarea placeholder="Reason to exclude unresolved records (optional if all resolved)" value={note[v.id] ?? ""} onChange={(e) => setNote({ ...note, [v.id]: e.target.value })} />
                  <Button size="sm" onClick={() => void act(() => release({ data: { reportId: v.id, exclusionNote: note[v.id] || undefined } }), "Report released to the owner")}>Release to owner</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {completed.length > 0 && ctx.versions.some((v) => v.status === "released") ? (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <p className="text-sm font-medium">Authorized correction</p>
          <p className="text-xs text-muted-foreground">After correcting source records, create a new version. Nothing is created if the finalized content did not change.</p>
          <Textarea placeholder="Reason for the revision (10+ characters)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => void act(() => revise({ data: { programId: completed[0]!.id, propertyId, reason } }), "New report version created")}>Create new version</Button>
        </div>
      ) : null}
    </SectionCard>
  );
}
