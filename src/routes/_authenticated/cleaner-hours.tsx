import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRole } from "@/hooks/useRole";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadingRows, PageHeader, SectionCard, SegmentedControl, StatTile } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ATTRIBUTED_TIME_LABEL,
  CLASSIFICATION_LABEL,
  METHOD_LABEL,
  REVIEW_KIND_LABEL,
  REVIEW_STATE_LABEL,
  OVERRIDE_CATEGORY_LABEL,
  OWNER_ZERO_COPY,
  STATE_LABEL,
  formatElapsed,
  formatMinutes,
  hours,
  pctOfRestricted,
  worstState,
  type Evaluation,
  type SafeguardState,
} from "@/lib/cleaner-hours";
import { ExposureBar, RotationAid, StateBadge } from "@/components/cleaner-hours/Safeguard";
import { usDate } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/cleaner-hours")({
  head: () => ({
    meta: [
      { title: "STR cleaner time — Resolve" },
      {
        name: "description",
        content:
          "Internal monitoring of Attributed Cleaner Time at homes enrolled in the STR cleaner-hours safeguard, with a review queue and traceable Breezeway sources.",
      },
      { property: "og:title", content: "STR cleaner time — Resolve" },
      { property: "og:description", content: "Attributed Cleaner Time by home and by cleaner, traceable to Breezeway." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="cleaner_hours">
      <CleanerHoursPage />
    </RequireCapability>
  ),
});

type Tab = "attention" | "properties" | "roster" | "accounts" | "homes";
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: Record<string, unknown>) => any };

