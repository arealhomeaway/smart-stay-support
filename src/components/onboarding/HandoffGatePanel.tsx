import { useState } from "react";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GATE_STEPS, gateLabel } from "@/lib/onboarding";
import { usDateTime } from "@/lib/dates";

export type HandoffRow = {
  id: string;
  property_id: string;
  status: string;
  gate_step: string | null;
  requested_at: string | null;
  carryover_accepted: boolean | null;
  notes: string | null;
  corrections: string | null;
  exceptions: unknown;
};

export type ReviewRow = {
  id: string;
  handoff_id: string;
  step: string;
  decision: string;
  reviewer_id: string | null;
  note: string | null;
  exception_reason: string | null;
  created_at: string;
};

type Person = { id: string; full_name: string | null; email: string | null };

/**
 * The documented handoff gate: Director of Onboarding review, then Director of
 * Operations review, then Operations
 * acceptance, then live confirmation. Every decision writes an immutable
 * history row with reviewer, date, decision and any recorded exception.
 */
export function HandoffGatePanel({
  handoff,
  reviews,
  people,
  propertyName,
  canReview,
  disabled,
  onDecision,
}: {
  handoff: HandoffRow;
  reviews: ReviewRow[];
  people: Person[];
  propertyName: string;
  canReview: boolean;
  disabled: boolean;
  onDecision: (input: {
    expectedStep: string;
    decision: "accepted" | "returned";
    corrections: string;
    exceptionReason?: string;
  }) => void;
}) {
  const step = handoff.gate_step ?? "kati_review";
  const order = GATE_STEPS.map((s) => s.value as string);
  const currentIndex = order.indexOf(step);
  const history = reviews.filter((r) => r.handoff_id === handoff.id);
  const nameOf = (id: string | null) =>
    people.find((p) => p.id === id)?.full_name ||
    people.find((p) => p.id === id)?.email ||
    "Reviewer";
  const exceptions = Array.isArray(handoff.exceptions)
    ? (handoff.exceptions as { step: string; reason: string; at: string }[])
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Handoff gate — {propertyName}</CardTitle>
        <CardDescription>
          {handoff.status === "returned"
            ? "Returned to onboarding with corrections."
            : `Currently at ${gateLabel(step)}.`}
          {handoff.carryover_accepted
            ? " Carryover work was accepted — it belongs to Operations from handoff onward, assigned by the Director of Operations."
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-2">
          {GATE_STEPS.filter((s) => s.value !== "complete").map((s, i) => {
            const done = handoff.status === "accepted" || i < currentIndex;
            const open =
              handoff.status === "requested" || handoff.status === "accepted_pending_live";
            const active = i === currentIndex && open;
            return (
              <li key={s.value} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                {done ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" />
                ) : (
                  <Circle
                    className={`mt-0.5 size-4 ${active ? "text-primary" : "text-muted-foreground"}`}
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.blurb}</p>
                </div>
                {active && <Badge variant="outline">Awaiting decision</Badge>}
              </li>
            );
          })}
        </ol>

        {exceptions.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs">
            <p className="font-medium">Recorded exceptions</p>
            {exceptions.map((e, i) => (
              <p key={i} className="text-muted-foreground">
                {gateLabel(e.step)}: {e.reason}
              </p>
            ))}
          </div>
        )}

        {(handoff.status === "requested" || handoff.status === "accepted_pending_live") &&
          canReview && (
            <div className="flex flex-wrap gap-2">
              <ApproveDialog
                step={step}
                disabled={disabled}
                onApprove={(note, exceptionReason) =>
                  onDecision({
                    expectedStep: step,
                    decision: "accepted",
                    corrections: note,
                    ...(exceptionReason ? { exceptionReason } : {}),
                  })
                }
              />
              <ReturnDialog
                disabled={disabled}
                onReturn={(corrections) => onDecision({ expectedStep: step, decision: "returned", corrections })}
              />
            </div>
          )}

        {history.length > 0 && (
          <div className="space-y-1 border-t pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              History
            </p>
            {history.map((h) => (
              <p key={h.id} className="text-xs text-muted-foreground">
                {usDateTime(h.created_at)} · {gateLabel(h.step)} ·{" "}
                {h.decision === "returned" ? "returned" : "approved"} by {nameOf(h.reviewer_id)}
                {h.note ? ` — ${h.note}` : ""}
                {h.exception_reason ? ` · exception: ${h.exception_reason}` : ""}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApproveDialog({
  step,
  disabled,
  onApprove,
}: {
  step: string;
  disabled: boolean;
  onApprove: (note: string, exceptionReason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [exception, setException] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          Approve {gateLabel(step).toLowerCase()}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve {gateLabel(step).toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Review note (optional)"
          />
          <Textarea
            rows={2}
            value={exception}
            onChange={(e) => setException(e.target.value)}
            placeholder="Authorised exception — only if a required readiness item is being waived"
          />
          <Button
            className="w-full"
            onClick={() => {
              onApprove(note.trim(), exception.trim());
              setOpen(false);
              setNote("");
              setException("");
            }}
          >
            Record decision
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReturnDialog({
  disabled,
  onReturn,
}: {
  disabled: boolean;
  onReturn: (corrections: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [corrections, setCorrections] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <RotateCcw className="size-4" /> Return
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return with corrections</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            rows={4}
            value={corrections}
            onChange={(e) => setCorrections(e.target.value)}
            placeholder="What must be corrected before this home can be accepted?"
          />
          <Button
            className="w-full"
            disabled={corrections.trim().length < 3}
            onClick={() => {
              onReturn(corrections.trim());
              setOpen(false);
              setCorrections("");
            }}
          >
            Return to onboarding
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
