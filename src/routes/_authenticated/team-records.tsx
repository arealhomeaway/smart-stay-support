/**
 * Team records (Build 14; register BN7, G1, G2): each Monday at 6 AM Central the database draws 5
 * records a coordinator at random from last week's work. The Operations Supervisor reviews each one
 * (Clean or Not clean with a note and a link to the evidence) and can skip one only with a reason,
 * which draws another. The Director of Operations double checks reviews chosen at random. Finance
 * sees totals. A coordinator sees only their own results, from their start date. Every rule lives in
 * the database (public.team_records_week and the functions beside it).
 */
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { EmptyState, PageHeader, SectionCard } from "@/components/ui/page";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { useRole } from "@/hooks/useRole";
import { AREA_CLASS, Field, INPUT_CLASS, SELECT_CLASS, Stat, plainError } from "@/components/trackers/parts";
import { centralStamp, dayText, rangeText } from "@/lib/bonus";
import { CHECKLIST, RECORD_KIND_LABEL, RECORD_STATUS_LABEL, TRACKER_COPY, addDays, centralToday, mondayOf, reviewProblem } from "@/lib/manual-trackers";

const C = TRACKER_COPY.records;

type Item = {
  id: string; draw_no: number; kind: string; label: string | null; record_at: string; link: string | null;
  owner_id: string; owner_name: string; replaces: string | null; status: string; final: string | null;
  review_id: string | null; reviewed_at: string | null; reviewed_by: string | null; checklist: Record<string, boolean> | null;
  note: string | null; evidence_url: string | null; picked: boolean; check: { agree: boolean; note: string | null; at: string } | null;
};
type Week = {
  view: "lead" | "finance"; week_start: string; from: string; to: string; draws_at: string; per_coordinator: number;
  director_checks: number; items: Item[]; total: number; reviewed: number; clean: number; not_clean: number; skipped: number;
  picked: number; checked: number; can_review: boolean; can_check: boolean; can_set: boolean;
};
type WeekRow = { week_start: string; total: number; reviewed: number; clean: number; not_clean: number; skipped: number };
type Mine = { starts_on: string; started: boolean; clean: number; not_clean: number; items: { id: string; label: string; at: string; final: string; note: string | null }[] };

