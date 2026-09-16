/**
 * What the homeowner actually said, and the person who records it.
 *
 * A standard homeowner answers by email. Resolve files that reply against the
 * decision it answers and shows it here in the homeowner's own words. It does
 * not decide anything: a coordinator reads the reply and records Approved,
 * Declined or Changes requested on the same decision an Active Owner would have
 * answered in their portal.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { relativeTime } from "@/lib/tickets";
import {
  editOwnerReplyDraft,
  ownerReplyContextChanged,
  ownerReplyDraftInput,
  adoptReviewedOwnerReplyContext,
  type OwnerReplyContext,
  type OwnerReplyDecision,
  type OwnerReplyDraft,
} from "@/lib/owner-email-reply-draft";
import {
  ownerRepliesForApprovalFn,
  recordOwnerReplyDecisionFn,
} from "@/lib/owner-response.functions";

const DECISIONS: { value: OwnerReplyDecision; label: string }[] = [
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "changes_requested", label: "Changes requested" },
];

export function OwnerReplies({
  approvalId,
  expectedUpdatedAt,
  sourceType,
  pending,
  refreshing,
  onReviewCurrent,
  onRecorded,
}: {
  approvalId: string;
  expectedUpdatedAt: string;
  sourceType: string;
  pending: boolean;
  refreshing: boolean;
  onReviewCurrent: () => Promise<Pick<OwnerReplyContext, "expectedUpdatedAt" | "pending">>;
  onRecorded?: () => void;
}) {
  const loadReplies = useServerFn(ownerRepliesForApprovalFn);
  const record = useServerFn(recordOwnerReplyDecisionFn);
  const qc = useQueryClient();
  const [draft, setDraft] = useState<OwnerReplyDraft | null>(null);
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewedContext, setReviewedContext] = useState<OwnerReplyContext | null>(null);

  const replies = useQuery({
    queryKey: ["owner-replies", approvalId],
    queryFn: () => loadReplies({ data: { approvalId } }),
  });

  const current: OwnerReplyContext = {
    approvalId,
    expectedUpdatedAt,
    responseId: replies.data?.find((reply) => reply.status === "matched")?.id ?? null,
    pending,
  };
  const stale = !!draft && (needsReview || ownerReplyContextChanged(draft.context, current));
  const busy = refreshing || replies.isFetching || reviewing;
  const reviewedCurrent =
    reviewedContext && !ownerReplyContextChanged(reviewedContext, current) && !busy;

  async function reviewCurrent() {
    setReviewing(true);
    setReviewedContext(null);
    try {
      const approval = await onReviewCurrent();
      const currentReplies = await replies.refetch();
      if (currentReplies.error) throw currentReplies.error;
      setReviewedContext({
        approvalId,
        ...approval,
        responseId: currentReplies.data?.find((reply) => reply.status === "matched")?.id ?? null,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not refresh current details.");
    } finally {
      setReviewing(false);
    }
  }

  const save = useMutation({
    mutationFn: () => {
      if (!draft || needsReview || busy || replies.isError)
        throw new Error("Review the current approval and replies before saving.");
      return record({ data: ownerReplyDraftInput(draft, current) });
    },
    onSuccess: () => {
      toast.success("Homeowner response recorded");
      setDraft(null);
      setNeedsReview(false);
      setReviewedContext(null);
      void qc.invalidateQueries({ queryKey: ["approval-detail", approvalId] });
      void qc.invalidateQueries({ queryKey: ["owner-replies", approvalId] });
      onRecorded?.();
    },
    onError: (e: unknown) => {
      setNeedsReview(true);
      setReviewedContext(null);
      toast.error(e instanceof Error ? e.message : "Could not save that.");
    },
  });

  const rows = replies.data ?? [];

  return (
    <div className="space-y-3">
      {rows.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Homeowner response received</p>
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-md border border-border/60 bg-secondary/40 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {r.from_name || r.from_address || "Homeowner"}
                </span>
                <span>{relativeTime(r.received_at)}</span>
                {r.has_attachments ? <Chip>Attachment sent</Chip> : null}
              </div>
              {r.subject ? <p className="mt-1 text-xs text-muted-foreground">{r.subject}</p> : null}
              <p className="mt-2 whitespace-pre-wrap">{(r.body_text ?? "").slice(0, 2000)}</p>
              {r.web_link ? (
                <a
                  href={r.web_link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  Open the original email
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {pending || draft ? (
        <div className="space-y-2 rounded-md border border-border/60 p-3">
          <p className="text-sm font-medium">Record homeowner response</p>
          <p className="text-xs text-muted-foreground">
            Resolve never decides this for the homeowner. Choose what they said and save it.
          </p>
          {stale ? (
            <div className="space-y-2 rounded-md border border-border p-3 text-sm" role="status">
              <p>
                Your draft is retained. The approval or replies changed, or the last save was not
                confirmed. Review the current approval above and the replies before continuing.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || save.isPending}
                onClick={() => void reviewCurrent()}
              >
                {reviewing ? "Refreshing details…" : "Review current details"}
              </Button>
              {reviewedCurrent && pending ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => {
                    if (!draft || !reviewedContext) return;
                    setDraft(adoptReviewedOwnerReplyContext(draft, reviewedContext));
                    setNeedsReview(false);
                    setReviewedContext(null);
                  }}
                >
                  Use reviewed details
                </Button>
              ) : null}
              {!pending ? <p>This approval is no longer awaiting a response.</p> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {DECISIONS.filter(
              (d) => sourceType !== "financial_request" || d.value !== "changes_requested",
            ).map((d) => (
              <Button
                key={d.value}
                size="sm"
                variant={draft?.decision === d.value ? "default" : "outline"}
                disabled={save.isPending || (!draft && (busy || replies.isError))}
                onClick={() =>
                  setDraft((prior) => editOwnerReplyDraft(prior, current, { decision: d.value }))
                }
              >
                {d.label}
              </Button>
            ))}
          </div>
          <Textarea
            value={draft?.note ?? ""}
            disabled={save.isPending || (!draft && (busy || replies.isError))}
            onChange={(e) => {
              const note = e.target.value;
              setDraft((prior) => editOwnerReplyDraft(prior, current, { note }));
            }}
            placeholder="What the homeowner said, and where the answer came from."
            rows={3}
            maxLength={2000}
          />
          <Button
            size="sm"
            disabled={
              !draft?.decision ||
              draft.note.trim().length < 3 ||
              !pending ||
              stale ||
              busy ||
              replies.isError ||
              save.isPending
            }
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save the homeowner's answer"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
