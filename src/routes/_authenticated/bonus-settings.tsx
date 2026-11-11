/**
 * Bonus settings (Build 13; register BN5, BN11; docs/specs/bonus-guide-values.md D): plans,
 * amounts for a full period and for a single period, goals with their share, three targets and
 * unit, how each is measured and whether it is Active, targets that change by period, the
 * people on each plan with their eligibility date, the Director's quarterly priorities, and the
 * history of every change. Only the COO, the CEO and Admin open it; every write goes through a
 * checked database function that keeps who, when and the old value.
 */
import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RequireCapability } from "@/components/RequireCapability";
import { PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { useStaffDirectory, displayName } from "@/hooks/useTeam";
import {
  PRIORITY_STATUS_LABEL,
  SETTINGS_COPY,
  SOURCE_LABEL,
  UNIT_LABEL,
  activeShareTotal,
  centralStamp,
  dayText,
  dollars,
  type BonusUnit,
} from "@/lib/bonus";

export const Route = createFileRoute("/_authenticated/bonus-settings")({
  head: () => ({
    meta: [
      { title: "Bonus settings · Resolve" },
      { name: "description", content: "Bonus plans, amounts, goals and targets, with the history of every change." },
      { property: "og:title", content: "Bonus settings · Resolve" },
      { property: "og:description", content: "Bonus plans, amounts, goals and targets, with the history of every change." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="admin_pages" title={SETTINGS_COPY.title}>
      <BonusSettingsPage />
    </RequireCapability>
  ),
});

type Plan = { code: string; name: string; period_kind: string; counting_start: string; reviewer_name: string; amount_goal_met: number | null; amount_strong: number | null; amount_exceeds: number | null };
type PeriodAmount = { plan_code: string; period_start: string; period_end: string; label: string; amount_goal_met: number; amount_strong: number; amount_exceeds: number };
type Goal = { id: string; plan_code: string; position: number; code: string; name: string; share: number; unit: BonusUnit; threshold_met: number; threshold_strong: number; threshold_exceeds: number; source: "automatic" | "reviewer"; measure_key: string | null; how_measured: string | null; active: boolean };
type Target = { goal_id: string; applies_from: string; threshold_met: number; threshold_strong: number; threshold_exceeds: number };
type Person = { user_id: string; plan_code: string; eligible_from: string; active: boolean; name: string };
type Priority = { id: string; user_id: string; period_start: string; name: string; points: number; status: keyof typeof PRIORITY_STATUS_LABEL; accepted_on: string | null; result_note: string | null };
type History = { id: string; area: string; row_key: string; field: string; old_value: unknown; new_value: unknown; reason: string | null; changed_at: string; by_name: string | null };
type Settings = { plans: Plan[]; period_amounts: PeriodAmount[]; goals: Goal[]; thresholds: Target[]; participants: Person[]; priorities: Priority[]; history: History[] };

const INPUT = "min-h-11";
const SELECT = "h-11 rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";
const LABEL = "flex flex-col gap-1 text-[13px] text-muted-foreground";
const KEY = ["bonus-settings"] as const;

function plainError(e: unknown): string {
  const m = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  return m && m.length < 200 ? m : "That did not save. Try again in a minute.";
}
const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

function useSave() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => PromiseLike<{ error: unknown }>) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) {
      toast.error(plainError(error));
      return false;
    }
    toast.success(SETTINGS_COPY.saved);
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: ["bonus-card"] });
    return true;
  };
  return { busy, run };
}

function BonusSettingsPage() {
  useShellPageLabel(SETTINGS_COPY.title);
  const q = useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.rpc("bonus_settings");
      if (error) throw error;
      return data as unknown as Settings;
    },
  });
  return (
    <div className="space-y-6" data-bonus-settings>
      <PageHeader title={SETTINGS_COPY.title} description={SETTINGS_COPY.hint} />
      <p className="rounded-[14px] border border-border p-4 text-sm font-medium" data-bonus-notice>
        {SETTINGS_COPY.notice}
      </p>
      {q.isPending ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : q.error || !q.data ? (
        <p role="alert" className="text-sm">The bonus settings could not be loaded. Try again in a minute.</p>
      ) : (
        <>
          <Plans s={q.data} />
          <PeriodAmounts s={q.data} />
          <Goals s={q.data} />
          <Targets s={q.data} />
          <People s={q.data} />
          <Priorities s={q.data} />
          <HistoryList s={q.data} />
        </>
      )}
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`${LABEL} ${wide ? "sm:col-span-2" : ""}`}>{label}{children}</label>;
}

