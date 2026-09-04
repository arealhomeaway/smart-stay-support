import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useRole } from "@/hooks/useRole";
import { useStaffDirectory, displayName } from "@/hooks/useTeam";
import {
  ESCALATION_OUTCOMES,
  ESCALATION_TARGET_LABELS,
  ESCALATION_URGENCIES,
  escalationOutcomeLabel,
  escalationTargetsFor,
  validateEscalation,
  type EscalationTarget,
  type EscalationUrgency,
} from "@/lib/escalation";
import { raiseEscalationFn, resolveEscalationFn } from "@/lib/escalation.functions";
import { relativeTime } from "@/lib/tickets";

/**
 * Escalation on a ticket.
 *
 * Raising one asks for a decision. It does not hand the work over — the
 * copy says so, and the server keeps ownership where it was unless the
 * supervisor answering it deliberately takes it or directs it elsewhere.
 */
export function EscalationPanel({ ticketId }: { ticketId: string }) {
  const { isSupervisor, readOnly } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["escalations", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escalations")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const openOne = (rows ?? []).find((r) => r.status === "open");
  const history = (rows ?? []).filter((r) => r.status !== "open");

  return (
    <div className="space-y-3">
      {openOne ? (
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-danger/40 bg-danger/10 text-danger">
              Escalated
            </Badge>
            <span className="text-sm font-medium">
              With the{" "}
              {ESCALATION_TARGET_LABELS[openOne.escalated_to_role as EscalationTarget] ??
                openOne.escalated_to_role}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">
              {relativeTime(openOne.created_at)}
            </span>
          </div>
          <p className="mt-2 text-sm">{openOne.reason}</p>
          {openOne.help_needed && (
            <p className="mt-1 text-sm text-muted-foreground">Needs: {openOne.help_needed}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            This is a request for a decision. Whoever raised it still owns the work.
          </p>
          {isSupervisor && !readOnly && (
            <AnswerEscalation
              escalationId={openOne.id}
              onDone={() => {
                void qc.invalidateQueries({ queryKey: ["escalations", ticketId] });
                void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
              }}
            />
          )}
        </div>
      ) : (
        !readOnly && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            Escalate for a decision
          </Button>
        )
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
              <span className="font-medium">{escalationOutcomeLabel(h.outcome)}</span>{" "}
              <span className="text-muted-foreground">· {relativeTime(h.resolved_at)}</span>
              {h.outcome_note && <p className="mt-1 text-muted-foreground">{h.outcome_note}</p>}
            </div>
          ))}
        </div>
      )}

      <RaiseSheet
        ticketId={ticketId}
        open={open}
        onOpenChange={setOpen}
        onDone={() => void qc.invalidateQueries({ queryKey: ["escalations", ticketId] })}
      />
    </div>
  );
}

function RaiseSheet({
  ticketId,
  open,
  onOpenChange,
  onDone,
}: {
  ticketId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const { isSupervisor } = useRole();
  const targets = escalationTargetsFor({ isSupervisor });
  const [to, setTo] = useState<EscalationTarget>("supervisor");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState("");
  const [need, setNeed] = useState("");
  const [urgency, setUrgency] = useState<EscalationUrgency>("normal");

  const problem = validateEscalation({
    escalated_to_role: to,
    reason,
    already_tried: tried,
    help_needed: need,
    urgency,
  });

  const send = useMutation({
    mutationFn: async () =>
      raiseEscalationFn({
        data: {
          ticketId,
          escalated_to_role: to,
          reason,
          already_tried: tried,
          help_needed: need,
          urgency,
        },
      }),
    onSuccess: () => {
      toast.success("Escalated. You still own this ticket.");
      setReason("");
      setTried("");
      setNeed("");
      onOpenChange(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Escalate for a decision</SheetTitle>
          <SheetDescription>
            You keep this ticket. Escalating asks someone above you to decide something you cannot.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div>
            <Label>Who needs to decide</Label>
            <Select value={to} onValueChange={(v) => setTo(v as EscalationTarget)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.value} value={t.value} disabled={!t.enabled}>
                    {t.label}
                    {t.hint ? ` — ${t.hint}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="esc-reason">What is the problem?</Label>
            <Textarea
              id="esc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="esc-tried">What have you already tried?</Label>
            <Textarea
              id="esc-tried"
              value={tried}
              onChange={(e) => setTried(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="esc-need">What decision or help do you need?</Label>
            <Textarea
              id="esc-need"
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label>How urgent is it?</Label>
            <Select value={urgency} onValueChange={(v) => setUrgency(v as EscalationUrgency)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESCALATION_URGENCIES.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label} — {u.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {problem && <p className="text-sm text-muted-foreground">{problem}</p>}

          <Button
            className="w-full"
            disabled={Boolean(problem) || send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? "Sending…" : "Send escalation"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** The supervisor's answer: guidance, take it, or direct it to someone. */
export function AnswerEscalation({
  escalationId,
  onDone,
}: {
  escalationId: string;
  onDone: () => void;
}) {
  const [outcome, setOutcome] = useState<string>("guidance");
  const [note, setNote] = useState("");
  const [assignTo, setAssignTo] = useState<string>("");
  const { data: staff } = useStaffDirectory();

  const answer = useMutation({
    mutationFn: async () =>
      resolveEscalationFn({
        data: {
          escalationId,
          outcome: outcome as "guidance" | "takeover" | "reassigned",
          outcome_note: note,
          assignTo: assignTo || null,
        },
      }),
    onSuccess: () => {
      toast.success("Decision recorded.");
      setNote("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      <Label>Your decision</Label>
      <Select value={outcome} onValueChange={setOutcome}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ESCALATION_OUTCOMES.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label} — {o.hint}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {outcome === "reassigned" && (
        <Select value={assignTo} onValueChange={setAssignTo}>
          <SelectTrigger>
            <SelectValue placeholder="Who carries this next?" />
          </SelectTrigger>
          <SelectContent>
            {(staff ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {displayName(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="Write the decision so the record explains itself."
      />

      <Button disabled={note.trim().length < 5 || answer.isPending} onClick={() => answer.mutate()}>
        {answer.isPending ? "Recording…" : "Record decision"}
      </Button>
    </div>
  );
}
