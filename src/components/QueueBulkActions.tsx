/**
 * The bar that appears once tickets are selected in a queue.
 *
 * It offers only what this person is actually allowed to do, and it asks for a
 * written reason before any priority change — the same conversation the ticket
 * itself has.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRole } from "@/hooks/useRole";
import { displayName, useStaffDirectory } from "@/hooks/useTeam";
import {
  BULK_PRIORITIES,
  BULK_STATUSES,
  bulkDenialReason,
  canRunBulkAction,
  type BulkAction,
} from "@/lib/queue-bulk";
import { bulkUpdateTicketsFn } from "@/lib/queue-bulk.functions";

const UNASSIGNED = "__unassigned__";

export function QueueBulkActions({
  selected,
  onClear,
}: {
  selected: string[];
  onClear: () => void;
}) {
  const role = useRole();
  const queryClient = useQueryClient();
  const { data: staff } = useStaffDirectory();
  const [action, setAction] = useState<BulkAction | "">("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const viewer = { roles: role.roles as string[], readOnly: role.readOnly };
  const allowed = (["assign", "status", "priority"] as const).filter((a) =>
    canRunBulkAction(viewer, a),
  );

  if (selected.length === 0) return null;

  const denial = action ? bulkDenialReason(viewer, action) : null;

  const run = async () => {
    if (!action) return;
    setBusy(true);
    try {
      const result = await bulkUpdateTicketsFn({
        data: {
          ticketIds: selected,
          action,
          ...(action === "assign"
            ? { assigneeId: assignee === UNASSIGNED ? null : assignee }
            : {}),
          ...(action === "status" ? { status } : {}),
          ...(action === "priority" ? { priority, reason } : {}),
        },
      });
      const parts = [`${result.updated} ticket${result.updated === 1 ? "" : "s"} updated`];
      if (result.unchanged > 0) parts.push(`${result.unchanged} already matched`);
      if (result.skipped.length > 0) parts.push(`${result.skipped.length} could not be changed`);
      toast.success(parts.join(" · "));
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["team-queue"] });
      setReason("");
      onClear();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That change could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const ready =
    action === "assign"
      ? Boolean(assignee)
      : action === "status"
        ? Boolean(status)
        : action === "priority"
          ? Boolean(priority) && reason.trim().length >= 5
          : false;

  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-lg">
      <span className="text-sm font-medium">
        {selected.length} selected
      </span>

      {allowed.length === 0 ? (
        <span className="text-sm text-muted-foreground">
          {bulkDenialReason(viewer, "status")}
        </span>
      ) : (
        <>
          <Select value={action} onValueChange={(v) => setAction(v as BulkAction)}>
            <SelectTrigger className="w-44" aria-label="What to change">
              <SelectValue placeholder="Change…" />
            </SelectTrigger>
            <SelectContent>
              {allowed.includes("assign") && <SelectItem value="assign">Reassign</SelectItem>}
              {allowed.includes("status") && <SelectItem value="status">Set status</SelectItem>}
              {allowed.includes("priority") && <SelectItem value="priority">Set priority</SelectItem>}
            </SelectContent>
          </Select>

          {action === "assign" && (
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="w-56" aria-label="Who takes this work">
                <SelectValue placeholder="Who takes this work" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Back to unassigned</SelectItem>
                {(staff ?? []).map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {displayName(person)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {action === "status" && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-56" aria-label="New status">
                <SelectValue placeholder="New status" />
              </SelectTrigger>
              <SelectContent>
                {BULK_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {action === "priority" && (
            <>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-28" aria-label="New priority">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  {BULK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="w-64"
                placeholder="Why these tickets change priority"
                aria-label="Reason for the priority change"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </>
          )}

          <Button disabled={!ready || busy || Boolean(denial)} onClick={() => void run()}>
            {busy ? "Applying…" : "Apply"}
          </Button>
        </>
      )}

      <Button variant="ghost" onClick={onClear}>
        Clear
      </Button>

      {denial && <span className="text-sm text-danger">{denial}</span>}
      {action === "status" && (
        <span className="w-full text-xs text-muted-foreground">
          Resolving and closing stay on the ticket, where the required evidence lives.
        </span>
      )}
    </div>
  );
}