function Plans({ s }: { s: Settings }) {
  return (
    <SectionCard title={SETTINGS_COPY.plans}>
      <div className="space-y-4">
        {s.plans.map((p) => (
          <PlanForm key={p.code} p={p} />
        ))}
      </div>
    </SectionCard>
  );
}

function PlanForm({ p }: { p: Plan }) {
  const { busy, run } = useSave();
  const [start, setStart] = useState(p.counting_start);
  const [met, setMet] = useState(p.amount_goal_met === null ? "" : String(p.amount_goal_met));
  const [strong, setStrong] = useState(p.amount_strong === null ? "" : String(p.amount_strong));
  const [exc, setExc] = useState(p.amount_exceeds === null ? "" : String(p.amount_exceeds));
  const [reason, setReason] = useState("");
  return (
    <div className="rounded-[14px] border border-border p-4" data-bonus-plan={p.code}>
      <h3 className="font-semibold">{p.name}</h3>
      <p className="text-sm text-muted-foreground">
        Period: {p.period_kind === "monthly" ? "monthly" : "quarterly"}. Verified by the {p.reviewer_name}. Full period: {dollars(p.amount_goal_met)}, {dollars(p.amount_strong)},{" "}
        {dollars(p.amount_exceeds)}.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Counting starts"><Input type="date" className={INPUT} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Goal met amount, full period"><Input inputMode="decimal" className={INPUT} value={met} onChange={(e) => setMet(e.target.value)} /></Field>
        <Field label="Strong amount, full period"><Input inputMode="decimal" className={INPUT} value={strong} onChange={(e) => setStrong(e.target.value)} /></Field>
        <Field label="Exceeds amount, full period"><Input inputMode="decimal" className={INPUT} value={exc} onChange={(e) => setExc(e.target.value)} /></Field>
        <Field label={SETTINGS_COPY.reason} wide><Input className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
      <Button
        className="mt-3 min-h-11"
        disabled={busy}
        onClick={() =>
          void run(() =>
            supabase.rpc("bonus_save_plan", {
              _code: p.code,
              _counting_start: start,
              _met: num(met) as number,
              _strong: num(strong) as number,
              _exceeds: num(exc) as number,
              _reason: reason,
            }),
          )
        }
      >
        Save
      </Button>
    </div>
  );
}

