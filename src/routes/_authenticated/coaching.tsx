/**
 * Coaching (Build 14; register BN8, G3): the Operations Supervisor records each coaching session
 * with a coordinator (date, type, agenda items, notes, what went well, follow ups with an owner and
 * a due date, the next session). The month shows sessions done against the required count (a
 * setting: per month for the team, changeable per coordinator). A coordinator sees only their own
 * sessions. Replaces the Notion Coaching and Accountability database; nothing is imported.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/page";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { AREA_CLASS, Field, INPUT_CLASS, SELECT_CLASS, Stat, plainError } from "@/components/trackers/parts";
import { dayText } from "@/lib/bonus";
import {
  FOLLOW_UP_OWNERS, FOLLOW_UP_OWNER_LABEL, SESSION_TYPES, SESSION_TYPE_LABEL, TRACKER_COPY, centralToday, monthLabel, monthStart,
} from "@/lib/manual-trackers";

const C = TRACKER_COPY.coaching;

type FollowUp = { text: string; owner?: string; due_on?: string };
type Session = {
  id: string; coordinator_id: string; coordinator_name: string | null; session_on: string; type: string; agenda: string[];
  notes: string | null; went_well: string | null; follow_ups: FollowUp[]; next_session_on: string | null; recorded_by_name: string | null;
};
type Person = { user_id: string; name: string; required: number; done: number };
type Log = {
  view: "lead" | "coordinator"; month: string; sessions: Session[]; coordinators?: Person[]; required?: number; done?: number;
  settings?: { per_month?: number; per_coordinator?: Record<string, number> }; can_record?: boolean; can_set?: boolean;
};

export const Route = createFileRoute("/_authenticated/coaching")({
  head: () => ({
    meta: [
      { title: "Coaching · Resolve" },
      { name: "description", content: "Coaching sessions with each coordinator, counted against the monthly requirement." },
      { property: "og:title", content: "Coaching · Resolve" },
      { property: "og:description", content: "Coaching sessions with each coordinator, counted against the monthly requirement." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachingPage,
});

function shiftMonth(m: string, by: number) {
  const d = new Date(`${m.slice(0, 7)}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return `${d.toISOString().slice(0, 7)}-01`;
}

function CoachingPage() {
  useShellPageLabel(C.title);
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => monthStart(centralToday()));
  const q = useQuery({
    queryKey: ["coaching-log", month],
    queryFn: async (): Promise<Log> => {
      const { data, error } = await supabase.rpc("coaching_log", { _month: month });
      if (error) throw error;
      return data as unknown as Log;
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["coaching-log"] });
  const log = q.data;
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-6" data-coaching-page>
      <PageHeader title={C.title} description={C.hint} />
      {q.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : q.error || !log ? (
        <p role="alert" className="text-sm">{TRACKER_COPY.loadError}</p>
      ) : log.view === "coordinator" ? (
        <SectionCard title={C.mineTitle}>
          {log.sessions.length === 0 ? <p className="text-sm text-muted-foreground">{C.mineNone}</p> : <SessionList sessions={log.sessions} />}
        </SectionCard>
      ) : (
        <>
          <SectionCard title={C.count(log.done ?? 0, log.required ?? 0)} description={monthLabel(month)}>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => setMonth(shiftMonth(month, -1))}>Back</Button>
              <Button variant="outline" className="min-h-11" onClick={() => setMonth(shiftMonth(month, 1))}>Next</Button>
              {log.can_record && (
                <Button className="min-h-11" onClick={() => setAdding((v) => !v)} data-coaching-new>{C.newSession}</Button>
              )}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(log.coordinators ?? []).map((p) => (
                <Stat key={p.user_id} label={p.name} value={`${Math.min(p.done, p.required)} of ${p.required}`} />
              ))}
            </div>
          </SectionCard>
          {adding && log.can_record && (
            <SessionForm people={log.coordinators ?? []} onDone={() => { setAdding(false); refresh(); }} />
          )}
          <SectionCard title={monthLabel(month)}>
            {log.sessions.length === 0 ? <EmptyState title={C.none} /> : <SessionList sessions={log.sessions} showName />}
          </SectionCard>
          {log.can_set && <CoachingSettings log={log} onSaved={refresh} />}
        </>
      )}
    </div>
  );
}

function SessionList({ sessions, showName = false }: { sessions: Session[]; showName?: boolean }) {
  return (
    <ul className="divide-y divide-border" data-coaching-list>
      {sessions.map((s) => (
        <li key={s.id} className="space-y-1 py-3 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-medium">{dayText(s.session_on)}</span>
            {showName && <span>{s.coordinator_name}</span>}
            <span className="text-muted-foreground">{SESSION_TYPE_LABEL[s.type] ?? s.type}</span>
          </div>
          {s.agenda.length > 0 && (
            <ul className="list-disc pl-5">
              {s.agenda.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          )}
          {s.notes && <p className="break-words">{s.notes}</p>}
          {s.went_well && <p className="break-words"><span className="text-muted-foreground">{C.wentWell}: </span>{s.went_well}</p>}
          {s.follow_ups.length > 0 && (
            <ul className="space-y-0.5">
              {s.follow_ups.map((f, i) => (
                <li key={i}>
                  {f.text}
                  {f.owner ? `, ${FOLLOW_UP_OWNER_LABEL[f.owner] ?? f.owner}` : ""}
                  {f.due_on ? `, due ${dayText(f.due_on)}` : ""}
                </li>
              ))}
            </ul>
          )}
          {s.next_session_on && <p className="text-muted-foreground">{C.nextOn}: {dayText(s.next_session_on)}</p>}
        </li>
      ))}
    </ul>
  );
}

function SessionForm({ people, onDone }: { people: Person[]; onDone: () => void }) {
  const today = centralToday();
  const [who, setWho] = useState(people[0]?.user_id ?? "");
  const [on, setOn] = useState(today);
  const [type, setType] = useState("check_in");
  const [agenda, setAgenda] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");
  const [well, setWell] = useState("");
  const [fus, setFus] = useState<FollowUp[]>([]);
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = useMemo(
    () => who && on && agenda.some((a) => a.trim()) && notes.trim().length >= 3 &&
      fus.every((f) => !f.text.trim() || (f.owner && f.due_on)),
    [who, on, agenda, notes, fus],
  );
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("coaching_save_session", {
      _coordinator: who, _on: on, _type: type, _agenda: agenda, _notes: notes, _went_well: well,
      _follow_ups: fus.filter((f) => f.text.trim()), _next_on: next || undefined,
    });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(C.saved);
    onDone();
  };
  return (
    <SectionCard title={C.newSession}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={C.coordinator}>
          <select className={SELECT_CLASS} value={who} onChange={(e) => setWho(e.target.value)} data-coaching-who>
            {people.map((p) => <option key={p.user_id} value={p.user_id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label={C.date}>
          <input type="date" className={INPUT_CLASS} value={on} max={today} onChange={(e) => setOn(e.target.value)} />
        </Field>
        <Field label={C.type}>
          <select className={SELECT_CLASS} value={type} onChange={(e) => setType(e.target.value)}>
            {SESSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-[13px] text-muted-foreground">{C.agenda}</p>
        {agenda.map((a, i) => (
          <input
            key={i}
            className={INPUT_CLASS}
            value={a}
            aria-label={`${C.agenda} ${i + 1}`}
            onChange={(e) => setAgenda(agenda.map((x, j) => (j === i ? e.target.value : x)))}
          />
        ))}
        <Button variant="outline" className="min-h-11" onClick={() => setAgenda([...agenda, ""])}>{C.addAgenda}</Button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={C.notes}>
          <textarea className={AREA_CLASS} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <Field label={C.wentWell}>
          <textarea className={AREA_CLASS} value={well} onChange={(e) => setWell(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 space-y-2">
        <p className="text-[13px] text-muted-foreground">{C.followUps}</p>
        {fus.map((f, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input className={INPUT_CLASS} value={f.text} aria-label={C.followUps}
              onChange={(e) => setFus(fus.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <select className={SELECT_CLASS} value={f.owner ?? ""} aria-label={C.owner}
              onChange={(e) => setFus(fus.map((x, j) => (j === i ? { ...x, owner: e.target.value } : x)))}>
              <option value="">{C.owner}</option>
              {FOLLOW_UP_OWNERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input type="date" className={INPUT_CLASS} value={f.due_on ?? ""} min={on} aria-label={C.dueOn}
              onChange={(e) => setFus(fus.map((x, j) => (j === i ? { ...x, due_on: e.target.value } : x)))} />
          </div>
        ))}
        <Button variant="outline" className="min-h-11" onClick={() => setFus([...fus, { text: "" }])}>{C.addFollowUp}</Button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={C.nextOn}>
          <input type="date" className={INPUT_CLASS} value={next} min={on} onChange={(e) => setNext(e.target.value)} />
        </Field>
      </div>
      <Button className="mt-4 min-h-11" disabled={busy || !ready} onClick={save} data-coaching-save>{C.save}</Button>
    </SectionCard>
  );
}

function CoachingSettings({ log, onSaved }: { log: Log; onSaved: () => void }) {
  const [per, setPer] = useState(String(log.settings?.per_month ?? 1));
  const [over, setOver] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(log.settings?.per_coordinator ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const per_coordinator = Object.fromEntries(Object.entries(over).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)]));
    const { error } = await supabase.rpc("manual_tracker_save_settings", {
      _key: "coaching_settings", _value: { per_month: Number(per), per_coordinator },
    });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(C.saved);
    onSaved();
  };
  return (
    <SectionCard title={C.settings}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={C.perMonth}>
          <input className={INPUT_CLASS} type="number" min={0} max={10} value={per} onChange={(e) => setPer(e.target.value)} />
        </Field>
        {(log.coordinators ?? []).map((p) => (
          <Field key={p.user_id} label={`${C.override}: ${p.name}`}>
            <select className={SELECT_CLASS} value={over[p.user_id] ?? ""} onChange={(e) => setOver({ ...over, [p.user_id]: e.target.value })}>
              <option value="">{C.sameAsTeam}</option>
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={String(n)}>{n}</option>)}
            </select>
          </Field>
        ))}
      </div>
      <Button className="mt-3 min-h-11" disabled={busy} onClick={save}>Save</Button>
    </SectionCard>
  );
}
