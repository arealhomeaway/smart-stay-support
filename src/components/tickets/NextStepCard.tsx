/**
 * The next step line at the top of "Do this now" (register T5, T13), with a
 * way for a person to change the step and its due time. Each change writes
 * tickets.next_action / next_action_due_at, which the existing
 * tickets_log_state trigger records with who and when in ticket_state_log,
 * plus one history line on the ticket. It never acknowledges the ticket,
 * starts work or touches any clock.
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
  type NextStepView,
} from "@/lib/ticket-next-step";

/** The due time as a Central wall clock form value (Emily, Nov 10: Central time). */
function toLocalInput(iso: string | null): string {
  return isoToCentralInput(iso);
}

export function NextStepCard({
  ticketId,
  view,
  canEdit,
  onChanged,
}: {
  ticketId: string;
  view: NextStepView;
  canEdit: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setStep(view.custom ? view.label : "");
    setDue(toLocalInput(view.dueAt));
    setEditing(true);
  }

  async function write(nextAction: string | null, dueIso: string | null) {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Sign in again to save.");
      const { data, error } = await supabase
        .from("tickets")
        .update({ next_action: nextAction, next_action_due_at: dueIso })
        .eq("id", ticketId)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("You cannot change this ticket.");
      const { error: logError } = await supabase.from("ticket_activity").insert({
        ticket_id: ticketId,
        author_id: userData.user.id,
        kind: "next_step",
        event_type: "next_step_changed",
        body: nextStepHistoryLine(nextAction, dueIso, (iso) => centralDateTime(iso)),
      });
      if (logError) throw new Error(logError.message);
      toast.success(nextAction ? NEXT_STEP_COPY.saved : NEXT_STEP_COPY.cleared);
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nothing was saved. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    const problem = nextStepProblem(step, due);
    if (problem) {
      toast.error(problem);
      return;
    }
    await write(step.trim(), due ? centralInputToIso(due) : null);
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
            <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => void write(null, null)}>
              {NEXT_STEP_COPY.done}
            </Button>
          )}
        </div>
      )}
      {canEdit && editing && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3" data-testid="next-step-editor">
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
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving" : NEXT_STEP_COPY.save}
            </Button>
            {view.custom && (
              <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => void write(null, null)}>
                {NEXT_STEP_COPY.clear}
              </Button>
            )}
            <Button type="button" variant="ghost" className="min-h-11" disabled={saving} onClick={() => setEditing(false)}>
              {NEXT_STEP_COPY.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
