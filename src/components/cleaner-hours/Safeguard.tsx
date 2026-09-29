import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, LoadingRows, SectionCard } from "@/components/ui/page";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ATTRIBUTED_TIME_LABEL,
  EMERGENCY_OVERRIDE_CATEGORIES,
  ESTIMATE_SOURCE_LABEL,
  MANAGER_OVERRIDE_CATEGORIES,
  OWNER_ZERO_COPY,
  STATE_BADGE,
  STATE_GUIDANCE,
  STATE_LABEL,
  hours,
  pctOfRestricted,
  type Evaluation,
  type SafeguardState,
} from "@/lib/cleaner-hours";

export const rpc = supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => any };

export function StateBadge({ state, className }: { state: SafeguardState; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATE_BADGE[state], className)}>
      {STATE_LABEL[state]}
    </span>
  );
}

export function ExposureBar({ hoursValue }: { hoursValue: number | string | null | undefined }) {
  const pct = pctOfRestricted(hoursValue);
  return (
    <div className="flex items-center gap-2" title={`${pct}% of the 75 h Restricted threshold`}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full", pct >= 100 ? "bg-danger" : pct >= 67 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

/** Current attributed / estimated clean / projected total, kept visibly separate. */
export function EvaluationSummary({ ev }: { ev: Evaluation }) {
  if (!ev.enrolled || ev.state === "identity_required") {
    return (
      <div className="rounded-md border border-border p-3 text-sm">
        <StateBadge state={ev.state} /> <span className="ml-2">{STATE_GUIDANCE[ev.state]}</span>
      </div>
    );
  }
  const banner =
    ev.state === "hard_block" ? "border-danger bg-danger/10" :
    ev.state === "restricted" ? "border-danger/50 bg-danger/5" :
    ev.state === "warning" ? "border-warning/60 bg-warning/10" :
    ev.state === "monitor" ? "border-info/40 bg-info/5" : "border-border";
  return (
    <div className={cn("space-y-3 rounded-md border p-3", banner)}>
      <div className="flex flex-wrap items-center gap-2">
        <StateBadge state={ev.state} />
        {ev.inversion ? <span className="text-xs font-medium text-danger">Hours inversion — Attributed Cleaner Time is at or above owner hours</span> : null}
      </div>
      <p className="text-sm">{STATE_GUIDANCE[ev.state]}</p>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div><dt className="text-xs text-muted-foreground">Current {ATTRIBUTED_TIME_LABEL}</dt><dd className="font-medium">{hours(ev.current_hours)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Estimated clean impact</dt><dd className="font-medium">+ {hours(ev.projected_clean_hours)}</dd>
          <dd className="text-xs text-muted-foreground">{ESTIMATE_SOURCE_LABEL[ev.estimate_source ?? ""] ?? ev.estimate_source}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Projected total</dt><dd className="font-semibold">{hours(ev.projected_total_hours)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Owner hours {ev.year}</dt><dd className="font-medium">{hours(ev.owner_hours)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Owner participation buffer</dt><dd className="font-medium">{ev.owner_zero ? "—" : hours(ev.buffer_hours)}</dd></div>
      </dl>
      {ev.owner_zero ? <p className="text-xs text-muted-foreground">{OWNER_ZERO_COPY}</p> : null}
      {ev.segment_start && !ev.segment_start.endsWith("-01-01") ? (
        <p className="text-xs text-muted-foreground">Compared from the current ownership period starting {ev.segment_start}{ev.owner_name ? ` (${ev.owner_name})` : ""}.</p>
      ) : null}
    </div>
  );
}

export function OverrideDialog({
  kind, propertyId, workerId, workerName, taskRef, scheduled, breezewayTaskId, ev, onClose, onDone,
}: {
  kind: "manager" | "emergency"; propertyId: string; workerId: string; workerName: string; taskRef: string; scheduled: string | null;
  breezewayTaskId: number | null; ev: Evaluation; onClose: () => void; onDone: () => void;
}) {
  const cats = kind === "emergency" ? EMERGENCY_OVERRIDE_CATEGORIES : MANAGER_OVERRIDE_CATEGORIES;
  const [category, setCategory] = useState("");
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await rpc.rpc("cleaner_safeguard_override", {
      _kind: kind, _property: propertyId, _worker: workerId, _task_ref: taskRef, _scheduled: scheduled, _category: category,
      _justification: why, _breezeway_task_id: breezewayTaskId,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(kind === "emergency" ? "Emergency override recorded for this one clean." : "Override recorded for this one clean.");
    onDone();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "emergency" ? "Emergency override — one clean only" : "Leadership override — one clean only"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p><strong>{workerName}</strong> · clean <strong>{taskRef}</strong>{scheduled ? ` on ${scheduled}` : ""}</p>
          <p className="text-muted-foreground">
            {hours(ev.current_hours)} current + {hours(ev.projected_clean_hours)} estimated = {hours(ev.projected_total_hours)} projected {ATTRIBUTED_TIME_LABEL}.
            Owner hours {hours(ev.owner_hours)}{ev.owner_zero ? "" : `, buffer ${hours(ev.buffer_hours)}`}.
          </p>
          {kind === "emergency" ? (
            <p className="rounded-md border border-danger bg-danger/10 p-2 font-medium text-danger">
              This allows this single clean only. {workerName} remains Hard Blocked for all future standard assignments at this home.
              Leadership is alerted immediately and this override stays permanently in the safeguard audit history.
            </p>
          ) : (
            <p className="text-muted-foreground">This allows this single clean only. The cleaner stays Restricted for other cleans.</p>
          )}
        </div>
        <label className="text-sm font-medium">{kind === "emergency" ? "Emergency reason category" : "Reason category"}</label>
        <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Choose…</option>
          {cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <label className="text-sm font-medium">Detailed justification (at least 25 characters)</label>
        <Textarea value={why} onChange={(e) => setWhy(e.target.value)} />
        <p className="text-xs text-muted-foreground">{why.trim().length}/25</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={kind === "emergency" ? "destructive" : "default"} disabled={busy || !category || why.trim().length < 25} onClick={save}>
            {kind === "emergency" ? "Approve emergency clean" : "Approve this clean"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RotationAid({ property, date }: { property: string; date: string | null }) {
  const q = useQuery({
    queryKey: ["cleaner-dispatch", "rotation", property, date],
    queryFn: async () => {
      const { data, error } = await rpc.rpc("cleaner_rotation", { _property: property, _on: date });
      if (error) throw new Error(error.message);
      return data as Evaluation[];
    },
  });
  const rows = useMemo(() => q.data ?? [], [q.data]);
  return (
    <SectionCard title="Cleaner rotation aid" description="Individual cleaners at this home, lowest projected Attributed Cleaner Time first.">
      {q.isLoading ? <LoadingRows /> : !rows.length ? <EmptyState title="No individual cleaners on record yet" /> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1.5">Cleaner</th><th>Current</th><th>Projected with next clean</th><th>State</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.worker_id} className="border-t border-border">
                <td className="py-1.5">{r.worker_name}</td><td>{hours(r.current_hours)}</td><td>{hours(r.projected_total_hours)}</td>
                <td><StateBadge state={r.state as SafeguardState} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
}
