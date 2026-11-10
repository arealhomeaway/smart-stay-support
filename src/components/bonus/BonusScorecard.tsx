/**
 * One person's bonus for one period (Build 13; register BN5, BN6). The person sees their own
 * bars and dollars; their reviewer sees the same card with the reviewer's tools. Every number
 * comes from the database (public.bonus_scorecard); nothing is worked out here.
 */
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import {
  BONUS_COPY,
  LEVEL_LABEL,
  VERIFY_COPY,
  barGeometry,
  centralStamp,
  dayText,
  dollars,
  goalLine,
  measureText,
  rangeText,
  type BonusCard,
  type BonusGoal,
} from "@/lib/bonus";

const STATUS_TONE: Record<BonusCard["status"], StatusTone> = { in_progress: "progress", ready: "waiting", verified: "resolved" };
const LEVEL_TONE: Record<string, StatusTone> = { below: "escalated", goal_met: "progress", strong: "brand", exceeds: "resolved" };

function plainError(e: unknown): string {
  const m = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  return m && m.length < 200 ? m : "That did not save. Try again in a minute.";
}

export function BonusScorecard({ card, onChanged }: { card: BonusCard; onChanged: () => void }) {
  const verified = card.status === "verified";
  return (
    <div className="space-y-4" data-bonus-card>
      <div className="rounded-[14px] border border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{card.plan_name}</h3>
          <StatusBadge tone={STATUS_TONE[card.status]}>{BONUS_COPY.status[card.status]}</StatusBadge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {BONUS_COPY.period}: {card.label}, {rangeText(card.period_start, card.period_end)}
        </p>
        {card.counting_from > card.period_start && (
          <p className="text-sm text-muted-foreground">
            {BONUS_COPY.countingStarts} {dayText(card.counting_from)}.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {BONUS_COPY.paysOn}: {card.pays_on}
        </p>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3">
          <span className="text-sm text-muted-foreground">{verified ? BONUS_COPY.verifiedTotal : BONUS_COPY.estimated}</span>
          <span className={card.total === null ? "text-base font-semibold" : "text-3xl font-bold"} data-bonus-total>
            {card.total === null ? (card.counting_from > card.data_as_of.slice(0, 10) ? BONUS_COPY.notCountedYet : BONUS_COPY.notSet) : dollars(card.total)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {BONUS_COPY.levels}: {dollars(card.amount_goal_met)}, {dollars(card.amount_strong)}, {dollars(card.amount_exceeds)}
        </p>
        {card.fewer_than_three && <p className="mt-2 text-sm">{BONUS_COPY.fewerThanThree}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          {verified && card.verified_at
            ? `${BONUS_COPY.verifiedBy} ${card.verified_by_name ?? "the reviewer"}, ${centralStamp(card.verified_at)}`
            : `${BONUS_COPY.dataAsOf} ${centralStamp(card.data_as_of)}`}
        </p>
      </div>

      <ul className="space-y-3">
        {card.goals.map((g) => (
          <GoalRow key={g.goal_id} g={g} card={card} onChanged={onChanged} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{BONUS_COPY.movedShare}</p>

      <Adjustments card={card} onChanged={onChanged} />
      <Questions card={card} onChanged={onChanged} />
      <VerifyBar card={card} onChanged={onChanged} />
      {card.history.length > 0 && (
        <div className="rounded-[14px] border border-border p-4">
          <h4 className="font-medium">{BONUS_COPY.history}</h4>
          <ul className="mt-2 space-y-1 text-sm">
            {card.history.map((h) => (
              <li key={`${h.action}-${h.done_at}`}>
                {centralStamp(h.done_at)}: {h.action === "verified" ? "Verified" : "Reopened"} at {dollars(h.total)}
                {h.reason ? `. ${h.reason}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GoalRow({ g, card, onChanged }: { g: BonusGoal; card: BonusCard; onChanged: () => void }) {
  const bar = barGeometry(g);
  const counted = g.status === "counted";
  const share = g.effective_share !== null && Number(g.effective_share) !== Number(g.share) ? `${Number(g.share)}%, now ${Math.round(Number(g.effective_share) * 10) / 10}%` : `${Number(g.share)}%`;
  // The reviewer enters a measure only where Resolve cannot count it (the database checks this too).
  const canEnter = card.can_enter && g.active && (g.source === "reviewer" || g.status === "not_tracked" || g.note !== null);
  return (
    <li className="rounded-[14px] border border-border p-4" data-bonus-goal={g.code}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">{g.name}</span>
        <span className="text-sm text-muted-foreground">
          {BONUS_COPY.share} {share}
        </span>
      </div>
      {g.how_measured && <p className="mt-1 text-sm text-muted-foreground">{g.how_measured}</p>}
      {g.active && g.status !== "not_started" && (
        <div className="relative mt-3 h-3 rounded-full bg-muted" aria-hidden="true">
          <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${counted ? bar.fill : 0}%` }} />
          {bar.marks.map((m) => (
            <span key={m.level} className="absolute -top-1 h-5 w-0.5 bg-foreground/60" style={{ left: `${m.at}%` }} />
          ))}
        </div>
      )}
      {g.active && (
        <p className="mt-1 text-xs text-muted-foreground">
          {LEVEL_LABEL.goal_met} {measureText(g.threshold_met, g.unit)}, {LEVEL_LABEL.strong} {measureText(g.threshold_strong, g.unit)},{" "}
          {LEVEL_LABEL.exceeds} {measureText(g.threshold_exceeds, g.unit)}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {counted && g.value !== null && <span className="font-semibold">{measureText(g.value, g.unit)}</span>}
        {counted && g.denominator !== null && g.unit === "percent" && g.source === "automatic" && (
          <span className="text-muted-foreground">
            ({g.numerator} of {g.denominator})
          </span>
        )}
        {counted && g.level ? (
          <StatusBadge tone={LEVEL_TONE[g.level] ?? "context"}>{LEVEL_LABEL[g.level]}</StatusBadge>
        ) : (
          <span className="text-muted-foreground">{goalLine(g)}</span>
        )}
        {counted && g.dollars !== null && <span className="ml-auto font-semibold">{dollars(g.dollars)}</span>}
      </div>
      {g.system_problem && <p className="mt-1 text-sm">{BONUS_COPY.systemProblem}</p>}
      {g.note && (
        <p className="mt-1 text-sm text-muted-foreground">
          {g.note}
          {g.evidence_url ? (
            <>
              {" "}
              <a href={g.evidence_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Evidence
              </a>
            </>
          ) : null}
        </p>
      )}
      {canEnter && <EnterMeasure g={g} card={card} onChanged={onChanged} />}
      {g.facts.length > 0 && <Facts g={g} card={card} onChanged={onChanged} />}
      {card.can_enter && g.source === "automatic" && g.status !== "not_tracked" && g.active && (
        <SystemProblem g={g} card={card} onChanged={onChanged} />
      )}
    </li>
  );
}

function EnterMeasure({ g, card, onChanged }: { g: BonusGoal; card: BonusCard; onChanged: () => void }) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [nothing, setNothing] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("bonus_enter_measure", {
      _plan: card.plan,
      _user: card.user_id,
      _start: card.period_start,
      _goal: g.goal_id,
      _value: nothing ? (null as unknown as number) : Number(value),
      _note: note,
      _evidence_url: evidence || (null as unknown as string),
    });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(VERIFY_COPY.entrySaved);
    setValue("");
    setNote("");
    setEvidence("");
    onChanged();
  };
  const ok = note.trim().length >= 3 && (nothing || (value.trim() !== "" && Number.isFinite(Number(value))));
  return (
    <details className="mt-3 rounded-lg border border-border p-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">{VERIFY_COPY.enter}</summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          {VERIFY_COPY.enterValue} ({g.unit === "percent" ? "percent" : g.unit === "rating" ? "rating out of 5" : "points"})
          <Input inputMode="decimal" value={value} disabled={nothing} onChange={(e) => setValue(e.target.value)} className="min-h-11" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={nothing} onChange={(e) => setNothing(e.target.checked)} />
          {VERIFY_COPY.nothingToMeasure}
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          {VERIFY_COPY.enterNote}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          {VERIFY_COPY.enterEvidence}
          <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} className="min-h-11" />
        </label>
      </div>
      <Button className="mt-3 min-h-11" disabled={!ok || busy} onClick={() => void save()}>
        {VERIFY_COPY.saveEntry}
      </Button>
    </details>
  );
}

function Facts({ g, card, onChanged }: { g: BonusGoal; card: BonusCard; onChanged: () => void }) {
  const [excusing, setExcusing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = new Set(card.adjustments.filter((a) => a.kind === "excused" && a.decision === null).map((a) => a.fact_key));
  const send = async (key: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("bonus_request_adjustment", {
      _plan: card.plan,
      _user: card.user_id,
      _start: card.period_start,
      _goal: g.goal_id,
      _kind: "excused",
      _fact_key: key,
      _reason: reason,
    });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(VERIFY_COPY.sentToCoo);
    setExcusing(null);
    setReason("");
    onChanged();
  };
  return (
    <details className="mt-3">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">
        {BONUS_COPY.facts} ({g.fact_count})
      </summary>
      <ul className="mt-1 divide-y divide-border text-sm">
        {g.facts.map((f) => (
          <li key={f.key} className="py-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 break-words">{f.label}</span>
              {f.at && <span className="text-muted-foreground">{centralStamp(f.at)}</span>}
              {f.score !== null && g.unit === "rating" && <span>{Number(f.score).toFixed(2)}</span>}
              {f.met !== null && (
                <StatusBadge tone={f.excused ? "closed" : f.met ? "resolved" : "escalated"}>
                  {f.excused ? BONUS_COPY.excused : f.met ? BONUS_COPY.met : BONUS_COPY.missed}
                </StatusBadge>
              )}
              {card.can_enter && f.met === false && !f.excused && !pending.has(f.key) && (
                <Button variant="outline" className="min-h-11" onClick={() => setExcusing(excusing === f.key ? null : f.key)}>
                  {VERIFY_COPY.excuse}
                </Button>
              )}
              {pending.has(f.key) && <span className="text-muted-foreground">{VERIFY_COPY.waitingCoo}</span>}
            </div>
            {excusing === f.key && (
              <div className="mt-2 space-y-2">
                <Label htmlFor={`excuse-${f.key}`}>{VERIFY_COPY.excuseReason}</Label>
                <Textarea id={`excuse-${f.key}`} value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button className="min-h-11" disabled={busy || reason.trim().length < 5} onClick={() => void send(f.key)}>
                  {VERIFY_COPY.askCoo}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function SystemProblem({ g, card, onChanged }: { g: BonusGoal; card: BonusCard; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const waiting = card.adjustments.some((a) => a.goal_id === g.goal_id && a.kind === "system_problem" && a.decision === null);
  if (g.system_problem) return null;
  if (waiting) return <p className="mt-2 text-sm text-muted-foreground">{VERIFY_COPY.waitingCoo}</p>;
  const send = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("bonus_request_adjustment", {
      _plan: card.plan,
      _user: card.user_id,
      _start: card.period_start,
      _goal: g.goal_id,
      _kind: "system_problem",
      _fact_key: null as unknown as string,
      _reason: reason,
    });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(VERIFY_COPY.sentToCoo);
    setReason("");
    onChanged();
  };
  return (
    <details className="mt-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">{VERIFY_COPY.systemProblem}</summary>
      <div className="mt-2 space-y-2">
        <Label htmlFor={`sys-${g.goal_id}`}>{VERIFY_COPY.systemReason}</Label>
        <Textarea id={`sys-${g.goal_id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
        <Button className="min-h-11" disabled={busy || reason.trim().length < 5} onClick={() => void send()}>
          {VERIFY_COPY.askCoo}
        </Button>
      </div>
    </details>
  );
}

function Adjustments({ card, onChanged }: { card: BonusCard; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  if (card.adjustments.length === 0 || !(card.can_enter || card.can_decide || card.can_reopen)) return null;
  const goalName = (id: string) => card.goals.find((g) => g.goal_id === id)?.name ?? "Goal";
  const decide = async (id: string, approve: boolean) => {
    setBusy(true);
    const { error } = await supabase.rpc("bonus_decide_adjustment", { _id: id, _approve: approve, _note: null as unknown as string });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(approve ? VERIFY_COPY.approved : VERIFY_COPY.declined);
    onChanged();
  };
  return (
    <div className="rounded-[14px] border border-border p-4" data-bonus-adjustments>
      <h4 className="font-medium">{VERIFY_COPY.rulesNote}</h4>
      <ul className="mt-2 divide-y divide-border text-sm">
        {card.adjustments.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1 break-words">
              {goalName(a.goal_id)}: {a.kind === "excused" ? VERIFY_COPY.excuse : VERIFY_COPY.systemProblem}. {a.reason}
            </span>
            {a.decision ? (
              <StatusBadge tone={a.decision === "approved" ? "resolved" : "closed"}>
                {a.decision === "approved" ? VERIFY_COPY.approved : VERIFY_COPY.declined}
              </StatusBadge>
            ) : card.can_decide ? (
              <>
                <Button className="min-h-11" disabled={busy} onClick={() => void decide(a.id, true)}>
                  {VERIFY_COPY.approve}
                </Button>
                <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => void decide(a.id, false)}>
                  {VERIFY_COPY.decline}
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">{VERIFY_COPY.waitingCoo}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Questions({ card, onChanged }: { card: BonusCard; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const isReviewSide = card.can_enter || card.can_reopen || card.can_decide;
  if (card.questions.length === 0 && !card.can_raise_question && !(card.status === "verified" && card.question_window_closes)) return null;
  const raise = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("bonus_raise_question", { _plan: card.plan, _start: card.period_start, _question: text });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(BONUS_COPY.questionSent);
    setText("");
    onChanged();
  };
  const answer = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("bonus_answer_question", { _id: id, _answer: answers[id] ?? "" });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(VERIFY_COPY.answerSaved);
    onChanged();
  };
  return (
    <div className="rounded-[14px] border border-border p-4" data-bonus-questions>
      <h4 className="font-medium">{BONUS_COPY.questions}</h4>
      {card.questions.map((q) => (
        <div key={q.id} className="mt-2 text-sm">
          <p className="break-words">{q.question}</p>
          {q.answer ? (
            <p className="mt-1 break-words text-muted-foreground">
              {BONUS_COPY.answered}: {q.answer}
            </p>
          ) : isReviewSide ? (
            <div className="mt-2 space-y-2">
              <Textarea value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} />
              <Button className="min-h-11" disabled={busy || (answers[q.id] ?? "").trim().length < 3} onClick={() => void answer(q.id)}>
                {VERIFY_COPY.answer}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      {card.can_raise_question ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-muted-foreground">
            {BONUS_COPY.questionWindow} {centralStamp(card.question_window_closes)}.
          </p>
          <Label htmlFor="bonus-question">{BONUS_COPY.raiseQuestion}</Label>
          <Textarea id="bonus-question" placeholder={BONUS_COPY.questionPlaceholder} value={text} onChange={(e) => setText(e.target.value)} />
          <Button className="min-h-11" disabled={busy || text.trim().length < 5} onClick={() => void raise()} data-bonus-raise>
            {BONUS_COPY.sendQuestion}
          </Button>
        </div>
      ) : card.status === "verified" && !isReviewSide ? (
        <p className="mt-2 text-sm text-muted-foreground">{BONUS_COPY.questionClosed}</p>
      ) : null}
    </div>
  );
}

function VerifyBar({ card, onChanged }: { card: BonusCard; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!card.can_verify && !card.can_reopen) return null;
  const verify = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("bonus_verify", { _plan: card.plan, _user: card.user_id, _start: card.period_start });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(VERIFY_COPY.verified);
    onChanged();
  };
  const reopen = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("bonus_reopen", { _plan: card.plan, _user: card.user_id, _start: card.period_start, _reason: reason });
    setBusy(false);
    if (error) { toast.error(plainError(error)); return; }
    toast.success(VERIFY_COPY.reopened);
    setReason("");
    onChanged();
  };
  return (
    <div className="rounded-[14px] border border-border p-4">
      {card.can_verify && (
        <Button className="min-h-11 w-full sm:w-auto" disabled={busy} onClick={() => void verify()} data-bonus-verify>
          {VERIFY_COPY.verify}
        </Button>
      )}
      {card.can_reopen && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">{VERIFY_COPY.reopen}</summary>
          <div className="mt-2 space-y-2">
            <Label htmlFor="bonus-reopen">{VERIFY_COPY.reopenReason}</Label>
            <Textarea id="bonus-reopen" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Button variant="outline" className="min-h-11" disabled={busy || reason.trim().length < 5} onClick={() => void reopen()}>
              {VERIFY_COPY.reopen}
            </Button>
          </div>
        </details>
      )}
    </div>
  );
}
