import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
  formatElapsed,
  formatMinutes,
  groupSummary,
  workerKey,
  type SummaryRow,
} from "@/lib/cleaner-hours";
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

type Tab = "property" | "worker" | "review" | "accounts" | "homes";
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
  const [tab, setTab] = useState<Tab>("property");
  const year = new Date().getFullYear();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["cleaner-hours"] });

  const summary = useQuery({
    queryKey: ["cleaner-hours", "summary", year],
    queryFn: () => fetchAll<SummaryRow>("cleaner_exposure_summary", (q) => q.select("*").eq("year", year)),
  });
  const homes = useQuery({
    queryKey: ["cleaner-hours", "homes"],
    queryFn: () => fetchAll<{ property_id: string; active: boolean; tracking_from: string; note: string | null; is_fixture: boolean }>(
      "cleaner_hours_properties", (q) => q.select("*").eq("is_fixture", false)),
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

  const rows = summary.data ?? [];
  const activeHomes = (homes.data ?? []).filter((h) => h.active);
  const totalMinutes = rows.reduce((s, r) => s + Number(r.attributed_minutes ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations · Internal"
        title="STR cleaner time"
        description={
          <>
            {ATTRIBUTED_TIME_LABEL} at homes enrolled in the STR cleaner-hours safeguard. Each cleaner on a Breezeway clean
            is attributed the full elapsed Task time — a conservative exposure figure, not hours worked. No tax or
            qualification conclusions are made here.
          </>
        }
        actions={<ManualEntryButton propName={propName} onDone={refresh} />}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Homes tracked" value={activeHomes.length} hint={activeHomes.length ? undefined : "No STR home enrolled yet"} />
        <StatTile label={`${ATTRIBUTED_TIME_LABEL} ${year}`} value={formatMinutes(totalMinutes)} />
        <StatTile label="Cleaners with exposure" value={new Set(rows.map(workerKey)).size} />
        <StatTile label="Open review items" value={openItems.data ?? "—"} tone={(openItems.data ?? 0) > 0 ? "attention" : "neutral"} />
      </div>

      <SegmentedControl<Tab>
        ariaLabel="View"
        value={tab}
        onChange={setTab}
        options={[
          { value: "property", label: "By home" },
          { value: "worker", label: "By cleaner" },
          { value: "review", label: "Review queue", count: openItems.data ?? 0 },
          { value: "accounts", label: "Cleaner accounts" },
          { value: "homes", label: "Tracked homes" },
        ]}
      />

      {tab === "property" || tab === "worker" ? (
        summary.isLoading ? <LoadingRows /> : summary.error ? (
          <EmptyState title="Could not load cleaner time" hint={(summary.error as Error).message} />
        ) : (
          <SummaryView rows={rows} by={tab} propName={propName} year={year} onChanged={refresh} />
        )
      ) : null}
      {tab === "review" ? <ReviewQueue propName={propName} onChanged={refresh} /> : null}
      {tab === "accounts" ? <AccountsView onChanged={refresh} /> : null}
      {tab === "homes" ? <TrackedHomes propName={propName} properties={properties.data ?? []} onChanged={refresh} /> : null}
    </div>
  );
}

function SummaryView({ rows, by, propName, year, onChanged }: {
  rows: SummaryRow[]; by: "property" | "worker"; propName: Map<string, string>; year: number; onChanged: () => void;
}) {
  const owner = useQuery({
    queryKey: ["cleaner-hours", "owner", year],
    enabled: by === "property",
    queryFn: () => fetchAll<{ property_id: string; owner_minutes: number }>("cleaner_owner_hours_by_property", (q) => q.select("*").eq("year", year)),
  });
  const ownerBy = new Map((owner.data ?? []).map((o) => [o.property_id, Number(o.owner_minutes)]));
  const [detail, setDetail] = useState<{ propertyId: string | null; workerKey: string | null; title: string } | null>(null);
  const groups = groupSummary(rows, by);
  if (!groups.length) {
    return <EmptyState title="No cleaner time recorded yet" hint="Tracking starts when a home is enrolled under Tracked homes and its next Breezeway clean finishes." />;
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const title = by === "property" ? propName.get(g.key) ?? "Unmatched home" : g.rows[0]!.worker_name;
        return (
          <SectionCard
            key={g.key}
            title={title}
            description={
              <span>
                {ATTRIBUTED_TIME_LABEL}: <strong>{formatMinutes(g.minutes)}</strong> · {g.cleans} clean{g.cleans === 1 ? "" : "s"}
                {g.unknown ? ` · ${g.unknown} with unknown time` : ""}
                {by === "property" ? ` · Owner hours logged in Active Owner: ${ownerBy.has(g.key) ? formatMinutes(ownerBy.get(g.key)) : "none"}` : ""}
                {by === "worker" && g.rows[0]!.worker_type !== "individual" ? ` · ${CLASSIFICATION_LABEL[g.rows[0]!.worker_type] ?? g.rows[0]!.worker_type}` : ""}
              </span>
            }
            tone={g.unreviewed ? "attention" : "default"}
          >
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5">{by === "property" ? "Cleaner" : "Home"}</th>
                  <th>{ATTRIBUTED_TIME_LABEL}</th>
                  <th>Cleans</th>
                  <th>Reviewed / needs review</th>
                  <th>Most recent</th>
                  <th>Confidence</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={`${r.property_id}-${workerKey(r)}`} className="border-t border-border">
                    <td className="py-1.5">{by === "property" ? r.worker_name : propName.get(r.property_id ?? "") ?? "Unmatched home"}</td>
                    <td>{formatMinutes(r.attributed_minutes)}</td>
                    <td>{r.cleans}</td>
                    <td>{r.reviewed_entries} / {r.unreviewed_entries ? <Badge variant="outline">{r.unreviewed_entries} needs review</Badge> : 0}</td>
                    <td>{r.last_clean ? usDate(r.last_clean) : "—"}</td>
                    <td className="capitalize">{r.lowest_confidence}</td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetail({ propertyId: r.property_id, workerKey: workerKey(r), title: `${r.worker_name} · ${propName.get(r.property_id ?? "") ?? "Home"}` })}>
                        Sources
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        );
      })}
      {detail ? <EntriesDialog {...detail} onClose={() => setDetail(null)} onChanged={onChanged} /> : null}
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
                  <Button size="sm" variant="outline" onClick={() => setClosing({ item: i, to: "resolved" })}>Mark reviewed</Button>
                  <Button size="sm" variant="ghost" onClick={() => setClosing({ item: i, to: "dismissed" })}>Dismiss</Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {closing ? <CloseReview {...closing} onClose={() => setClosing(null)} onDone={() => { setClosing(null); items.refetch(); onChanged(); }} /> : null}
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
