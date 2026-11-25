/**
 * Due date on the ticket page (Emily, Nov 18). Guest-ready standards (Nov 24): a Locked ticket type shows a lock and
 * its one-line reason; only Supervisors, Directors and Admin change it, with a short reason added as an update.
 * Due date (Nov 18 original): Set once when the ticket is created; anyone who can
 * edit the ticket changes it here with a date picker, no reason needed. The database records the
 * change in the ticket's history with the person's name (set_ticket_due_on).
 */
import { useState } from "react";
import { CalendarIcon, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { dueChangeRule } from "@/lib/guest-ready-standards";
import { centralToday, dueDateLabel, dueOverdueDays, overdueByDays } from "@/lib/ticket-due-date";

type Props = {
  ticketId: string;
  dueOn: string | null;
  status: string;
  canEdit: boolean;
  /** Guest-ready standards: a Locked ticket type (tickets.due_locked). */
  locked?: boolean;
  /** One line saying why it is locked. */
  lockNote?: string | null;
  /** Supervisors, Directors and Admin change a locked date with a reason. */
  canChangeLocked?: boolean;
  onChanged?: () => void | Promise<void>;
};

/** The database's own plain refusals; anything else shows one plain line. */
const PLAIN = ["This due date is locked.", "Write a short reason.", "You cannot change this ticket.", "That ticket could not be found.", "Pick a date.", "Sign in to change the due date."];

const toDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromDay = (s: string | null) => {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};

export function TicketDueDate({ ticketId, dueOn, status, canEdit, locked = false, lockNote = null, canChangeLocked = false, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const mode = dueChangeRule(locked, canChangeLocked, canEdit);
  const late = dueOverdueDays({ status, due_on: dueOn });
  const label = dueOn ? dueDateLabel(dueOn) : "Not set";
  const picked: Date | null = fromDay(dueOn) ?? null;

  const text = (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5">
      {locked ? <Lock className="size-3.5 self-center text-muted-foreground" aria-label="Locked" /> : null}
      <span className="text-muted-foreground">Due date</span>
      <span className={cn("font-medium", late > 0 && "font-semibold text-coral")}>{label}</span>
      {late > 0 ? <span className="font-semibold text-coral">{overdueByDays(late)}</span> : null}
    </span>
  );

  async function pick(day: Date | undefined) {
    if (!day) return;
    const next = toDay(day);
    if (next === dueOn) {
      setOpen(false);
      return;
    }
    if (mode === "edit_with_reason") {
      setPending(next);
      return;
    }
    await save(next, null);
  }

  async function save(next: string, why: string | null) {
    setSaving(true);
    try {
      const args = why ? { _ticket_id: ticketId, _due_on: next, _reason: why } : { _ticket_id: ticketId, _due_on: next };
      const { error } = await supabase.rpc("set_ticket_due_on" as never, args as never);
      if (error) throw new Error(PLAIN.includes(error.message) ? error.message : "The due date could not be saved. Try again.");
      toast.success(`Due date saved: ${dueDateLabel(next)}.`);
      setOpen(false);
      setPending(null);
      setReason("");
      await onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The due date could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const note = locked && lockNote ? (
    <span className="basis-full text-xs text-muted-foreground" data-testid="ticket-due-lock-note">{lockNote}</span>
  ) : null;

  if (mode === "view") {
    return (
      <>
        <span className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-sm" data-testid="ticket-due-date">
          {text}
        </span>
        {note}
      </>
    );
  }
  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("min-h-11 gap-1.5 px-3 text-sm font-normal text-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted", late > 0 && "border-coral/40")}
          aria-label={`Due date ${label}. Change the due date`}
          data-testid="ticket-due-date"
          disabled={saving}
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
          {text}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {pending ? (
          <div className="w-72 space-y-2 p-3" data-testid="due-lock-reason">
            <p className="text-sm font-medium">Change a locked due date to {dueDateLabel(pending)}</p>
            <Input
              className="min-h-11"
              placeholder="Short reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Short reason"
              autoFocus
            />
            <div className="flex gap-2">
              <Button className="min-h-11" disabled={saving || reason.trim().length < 3} onClick={() => void save(pending, reason.trim())}>
                Save
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={() => { setPending(null); setReason(""); }}>
                Back
              </Button>
            </div>
          </div>
        ) : (
        <Calendar
          mode="single"
          {...(picked ? { selected: picked, defaultMonth: picked } : {})}
          onSelect={(d) => void pick(d)}
          disabled={saving}
          autoFocus
          today={fromDay(centralToday()) ?? new Date()}
          className={cn("p-3 pointer-events-auto")}
        />
        )}
      </PopoverContent>
    </Popover>
    {note}
    </>
  );
}
