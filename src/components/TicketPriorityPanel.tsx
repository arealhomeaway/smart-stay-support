/**
 * Changing a ticket's priority — supervisors only, reason always required.
 * Everyone else sees the priority and why it was last changed, read-only.
 */
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { setTicketPriorityFn } from "@/lib/ticket-priority.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { priorityMeta } from "@/lib/tickets";

type Props = {
  ticketId: string;
  priority: string | null | undefined;
  suggestedPriority?: string | null;
  overrideReason?: string | null;
  canChange: boolean;
  disabled?: boolean;
  onChanged?: () => void;
};

const CHOICES = ["p1", "p2", "p3"] as const;

export function TicketPriorityPanel({
  ticketId,
  priority,
  suggestedPriority,
  overrideReason,
  canChange,
  disabled,
  onChanged,
}: Props) {
  const setPriority = useServerFn(setTicketPriorityFn);
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState<string>(priority ?? "p3");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const calculated = suggestedPriority ?? null;
  const differs = Boolean(calculated && calculated !== priority);

  async function save() {
    if (reason.trim().length < 5) {
      toast.error("Write why this priority is different from the calculated one.");
      return;
    }
    setSaving(true);
    try {
      await setPriority({ data: { ticketId, priority: next as "p1" | "p2" | "p3", reason: reason.trim() } });
      toast.success("Priority changed and recorded.");
      setOpen(false);
      setReason("");
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That change could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Priority — {priorityMeta(priority).short}</p>
          <p className="text-xs text-muted-foreground">
            {calculated
              ? differs
                ? `Calculated as ${calculated.toUpperCase()} and changed by a supervisor.`
                : "Matches the calculated priority."
              : "Set when this ticket was opened."}
          </p>
          {overrideReason && (
            <p className="mt-1 text-xs text-muted-foreground">Reason on file: {overrideReason}</p>
          )}
        </div>
        {canChange && !disabled && !open && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Change priority
          </Button>
        )}
      </div>

      {canChange && open && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>New priority</Label>
            <Select value={next} onValueChange={setNext}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHOICES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {priorityMeta(p).short}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="priority-reason">Why (required)</Label>
            <Input
              id="priority-reason"
              value={reason}
              placeholder="Guest is elderly and alone in the home"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving || reason.trim().length < 5}>
              {saving ? "Saving…" : "Save priority"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
