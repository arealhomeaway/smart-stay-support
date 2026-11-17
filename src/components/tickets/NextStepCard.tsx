/**
 * The next step line at the top of "Do this now" (register T5, T13), with a
 * way for a person to change or skip the step. Every change and skip needs a
 * short reason, written to the ticket's Activity (Emily, Nov 17).
 * A change writes tickets.next_action / next_action_due_at, which the existing
 * tickets_log_state trigger records with who and when in ticket_state_log.
 * A skip is offered only where the rules in ticket-next-step.ts allow it. It
 * never acknowledges the ticket, starts work or starts a clock.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { centralDateTime, centralInputToIso, isoToCentralInput } from "@/lib/dates";
import {
  NEXT_STEP_COPY,
  nextStepHistoryLine,
  nextStepProblem,
  reasonProblem,
  skipHistoryLine,
  skipPatch,
  type NextStepView,
  type SkipKind,
} from "@/lib/ticket-next-step";

type Mode = "skip" | "change";

export function NextStepCard({
  ticketId,
  view,
  canEdit,
  skip = null,
  onChanged,
}: {
  ticketId: string;
  view: NextStepView;
  canEdit: boolean;
  /** What Skip this step would do here; null when this step cannot be skipped. */
  skip?: SkipKind;
  onChanged: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<Mode>("change");
  const [step, setStep] = useState("");
  const [due, setDue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setMode(skip ? "skip" : "change");
    setStep(view.custom ? view.label : "");
    // Only a written step keeps its own due time. A suggested step's due time is the ticket's
    // clock, often already late; carrying it over made the new step late the moment it was saved.
    setDue(view.custom ? isoToCentralInput(view.dueAt) : "");
    setReason("");
    setEditing(true);
  }

  async function run(work: (userId: string) => Promise<void>, success: string) {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in again to save.");
      await work(userData.user.id);
      toast.success(success);
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nothing was saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function update(patch: Record<string, unknown>) {
    const { data, error } = await supabase.from("tickets").update(patch as never).eq("id", ticketId).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("You cannot change this ticket.");
  }

  async function log(userId: string, eventType: string, body: string) {
    const { error } = await supabase.from("ticket_activity").insert({
      ticket_id: ticketId,
      author_id: userId,
      kind: "next_step",
      event_type: eventType,
      body,
    });
    if (error) throw new Error(error.message);
  }

  /** Done: the written step is finished. */
  function done() {
    void run(async (uid) => {
      await update({ next_action: null, next_action_due_at: null });
      await log(uid, "next_step_changed", nextStepHistoryLine(null, null, (iso) => centralDateTime(iso)));
    }, NEXT_STEP_COPY.cleared);
  }

  function save() {
    const why = reasonProblem(reason);
    if (mode === "skip") {
      if (!skip) return;
      if (why) return void toast.error(why);
      void run(async (uid) => {
        await update(skipPatch(skip));
        await log(uid, "step_skipped", skipHistoryLine(view.label, reason));
      }, NEXT_STEP_COPY.skipped);
      return;
    }
    const problem = nextStepProblem(step, due) ?? why;
    if (problem) return void toast.error(problem);
    const dueIso = due ? centralInputToIso(due) : null;
    void run(async (uid) => {
      await update({ next_action: step.trim(), next_action_due_at: dueIso });
      await log(uid, "next_step_changed", nextStepHistoryLine(step.trim(), dueIso, (iso) => centralDateTime(iso), reason));
    }, NEXT_STEP_COPY.saved);
  }

  return (
    <div className="mt-2 space-y-2" data-testid="next-step">
      <p
        className={`text-base font-semibold ${view.late ? "text-danger" : "text-foreground"}`}
        data-testid="next-step-line"
      >
        {view.line}
      </p>
      {canEdit && !editing && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={startEdit}>
            {NEXT_STEP_COPY.change}
          </Button>
          {view.custom && (
            <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={done}>
              {NEXT_STEP_COPY.done}
            </Button>
          )}
        </div>
      )}
      {canEdit && editing && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3" data-testid="next-step-editor">
          {skip && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Skip or change">
              {(["skip", "change"] as const).map((m) => (
                <Button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  variant={mode === m ? "default" : "outline"}
                  className="min-h-11"
                  onClick={() => setMode(m)}
                >
                  {m === "skip" ? NEXT_STEP_COPY.chooseSkip : NEXT_STEP_COPY.chooseChange}
                </Button>
              ))}
            </div>
          )}
          {mode === "change" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor={`next-step-${ticketId}`}>{NEXT_STEP_COPY.stepLabel}</Label>
                <Input
                  id={`next-step-${ticketId}`}
                  className="min-h-11"
                  maxLength={200}
                  value={step}
                  placeholder="For example: check the approval"
                  onChange={(e) => setStep(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`next-step-due-${ticketId}`}>{NEXT_STEP_COPY.dueLabel}</Label>
                <Input
                  id={`next-step-due-${ticketId}`}
                  type="datetime-local"
                  className="min-h-11"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`next-step-reason-${ticketId}`}>{NEXT_STEP_COPY.reasonLabel}</Label>
            <Input
              id={`next-step-reason-${ticketId}`}
              className="min-h-11"
              maxLength={200}
              value={reason}
              placeholder={NEXT_STEP_COPY.reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11" disabled={saving} onClick={save}>
              {saving ? "Saving" : mode === "skip" ? NEXT_STEP_COPY.skip : NEXT_STEP_COPY.save}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" disabled={saving} onClick={() => setEditing(false)}>
              {NEXT_STEP_COPY.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
