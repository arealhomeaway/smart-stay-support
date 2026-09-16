/** Staff reviews retain the displayed entry until current details are explicitly reviewed. */
import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { ownerTimeReviewQueue, reviewOwnerTimeEntry } from "@/lib/owner-program.functions";
import {
  captureOwnerTimeReview,
  ownerTimeReviewChanged,
  ownerTimeReviewInput,
  type OwnerTimeReviewDraft,
  type ReviewDecision,
  type TimeReviewRow,
} from "@/lib/owner-time-review";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/hooks/useRole";
import { usDate } from "@/lib/dates";

function EntryDetails({ entry }: { entry: TimeReviewRow }) {
  return (
    <div className="min-w-0 space-y-1 break-words">
      <p className="font-medium">{entry.activity}</p>
      <p className="text-sm text-muted-foreground">
        {entry.ownerName || "Owner"} · {usDate(entry.entryDate)} · {entry.minutes} minutes
        {entry.propertyNames.length > 0 && ` · ${entry.propertyNames.join(", ")}`}
      </p>
      <p className="text-sm text-muted-foreground">
        {entry.phase === "onboarding" ? "Onboarding" : "Ongoing participation"}
        {entry.activityCategory && ` · ${entry.activityCategory}`}
      </p>
      {entry.output && <p className="whitespace-pre-wrap text-sm">{entry.output}</p>}
      <p className="text-sm">Review status: {entry.reviewStatus}</p>
      {entry.reviewNote && <p className="text-sm">Previous review note: {entry.reviewNote}</p>}
    </div>
  );
}

export function OwnerTimeReviewQueue() {
  const { userId, isSupervisor, readOnly, isStaff } = useRole();
  if (!userId || !isStaff) return null;
  return (
    <TimeReviewQueue
      key={`${userId}:${isSupervisor}:${readOnly}`}
      userId={userId}
      mayReview={isSupervisor && !readOnly}
    />
  );
}

function TimeReviewQueue({ userId, mayReview }: { userId: string; mayReview: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(ownerTimeReviewQueue);
  const decide = useServerFn(reviewOwnerTimeEntry);
  const [draft, setDraft] = useState<OwnerTimeReviewDraft | null>(null);
  const [decisionError, setDecisionError] = useState("");
  const noteId = useId();
  const decisionId = useId();
  const queueKey = ["owner-time-review", userId];
  const queue = useQuery({ queryKey: queueKey, queryFn: () => load() });
  const entries = queue.data?.entries ?? [];
  const rules = queue.data?.rules ?? [];
  const current = draft ? entries.find((entry) => entry.id === draft.entry.id) : undefined;
  const changed = draft ? ownerTimeReviewChanged(draft, current) : false;

  const act = useMutation({
    mutationFn: (submitted: OwnerTimeReviewDraft) =>
      decide({ data: ownerTimeReviewInput(submitted) }),
    onSuccess: () => {
      setDraft(null);
      setDecisionError("");
      toast.success("Decision recorded.");
      // Review decisions change counted progress, reports, staff queues and history.
      void Promise.allSettled(
        [
          "owner-time-review",
          "owner-program",
          "owner-programs",
          "owner-home",
          "owner-report",
          "owner-analytics",
          "audit-log",
        ].map((key) => qc.invalidateQueries({ queryKey: [key] })),
      );
    },
    onError: (error: Error) => {
      setDecisionError(error.message);
      // Refresh available context without replacing the draft or retrying a decision.
      void qc.invalidateQueries({ queryKey: queueKey });
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-4 text-primary" /> Owner participation review
          </CardTitle>
          <CardDescription>
            Review the homeowner's reported activity and record a decision. A return or flag
            requires a reason the owner can read. Original participation details are retained.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rules.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {rules.map((rule) => (
                <Badge key={rule.key} variant="outline" className="font-normal">
                  {rule.label}: {Object.values(rule.value).join(" · ") || "not set"}
                </Badge>
              ))}
            </div>
          )}
          {queue.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : queue.isError ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>
                The participation queue could not be refreshed. Review current entries before
                saving.
              </p>
              <Button size="sm" variant="outline" onClick={() => void queue.refetch()}>
                Refresh entries
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing is waiting on a reviewer.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="space-y-3 rounded-lg border p-3">
                <EntryDetails entry={entry} />
                {mayReview && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={act.isPending || queue.isFetching}
                    onClick={() => {
                      setDraft(captureOwnerTimeReview(entry));
                      setDecisionError("");
                    }}
                  >
                    Review entry
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Dialog
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open && !act.isPending) setDraft(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review participation entry</DialogTitle>
            <DialogDescription>
              Check the activity and actual time reported. Your decision and reason are saved with
              the entry's history.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!mayReview || act.isPending || changed || queue.isFetching || queue.isError)
                  return;
                act.mutate(draft);
              }}
            >
              <EntryDetails entry={draft.entry} />
              {changed && (
                <div role="status" className="space-y-3 rounded-md border p-3 text-sm">
                  <p>
                    This entry changed or left the review queue. Your original review and note have
                    been retained.
                  </p>
                  {current ? (
                    <>
                      <p className="font-medium">Current entry</p>
                      <EntryDetails entry={current} />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={act.isPending || queue.isFetching || queue.isError}
                        onClick={() => {
                          setDraft(captureOwnerTimeReview(current, draft.decision, draft.note));
                          setDecisionError("");
                        }}
                      >
                        I reviewed the current entry
                      </Button>
                    </>
                  ) : (
                    <p>Refresh the queue to check whether this entry still needs review.</p>
                  )}
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor={decisionId}>Decision</Label>
                <select
                  id={decisionId}
                  name="reviewDecision"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={draft.decision}
                  disabled={act.isPending}
                  onChange={(event) =>
                    setDraft({ ...draft, decision: event.target.value as ReviewDecision })
                  }
                >
                  <option value="approved">Approve</option>
                  <option value="returned">Return for correction</option>
                  <option value="flagged">Flag for review</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={noteId}>Reason the owner will see</Label>
                <Textarea
                  id={noteId}
                  name="reviewNote"
                  rows={3}
                  required={draft.decision !== "approved"}
                  maxLength={1000}
                  value={draft.note}
                  disabled={act.isPending}
                  placeholder="Required to return or flag an entry"
                  onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                />
              </div>
              {decisionError && (
                <p role="alert" className="text-sm text-destructive">
                  {decisionError}
                </p>
              )}
              {queue.isError && (
                <p role="alert" className="text-sm text-destructive">
                  The current entry could not be refreshed. Your review has been retained.
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={act.isPending}
                  onClick={() => setDraft(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={act.isPending || queue.isFetching}
                  onClick={() => void queue.refetch()}
                >
                  Refresh entries
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !mayReview ||
                    act.isPending ||
                    changed ||
                    queue.isFetching ||
                    queue.isError ||
                    (draft.decision !== "approved" && !draft.note.trim())
                  }
                >
                  {act.isPending ? "Recording…" : "Record decision"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
