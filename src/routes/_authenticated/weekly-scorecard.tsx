/**
 * Weekly scorecard and report (Build 14; register BN9, G4): one scorecard a week, due Thursday at
 * 3 PM Central, covering Thursday to Wednesday. The numbers fill in from Resolve for each
 * coordinator; the Operations Supervisor adds their call and notes from the one on ones, wins,
 * problems and requests, then presses Submit. The Director of Operations marks it Reviewed or
 * Returns it with a note. Submitted versions are locked; a correction is a new version with a
 * reason. Finance sees the status and numbers only. Every rule lives in public.weekly_scorecard.
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/page";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { AREA_CLASS, Field, SELECT_CLASS, plainError } from "@/components/trackers/parts";
import { centralStamp, dayText } from "@/lib/bonus";
import { COORDINATOR_LEVELS, TRACKER_COPY, WEEKLY_EVENT_LABEL, WEEKLY_STATUS_LABEL, countText, type Count } from "@/lib/manual-trackers";

const C = TRACKER_COPY.weekly;

type Coord = {
  user_id: string; name: string; follow_through: Count; urgent: { reply_met: number; action_met: number; total: number };
  handoffs: Count; duties: Count; records: Count;
};
type Facts = { from: string; to: string; as_of: string; arrivals: Count; coordinators: Coord[] };
type Manual = { coordinators?: Record<string, { level?: string; notes?: string }>; wins?: string; problems?: string; requests?: string };
type Card = {
  view: "lead" | "finance"; due_on: string; from: string; to: string; opens_at: string; due_at: string; opened: boolean;
  status: string; on_time: boolean; latest_action: string | null; locked: boolean; facts: Facts | null; manual: Manual | null;
  return_note: string | null; events: { action: string; version: number; at: string; by_name: string | null; timing: string | null; reason: string | null; note: string | null }[];
  can_edit: boolean; can_correct: boolean; can_decide: boolean;
};
type WeekRow = { due_on: string; status: string; on_time: boolean; latest_action: string | null };

export const Route = createFileRoute("/_authenticated/weekly-scorecard")({
  validateSearch: (s: Record<string, unknown>): { due?: string | undefined } => ({
    due: typeof s["due"] === "string" ? s["due"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Weekly scorecard · Resolve" },
      { name: "description", content: "The Operations Supervisor's weekly scorecard and report, due Thursday at 3 PM." },
      { property: "og:title", content: "Weekly scorecard · Resolve" },
      { property: "og:description", content: "The Operations Supervisor's weekly scorecard and report, due Thursday at 3 PM." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WeeklyScorecardPage,
});

function statusTone(s: string): StatusTone {
  return s === "on_time" ? "resolved" : s === "late" ? "waiting" : s === "not_submitted" ? "escalated" : "progress";
}

function WeeklyScorecardPage() {
  useShellPageLabel(C.title);
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [due, setDue] = useState<string | null>(search.due ?? null);
  const weeks = useQuery({
    queryKey: ["weekly-scorecard-weeks"],
    queryFn: async (): Promise<WeekRow[]> => {
      const { data, error } = await supabase.rpc("weekly_scorecard_weeks");
      if (error) throw error;
      return (data ?? []) as unknown as WeekRow[];
    },
  });
  const q = useQuery({
    queryKey: ["weekly-scorecard", due],
    queryFn: async (): Promise<Card> => {
      const { data, error } = await supabase.rpc("weekly_scorecard", due ? { _due: due } : {});
      if (error) throw error;
      return data as unknown as Card;
    },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["weekly-scorecard"] });
    void qc.invalidateQueries({ queryKey: ["weekly-scorecard-weeks"] });
    void qc.invalidateQueries({ queryKey: ["trackers-waiting"] });
  };
  const card = q.data;
  return (
    <div className="space-y-6" data-weekly-page>
      <PageHeader title={C.title} description={C.hint} />
      <SectionCard title={C.week}>
        <Field label={C.week}>
          <select className={SELECT_CLASS} value={due ?? card?.due_on ?? ""} onChange={(e) => setDue(e.target.value)} data-weekly-week>
            {(weeks.data ?? []).map((w) => (
              <option key={w.due_on} value={w.due_on}>
                {dayText(w.due_on)}, {WEEKLY_STATUS_LABEL[w.status] ?? w.status}
              </option>
            ))}
          </select>
        </Field>
      </SectionCard>
      {q.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : q.error || !card ? (
        <p role="alert" className="text-sm">{TRACKER_COPY.loadError}</p>
      ) : (
        <ScorecardView key={`${card.due_on}:${card.events.length}`} card={card} onChanged={refresh} />
      )}
    </div>
  );
}

function ScorecardView({ card, onChanged }: { card: Card; onChanged: () => void }) {
  const [manual, setManual] = useState<Manual>(() => card.manual ?? {});
  const [correcting, setCorrecting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setManual(card.manual ?? {}), [card.manual]);
  const editable = card.can_edit || correcting;
  const setCoord = (id: string, patch: { level?: string; notes?: string }) =>
    setManual({ ...manual, coordinators: { ...(manual.coordinators ?? {}), [id]: { ...(manual.coordinators?.[id] ?? {}), ...patch } } });

  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(ok);
    setCorrecting(false);
    onChanged();
  };
  const saveDraft = () => run(() => supabase.rpc("weekly_scorecard_save_draft", { _due: card.due_on, _manual: manual }), C.saved);
  const submit = () =>
    run(() => supabase.rpc("weekly_scorecard_submit", { _due: card.due_on, _manual: manual, ...(correcting ? { _reason: reason } : {}) }), C.submitted);
  const decide = (reviewed: boolean) =>
    run(() => supabase.rpc("weekly_scorecard_decide", { _due: card.due_on, _reviewed: reviewed, _note: note }), C.saved);

  return (
    <>
      <SectionCard
        title={C.due(dayText(card.due_on))}
        description={C.covers(dayText(card.from), dayText(card.to))}
        actions={<StatusBadge tone={statusTone(card.status)}>{WEEKLY_STATUS_LABEL[card.status] ?? card.status}</StatusBadge>}
      >
        {card.latest_action && (
          <p className="text-sm">
            {WEEKLY_EVENT_LABEL[card.latest_action]}
            {card.return_note ? `: ${card.return_note}` : ""}
          </p>
        )}
        {!card.opened && <p className="text-sm text-muted-foreground">{C.opensOn(dayText(card.due_on))}</p>}
        {card.view === "finance" && <p className="text-sm text-muted-foreground">{C.financeHint}</p>}
      </SectionCard>

      {card.facts && (
        <SectionCard title={C.facts} description={`As of ${centralStamp(card.facts.as_of)}`}>
          <p className="mb-3 text-sm">{C.arrivals}: {countText(card.facts.arrivals)}</p>
          <ul className="space-y-3" data-weekly-facts>
            {card.facts.coordinators.map((c) => (
              <li key={c.user_id} className="rounded-[14px] border border-border p-4">
                <p className="font-medium">{c.name}</p>
                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <Row label={C.followThrough} value={countText(c.follow_through)} />
                  <Row label={C.urgentReply} value={countText({ met: c.urgent.reply_met, total: c.urgent.total })} />
                  <Row label={C.urgentAction} value={countText({ met: c.urgent.action_met, total: c.urgent.total })} />
                  <Row label={C.handoffs} value={countText(c.handoffs)} />
                  <Row label={C.duties} value={countText(c.duties)} />
                  <Row label={C.records} value={countText(c.records)} />
                </dl>
                {card.view === "lead" && (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label={C.yourCall}>
                      <select className={SELECT_CLASS} disabled={!editable} value={manual.coordinators?.[c.user_id]?.level ?? ""}
                        onChange={(e) => setCoord(c.user_id, { level: e.target.value })}>
                        <option value="">Choose</option>
                        {COORDINATOR_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label={C.notes}>
                        <textarea className={AREA_CLASS} disabled={!editable} value={manual.coordinators?.[c.user_id]?.notes ?? ""}
                          onChange={(e) => setCoord(c.user_id, { notes: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {card.view === "lead" && card.opened && (
        <SectionCard title={C.wins}>
          <div className="space-y-3">
            {(["wins", "problems", "requests"] as const).map((k) => (
              <Field key={k} label={C[k]}>
                <textarea className={AREA_CLASS} disabled={!editable} value={manual[k] ?? ""} onChange={(e) => setManual({ ...manual, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
          {correcting && (
            <div className="mt-3">
              <Field label={C.reason}>
                <textarea className={AREA_CLASS} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {card.can_edit && (
              <>
                <Button variant="outline" className="min-h-11" disabled={busy} onClick={saveDraft}>{C.saveDraft}</Button>
                <Button className="min-h-11" disabled={busy} onClick={submit} data-weekly-submit>{C.submit}</Button>
              </>
            )}
            {card.can_correct && !correcting && (
              <Button variant="outline" className="min-h-11" onClick={() => setCorrecting(true)}>{C.correct}</Button>
            )}
            {correcting && (
              <Button className="min-h-11" disabled={busy || reason.trim().length < 5} onClick={submit}>{C.submitCorrection}</Button>
            )}
          </div>
        </SectionCard>
      )}

      {card.can_decide && (
        <SectionCard title={WEEKLY_EVENT_LABEL["submitted"] ?? "Submitted"}>
          <Field label={C.returnNote}>
            <textarea className={AREA_CLASS} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={busy} onClick={() => decide(true)} data-weekly-reviewed>{C.reviewed}</Button>
            <Button variant="outline" className="min-h-11" disabled={busy || note.trim().length < 3} onClick={() => decide(false)}>{C.returnIt}</Button>
          </div>
        </SectionCard>
      )}

      <SectionCard title={C.history}>
        {card.events.length === 0 ? (
          <EmptyState title={C.none} />
        ) : (
          <ul className="divide-y divide-border">
            {card.events.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 gap-y-1 py-2 text-sm">
                <span className="font-medium">{WEEKLY_EVENT_LABEL[e.action] ?? e.action}{e.action === "submitted" ? `, version ${e.version}` : ""}</span>
                <span>{centralStamp(e.at)}</span>
                {e.by_name && <span className="text-muted-foreground">{e.by_name}</span>}
                {e.timing && <span>{WEEKLY_STATUS_LABEL[e.timing]}</span>}
                {e.reason && <span className="w-full break-words">{e.reason}</span>}
                {e.note && <span className="w-full break-words">{e.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
