import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/hooks/useRole";
import {
  finalReviewExplanation,
  finalReviewRequirement,
  finalReviewResultLabel,
  type FinalReviewFacts,
} from "@/lib/final-review";
import { recordFinalReviewFn } from "@/lib/final-review.functions";

/**
 * Final Review — the supervisor's last look at finished work.
 *
 * Only elevated-risk work reaches this panel. Everything else says so plainly,
 * so nobody is left waiting for a review that is never coming.
 */
export function FinalReviewPanel({
  ticketId,
  facts,
  result,
  note,
  onDone,
}: {
  ticketId: string;
  facts: FinalReviewFacts;
  result: string | null | undefined;
  note?: string | null;
  onDone?: () => void;
}) {
  const { isSupervisor, readOnly } = useRole();
  const qc = useQueryClient();
  const requirement = finalReviewRequirement(facts);
  const [reviewNote, setReviewNote] = useState("");
  const [mode, setMode] = useState<"idle" | "return">("idle");

  const submit = useMutation({
    mutationFn: async (decision: "approve" | "return") =>
      recordFinalReviewFn({ data: { ticketId, decision, note: reviewNote || null } }),
    onSuccess: (_r, decision) => {
      toast.success(
        decision === "approve" ? "Approved and closed." : "Sent back for changes.",
      );
      setReviewNote("");
      setMode("idle");
      void qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
      void qc.invalidateQueries({ queryKey: ["tickets"] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decided = result && result !== "not_reviewed";

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">Review before closing</h3>
        {decided ? (
          <Badge variant="outline">{finalReviewResultLabel(result)}</Badge>
        ) : requirement.required ? (
          <Badge variant="outline" className="border-warning/40 bg-warning/10">
            Needs review
          </Badge>
        ) : (
          <Badge variant="outline">Not needed</Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {decided ? (note ?? finalReviewExplanation(requirement)) : finalReviewExplanation(requirement)}
      </p>

      {!decided && requirement.required && requirement.reasons.length > 1 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {requirement.reasons.slice(1).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {!decided && requirement.required && isSupervisor && !readOnly && (
        <div className="mt-4 space-y-3">
          <Label htmlFor="final-review-note">
            {mode === "return" ? "What needs to change?" : "Note (optional)"}
          </Label>
          <Textarea
            id="final-review-note"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={3}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={submit.isPending} onClick={() => submit.mutate("approve")}>
              Approve and close
            </Button>
            <Button
              variant="outline"
              disabled={submit.isPending || (mode === "return" && reviewNote.trim().length < 5)}
              onClick={() => (mode === "return" ? submit.mutate("return") : setMode("return"))}
            >
              {mode === "return" ? "Send it back" : "Send back for changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
