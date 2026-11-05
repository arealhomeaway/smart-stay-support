/**
 * The current guided-checklist step, inside "Do this now". One step at a time:
 * answering records who/when in ticket activity and reveals the next step.
 * Actions open screens that already exist; limits come from existing rules.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/page";
import { usDate, usDateTime } from "@/lib/dates";
import {
  ACTION_LABELS,
  NOT_APPLICABLE,
  answerHistoryLine,
  answerProblem,
  checklistProgress,
  fillQuestion,
  parseChecklistRow,
  refundLimitsText,
  repairBand,
  type ChecklistAction,
  type ChecklistAnswer,
  type ChecklistFact,
  type ChecklistStep,
  type ChecklistTemplate,
} from "@/lib/ticket-checklists";
import { ownerRezGuestUpdate } from "@/lib/dispatch-next-step";

const NEXT_UPDATE = [
  { label: "In 1 hour", hours: 1 },
  { label: "In 2 hours", hours: 2 },
  { label: "In 4 hours", hours: 4 },
  { label: "Tomorrow morning", hours: -1 },
  { label: "No further update needed", hours: 0 },
];
function nextUpdateAt(hours: number): string | null {
  if (hours === 0) return null;
  const d = new Date();
  if (hours === -1) { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); } else d.setHours(d.getHours() + hours);
  return d.toISOString();
}

export type ChecklistFacts = {
  guest: string | null;
  lockSystem: string | null;
  reservation: string | null;
  lastStay: string | null;
  nextClean: string | null;
  nextArrival: string | null;
};

type Db = { from: (t: string) => any };

export function usePinnedChecklist(playbookId: string | null | undefined) {
  return useQuery({
    queryKey: ["ticket-checklist-template", playbookId],
    enabled: Boolean(playbookId),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as Db)
        .from("playbooks")
        .select("id, title, version, checklist, checklist_category, sop_url")
        .eq("id", playbookId)
        .maybeSingle();
      if (error) throw error;
      return data ? parseChecklistRow(data) : null;
    },
  });
}

export function useChecklistAnswers(ticketId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["ticket-checklist-answers", ticketId],
    enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as Db)
        .from("ticket_steps")
        .select("step_key, answer, answer_fields, note, not_applicable_reason, completed_by, completed_at, created_at")
        .eq("ticket_id", ticketId)
        .not("step_key", "is", null);
      if (error) throw error;
      return ((data ?? []) as Array<Record<string, any>>).map(
        (r): ChecklistAnswer => ({
          stepKey: r["step_key"],
          value: r["answer"],
          note: r["answer"] === NOT_APPLICABLE ? r["not_applicable_reason"] : r["note"],
          fields: r["answer_fields"] ?? null,
          answeredBy: r["completed_by"] ?? null,
          answeredAt: r["completed_at"] ?? r["created_at"],
        }),
      );
    },
  });
}

/** Presentational card; also used by the editor's preview with local answers. */
export function ChecklistStepView({
  template,
  answers,
  activeGuest,
  facts,
  readOnly,
  busy,
  onAnswer,
  onAction,
  actionSlot,
  waitingControl,
  nameFor,
}: {
  template: ChecklistTemplate;
  answers: ChecklistAnswer[];
  activeGuest: boolean;
  facts: ChecklistFacts;
  readOnly: boolean;
  busy: boolean;
  onAnswer: (step: ChecklistStep, a: { value: string; note: string; fields: Record<string, string>; nextUpdate: string | null }) => void;
  onAction?: (action: ChecklistAction, step: ChecklistStep) => void;
  /** Inline existing screen for an action (for example the vendor and work order flow). */
  actionSlot?: (action: ChecklistAction) => ReactNode;
  waitingControl?: ReactNode;
  nameFor?: (id: string | null | undefined) => string;
}) {
  const progress = checklistProgress(template, answers, activeGuest);
  const step = progress.current;
  const [choice, setChoice] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [na, setNa] = useState(false);
  const [nextHours, setNextHours] = useState(2);
  const reset = () => { setChoice(null); setNote(""); setFields({}); setNa(false); };

  const doneList = progress.done.length > 0 && (
    <details className="group rounded-md border border-border px-3 py-2 text-sm" data-testid="checklist-history">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-muted-foreground">
        <span>{progress.done.length} step{progress.done.length === 1 ? "" : "s"} done</span>
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <ol className="mt-2 space-y-1">
        {progress.done.map(({ step: s, answer, option }) => (
          <li key={s.key} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <span className="font-medium">{s.label}. {fillQuestion(s.question, facts)}</span>{" "}
              <span className="text-muted-foreground">
                {answer.value === NOT_APPLICABLE ? `Doesn't apply: ${answer.note ?? ""}` : (option?.label ?? answer.value)}
                {answer.answeredAt ? ` · ${nameFor ? nameFor(answer.answeredBy) + ", " : ""}${usDateTime(answer.answeredAt)}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </details>
  );

  if (!step) {
    return (
      <div className="space-y-3" data-testid="checklist-card">
        <p className="font-semibold">Checklist complete.</p>
        {doneList}
      </div>
    );
  }

  const opt = step.options.find((o) => o.value === choice) ?? null;
  const showNextUpdate = step.guestResponse && choice === "yes";
  const problem = choice || na
    ? answerProblem(step, { value: na ? NOT_APPLICABLE : choice!, note, fields })
    : "Choose an answer.";
  const factLines = (step.facts ?? []).map((f) => factLine(f, facts, fields, answers)).filter(Boolean) as string[];

  return (
    <div className="space-y-3" data-testid="checklist-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {template.title} · Step {step.label}
        </p>
        <span className="text-xs text-muted-foreground">{progress.done.length} of {progress.total} done</span>
      </div>
      <h3 className="text-lg font-semibold" data-testid="checklist-question">{fillQuestion(step.question, facts)}</h3>
      {step.help && <p className="text-sm text-muted-foreground">{step.help}</p>}
      {factLines.length > 0 && (
        <ul className="space-y-0.5 rounded-md bg-sunken px-3 py-2 text-sm" aria-label="What Resolve already knows">
          {factLines.map((l) => <li key={l}>{l}</li>)}
        </ul>
      )}
      {progress.pending && progress.pending.value !== NOT_APPLICABLE && (
        <p className="text-sm text-muted-foreground">
          Last answer: {step.options.find((o) => o.value === progress.pending!.value)?.label}
          {progress.pending.answeredAt ? `, ${usDateTime(progress.pending.answeredAt)}` : ""}. This step stays open.
        </p>
      )}

      {step.action && actionSlot?.(step.action)}
      {step.action && !actionSlot?.(step.action) && onAction && !readOnly && (
        <Button variant="outline" size="sm" onClick={() => onAction(step.action!, step)}>{ACTION_LABELS[step.action]}</Button>
      )}

      {!readOnly && !na && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Answer">
          {step.options.map((o) => (
            <Button key={o.value} variant={choice === o.value ? "default" : "outline"} onClick={() => setChoice(o.value)}>
              {o.label}
            </Button>
          ))}
        </div>
      )}
      {opt?.effect && !na && <p className="text-sm text-muted-foreground">{opt.effect}</p>}
      {opt?.action && !na && !readOnly && (actionSlot?.(opt.action) ?? (onAction && (
        <Button variant="outline" size="sm" onClick={() => onAction(opt.action!, step)}>{ACTION_LABELS[opt.action]}</Button>
      )))}

      {!readOnly && !na && (step.fields ?? []).map((f) => (
        <div key={f.key} className="space-y-1">
          <label className="text-sm font-medium" htmlFor={`cl-${step.key}-${f.key}`}>{f.label}{f.required ? "" : " (optional)"}</label>
          <Input
            id={`cl-${step.key}-${f.key}`}
            type={f.kind === "datetime" ? "datetime-local" : "text"}
            inputMode={f.kind === "money" ? "decimal" : undefined}
            value={fields[f.key] ?? ""}
            onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
          />
        </div>
      ))}

      {!readOnly && (opt?.noteRequired || na || (choice && !opt?.noteRequired)) && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={na ? "Why doesn't this apply? (required)" : opt?.noteRequired ? "Note (required)" : "Optional note"}
          aria-label={na ? "Reason this step doesn't apply" : "Note"}
        />
      )}

      {showNextUpdate && !na && (
        <div className="space-y-1">
          <p className="text-sm font-medium">When is the next update due?</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Next guest update">
            {NEXT_UPDATE.map((o) => (
              <button key={o.label} type="button" onClick={() => setNextHours(o.hours)}>
                <Chip className={nextHours === o.hours ? "border-primary" : undefined}>{o.label}</Chip>
              </button>
            ))}
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            disabled={busy || Boolean(problem)}
            title={problem ?? undefined}
            onClick={() => {
              onAnswer(step, { value: na ? NOT_APPLICABLE : choice!, note, fields, nextUpdate: showNextUpdate ? nextUpdateAt(nextHours) : null });
              reset();
            }}
          >
            Save and continue
          </Button>
          {problem && (choice || na) && <span className="text-sm text-muted-foreground">{problem}</span>}
          <Button variant="ghost" size="sm" onClick={() => { setNa(!na); setChoice(null); }}>
            {na ? "Back to the answers" : "This doesn't apply"}
          </Button>
          {waitingControl}
        </div>
      )}
      {doneList}
    </div>
  );
}

function factLine(f: ChecklistFact, facts: ChecklistFacts, fields: Record<string, string>, answers: ChecklistAnswer[]): string | null {
  switch (f) {
    case "guest": return facts.guest ? `Guest: ${facts.guest}` : "No guest in the home right now.";
    case "lock_system": return `Lock system: ${facts.lockSystem ?? "not on file"}`;
    case "reservation": return facts.reservation ? `Reservation: ${facts.reservation}` : null;
    case "last_stay": return facts.lastStay ? `Last stay: ${facts.lastStay}` : "Last stay: not on file";
    case "next_clean": return `Next clean: ${facts.nextClean ? usDate(facts.nextClean) : "none scheduled"}`;
    case "next_arrival": return facts.nextArrival ? `Next arrival: ${usDate(facts.nextArrival)}` : null;
    case "refund_limits": return `Refund limits: ${refundLimitsText()}`;
    case "repair_band": {
      const raw = fields["amount"] ?? answers.find((a) => a.stepKey === "quote")?.fields?.["amount"];
      const emergency = answers.find((a) => a.stepKey === "emergency")?.value === "yes";
      const band = raw ? repairBand(Number(raw), emergency) : null;
      return band ? `${band.label}. ${band.reason}` : "Enter the amount to see who approves.";
    }
  }
}

/** Live card on a ticket with a pinned checklist. */
export function ChecklistStepCard({
  ticketId,
  playbookId,
  activeGuest,
  facts,
  readOnly,
  log,
  onChanged,
  onAction,
  actionSlot,
  waitingControl,
  nameFor,
}: {
  ticketId: string;
  playbookId: string;
  activeGuest: boolean;
  facts: ChecklistFacts;
  readOnly: boolean;
  log: (kind: string, body: string, eventType?: string) => Promise<void>;
  onChanged: () => void | Promise<void>;
  onAction: (action: ChecklistAction, step: ChecklistStep) => void;
  actionSlot?: (action: ChecklistAction) => ReactNode;
  waitingControl?: ReactNode;
  nameFor?: (id: string | null | undefined) => string;
}) {
  const qc = useQueryClient();
  const tpl = usePinnedChecklist(playbookId);
  const answers = useChecklistAnswers(ticketId, Boolean(tpl.data));
  const save = useMutation({
    mutationFn: async ({ step, a }: { step: ChecklistStep; a: { value: string; note: string; fields: Record<string, string>; nextUpdate: string | null } }) => {
      const na = a.value === NOT_APPLICABLE;
      const { error } = await (supabase as unknown as Db).from("ticket_steps").insert({
        ticket_id: ticketId,
        position: (answers.data?.length ?? 0) + 1,
        instruction: fillQuestion(step.question, facts),
        detail: step.help ?? null,
        required: true,
        step_key: step.key,
        answer: a.value,
        answer_fields: Object.keys(a.fields).length ? a.fields : null,
        note: na ? null : a.note.trim() || null,
        not_applicable_reason: na ? a.note.trim() : null,
        checklist_playbook_id: playbookId,
      });
      if (error) throw error;
      if (step.guestResponse && a.value === "yes") {
        // Same guest update record and clock as Save Guest Update.
        const u = ownerRezGuestUpdate(a.note, a.nextUpdate, new Date());
        const r = await supabase.from("tickets").update(u.patch as never).eq("id", ticketId);
        if (r.error) throw r.error;
        await log("communication", u.history, "guest_update");
      } else {
        await log("note", answerHistoryLine(step, a));
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ticket-checklist-answers", ticketId] });
      await onChanged();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the answer."),
  });

  if (tpl.isLoading || answers.isLoading) return <p className="text-sm text-muted-foreground">Loading checklist…</p>;
  if (!tpl.data) return null;
  return (
    <ChecklistStepView
      template={tpl.data}
      answers={answers.data ?? []}
      activeGuest={activeGuest}
      facts={facts}
      readOnly={readOnly}
      busy={save.isPending}
      onAnswer={(step, a) => save.mutate({ step, a })}
      onAction={onAction}
      {...(actionSlot ? { actionSlot } : {})}
      {...(waitingControl ? { waitingControl } : {})}
      {...(nameFor ? { nameFor } : {})}
    />
  );
}
