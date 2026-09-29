import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadingRows, PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EvaluationSummary, OverrideDialog, StateBadge, rpc } from "@/components/cleaner-hours/Safeguard";
import { hours, worstState, type Evaluation, type SafeguardState } from "@/lib/cleaner-hours";

export const Route = createFileRoute("/_authenticated/str-dispatch-check")({
  head: () => ({
    meta: [
      { title: "STR cleaner check — Resolve" },
      { name: "description", content: "Check the STR cleaner-hours operational safeguard before assigning a cleaner to an enrolled STR home." },
      { property: "og:title", content: "STR cleaner check — Resolve" },
      { property: "og:description", content: "Operational safeguard check before dispatching a cleaner to an STR home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="cleaner_dispatch_check">
      <DispatchCheckPage />
    </RequireCapability>
  ),
});

type Options = {
  homes: { property_id: string; name: string; is_fixture: boolean }[];
  workers: { id: string; name: string; type: "individual" | "company" }[];
  tasks: { task_id: number; property_id: string; name: string | null; scheduled_date: string | null }[];
};

function DispatchCheckPage() {
  const options = useQuery({
    queryKey: ["cleaner-dispatch", "options"],
    queryFn: async () => {
      const { data, error } = await rpc.rpc("cleaner_dispatch_options");
      if (error) throw new Error(error.message);
      return data as Options;
    },
  });
  const [property, setProperty] = useState("");
  const [taskChoice, setTaskChoice] = useState("");
  const [manualRef, setManualRef] = useState("");
  const [scheduled, setScheduled] = useState("");
  const [worker, setWorker] = useState("");
  const [individuals, setIndividuals] = useState<string[]>([]);

  const homes = (options.data?.homes ?? []).filter((h) => !h.is_fixture);
  const tasks = (options.data?.tasks ?? []).filter((t) => t.property_id === property);
  const workers = options.data?.workers ?? [];
  const selectedWorker = workers.find((w) => w.id === worker);
  const task = tasks.find((t) => String(t.task_id) === taskChoice);
  const taskRef = task ? String(task.task_id) : manualRef.trim();
  const date = task?.scheduled_date ?? (scheduled || null);
  const isCompany = selectedWorker?.type === "company";
  const checkIds = isCompany ? individuals : worker ? [worker] : [];

  const evals = useQuery({
    queryKey: ["cleaner-dispatch", "check", property, checkIds.join(","), taskRef, date],
    enabled: !!property && checkIds.length > 0,
    queryFn: async () =>
      Promise.all(
        checkIds.map(async (id) => {
          const { data, error } = await rpc.rpc("cleaner_safeguard_check", { _property: property, _worker: id, _task_ref: taskRef || "-", _scheduled: date });
          if (error) throw new Error(error.message);
          return { ...(data as Evaluation), worker_id: id };
        }),
      ),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="STR cleaner check"
        description="Run this before assigning a cleaner to a clean at an enrolled STR home. It shows the cleaner's Attributed Cleaner Time against the operational safeguard thresholds. It is an operational safeguard only — not a tax determination."
      />
      {options.isLoading ? <LoadingRows /> : options.error ? (
        <EmptyState title="Could not load" hint={(options.error as Error).message} />
      ) : !homes.length ? (
        <EmptyState title="No STR homes are enrolled yet" hint="The check becomes available once leadership enrolls an STR home in the cleaner-hours safeguard." />
      ) : (
        <SectionCard title="Which clean?">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">STR home</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={property}
                onChange={(e) => { setProperty(e.target.value); setTaskChoice(""); }}>
                <option value="">Choose a home…</option>
                {homes.map((h) => <option key={h.property_id} value={h.property_id}>{h.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Breezeway clean</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={taskChoice} onChange={(e) => setTaskChoice(e.target.value)} disabled={!property}>
                <option value="">{tasks.length ? "Choose an upcoming clean…" : "No upcoming cleans found — enter below"}</option>
                {tasks.map((t) => <option key={t.task_id} value={t.task_id}>{t.scheduled_date ?? "Unscheduled"} · {t.name ?? "Clean"} (#{t.task_id})</option>)}
              </select>
            </div>
            {!task ? (
              <>
                <div><label className="text-sm font-medium">Breezeway Task # or work item</label><Input value={manualRef} onChange={(e) => setManualRef(e.target.value)} /></div>
                <div><label className="text-sm font-medium">Clean date</label><Input type="date" value={scheduled} onChange={(e) => setScheduled(e.target.value)} /></div>
              </>
            ) : null}
            <div>
              <label className="text-sm font-medium">Cleaner or login</label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={worker} onChange={(e) => { setWorker(e.target.value); setIndividuals([]); }}>
                <option value="">Choose…</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.name}{w.type === "company" ? " (company / vendor login)" : ""}</option>)}
              </select>
            </div>
            {isCompany ? (
              <div>
                <label className="text-sm font-medium">Individual cleaner(s) doing the work</label>
                <select multiple className="h-24 w-full rounded-md border border-input bg-background px-2 text-sm" value={individuals}
                  onChange={(e) => setIndividuals([...e.target.selectedOptions].map((o) => o.value))}>
                  {workers.filter((w) => w.type === "individual").map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Each person on a multi-person clean is attributed the full elapsed Task time.</p>
              </div>
            ) : null}
          </div>
        </SectionCard>
      )}

      {property && isCompany && individuals.length === 0 ? (
        <SectionCard title="Company / vendor login selected" tone="attention">
          <p className="text-sm">A company login cannot be dispatched directly to an STR home. Identify the individual cleaner(s) above, or send it for Director of Operations / Admin review.</p>
          <div className="mt-3"><IdentityReviewButton property={property} worker={worker} taskRef={taskRef} date={date} /></div>
        </SectionCard>
      ) : null}

      {property && evals.data?.length ? (
        <Decision property={property} taskRef={taskRef} date={date} breezewayTaskId={task?.task_id ?? null}
          worker={worker} individuals={isCompany ? individuals : null} evals={evals.data} onChanged={() => evals.refetch()} />
      ) : property && evals.isLoading && checkIds.length ? <LoadingRows /> : null}

      {property ? <RotationAid property={property} date={date} /> : null}
    </div>
  );
}

function IdentityReviewButton({ property, worker, taskRef, date }: { property: string; worker: string; taskRef: string; date: string | null }) {
  const send = async () => {
    const { error } = await rpc.rpc("cleaner_record_dispatch", { _property: property, _worker: worker, _task_ref: taskRef, _scheduled: date });
    if (error) { toast.error(error.message); return; }
    toast.success("Sent to the Director of Operations / Admin for cleaner identification.");
  };
  return <Button variant="outline" disabled={!taskRef} onClick={send}>Send for leadership review</Button>;
}

function Decision({ property, taskRef, date, breezewayTaskId, worker, individuals, evals, onChanged }: {
  property: string; taskRef: string; date: string | null; breezewayTaskId: number | null; worker: string; individuals: string[] | null;
  evals: Evaluation[]; onChanged: () => void;
}) {
  const [ack, setAck] = useState(false);
  const [override, setOverride] = useState<{ kind: "manager" | "emergency"; ev: Evaluation } | null>(null);
  const [requestFor, setRequestFor] = useState<Evaluation | null>(null);
  const worst = worstState(evals.map((e) => e.state));
  const needsOverride = evals.filter((e) =>
    (e.state === "restricted" && !e.override) || (e.state === "hard_block" && e.override?.kind !== "emergency"));
  const canOverride = evals.some((e) => e.can_override);
  const record = async () => {
    const { data, error } = await rpc.rpc("cleaner_record_dispatch", {
      _property: property, _worker: worker, _task_ref: taskRef, _scheduled: date, _acknowledged: ack,
      _individuals: individuals, _breezeway_task_id: breezewayTaskId,
    });
    if (error) { toast.error(error.message.replace(/^SAFEGUARD_[A-Z_]+: /, "")); return; }
    toast.success(data?.status === "identity_review" ? "Sent for leadership review." : "Dispatch recorded. Assign the cleaner in Breezeway.");
    onChanged();
  };
  return (
    <SectionCard title={<span className="flex items-center gap-2">Safeguard result <StateBadge state={worst} /></span>}
      tone={worst === "hard_block" || worst === "restricted" ? "critical" : worst === "warning" ? "attention" : "default"}>
      <div className="space-y-4">
        {evals.map((e) => (
          <div key={e.worker_id} className="space-y-2">
            <p className="font-medium">{e.worker_name}</p>
            <EvaluationSummary ev={e} />
            {e.override ? (
              <p className="text-sm">
                {e.override.kind === "emergency" ? "Emergency override" : "Leadership override"} approved by {e.override.by} for this clean only.
                {e.override.kind === "emergency" ? " The cleaner remains Hard Blocked for future standard assignments." : ""}
              </p>
            ) : null}
            {!e.override && (e.state === "restricted" || e.state === "hard_block") ? (
              <div className="flex flex-wrap gap-2">
                {e.can_override && e.state === "restricted" ? <Button size="sm" onClick={() => setOverride({ kind: "manager", ev: e })}>Approve single-clean override</Button> : null}
                {e.can_override && e.state === "hard_block" ? <Button size="sm" variant="destructive" onClick={() => setOverride({ kind: "emergency", ev: e })}>Emergency override (one clean)</Button> : null}
                {!e.can_override ? <Button size="sm" variant="outline" onClick={() => setRequestFor(e)}>Request leadership review</Button> : null}
              </div>
            ) : null}
          </div>
        ))}
        {!taskRef ? <p className="text-sm text-muted-foreground">Choose or enter the clean to record a dispatch.</p> : needsOverride.length ? (
          <p className="text-sm font-medium">Standard dispatch is locked{canOverride ? "." : " — a leadership review is required."}</p>
        ) : (
          <div className="space-y-3">
            {worst === "warning" ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                I considered rotating to another cleaner before dispatching this clean.
              </label>
            ) : null}
            <Button disabled={worst === "warning" && !ack} onClick={record}>Record dispatch</Button>
          </div>
        )}
      </div>
      {override ? (
        <OverrideDialog kind={override.kind} propertyId={property} workerId={override.ev.worker_id!} workerName={override.ev.worker_name ?? "Cleaner"}
          taskRef={taskRef} scheduled={date} breezewayTaskId={breezewayTaskId} ev={override.ev}
          onClose={() => setOverride(null)} onDone={() => { setOverride(null); onChanged(); }} />
      ) : null}
      {requestFor ? <RequestDialog property={property} ev={requestFor} taskRef={taskRef} date={date} onClose={() => setRequestFor(null)} /> : null}
    </SectionCard>
  );
}

function RequestDialog({ property, ev, taskRef, date, onClose }: { property: string; ev: Evaluation; taskRef: string; date: string | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const send = async () => {
    const { error } = await rpc.rpc("cleaner_safeguard_request_override", { _property: property, _worker: ev.worker_id, _task_ref: taskRef, _scheduled: date, _note: note });
    if (error) { toast.error(error.message); return; }
    toast.success("Leadership has been alerted.");
    onClose();
  };
  return (
    <SectionCard title={`Request leadership review for ${ev.worker_name}`}>
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why is this cleaner needed for this clean?" />
      <div className="mt-2 flex gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={!taskRef || note.trim().length < 10} onClick={send}>Send request</Button>
      </div>
    </SectionCard>
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
