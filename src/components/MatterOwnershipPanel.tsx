import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useCurrentUserId, useStaffDirectory, displayName } from "@/hooks/useTeam";
import { canEditMatter, currentOwnerId, extractMentions } from "@/lib/matters";
import { usDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Ticket = {
  id: string;
  record_owner: string | null;
  accountable_owner: string | null;
  current_action_owner: string | null;
  assigned_to: string | null;
  created_by: string | null;
  pending_handoff_to: string | null;
  escalation_level: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  closure_exception_reason: string | null;
  closure_exception_at: string | null;
  /** How current_action_owner/assigned_to was set: 'automatic', 'manual', or null (never assigned). */
  assignment_source: string | null;
  /** Why — populated by the automatic-assignment trigger; cleared on manual (re)assignment. */
  assignment_note: string | null;
};

/**
 * Ownership, assignment and supervisor exceptions for one ticket.
 *
 * Assignment always writes both the working assignee and the action owner so
 * "whose ticket is this" is never ambiguous. Every change is written to the
 * activity log, and the database audit trigger records it independently.
 */
export function MatterOwnershipPanel({
  ticket,
  closed,
  onChanged,
}: {
  ticket: Ticket;
  closed: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const { isSupervisor, readOnly } = useRole();
  const userId = useCurrentUserId();
  const { data: staff } = useStaffDirectory();
  const people = staff ?? [];

  const [assignee, setAssignee] = useState<string>("");
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(true);
  const [exception, setException] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [busy, setBusy] = useState(false);

  const canEdit = canEditMatter(ticket, userId, { isSupervisor, readOnly });
  const ownerId = currentOwnerId(ticket);
  const owner = people.find((p) => p.id === ownerId);

  async function log(
    kind: string,
    body: string,
    eventType: string,
    opts?: { internal?: boolean; mentions?: string[] },
  ) {
    await supabase.from("ticket_activity").insert({
      ticket_id: ticket.id,
      author_id: userId,
      kind,
      event_type: eventType,
      body,
      internal: opts?.internal ?? false,
      mentions: opts?.mentions ?? [],
    });
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  }

  const assign = (targetId: string, self = false) =>
    run(async () => {
      const target = people.find((p) => p.id === targetId);
      const { error } = await supabase
        .from("tickets")
        .update({
          assigned_to: targetId,
          current_action_owner: targetId,
          record_owner: ticket.record_owner ?? targetId,
          accountable_owner: ticket.accountable_owner ?? targetId,
          // A human decided this — supersedes whatever the automatic
          // assignment trigger set (or didn't) at creation.
          assignment_source: "manual",
          assignment_note: null,
        })
        .eq("id", ticket.id);
      if (error) throw error;
      await log(
        "assignment",
        self ? "Picked this ticket up." : `Assigned to ${displayName(target)}.`,
        ownerId ? "reassigned" : "assigned",
      );
      setAssignee("");
      toast.success(self ? "It's yours." : `Assigned to ${displayName(target)}.`);
    });

  const escalate = () =>
    run(async () => {
      const { error } = await supabase
        .from("tickets")
        .update({
          escalated_at: new Date().toISOString(),
          escalation_level: ticket.escalation_level === "p1" ? "p1" : "p2",
        })
        .eq("id", ticket.id);
      if (error) throw error;
      await log("escalation", "Escalated for supervisor attention.", "escalated");
      toast.success("Escalated — a supervisor will see this in the queue.");
    });

  const addNote = () =>
    run(async () => {
      if (!note.trim()) return;
      const mentions = extractMentions(note, people);
      await log("note", note.trim(), internal ? "internal_note" : "note", { internal, mentions });
      setNote("");
      toast.success(
        mentions.length ? `Note added, ${mentions.length} teammate(s) mentioned.` : "Note added.",
      );
    });

  const recordException = () =>
    run(async () => {
      if (!exception.trim()) {
        toast.error("Write down why the closure requirement is being waived.");
        return;
      }
      const { error } = await supabase
        .from("tickets")
        .update({
          closure_exception_reason: exception.trim(),
          closure_exception_by: userId,
          closure_exception_at: new Date().toISOString(),
        })
        .eq("id", ticket.id);
      if (error) throw error;
      await log(
        "exception",
        `Closure exception authorised: ${exception.trim()}`,
        "closure_exception",
      );
      setException("");
      toast.success("Exception recorded. This ticket can now be closed.");
    });

  const archive = () =>
    run(async () => {
      if (!archiveReason.trim()) {
        toast.error("Give a reason so the record stays explainable.");
        return;
      }
      const { error } = await supabase
        .from("tickets")
        .update({
          archived_at: new Date().toISOString(),
          archive_reason: archiveReason.trim(),
          archived_by: userId,
        })
        .eq("id", ticket.id);
      if (error) throw error;
      await log("archive", `Archived: ${archiveReason.trim()}`, "archived");
      setArchiveReason("");
      toast.success("Archived. Nothing was deleted.");
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ownership</CardTitle>
        <CardDescription>
          {ownerId
            ? `${displayName(owner)} is accountable for what happens next.`
            : (ticket.assignment_note ?? "Nobody owns this yet.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{ownerId ? displayName(owner) : "Unassigned"}</Badge>
          {ownerId && ticket.assignment_source === "automatic" && (
            <Badge variant="outline" className="text-muted-foreground">
              Auto-assigned
            </Badge>
          )}
          {ticket.pending_handoff_to && <Badge variant="outline">Handoff pending</Badge>}
          {ticket.escalation_level && <Badge variant="danger">Escalated</Badge>}
          {ticket.archived_at && <Badge variant="outline">Archived</Badge>}
        </div>

        {readOnly && (
          <p className="rounded-md border border-border bg-secondary/40 p-2 text-xs text-muted-foreground">
            Preview mode is read-only. Nothing here can change data.
          </p>
        )}

        {!canEdit && !readOnly && (
          <p className="rounded-md border border-border bg-secondary/40 p-2 text-xs text-muted-foreground">
            This ticket belongs to {displayName(owner)}. Ask a supervisor to reassign it if you need
            to work on it.
          </p>
        )}

        {canEdit && !ticket.archived_at && (
          <>
            <div className="flex flex-wrap gap-2">
              {ownerId !== userId && userId && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => assign(userId, true)}
                >
                  Take this ticket
                </Button>
              )}
              {!closed && (
                <Button size="sm" variant="outline" disabled={busy} onClick={escalate}>
                  Escalate
                </Button>
              )}
            </div>

            {isSupervisor && (
              <div className="space-y-2">
                <Label className="text-xs">Assign or reassign</Label>
                <div className="flex gap-2">
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Choose a coordinator" />
                    </SelectTrigger>
                    <SelectContent>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {displayName(p)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!assignee || busy} onClick={() => assign(assignee)}>
                    Assign
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Note for the team</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What you found, what you tried, who you called. Use @name to pull someone in."
                rows={3}
              />
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={internal} onCheckedChange={setInternal} />
                  Internal only
                </label>
                <Button size="sm" disabled={!note.trim() || busy} onClick={addNote}>
                  Add note
                </Button>
              </div>
            </div>

            {isSupervisor && (
              <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-3">
                <Label className="text-xs">Supervisor exception</Label>
                {ticket.closure_exception_reason ? (
                  <p className="text-xs text-muted-foreground">
                    Exception on file: {ticket.closure_exception_reason}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Waive a closure requirement only when the evidence genuinely cannot be
                      produced. The reason is permanent.
                    </p>
                    <Textarea
                      value={exception}
                      onChange={(e) => setException(e.target.value)}
                      rows={2}
                      placeholder="Why the required evidence cannot be produced"
                    />
                    <Button size="sm" variant="outline" disabled={busy} onClick={recordException}>
                      Record exception
                    </Button>
                  </>
                )}
              </div>
            )}

            {isSupervisor && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <Label className="text-xs">Archive (never delete)</Label>
                <Textarea
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  rows={2}
                  placeholder="Duplicate of #1234, test record, logged in error…"
                />
                <Button size="sm" variant="outline" disabled={busy} onClick={archive}>
                  Archive ticket
                </Button>
              </div>
            )}
          </>
        )}

        {ticket.archived_at && (
          <p className="text-xs text-muted-foreground">
            Archived {usDateTime(ticket.archived_at)} — {ticket.archive_reason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
