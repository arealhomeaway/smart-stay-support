import { formatPropertyLabel } from "@/lib/property-label";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usDate } from "@/lib/dates";
import { MATCH_STATE_LABEL, type MatchState } from "@/lib/departure-matching";
import { linkCleanReservation, previewDepartureMatching } from "@/lib/departure-matching.functions";

type Candidate = { id: string; guest?: string | null; arrival?: string; departure?: string; code?: string | null };

/** Supervisors: cleans that need a reservation picked + the dry-run matching preview. */
export function DepartureMatchingPanel() {
  const qc = useQueryClient();
  const sup = useQuery({
    queryKey: ["is-supervisor"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("is_supervisor", { _user_id: u.user.id });
      return !!data;
    },
  });
  const needs = useQuery({
    enabled: !!sup.data,
    queryKey: ["departure-matching", "needs"],
    queryFn: async () => {
      const { data } = await supabase.from("departure_clean_matches")
        .select("id, breezeway_task_id, reason, candidates, properties(name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id), breezeway_work_orders(name, scheduled_date, status)")
        .eq("state", "multiple_reservations").order("created_at").limit(100);
      return data ?? [];
    },
  });
  const preview = useServerFn(previewDepartureMatching);
  const link = useServerFn(linkCleanReservation);
  const run = useMutation({ mutationFn: () => preview({ data: { days: 30 } }) });
  const pick = useMutation({
    mutationFn: (v: { matchId: string; bookingId: string }) => link({ data: v }),
    onSuccess: () => { toast.success("Reservation linked"); qc.invalidateQueries({ queryKey: ["departure-matching"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const [showAll, setShowAll] = useState(false);
  if (!sup.data) return null;
  const r = run.data;

  return (
    <section aria-label="Departure clean matching" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Departure clean matching</h2>
        <Button size="sm" variant="outline" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? "Checking…" : "Preview matching — last 30 days (no changes)"}
        </Button>
      </div>

      {(needs.data?.length ?? 0) > 0 && (
        <div className="space-y-2" aria-label="Needs reservation match">
          <h3 className="text-sm font-semibold">Needs reservation match · {needs.data!.length}</h3>
          {needs.data!.map((m) => (
            <div key={m.id} className="rounded-md border border-border p-3 text-sm">
              <p className="font-medium">{formatPropertyLabel(m.properties).primary} · {m.breezeway_work_orders?.name} · {m.breezeway_work_orders?.scheduled_date ? usDate(m.breezeway_work_orders.scheduled_date) : "—"}</p>
              <p className="text-muted-foreground">{m.reason}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(m.candidates as Candidate[]).map((c) => (
                  <Button key={c.id} size="sm" variant="outline" disabled={pick.isPending} onClick={() => pick.mutate({ matchId: m.id, bookingId: c.id })}>
                    Link {c.guest ?? "guest"} · {c.arrival ? usDate(c.arrival) : "?"}–{c.departure ? usDate(c.departure) : "?"}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {run.error && <p className="text-sm text-destructive">{(run.error as Error).message}</p>}
      {r && (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Dry run {usDate(r.window.from)}–{usDate(r.window.to)}. Nothing was saved and no Departure Reviews or Tickets were created.</p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            {[
              ["OwnerRez departures", r.totals.departures],
              ["Breezeway cleans reviewed", r.totals.cleansReviewed],
              ["Finished departure cleans", r.totals.finishedDepartureCleans],
              ["Matched", `${r.totals.matched} (${r.totals.highConfidence} same-day)`],
              ["No matching reservation", r.totals.noReservation],
              ["Multiple possible", r.totals.multiple],
              ["Extra cleans (already linked)", r.totals.alreadyLinked],
              ["Missing data", r.totals.missingData],
              ["Departures with no matched clean", r.totals.departuresWithoutClean],
              ["Departure cleans not finished yet", r.totals.notYetFinished],
              ["Departures matched", `${r.totals.pctMatched}%`],
              ["Exact finish times from Breezeway", r.totals.exactFinishTimes],
            ].map(([k, v]) => (
              <div key={String(k)}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
            ))}
          </dl>
          <details>
            <summary className="cursor-pointer font-medium">Breezeway clean types found ({r.labels.length})</summary>
            <ul className="mt-1">
              {r.labels.map((l) => <li key={l.name}>{l.departure ? <Badge>Departure</Badge> : <Badge variant="outline">Other</Badge>} {l.name} — {l.total} ({l.done} finished)</li>)}
            </ul>
          </details>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead><tr className="text-muted-foreground"><th>Home</th><th>Clean date</th><th>Guest / reservation</th><th>Checkout</th><th>Result</th><th>Reason</th></tr></thead>
              <tbody>
                {(showAll ? r.results : r.results.filter((x) => x.state !== "matched").concat(r.results.filter((x) => x.state === "matched").slice(0, 15))).map((x) => (
                  <tr key={x.clean_id} className="border-t border-border align-top">
                    <td>{x.property}</td>
                    <td>{x.clean_date ? usDate(x.clean_date) : "—"}</td>
                    <td>{x.guest ?? "—"}{x.code ? ` · ${x.code}` : ""}</td>
                    <td>{x.checkout_date ? usDate(x.checkout_date) : "—"}</td>
                    <td><Badge variant={x.state === "matched" ? "secondary" : "outline"}>{MATCH_STATE_LABEL[x.state as MatchState]}</Badge></td>
                    <td>{x.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!showAll && <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>Show all {r.results.length}</Button>}
          </div>
        </div>
      )}
    </section>
  );
}
