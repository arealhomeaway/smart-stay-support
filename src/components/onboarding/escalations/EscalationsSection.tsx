/**
 * Escalations on one home, above the main Task list: every open escalation, each linked to its
 * Task (or owner card). The Director of Onboarding and Admin close them; the person who raised
 * one can withdraw it.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listOnboardingEscalationsFn, resolveOnboardingEscalationFn, type OnboardingEscalation } from "@/lib/onboarding-escalations.functions";

export const escalationsKey = (propertyId: string) => ["onboarding-escalations", propertyId] as const;

export function useHomeEscalations(propertyId: string) {
  const list = useServerFn(listOnboardingEscalationsFn);
  return useQuery({ queryKey: escalationsKey(propertyId), queryFn: () => list({ data: { propertyId } }), staleTime: 30_000 });
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function EscalationsSection(p: { propertyId: string; viewerId: string | null; canClose: boolean }) {
  const q = useHomeEscalations(p.propertyId);
  if (!q.data?.ready) return null;
  const rows = q.data.rows;
  return (
    <section className="surface space-y-3 p-4" aria-label="Escalations">
      <h2 className="text-base font-semibold">Escalations ({rows.length})</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open escalations.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <EscalationRow key={r.id} row={r} propertyId={p.propertyId} canClose={p.canClose} isRaiser={r.raisedById === p.viewerId} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EscalationRow(p: { row: OnboardingEscalation; propertyId: string; canClose: boolean; isRaiser: boolean }) {
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const resolve = useServerFn(resolveOnboardingEscalationFn);
  const qc = useQueryClient();
  const done = useMutation({
    mutationFn: () => resolve({ data: { id: p.row.id, note } }),
    onSuccess: () => {
      toast.success(p.canClose ? "Escalation closed." : "Escalation withdrawn.");
      void qc.invalidateQueries({ queryKey: escalationsKey(p.propertyId) });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const search = p.row.taskId ? { tab: "tasks", task: p.row.taskId } : { opp: p.row.workItemId ?? undefined };
  return (
    <li className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to="/onboarding/$propertyId"
            params={{ propertyId: p.propertyId }}
            search={search as never}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            {p.row.title}
          </Link>
          <p className="text-sm">{p.row.reason}</p>
          <p className="text-xs text-muted-foreground">
            {p.row.raisedBy} · {when(p.row.raisedAt)}
          </p>
        </div>
        {p.canClose || p.isRaiser ? (
          <Button variant="outline" className="min-h-11" onClick={() => setClosing((v) => !v)} aria-expanded={closing}>
            {p.canClose ? "Close" : "Withdraw"}
          </Button>
        ) : null}
      </div>
      {closing ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input className="min-h-11 flex-1" placeholder="What was decided (optional)" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
          <Button className="min-h-11" disabled={done.isPending} onClick={() => done.mutate()}>
            {done.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