async function fetchAll<T>(table: string, build: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(db.from(table)).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

function useProperties() {
  return useQuery({
    queryKey: ["cleaner-hours", "properties"],
    queryFn: async () => {
      const rows = await fetchAll<{ id: string; name: string | null; breezeway_mapping_state: string | null }>("properties", (q) =>
        q.select("id, name, breezeway_mapping_state").is("archived_at", null).order("name"),
      );
      return rows;
    },
  });
}

function CleanerHoursPage() {
  const thisYear = new Date().getFullYear();
  const [tab, setTab] = useState<Tab>("attention");
  const [year, setYear] = useState(thisYear);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["cleaner-hours"] });

  const portfolio = useQuery({
    queryKey: ["cleaner-hours", "portfolio", year],
    queryFn: async () => {
      const { data, error } = await db.rpc("cleaner_safeguard_portfolio", { _year: year });
      if (error) throw new Error(error.message);
      return data as Portfolio;
    },
  });
  const openItems = useQuery({
    queryKey: ["cleaner-hours", "review-count"],
    queryFn: async () => {
      const { count } = await db.from("cleaner_review_items").select("id", { count: "exact", head: true }).eq("status", "open").eq("is_fixture", false);
      return count ?? 0;
    },
  });
  const properties = useProperties();
  const propName = useMemo(() => new Map((properties.data ?? []).map((p) => [p.id, p.name ?? "Unnamed home"])), [properties.data]);

  const props = portfolio.data?.properties ?? [];
  const cells = props.flatMap((p) => p.cleaners.map((c) => ({ ...c, property_id: p.property_id, property_name: p.name })));
  const flagged = cells.filter((c) => ["warning", "restricted", "hard_block"].includes(c.state) || c.inversion);
  const totalHours = cells.reduce((s, c) => s + Number(c.current_hours ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insight · Operations leadership"
        title="STR cleaner time"
        description={
          <>
            {ATTRIBUTED_TIME_LABEL} at homes enrolled in the STR cleaner-hours safeguard, measured against operational safeguard thresholds.
            Each cleaner on a Breezeway clean is attributed the full elapsed Task time — a conservative exposure figure, not hours worked.
            This is an operational safeguard only; Resolve makes no tax or participation determinations.
          </>
        }
        actions={
          <div className="flex gap-2">
            <select aria-label="Year" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {[thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <ManualEntryButton propName={propName} onDone={refresh} />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Homes tracked" value={props.filter((p) => p.active).length} hint={props.length ? undefined : "No STR home enrolled yet"} />
        <StatTile label={`${ATTRIBUTED_TIME_LABEL} ${year}`} value={hours(totalHours)} />
        <StatTile label="Cleaners in Warning or above" value={flagged.length} tone={flagged.length ? "attention" : "neutral"} />
        <StatTile label="Open Attention Queue items" value={openItems.data ?? "—"} tone={(openItems.data ?? 0) > 0 ? "attention" : "neutral"} />
      </div>

      <SegmentedControl<Tab>
        ariaLabel="View"
        value={tab}
        onChange={setTab}
        options={[
          { value: "attention", label: "Attention Queue", count: (openItems.data ?? 0) },
          { value: "properties", label: "Enrolled Properties" },
          { value: "roster", label: "Cleaner Roster" },
          { value: "accounts", label: "Cleaner accounts" },
          { value: "homes", label: "Tracked homes" },
        ]}
      />

      {portfolio.error ? <EmptyState title="Could not load the safeguard" hint={(portfolio.error as Error).message} /> : null}
      {tab === "attention" ? (
        <div className="space-y-4">
          <SectionCard title="Homes approaching operational safeguard thresholds" description="Cleaners in Warning, Restricted or Hard Block, and hours inversions / narrow owner participation buffers.">
            {portfolio.isLoading ? <LoadingRows /> : !flagged.length ? <EmptyState title="No cleaner is in Warning or above" /> : (
              <CellTable rows={flagged} showProperty />
            )}
          </SectionCard>
          <ReviewQueue propName={propName} onChanged={refresh} />
          <OverridesLog overrides={portfolio.data?.overrides ?? []} />
        </div>
      ) : null}
      {tab === "properties" ? (portfolio.isLoading ? <LoadingRows /> : <EnrolledProperties props={props} onChanged={refresh} />) : null}
      {tab === "roster" ? (portfolio.isLoading ? <LoadingRows /> : <CleanerRoster props={props} />) : null}
      {tab === "accounts" ? <AccountsView onChanged={refresh} /> : null}
      {tab === "homes" ? (
        <div className="space-y-4">
          <FirstLiveRecordCheck />
          <TrackedHomes propName={propName} properties={properties.data ?? []} onChanged={refresh} />
        </div>
      ) : null}
    </div>
  );
}

type FirstLiveRow = {
  property_id: string; property_name: string; tracking_from: string; breezeway_home_id: string | null; mapping_state: string | null;
  first_ledger_id: string | null; breezeway_task_id: number | null; completion_date: string | null; calendar_year: number | null;
  worker_id: string | null; breezeway_person_id: number | null; worker_name: string | null; worker_classification: string | null;
  raw_elapsed_minutes: number | null; attributed_minutes: number | null; original_minutes: number | null;
  attribution_method: string | null; review_state: string | null; counted: boolean | null; before_tracking_start: boolean | null;
  open_review_items: number; safeguard: { state?: SafeguardState; owner_hours?: number; buffer_hours?: number | null; current_hours?: number } | null;
};

/** Temporary readiness check: the first real Breezeway cleaning record per tracked STR home. */
function FirstLiveRecordCheck() {
  const q = useQuery({
    queryKey: ["cleaner-first-live-record"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("cleaner_first_live_record_check" as never);
      if (error) throw error;
      return (data ?? []) as unknown as FirstLiveRow[];
    },
  });
  return (
    <SectionCard title="First live record check" description="Readiness check: the first real Breezeway cleaning record received for each tracked STR home. Verify each field before relying on the safeguard.">
      {q.isLoading ? <LoadingRows /> : q.error ? <EmptyState title="Could not load the check" hint={(q.error as Error).message} /> : !q.data?.length ? <EmptyState title="No STR home is tracked" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-2 pr-3">Home</th><th className="pr-3">Tracking from</th><th className="pr-3">Breezeway Task</th><th className="pr-3">Cleaner</th><th className="pr-3">Duration</th><th className="pr-3">Year</th><th className="pr-3">Owner hours</th><th className="pr-3">State</th><th>Review</th></tr>
            </thead>
            <tbody>
              {q.data.map((r) => (
                <tr key={r.property_id} className="border-t border-border align-top">
                  <td className="py-2 pr-3 font-medium">{r.property_name}<div className="text-xs text-muted-foreground">Home {r.breezeway_home_id ?? "—"} · {r.mapping_state ?? "—"}</div></td>
                  <td className="pr-3">{usDate(r.tracking_from)}</td>
                  {!r.first_ledger_id ? (
                    <td colSpan={7} className="text-muted-foreground">Waiting for the first real cleaning record.</td>
                  ) : (
                    <>
                      <td className="pr-3">{r.breezeway_task_id}<div className="text-xs text-muted-foreground">{r.completion_date ? usDate(r.completion_date) : "—"}{r.before_tracking_start ? " · BEFORE START" : ""}</div></td>
                      <td className="pr-3">{r.worker_name ?? "Unlinked"}<div className="text-xs text-muted-foreground">Person {r.breezeway_person_id ?? "—"} · {r.worker_classification ?? "unclassified"}</div></td>
                      <td className="pr-3">Elapsed {r.raw_elapsed_minutes ?? "—"} min<div className="text-xs text-muted-foreground">Attributed {r.attributed_minutes ?? "—"} min · {r.attribution_method ?? "—"}{r.review_state ? ` · ${r.review_state}` : ""}</div></td>
                      <td className="pr-3">{r.calendar_year}</td>
                      <td className="pr-3">{r.safeguard?.owner_hours ?? "—"}</td>
                      <td className="pr-3">{r.safeguard?.state ? <StateBadge state={r.safeguard.state} /> : "—"}</td>
                      <td>{r.open_review_items ? <Badge variant="outline">{r.open_review_items} open</Badge> : "None"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

type Cell = Evaluation & { worker_id: string; property_id?: string; property_name?: string };
type PortfolioProperty = {
  property_id: string; name: string; active: boolean; tracking_from: string; standard_clean_minutes: number | null;
  owner_name: string | null; segment_start: string; owner_hours: number; owner_zero: boolean; cleaners: Cell[];
  needs_review_entries: number; next_clean: { task_id: number; date: string; name: string | null } | null;
};
type OverrideRow = {
  id: string; kind: "manager" | "emergency"; property_name: string; worker_name: string; task_ref: string; scheduled_date: string | null;
  current_hours: number; projected_clean_hours: number; projected_total_hours: number; owner_hours: number; buffer_hours: number | null;
  state_at_approval: SafeguardState; reason_category: string; justification: string; approved_by_name: string; created_at: string;
};
type Portfolio = { year: number; as_of: string; properties: PortfolioProperty[]; overrides: OverrideRow[] };

function CellTable({ rows, showProperty }: { rows: Cell[]; showProperty?: boolean }) {
  const [detail, setDetail] = useState<Cell | null>(null);
  return (
    <>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>{showProperty ? <th className="py-1.5">Home</th> : null}<th className="py-1.5">Cleaner</th><th>{ATTRIBUTED_TIME_LABEL}</th><th>of 75 h</th><th>Owner hours</th><th>Buffer</th><th>State</th><th /></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={`${c.property_id}-${c.worker_id}`} className="border-t border-border">
              {showProperty ? <td className="py-1.5">{c.property_name}</td> : null}
              <td className="py-1.5">{c.worker_name}</td>
              <td>{hours(c.current_hours)}</td>
              <td><ExposureBar hoursValue={c.current_hours} /></td>
              <td>{hours(c.owner_hours)}</td>
              <td>{c.owner_zero ? "—" : hours(c.buffer_hours)}{c.inversion ? <span className="ml-1 text-xs text-danger">inversion</span> : null}</td>
              <td><StateBadge state={c.state} /></td>
              <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setDetail(c)}>Sources</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {detail ? <EntriesDialog propertyId={detail.property_id ?? null} workerKey={detail.worker_id} title={`${detail.worker_name} · ${detail.property_name ?? "Home"}`} onClose={() => setDetail(null)} onChanged={() => {}} /> : null}
    </>
  );
}

function OverridesLog({ overrides }: { overrides: OverrideRow[] }) {
  return (
    <SectionCard title="Recent overrides" description="Permanent safeguard audit history. Each override applies to one specific clean only.">
      {!overrides.length ? <EmptyState title="No overrides this year" /> : (
        <ul className="divide-y divide-border text-sm">
          {overrides.map((o) => (
            <li key={o.id} className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={o.kind === "emergency" ? "rounded bg-danger px-1.5 text-xs font-semibold text-danger-foreground" : "rounded border border-border px-1.5 text-xs"}>
                  {o.kind === "emergency" ? "EMERGENCY" : "Leadership override"}
                </span>
                <span className="font-medium">{o.worker_name}</span> · {o.property_name} · clean {o.task_ref}{o.scheduled_date ? ` (${usDate(o.scheduled_date)})` : ""}
              </div>
              <div className="text-muted-foreground">
                {OVERRIDE_CATEGORY_LABEL[o.reason_category] ?? o.reason_category}: “{o.justification}” — {o.approved_by_name}, {new Date(o.created_at).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">
                At approval: {STATE_LABEL[o.state_at_approval]} · {hours(o.current_hours)} + {hours(o.projected_clean_hours)} = {hours(o.projected_total_hours)} · owner {hours(o.owner_hours)} · buffer {o.buffer_hours == null ? "—" : hours(o.buffer_hours)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function EnrolledProperties({ props, onChanged }: { props: PortfolioProperty[]; onChanged: () => void }) {
  const { can } = useRole();
  if (!props.length) return <EmptyState title="No homes enrolled yet" hint="Enroll the first STR home under Tracked homes before it goes live in Operations." />;
  return (
    <div className="space-y-4">
      {props.map((p) => {
        const top = p.cleaners[0];
        const state = worstState(p.cleaners.map((c) => c.state));
        return (
          <SectionCard key={p.property_id}
            title={<span className="flex items-center gap-2">{p.name} {p.cleaners.length ? <StateBadge state={state} /> : null}</span>}
            description={
              <span>
                Active owner: {p.owner_name ?? "—"} · Owner hours {hours(p.owner_hours)} · {p.needs_review_entries ? `${p.needs_review_entries} entries need review (lower confidence)` : "Data confidence: reviewed"}
                {" · "}Next clean: {p.next_clean ? `${usDate(p.next_clean.date)} (#${p.next_clean.task_id})` : "none scheduled"}
                {!p.segment_start.endsWith("-01-01") ? ` · Ownership period from ${usDate(p.segment_start)}` : ""}
              </span>
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {can("str_participation_report") ? (
                  <Button size="sm" asChild>
                    <Link to="/str-participation-report" search={{ property: p.property_id }}>Generate Property Participation Report</Link>
                  </Button>
                ) : null}
                <StandardDuration property={p.property_id} minutes={p.standard_clean_minutes} onChanged={onChanged} />
              </div>
            }
          >
            {p.owner_zero ? <p className="mb-2 text-sm text-muted-foreground">{OWNER_ZERO_COPY}</p> : null}
            {top ? (
              <p className="mb-2 text-sm">Top cleaner: <strong>{top.worker_name}</strong> · {hours(top.current_hours)} ({pctOfRestricted(top.current_hours)}% of the 75 h bar){p.owner_zero ? "" : ` · buffer ${hours(top.buffer_hours)}`}</p>
            ) : null}
            {p.cleaners.length ? <CellTable rows={p.cleaners.map((c) => ({ ...c, property_id: p.property_id, property_name: p.name }))} /> : <EmptyState title="No cleaner time recorded yet this year" />}
          </SectionCard>
        );
      })}
    </div>
  );
}

function StandardDuration({ property, minutes, onChanged }: { property: string; minutes: number | null; onChanged: () => void }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(minutes ? String(minutes / 60) : "");
  const save = async () => {
    const { error } = await db.rpc("cleaner_set_standard_duration", { _property: property, _minutes: val ? Math.round(Number(val) * 60) : null });
    if (error) { toast.error(error.message); return; }
    setEdit(false); onChanged();
  };
  if (!edit) return <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Standard clean: {minutes ? hours(minutes / 60) : "not set (4.0 h default)"}</Button>;
  return (
    <div className="flex items-center gap-2">
      <Input className="h-8 w-20" type="number" step="0.25" min={0.5} max={12} value={val} onChange={(e) => setVal(e.target.value)} placeholder="hours" />
      <Button size="sm" onClick={save}>Save</Button>
      <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
    </div>
  );
}

function CleanerRoster({ props }: { props: PortfolioProperty[] }) {
  const [rotationHome, setRotationHome] = useState("");
  const byWorker = new Map<string, { name: string; homes: number; total: number; max?: Cell & { property_name: string } }>();
  for (const p of props) for (const c of p.cleaners) {
    const r = byWorker.get(c.worker_id) ?? { name: c.worker_name ?? "Cleaner", homes: 0, total: 0 };
    r.homes += 1; r.total += Number(c.current_hours ?? 0);
    if (!r.max || Number(c.current_hours) > Number(r.max.current_hours)) r.max = { ...c, property_name: p.name };
    byWorker.set(c.worker_id, r);
  }
  const rows = [...byWorker.entries()].sort((a, b) => b[1].total - a[1].total);
  return (
    <div className="space-y-4">
      <SectionCard title="Cleaner roster" description="Individual cleaners (classification: Individual) with Attributed Cleaner Time at enrolled STR homes.">
        {!rows.length ? <EmptyState title="No individual cleaner time recorded yet" /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Cleaner</th><th>Classification</th><th>STR homes worked</th><th>Highest home</th><th>Status there</th><th>Portfolio {ATTRIBUTED_TIME_LABEL}</th></tr></thead>
            <tbody>
              {rows.map(([id, r]) => (
                <tr key={id} className="border-t border-border">
                  <td className="py-1.5">{r.name}</td><td>Individual</td><td>{r.homes}</td>
                  <td>{r.max?.property_name} · {hours(r.max?.current_hours)}</td>
                  <td>{r.max ? <StateBadge state={r.max.state} /> : null}</td>
                  <td>{hours(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
      <SectionCard title="Cleaner rotation aid" description="Pick a home to see cleaners sorted by lowest exposure there first."
        actions={
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={rotationHome} onChange={(e) => setRotationHome(e.target.value)}>
            <option value="">Choose a home…</option>
            {props.filter((p) => p.active).map((p) => <option key={p.property_id} value={p.property_id}>{p.name}</option>)}
          </select>
        }>
        {rotationHome ? <RotationAid property={rotationHome} date={null} /> : <p className="text-sm text-muted-foreground">Choose a home.</p>}
      </SectionCard>
    </div>
  );
}

type Entry = {
  id: string; entry_key: string; worker_id: string | null; breezeway_person_id: number | null; breezeway_person_name: string | null;
  property_id: string | null; completion_date: string; breezeway_task_id: number | null; assignee_count: number | null;
  raw_elapsed_seconds: number | null; attributed_minutes: number | null; original_minutes: number | null; attribution_method: string;
  review_state: string; confidence: string; source_revision: string | null; synced_at: string; superseded_at: string | null;
  superseded_reason: string | null; reason: string | null; author_name: string | null; created_at: string; supersedes_id: string | null;
};

function EntriesDialog({ propertyId, workerKey: wk, taskId, title, onClose, onChanged }: {
  propertyId?: string | null; workerKey?: string | null; taskId?: number | null; title: string; onClose: () => void; onChanged: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const entries = useQuery({
    queryKey: ["cleaner-hours", "entries", propertyId, wk, taskId, showHistory],
    queryFn: () =>
      fetchAll<Entry>("cleaner_exposure_ledger", (q) => {
        let b = q.select("*").eq("is_fixture", false).order("completion_date", { ascending: false }).order("created_at", { ascending: false });
        if (!showHistory) b = b.is("superseded_at", null);
        if (taskId != null) b = b.eq("breezeway_task_id", taskId);
        if (propertyId) b = b.eq("property_id", propertyId);
        if (wk?.startsWith("bz:")) b = b.eq("breezeway_person_id", Number(wk.slice(3))).is("worker_id", null);
        else if (wk && !wk.startsWith("name:")) b = b.eq("worker_id", wk);
        return b;
      }),
  });
  const [correcting, setCorrecting] = useState<Entry | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} /> Show superseded history
        </label>
        <div className="max-h-[60vh] overflow-auto">
          {entries.isLoading ? <LoadingRows /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th>Completed</th><th>Breezeway Task</th><th>Breezeway person</th><th>Elapsed Task time</th><th>{ATTRIBUTED_TIME_LABEL}</th><th>Method</th><th>State</th><th /></tr>
              </thead>
              <tbody>
                {(entries.data ?? []).map((e) => (
                  <tr key={e.id} className={`border-t border-border align-top ${e.superseded_at ? "opacity-60" : ""}`}>
                    <td className="py-1.5">{usDate(e.completion_date)}</td>
                    <td>{e.breezeway_task_id ?? "Manual"}{e.assignee_count ? <div className="text-xs text-muted-foreground">{e.assignee_count} on Task</div> : null}</td>
                    <td>{e.breezeway_person_name ?? "—"}{e.breezeway_person_id ? <div className="text-xs text-muted-foreground">#{e.breezeway_person_id}</div> : null}</td>
                    <td>{e.breezeway_task_id ? formatElapsed(e.raw_elapsed_seconds) : "—"}</td>
                    <td>
                      {formatMinutes(e.attributed_minutes)}
                      {e.original_minutes != null || e.attribution_method === "manual_correction" ? <div className="text-xs text-muted-foreground">was {formatMinutes(e.original_minutes)}</div> : null}
                    </td>
                    <td className="max-w-56">
                      {METHOD_LABEL[e.attribution_method] ?? e.attribution_method}
                      {e.reason ? <div className="text-xs text-muted-foreground">“{e.reason}” — {e.author_name}</div> : null}
                      {e.superseded_at ? <div className="text-xs text-muted-foreground">Superseded {usDate(e.superseded_at)}: {e.superseded_reason}</div> : null}
                      <div className="text-xs text-muted-foreground">Source revision {e.source_revision ? new Date(e.source_revision).toLocaleString() : "—"} · synced {new Date(e.synced_at).toLocaleString()}</div>
                    </td>
                    <td>{REVIEW_STATE_LABEL[e.review_state] ?? e.review_state}</td>
                    <td>{!e.superseded_at && e.attribution_method !== "company_account_not_counted" ? <Button size="sm" variant="outline" onClick={() => setCorrecting(e)}>Correct</Button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {correcting ? <CorrectDialog entry={correcting} onClose={() => setCorrecting(null)} onDone={() => { setCorrecting(null); entries.refetch(); onChanged(); }} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function useWorkers() {
  return useQuery({
    queryKey: ["cleaner-hours", "workers"],
    queryFn: () => fetchAll<{ id: string; display_name: string; account_type: string; active: boolean }>("cleaner_workers", (q) => q.select("id, display_name, account_type, active").order("display_name")),
  });
}

function WorkerSelect({ value, onChange, type }: { value: string; onChange: (v: string) => void; type?: "individual" | "company" }) {
  const workers = useWorkers();
  return (
    <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Choose a worker…</option>
      {(workers.data ?? []).filter((w) => !type || w.account_type === type).map((w) => (
        <option key={w.id} value={w.id}>{w.display_name}{w.account_type === "company" ? " (company)" : ""}{w.active ? "" : " — inactive"}</option>
      ))}
    </select>
  );
}

function CorrectDialog({ entry, onClose, onDone }: { entry: Entry; onClose: () => void; onDone: () => void }) {
  const [minutes, setMinutes] = useState(String(entry.attributed_minutes ?? Math.round((entry.raw_elapsed_seconds ?? 0) / 60)));
  const [worker, setWorker] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await db.rpc("correct_cleaner_exposure", { _entry: entry.id, _minutes: Number(minutes), _worker_id: worker || null, _reason: reason });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Correction saved; the original entry is kept in history.");
    onDone();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Correct {ATTRIBUTED_TIME_LABEL}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          Breezeway elapsed Task time: {formatElapsed(entry.raw_elapsed_seconds)}. Current attributed: {formatMinutes(entry.attributed_minutes)}.
        </p>
        <label className="text-sm font-medium">Corrected minutes</label>
        <Input type="number" min={0} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        <label className="text-sm font-medium">Actual individual cleaner (optional — use when a company account was recorded)</label>
        <WorkerSelect value={worker} onChange={setWorker} type="individual" />
        <label className="text-sm font-medium">Reason and evidence (required)</label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Vendor timesheet shows Maria on site 2 h 10 m" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={busy || reason.trim().length < 5} onClick={save}>Save correction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualEntryButton({ propName, onDone }: { propName: Map<string, string>; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [worker, setWorker] = useState("");
  const [property, setProperty] = useState("");
  const [date, setDate] = useState("");
  const [minutes, setMinutes] = useState("");
  const [reason, setReason] = useState("");
  const homes = useQuery({
    queryKey: ["cleaner-hours", "homes"],
    queryFn: () => fetchAll<{ property_id: string; active: boolean; is_fixture: boolean }>("cleaner_hours_properties", (q) => q.select("*").eq("is_fixture", false)),
  });
  const save = async () => {
    const { error } = await db.rpc("add_manual_cleaner_clean", { _worker_id: worker, _property_id: property, _date: date, _minutes: Number(minutes), _reason: reason });
    if (error) { toast.error(error.message); return; }
    toast.success("Off-Breezeway clean added and sent to the review queue.");
    setOpen(false); setWorker(""); setProperty(""); setDate(""); setMinutes(""); setReason("");
    onDone();
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Add off-Breezeway clean</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a clean not recorded in Breezeway</DialogTitle></DialogHeader>
          <label className="text-sm font-medium">Individual cleaner</label>
          <WorkerSelect value={worker} onChange={setWorker} type="individual" />
          <label className="text-sm font-medium">Tracked home</label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={property} onChange={(e) => setProperty(e.target.value)}>
            <option value="">Choose a home…</option>
            {(homes.data ?? []).filter((h) => h.active).map((h) => <option key={h.property_id} value={h.property_id}>{propName.get(h.property_id) ?? h.property_id}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Date</label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="text-sm font-medium">Minutes</label><Input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} /></div>
          </div>
          <label className="text-sm font-medium">Where is this clean documented? (required)</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!worker || !property || !date || !minutes || reason.trim().length < 5} onClick={save}>Add clean</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type ReviewItem = {
  id: string; kind: string; status: string; breezeway_task_id: number | null; breezeway_person_id: number | null;
  property_id: string | null; detail: Record<string, unknown>; created_at: string; resolution_note: string | null; resolved_by_name: string | null;
};

function ReviewQueue({ propName, onChanged }: { propName: Map<string, string>; onChanged: () => void }) {
  const [status, setStatus] = useState<"open" | "closed">("open");
  const items = useQuery({
    queryKey: ["cleaner-hours", "review", status],
    queryFn: () => fetchAll<ReviewItem>("cleaner_review_items", (q) => {
      const b = q.select("*").eq("is_fixture", false).order("created_at", { ascending: false });
      return status === "open" ? b.eq("status", "open") : b.neq("status", "open");
    }),
  });
  const [closing, setClosing] = useState<{ item: ReviewItem; to: "resolved" | "dismissed" } | null>(null);
  const [task, setTask] = useState<number | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const openAccount = async (person: number) => {
    const { data, error } = await db.from("cleaner_breezeway_accounts").select("*").eq("breezeway_person_id", person).maybeSingle();
    if (error || !data) { toast.error("That Breezeway account could not be found."); return; }
    setAccount(data as Account);
  };
  return (
    <SectionCard
      title="Review queue"
      description="Records that cannot be attributed automatically. None of these are treated as zero; they stay here until a person decides."
      actions={<SegmentedControl ariaLabel="Status" value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "closed", label: "Closed" }]} />}
    >
      {items.isLoading ? <LoadingRows /> : !(items.data ?? []).length ? <EmptyState title={status === "open" ? "Nothing to review" : "No closed items"} /> : (
        <ul className="divide-y divide-border">
          {(items.data ?? []).map((i) => (
            <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 text-sm">
                <div className="font-medium">{REVIEW_KIND_LABEL[i.kind] ?? i.kind}</div>
                <div className="text-muted-foreground">
                  {i.property_id ? propName.get(i.property_id) ?? "Home" : ""}
                  {i.breezeway_task_id ? ` · Breezeway Task ${i.breezeway_task_id}` : ""}
                  {i.breezeway_person_id ? ` · Breezeway person #${i.breezeway_person_id}` : ""}
                  {typeof i.detail?.["name"] === "string" ? ` · ${i.detail["name"]}` : ""}
                  {typeof i.detail?.["total_time"] === "string" ? ` · elapsed ${i.detail["total_time"]}` : ""}
                  {typeof i.detail?.["reason"] === "string" ? ` · “${i.detail["reason"]}”` : ""}
                  {` · raised ${usDate(i.created_at)}`}
                </div>
                {i.resolution_note ? <div className="text-xs text-muted-foreground">{i.status}: {i.resolution_note} {i.resolved_by_name ? `— ${i.resolved_by_name}` : "(automatic)"}</div> : null}
              </div>
              {i.status === "open" ? (
                <div className="flex gap-2">
                  {i.breezeway_task_id ? <Button size="sm" variant="ghost" onClick={() => setTask(i.breezeway_task_id)}>Entries</Button> : null}
                  {(i.kind === "unclassified_assignee" || i.kind === "possible_duplicate_identity") && i.breezeway_person_id != null ? (
                    <Button size="sm" onClick={() => openAccount(i.breezeway_person_id!)}>Classify account</Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => setClosing({ item: i, to: "resolved" })}>Mark reviewed</Button>
                  <Button size="sm" variant="ghost" onClick={() => setClosing({ item: i, to: "dismissed" })}>Dismiss</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {closing ? <CloseReview {...closing} onClose={() => setClosing(null)} onDone={() => { setClosing(null); items.refetch(); onChanged(); }} /> : null}
      {account ? <ClassifyDialog account={account} onClose={() => setAccount(null)} onDone={() => { setAccount(null); items.refetch(); onChanged(); }} /> : null}
      {task != null ? <EntriesDialog taskId={task} title={`Breezeway Task ${task}`} onClose={() => setTask(null)} onChanged={() => { items.refetch(); onChanged(); }} /> : null}
    </SectionCard>
  );
}

function CloseReview({ item, to, onClose, onDone }: { item: ReviewItem; to: "resolved" | "dismissed"; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState("");
  const save = async () => {
    const { error } = await db.rpc("resolve_cleaner_review", { _id: item.id, _status: to, _note: note });
    if (error) { toast.error(error.message); return; }
    onDone();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{to === "resolved" ? "Mark reviewed" : "Dismiss"}: {REVIEW_KIND_LABEL[item.kind]}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">To change the attributed amount or the cleaner, use Correct on the entry first. Classify accounts under Cleaner accounts.</p>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you check, and what did you decide?" />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={note.trim().length < 5} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Account = {
  breezeway_person_id: number; last_seen_name: string | null; classification: string; worker_id: string | null;
  classification_note: string | null; last_seen_at: string;
};

function AccountsView({ onChanged }: { onChanged: () => void }) {
  const accounts = useQuery({
    queryKey: ["cleaner-hours", "accounts"],
    queryFn: () => fetchAll<Account>("cleaner_breezeway_accounts", (q) => q.select("*").order("last_seen_name")),
  });
  const workers = useWorkers();
  const workerName = new Map((workers.data ?? []).map((w) => [w.id, w.display_name]));
  const [editing, setEditing] = useState<Account | null>(null);
  return (
    <SectionCard
      title="Cleaner accounts seen on tracked Breezeway cleans"
      description="Classify each Breezeway account yourself. Resolve never decides individual vs company from the Breezeway role or name, and never merges people by name."
    >
      {accounts.isLoading ? <LoadingRows /> : !(accounts.data ?? []).length ? (
        <EmptyState title="No cleaner accounts yet" hint="Accounts appear here once a tracked home's clean comes in from Breezeway." />
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Breezeway account</th><th>ID</th><th>Classification</th><th>Resolve worker</th><th>Last seen</th><th /></tr></thead>
          <tbody>
            {(accounts.data ?? []).map((a) => (
              <tr key={a.breezeway_person_id} className="border-t border-border">
                <td className="py-1.5">{a.last_seen_name ?? "—"}</td>
                <td>#{a.breezeway_person_id}</td>
                <td>{a.classification === "unclassified" || a.classification === "unknown" ? <Badge variant="outline">{CLASSIFICATION_LABEL[a.classification]}</Badge> : CLASSIFICATION_LABEL[a.classification]}</td>
                <td>{a.worker_id ? workerName.get(a.worker_id) ?? "—" : "—"}</td>
                <td>{usDate(a.last_seen_at)}</td>
                <td className="text-right"><Button size="sm" variant="outline" onClick={() => setEditing(a)}>Classify</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing ? <ClassifyDialog account={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); accounts.refetch(); workers.refetch(); onChanged(); }} /> : null}
    </SectionCard>
  );
}

function ClassifyDialog({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: () => void }) {
  const [cls, setCls] = useState(account.classification === "unclassified" ? "individual" : account.classification);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [worker, setWorker] = useState("");
  const [name, setName] = useState(account.last_seen_name ?? "");
  const [note, setNote] = useState("");
  const needsWorker = cls === "individual" || cls === "company" || cls === "duplicate";
  const save = async () => {
    const useExisting = cls === "duplicate" || mode === "existing";
    const { data, error } = await db.rpc("classify_cleaner_account", {
      _person: account.breezeway_person_id, _classification: cls,
      _worker_id: needsWorker && useExisting ? worker || null : null,
      _new_worker_name: needsWorker && !useExisting ? name : null, _note: note || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Saved. ${(data as { tasks_recalculated?: number })?.tasks_recalculated ?? 0} clean(s) recalculated.`);
    onDone();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Classify {account.last_seen_name ?? "account"} (#{account.breezeway_person_id})</DialogTitle></DialogHeader>
        <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={cls} onChange={(e) => setCls(e.target.value)}>
          {["individual", "company", "duplicate", "unknown"].map((c) => <option key={c} value={c}>{CLASSIFICATION_LABEL[c]}</option>)}
        </select>
        {needsWorker && cls !== "duplicate" ? (
          <SegmentedControl ariaLabel="Worker" value={mode} onChange={setMode} options={[{ value: "new", label: "New worker record" }, { value: "existing", label: "Link existing worker" }]} />
        ) : null}
        {needsWorker && (cls === "duplicate" || mode === "existing") ? (
          <WorkerSelect value={worker} onChange={setWorker} {...(cls === "duplicate" ? {} : { type: cls as "individual" | "company" })} />
        ) : null}
        {needsWorker && cls !== "duplicate" && mode === "new" ? <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Worker display name" /> : null}
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={cls === "duplicate" ? "How did you confirm these accounts are the same person? (required)" : "Note (optional)"} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={(cls === "duplicate" && (!worker || note.trim().length < 5)) || (needsWorker && mode === "existing" && cls !== "duplicate" && !worker)} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TrackedHomes({ propName, properties, onChanged }: {
  propName: Map<string, string>; properties: { id: string; name: string | null; breezeway_mapping_state: string | null }[]; onChanged: () => void;
}) {
  const homes = useQuery({
    queryKey: ["cleaner-hours", "homes"],
    queryFn: () => fetchAll<{ property_id: string; active: boolean; tracking_from: string; note: string | null; is_fixture: boolean; ended_at: string | null }>(
      "cleaner_hours_properties", (q) => q.select("*").eq("is_fixture", false)),
  });
  const runs = useQuery({
    queryKey: ["cleaner-hours", "runs"],
    queryFn: async () => (await db.from("cleaner_sync_runs").select("*").eq("kind", "nightly").order("started_at", { ascending: false }).limit(3)).data ?? [],
  });
  const [property, setProperty] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const change = async (id: string, active: boolean, start: string | null, why: string) => {
    const { error } = await db.rpc("set_cleaner_hours_participation", { _property: id, _active: active, _tracking_from: start, _note: why });
    if (error) { toast.error(error.message); return; }
    toast.success(active ? "Home enrolled in STR cleaner-hours tracking." : "Tracking stopped; history is kept.");
    setProperty(""); setNote("");
    homes.refetch(); onChanged();
  };
  const verified = properties.filter((p) => p.breezeway_mapping_state === "verified");
  return (
    <div className="space-y-4">
      <SectionCard
        title="Homes in the STR cleaner-hours safeguard"
        description="Only enrolled homes are tracked, from their start date forward. MTR and standard homes are never pulled in just because they have Breezeway cleans."
      >
        {!(homes.data ?? []).length ? <EmptyState title="No homes enrolled yet" hint="Enroll the first STR home before it goes live in Operations." /> : (
          <ul className="divide-y divide-border">
            {(homes.data ?? []).map((h) => (
              <li key={h.property_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{propName.get(h.property_id) ?? h.property_id}</div>
                  <div className="text-muted-foreground">{h.active ? `Tracking from ${usDate(h.tracking_from)}` : `Stopped ${h.ended_at ? usDate(h.ended_at) : ""}`}{h.note ? ` · ${h.note}` : ""}</div>
                </div>
                {h.active ? (
                  <Button size="sm" variant="ghost" onClick={() => { const why = window.prompt("Why is tracking stopping for this home?"); if (why) change(h.property_id, false, null, why); }}>Stop tracking</Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard title="Enroll a home" description="Requires a verified Breezeway match. The start date can be today or up to 45 days back.">
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={property} onChange={(e) => setProperty(e.target.value)}>
            <option value="">Choose a home…</option>
            {verified.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this home is enrolled (required)" />
        </div>
        <div className="mt-3"><Button disabled={!property || note.trim().length < 5} onClick={() => change(property, true, from, note)}>Enroll home</Button></div>
      </SectionCard>
      <SectionCard title="Breezeway sync" description="Live updates arrive from Breezeway as cleans change. A nightly check around 2 a.m. Central re-reads the last 45 days for enrolled homes to catch anything missed.">
        {!(runs.data ?? []).length ? <p className="text-sm text-muted-foreground">No nightly check has run yet.</p> : (
          <ul className="text-sm">
            {(runs.data as { id: string; window_to: string; status: string; cursor: number; home_queue: unknown[]; tasks_seen: number; errors: unknown[] }[]).map((r) => (
              <li key={r.id}>{usDate(r.window_to)} — {r.status} · {r.cursor}/{r.home_queue.length} homes · {r.tasks_seen} cleans checked{r.errors.length ? ` · ${r.errors.length} errors` : ""}</li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