function PeriodAmounts({ s }: { s: Settings }) {
  const { busy, run } = useSave();
  const [plan, setPlan] = useState(s.plans[0]?.code ?? "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [label, setLabel] = useState("");
  const [met, setMet] = useState("");
  const [strong, setStrong] = useState("");
  const [exc, setExc] = useState("");
  const planName = (c: string) => s.plans.find((p) => p.code === c)?.name ?? c;
  const edit = (a: PeriodAmount) => {
    setPlan(a.plan_code);
    setStart(a.period_start);
    setEnd(a.period_end);
    setLabel(a.label);
    setMet(String(a.amount_goal_met));
    setStrong(String(a.amount_strong));
    setExc(String(a.amount_exceeds));
  };
  return (
    <SectionCard title={SETTINGS_COPY.periodAmounts} description="A first or short period with its own amounts.">
      <ul className="divide-y divide-border text-sm">
        {s.period_amounts.map((a) => (
          <li key={`${a.plan_code}:${a.period_start}`} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1">
              {planName(a.plan_code)}, {a.label} ({dayText(a.period_start)} to {dayText(a.period_end)}): {dollars(a.amount_goal_met)}, {dollars(a.amount_strong)},{" "}
              {dollars(a.amount_exceeds)}
            </span>
            <Button variant="outline" className="min-h-11" onClick={() => edit(a)}>Edit</Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Plan">
          <select className={SELECT} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {s.plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Name of the period"><Input className={INPUT} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="First day"><Input type="date" className={INPUT} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Last day"><Input type="date" className={INPUT} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        <Field label="Goal met amount"><Input inputMode="decimal" className={INPUT} value={met} onChange={(e) => setMet(e.target.value)} /></Field>
        <Field label="Strong amount"><Input inputMode="decimal" className={INPUT} value={strong} onChange={(e) => setStrong(e.target.value)} /></Field>
        <Field label="Exceeds amount"><Input inputMode="decimal" className={INPUT} value={exc} onChange={(e) => setExc(e.target.value)} /></Field>
      </div>
      <Button
        className="mt-3 min-h-11"
        disabled={busy || !start || !end || !label}
        onClick={() =>
          void run(() =>
            supabase.rpc("bonus_save_period_amounts", {
              _plan: plan, _start: start, _end: end, _label: label,
              _met: num(met) as number, _strong: num(strong) as number, _exceeds: num(exc) as number, _reason: "",
            }),
          )
        }
      >
        Save period amounts
      </Button>
    </SectionCard>
  );
}

function Goals({ s }: { s: Settings }) {
  return (
    <SectionCard title={SETTINGS_COPY.goals}>
      <div className="space-y-6">
        {s.plans.map((p) => {
          const goals = s.goals.filter((g) => g.plan_code === p.code);
          const total = activeShareTotal(goals);
          return (
            <div key={p.code} className="space-y-2">
              <h3 className="font-semibold">{p.name}</h3>
              {total !== 100 && (
                <p className="text-sm" role="status">
                  {SETTINGS_COPY.total100} {total} percent, not 100. Skipped goals move their share to the others.
                </p>
              )}
              {goals.map((g) => <GoalForm key={g.id} g={g} plan={p.code} />)}
              <GoalForm plan={p.code} />
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function GoalForm({ g, plan }: { g?: Goal; plan: string }) {
  const { busy, run } = useSave();
  const [name, setName] = useState(g?.name ?? "");
  const [share, setShare] = useState(g ? String(Number(g.share)) : "");
  const [unit, setUnit] = useState<BonusUnit>(g?.unit ?? "percent");
  const [met, setMet] = useState(g ? String(Number(g.threshold_met)) : "");
  const [strong, setStrong] = useState(g ? String(Number(g.threshold_strong)) : "");
  const [exc, setExc] = useState(g ? String(Number(g.threshold_exceeds)) : "");
  const [source, setSource] = useState<"automatic" | "reviewer">(g?.source ?? "reviewer");
  const [active, setActive] = useState(g?.active ?? true);
  const [how, setHow] = useState(g?.how_measured ?? "");
  const [reason, setReason] = useState("");
  return (
    <details className="rounded-[14px] border border-border p-3" data-bonus-goal-form={g?.code ?? "new"}>
      <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2">
        <span className="font-medium">{g ? g.name : SETTINGS_COPY.addGoal}</span>
        {g && (
          <span className="text-sm text-muted-foreground">
            {Number(g.share)}%, {Number(g.threshold_met)} / {Number(g.threshold_strong)} / {Number(g.threshold_exceeds)} {UNIT_LABEL[g.unit]}, {g.active ? "Active" : "Inactive"}
          </span>
        )}
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" wide><Input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Share of the bonus (percent)"><Input inputMode="decimal" className={INPUT} value={share} onChange={(e) => setShare(e.target.value)} /></Field>
        <Field label="Unit">
          <select className={SELECT} value={unit} onChange={(e) => setUnit(e.target.value as BonusUnit)}>
            <option value="percent">Percent</option>
            <option value="rating">Rating out of 5</option>
            <option value="points">Points</option>
          </select>
        </Field>
        <Field label="Goal met target"><Input inputMode="decimal" className={INPUT} value={met} onChange={(e) => setMet(e.target.value)} /></Field>
        <Field label="Strong target"><Input inputMode="decimal" className={INPUT} value={strong} onChange={(e) => setStrong(e.target.value)} /></Field>
        <Field label="Exceeds target"><Input inputMode="decimal" className={INPUT} value={exc} onChange={(e) => setExc(e.target.value)} /></Field>
        <Field label="How it is measured">
          <select className={SELECT} value={source} onChange={(e) => setSource(e.target.value as "automatic" | "reviewer")}>
            {g?.measure_key && <option value="automatic">{SOURCE_LABEL.automatic}</option>}
            <option value="reviewer">{SOURCE_LABEL.reviewer}</option>
          </select>
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
        <Field label="What it measures, in plain words" wide><Textarea value={how} onChange={(e) => setHow(e.target.value)} /></Field>
        <Field label={SETTINGS_COPY.reason} wide><Input className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </div>
      <Button
        className="mt-3 min-h-11"
        disabled={busy || name.trim().length < 3}
        onClick={() =>
          void run(() =>
            supabase.rpc("bonus_save_goal", {
              _id: (g?.id ?? null) as unknown as string,
              _plan: plan, _name: name, _share: num(share) as number, _unit: unit,
              _met: num(met) as number, _strong: num(strong) as number, _exceeds: num(exc) as number,
              _source: source, _active: active, _how: how, _reason: reason,
            }),
          )
        }
      >
        {g ? "Save goal" : SETTINGS_COPY.addGoal}
      </Button>
    </details>
  );
}

function Targets({ s }: { s: Settings }) {
  const { busy, run } = useSave();
  const [goal, setGoal] = useState(s.goals.find((g) => g.code === "guest_rating")?.id ?? s.goals[0]?.id ?? "");
  const [from, setFrom] = useState("");
  const [met, setMet] = useState("");
  const [strong, setStrong] = useState("");
  const [exc, setExc] = useState("");
  const goalName = (id: string) => s.goals.find((g) => g.id === id)?.name ?? "Goal";
  return (
    <SectionCard title={SETTINGS_COPY.targetsByPeriod} description="A target that applies from a date replaces the goal's own target from then on.">
      <ul className="divide-y divide-border text-sm">
        {s.thresholds.map((t) => (
          <li key={`${t.goal_id}:${t.applies_from}`} className="py-2">
            {goalName(t.goal_id)} from {dayText(t.applies_from)}: {Number(t.threshold_met)}, {Number(t.threshold_strong)}, {Number(t.threshold_exceeds)}
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Goal">
          <select className={SELECT} value={goal} onChange={(e) => setGoal(e.target.value)}>
            {s.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Applies from"><Input type="date" className={INPUT} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Goal met target"><Input inputMode="decimal" className={INPUT} value={met} onChange={(e) => setMet(e.target.value)} /></Field>
        <Field label="Strong target"><Input inputMode="decimal" className={INPUT} value={strong} onChange={(e) => setStrong(e.target.value)} /></Field>
        <Field label="Exceeds target"><Input inputMode="decimal" className={INPUT} value={exc} onChange={(e) => setExc(e.target.value)} /></Field>
      </div>
      <Button
        className="mt-3 min-h-11"
        disabled={busy || !from}
        onClick={() =>
          void run(() =>
            supabase.rpc("bonus_save_goal_targets", {
              _goal: goal, _from: from, _met: num(met) as number, _strong: num(strong) as number, _exceeds: num(exc) as number, _reason: "",
            }),
          )
        }
      >
        Save targets
      </Button>
    </SectionCard>
  );
}

function People({ s }: { s: Settings }) {
  const staff = useStaffDirectory();
  const { busy, run } = useSave();
  const [user, setUser] = useState("");
  const [plan, setPlan] = useState("coordinator");
  const [from, setFrom] = useState("");
  const planName = (c: string) => s.plans.find((p) => p.code === c)?.name ?? c;
  return (
    <SectionCard title={SETTINGS_COPY.people} description="Each person's eligibility date. A coordinator sees nothing until that date.">
      <ul className="divide-y divide-border text-sm">
        {s.participants.map((p) => <PersonRow key={`${p.user_id}:${p.plan_code}`} p={p} planName={planName(p.plan_code)} />)}
      </ul>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Person">
          <select className={SELECT} value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="">Choose a person</option>
            {(staff.data ?? []).map((m) => <option key={m.id} value={m.id}>{displayName(m)}</option>)}
          </select>
        </Field>
        <Field label="Plan">
          <select className={SELECT} value={plan} onChange={(e) => setPlan(e.target.value)}>
            {s.plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Eligible from"><Input type="date" className={INPUT} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      </div>
      <Button
        className="mt-3 min-h-11"
        disabled={busy || !user || !from}
        onClick={() => void run(() => supabase.rpc("bonus_save_participant", { _user: user, _plan: plan, _eligible_from: from, _active: true, _reason: "" }))}
      >
        Add to the plan
      </Button>
    </SectionCard>
  );
}

function PersonRow({ p, planName }: { p: Person; planName: string }) {
  const { busy, run } = useSave();
  const [from, setFrom] = useState(p.eligible_from);
  const [active, setActive] = useState(p.active);
  return (
    <li className="flex flex-wrap items-end gap-3 py-3">
      <span className="min-w-40 flex-1 font-medium">
        {p.name}, {planName}
      </span>
      <Field label="Eligible from"><Input type="date" className={INPUT} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-5" checked={active} onChange={(e) => setActive(e.target.checked)} />
        On the plan
      </label>
      <Button
        variant="outline"
        className="min-h-11"
        disabled={busy}
        onClick={() => void run(() => supabase.rpc("bonus_save_participant", { _user: p.user_id, _plan: p.plan_code, _eligible_from: from, _active: active, _reason: "" }))}
      >
        Save
      </Button>
    </li>
  );
}

function Priorities({ s }: { s: Settings }) {
  const directors = s.participants.filter((p) => p.plan_code === "director_ops");
  const starts = Array.from(
    new Set([
      ...s.period_amounts.filter((a) => a.plan_code === "director_ops").map((a) => a.period_start),
      ...s.priorities.map((x) => x.period_start),
      "2027-01-01",
      "2027-04-01",
    ]),
  ).sort();
  const [start, setStart] = useState(starts[0] ?? "");
  const [user, setUser] = useState(directors[0]?.user_id ?? "");
  const rows = s.priorities.filter((x) => x.period_start === start && x.user_id === user);
  const total = rows.reduce((t, x) => t + Number(x.points), 0);
  const label = (d: string) => s.period_amounts.find((a) => a.plan_code === "director_ops" && a.period_start === d)?.label ?? `From ${dayText(d)}`;
  return (
    <SectionCard title={SETTINGS_COPY.priorities} description={SETTINGS_COPY.prioritiesHint}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Period">
          <select className={SELECT} value={start} onChange={(e) => setStart(e.target.value)}>
            {starts.map((d) => <option key={d} value={d}>{label(d)}</option>)}
          </select>
        </Field>
        {directors.length > 1 && (
          <Field label="Director of Operations">
            <select className={SELECT} value={user} onChange={(e) => setUser(e.target.value)}>
              {directors.map((d) => <option key={d.user_id} value={d.user_id}>{d.name}</option>)}
            </select>
          </Field>
        )}
      </div>
      <p className="mt-2 text-sm" role="status">
        {SETTINGS_COPY.mustReach100} {total} points{total === 100 ? "." : ", and must reach 100."}
      </p>
      <div className="mt-2 space-y-2">
        {rows.map((x) => <PriorityForm key={x.id} x={x} user={user} start={start} />)}
        {user && start && <PriorityForm user={user} start={start} />}
      </div>
    </SectionCard>
  );
}

function PriorityForm({ x, user, start }: { x?: Priority; user: string; start: string }) {
  const { busy, run } = useSave();
  const [name, setName] = useState(x?.name ?? "");
  const [points, setPoints] = useState(x ? String(x.points) : "");
  const [status, setStatus] = useState<Priority["status"]>(x?.status ?? "proposed");
  const [accepted, setAccepted] = useState(x?.accepted_on ?? "");
  const [result, setResult] = useState(x?.result_note ?? "");
  return (
    <details className="rounded-[14px] border border-border p-3" open={!x}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2">
        <span className="font-medium">{x ? x.name : "Add a priority"}</span>
        {x && <span className="text-sm text-muted-foreground">{x.points} points, {PRIORITY_STATUS_LABEL[x.status]}</span>}
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" wide><Input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Points"><Input inputMode="numeric" className={INPUT} value={points} onChange={(e) => setPoints(e.target.value)} /></Field>
        <Field label="Status">
          <select className={SELECT} value={status} onChange={(e) => setStatus(e.target.value as Priority["status"])}>
            {Object.entries(PRIORITY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Accepted on"><Input type="date" className={INPUT} value={accepted} onChange={(e) => setAccepted(e.target.value)} /></Field>
        <Field label="The agreed result" wide><Textarea value={result} onChange={(e) => setResult(e.target.value)} /></Field>
      </div>
      <Button
        className="mt-3 min-h-11"
        disabled={busy || name.trim().length < 3 || points.trim() === ""}
        onClick={() =>
          void run(() =>
            supabase.rpc("bonus_save_priority", {
              _id: (x?.id ?? null) as unknown as string, _user: user, _start: start, _name: name, _points: Number(points),
              _status: status, _accepted_on: (accepted || null) as unknown as string, _result_note: result,
            }),
          )
        }
      >
        {x ? "Save priority" : "Add the priority"}
      </Button>
    </details>
  );
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "Not set";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function HistoryList({ s }: { s: Settings }) {
  return (
    <SectionCard title={SETTINGS_COPY.history}>
      {s.history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No changes yet.</p>
      ) : (
        <ul className="divide-y divide-border text-sm" data-bonus-history>
          {s.history.map((h) => (
            <li key={h.id} className="py-2 break-words">
              {centralStamp(h.changed_at)}, {h.by_name ?? "Team member"}: {h.area} {h.field} from {show(h.old_value)} to {show(h.new_value)}
              {h.reason ? `. ${h.reason}` : ""}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
