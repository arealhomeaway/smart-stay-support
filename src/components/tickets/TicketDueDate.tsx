/**
 * Due date on the ticket page (Emily, Nov 18). Set once when the ticket is created; anyone who can
 * edit the ticket changes it here with a date picker, no reason needed. The database records the
 * change in the ticket's history with the person's name (set_ticket_due_on).
 */
import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { centralToday, dueDateLabel, dueOverdueDays, overdueByDays } from "@/lib/ticket-due-date";

type Props = {
  ticketId: string;
  dueOn: string | null;
  status: string;
  canEdit: boolean;
  onChanged?: () => void | Promise<void>;
};

/** The database's own plain refusals; anything else shows one plain line. */
const PLAIN = ["You cannot change this ticket.", "That ticket could not be found.", "Pick a date.", "Sign in to change the due date."];

const toDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromDay = (s: string | null) => {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
};

export function TicketDueDate({ ticketId, dueOn, status, canEdit, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const late = dueOverdueDays({ status, due_on: dueOn });
  const label = dueOn ? dueDateLabel(dueOn) : "Not set";
  const picked: Date | null = fromDay(dueOn) ?? null;

  const text = (
    <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5">
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
    setSaving(true);
    try {
      const { error } = await supabase.rpc("set_ticket_due_on" as never, { _ticket_id: ticketId, _due_on: next } as never);
      if (error) throw new Error(PLAIN.includes(error.message) ? error.message : "The due date could not be saved. Try again.");
      toast.success(`Due date saved: ${dueDateLabel(next)}.`);
      setOpen(false);
      await onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The due date could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <span className="inline-flex min-h-9 items-center rounded-md border border-border px-2.5 text-sm" data-testid="ticket-due-date">
        {text}
      </span>
    );
  }
  return (
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
        <Calendar
          mode="single"
          {...(picked ? { selected: picked, defaultMonth: picked } : {})}
          onSelect={(d) => void pick(d)}
          disabled={saving}
          autoFocus
          today={fromDay(centralToday()) ?? new Date()}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