export const Route = createFileRoute("/_authenticated/team-records")({
  validateSearch: (s: Record<string, unknown>): { week?: string | undefined } => ({
    week: typeof s["week"] === "string" ? s["week"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Team records · Resolve" },
      { name: "description", content: "Weekly random checks of coordinator records, with the Director's double check." },
      { property: "og:title", content: "Team records · Resolve" },
      { property: "og:description", content: "Weekly random checks of coordinator records, with the Director's double check." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeamRecordsPage,
});

function TeamRecordsPage() {
  useShellPageLabel(C.title);
  const role = useRole();
  const leadish = role.can("weekly_scorecard");
  return (
    <div className="space-y-6" data-team-records-page>
      <PageHeader title={C.title} description={C.hint} />
      {leadish ? <LeadView /> : <MineView />}
    </div>
  );
}

function LeadView() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [week, setWeek] = useState(() => search.week ?? mondayOf(centralToday()));
  const q = useQuery({
    queryKey: ["team-records-week", week],
    queryFn: async (): Promise<Week> => {
      const { data, error } = await supabase.rpc("team_records_week", { _week: week });
      if (error) throw error;
      return data as unknown as Week;
    },
  });
  const weeks = useQuery({
    queryKey: ["team-records-weeks"],
    queryFn: async (): Promise<WeekRow[]> => {
      const { data, error } = await supabase.rpc("team_records_weeks");
      if (error) throw error;
      return (data ?? []) as unknown as WeekRow[];
    },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["team-records-week"] });
    void qc.invalidateQueries({ queryKey: ["team-records-weeks"] });
    void qc.invalidateQueries({ queryKey: ["trackers-waiting"] });
  };
  const w = q.data;
  const picked = (w?.items ?? []).filter((i) => i.picked);
  return (
    <>
      <SectionCard title={C.progress(w?.reviewed ?? 0, w?.total ?? 0)} description={w ? rangeText(w.from, w.to) : undefined}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Week of">
            <div className="flex gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => setWeek(addDays(week, -7))} aria-label="Week before">Back</Button>
              <input type="date" className={INPUT_CLASS} value={week} onChange={(e) => e.target.value && setWeek(mondayOf(e.target.value))} data-records-week />
              <Button variant="outline" className="min-h-11" onClick={() => setWeek(addDays(week, 7))} aria-label="Week after">Next</Button>
            </div>
          </Field>
        </div>
        {w && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Reviewed" value={`${w.reviewed} of ${w.total}`} />
            <Stat label="Clean" value={w.clean} />
            <Stat label="Not clean" value={w.not_clean} />
            <Stat label="Skipped" value={w.skipped} />
          </div>
        )}
      </SectionCard>

      {q.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : q.error ? (
        <p role="alert" className="text-sm">{TRACKER_COPY.loadError}</p>
      ) : w && w.view === "finance" ? (
        <p className="text-sm text-muted-foreground">{C.financeHint}</p>
      ) : w && w.items.length === 0 ? (
        <EmptyState title={C.none} hint={`${C.drawsAt} ${centralStamp(w.draws_at)}`} />
      ) : (
        <ul className="space-y-3" data-records-list>
          {(w?.items ?? []).map((i) => (
            <RecordRow key={i.id} item={i} canReview={Boolean(w?.can_review)} onChanged={refresh} />
          ))}
        </ul>
      )}

      {w?.can_check && picked.length > 0 && (
        <SectionCard title={`${C.checkTitle} (${w.checked} of ${w.picked})`} description={C.checkHint}>
          <ul className="space-y-3">
            {picked.map((i) => (
              <DoubleCheckRow key={i.id} item={i} onChanged={refresh} />
            ))}
          </ul>
        </SectionCard>
      )}

      {w?.can_set && <RecordsSettings week={w} onSaved={refresh} />}

      <SectionCard title={C.history}>
        {(weeks.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{TRACKER_COPY.weekly.none}</p>
        ) : (
          <ul className="divide-y divide-border">
            {(weeks.data ?? []).map((r) => (
              <li key={r.week_start}>
                <button
                  type="button"
                  className="flex min-h-11 w-full flex-wrap items-center gap-x-4 gap-y-1 py-2 text-left text-sm"
                  onClick={() => setWeek(r.week_start)}
                >
                  <span className="font-medium">Week of {dayText(r.week_start)}</span>
                  <span>{r.reviewed} of {r.total} reviewed</span>
                  <span>{r.clean} clean</span>
                  <span>{r.not_clean} not clean</span>
                  {r.skipped > 0 && <span className="text-muted-foreground">{r.skipped} skipped</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function statusTone(s: string): StatusTone {
  return s === "clean" ? "resolved" : s === "not_clean" ? "escalated" : s === "skipped" ? "closed" : "progress";
}

function RecordRow({ item, canReview, onChanged }: { item: Item; canReview: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const shown = item.final ?? item.status;
  return (
    <li className="rounded-[14px] border border-border p-4" data-record-row={item.status}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.label ?? RECORD_KIND_LABEL[item.kind]}</span>
        <StatusBadge tone={statusTone(shown)}>{RECORD_STATUS_LABEL[shown] ?? shown}</StatusBadge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {RECORD_KIND_LABEL[item.kind]}, {item.owner_name}, {centralStamp(item.record_at)}
        {item.replaces ? ", drawn after a skip" : ""}
      </p>
      {item.link && (
        <Button asChild variant="link" className="min-h-11 px-0">
          <Link to={item.link}>{C.open}</Link>
        </Button>
      )}
      {item.status !== "waiting" && (
        <div className="mt-2 space-y-1 text-sm">
          {item.status === "skipped" ? (
            <p>Skipped: {item.note ?? ""}</p>
          ) : (
            <>
              <p>
                {item.reviewed_by ? `${item.reviewed_by}, ` : ""}
                {centralStamp(item.reviewed_at)}
              </p>
              {item.note && <p className="break-words">{item.note}</p>}
              {item.evidence_url && (
                <a className="inline-flex min-h-11 items-center text-primary underline" href={item.evidence_url} target="_blank" rel="noreferrer">
                  Evidence
                </a>
              )}
              {item.check && (
                <p>
                  Double check: {item.check.agree ? C.agree : C.disagree}
                  {item.check.note ? `, ${item.check.note}` : ""}
                </p>
              )}
            </>
          )}
        </div>
      )}
      {canReview && item.status === "waiting" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="min-h-11" onClick={() => { setOpen((v) => !v); setSkipping(false); }} data-review-open>
            {C.review}
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => { setSkipping((v) => !v); setOpen(false); }}>
            {C.skip}
          </Button>
        </div>
      )}
      {open && <ReviewForm item={item} onDone={() => { setOpen(false); onChanged(); }} />}
      {skipping && <SkipForm item={item} onDone={() => { setSkipping(false); onChanged(); }} />}
    </li>
  );
}

function ReviewForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [clean, setClean] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const problem = reviewProblem(clean, checks, note, url);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("team_records_review", {
      _draw: item.id, _clean: clean as boolean, _checklist: checks, _note: note, _evidence_url: url,
    });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(TRACKER_COPY.records.saved);
    onDone();
  };
  return (
    <div className="mt-3 space-y-3 rounded-[14px] bg-muted/40 p-3" data-review-form>
      <fieldset className="space-y-1">
        {CHECKLIST.map((c) => (
          <label key={c.key} className="flex min-h-11 items-center gap-3 text-[15px]">
            <input
              type="checkbox"
              className="size-5"
              checked={Boolean(checks[c.key])}
              onChange={(e) => setChecks({ ...checks, [c.key]: e.target.checked })}
            />
            {c.label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button variant={clean === true ? "default" : "outline"} className="min-h-11" onClick={() => setClean(true)}>{C.clean}</Button>
        <Button variant={clean === false ? "default" : "outline"} className="min-h-11" onClick={() => setClean(false)}>{C.notClean}</Button>
      </div>
      {clean === false && (
        <>
          <Field label={C.note}>
            <textarea className={AREA_CLASS} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field label={C.evidence}>
            <input className={INPUT_CLASS} type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
        </>
      )}
      {problem && clean !== null && <p className="text-sm text-muted-foreground">{problem}</p>}
      <Button className="min-h-11" disabled={busy || Boolean(problem)} onClick={save} data-review-save>{C.save}</Button>
    </div>
  );
}

function SkipForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("team_records_skip", { _draw: item.id, _reason: reason });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(TRACKER_COPY.records.saved);
    onDone();
  };
  return (
    <div className="mt-3 space-y-3 rounded-[14px] bg-muted/40 p-3">
      <Field label={C.skipReason}>
        <textarea className={AREA_CLASS} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Button className="min-h-11" disabled={busy || reason.trim().length < 5} onClick={save}>{C.skipSave}</Button>
    </div>
  );
}

function DoubleCheckRow({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (agree: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("team_records_double_check", { _review: item.review_id as string, _agree: agree, _note: note });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(TRACKER_COPY.records.saved);
    onChanged();
  };
  return (
    <li className="rounded-[14px] border border-border p-4" data-double-check-row>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{item.label}</span>
        <StatusBadge tone={statusTone(item.status)}>{RECORD_STATUS_LABEL[item.status]}</StatusBadge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{item.owner_name}</p>
      {item.link && (
        <Button asChild variant="link" className="min-h-11 px-0">
          <Link to={item.link}>{C.open}</Link>
        </Button>
      )}
      {item.check ? (
        <p className="mt-2 text-sm">{item.check.agree ? C.agree : C.disagree}{item.check.note ? `, ${item.check.note}` : ""}</p>
      ) : (
        <div className="mt-2 space-y-2">
          <Field label={C.checkNote}>
            <input className={INPUT_CLASS} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={busy} onClick={() => decide(true)}>{C.agree}</Button>
            <Button variant="outline" className="min-h-11" disabled={busy || note.trim().length < 3} onClick={() => decide(false)}>{C.disagree}</Button>
          </div>
        </div>
      )}
    </li>
  );
}

function RecordsSettings({ week, onSaved }: { week: Week; onSaved: () => void }) {
  const [per, setPer] = useState(String(week.per_coordinator));
  const [checks, setChecks] = useState(String(week.director_checks));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("manual_tracker_save_settings", {
      _key: "team_records_settings", _value: { per_coordinator: Number(per), director_checks: Number(checks) },
    });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(C.saved);
    onSaved();
  };
  return (
    <SectionCard title={C.settings}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={C.perCoordinator}>
          <input className={INPUT_CLASS} type="number" min={1} max={20} value={per} onChange={(e) => setPer(e.target.value)} />
        </Field>
        <Field label={C.directorChecks}>
          <input className={INPUT_CLASS} type="number" min={1} max={50} value={checks} onChange={(e) => setChecks(e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Button className="min-h-11" disabled={busy} onClick={save}>Save</Button>
        </div>
      </div>
    </SectionCard>
  );
}

function MineView() {
  const q = useQuery({
    queryKey: ["team-records-mine"],
    queryFn: async (): Promise<Mine> => {
      const { data, error } = await supabase.rpc("team_records_mine");
      if (error) throw error;
      return data as unknown as Mine;
    },
  });
  const m = q.data;
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (q.error || !m) return <p role="alert" className="text-sm">{TRACKER_COPY.loadError}</p>;
  if (!m.started) return <EmptyState title={C.mineTitle} hint={C.mineFrom(dayText(m.starts_on))} />;
  return (
    <SectionCard title={C.mineTitle}>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Clean" value={m.clean} />
        <Stat label="Not clean" value={m.not_clean} />
      </div>
      {m.items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{C.mineNone}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {m.items.map((i) => (
            <li key={i.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{i.label}</span>
                <StatusBadge tone={statusTone(i.final)}>{RECORD_STATUS_LABEL[i.final]}</StatusBadge>
              </div>
              <p className="text-muted-foreground">{centralStamp(i.at)}</p>
              {i.note && <p className="break-words">{i.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
