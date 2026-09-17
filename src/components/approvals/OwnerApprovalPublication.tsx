import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ownerApprovalPublicationContext,
  publishOwnerApprovalSummary,
} from "@/lib/owner-approval.functions";
import {
  captureApprovalPublicationVersion,
  sameApprovalPublicationVersion,
  type ApprovalPublicationVersion,
} from "@/lib/owner-approval-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function OwnerApprovalPublication({
  approvalId,
  onPublished,
}: {
  approvalId: string;
  onPublished: () => void;
}) {
  const load = useServerFn(ownerApprovalPublicationContext);
  const publish = useServerFn(publishOwnerApprovalSummary);
  const qc = useQueryClient();
  const [version, setVersion] = useState<ApprovalPublicationVersion | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["owner-approval-publication", approvalId],
    queryFn: () => load({ data: { approvalId } }),
  });
  const current = q.data;
  const changed = Boolean(version && current && !sameApprovalPublicationVersion(version, current));
  const mutation = useMutation({
    mutationFn: async () => {
      if (
        !version?.programId ||
        !version.ownerId ||
        !version.recipientId ||
        !current?.canPublish ||
        !reviewed ||
        changed
      ) {
        throw new Error(
          "Review the current Owner, recipient and decision context before publishing.",
        );
      }
      return publish({
        data: {
          approvalId: version.approvalId,
          expectedUpdatedAt: version.expectedUpdatedAt,
          expectedRevision: version.expectedRevision,
          expectedOwnerId: version.ownerId,
          expectedProgramId: version.programId,
          expectedRecipientId: version.recipientId,
          title,
          detail,
          reviewed: true,
        },
      });
    },
    onSuccess: () => {
      setVersion(null);
      setReviewed(false);
      setFailure(null);
      toast.success("Owner-facing approval summary published.");
      void qc.invalidateQueries({ queryKey: ["owner-approval-publication", approvalId] });
      void qc.invalidateQueries({ queryKey: ["owner-approvals"] });
      onPublished();
    },
    onError: (error: Error) => {
      setFailure(error.message);
      setReviewed(false);
      void q.refetch();
    },
  });
  return (
    <section
      className="space-y-3 rounded-md border border-border p-3"
      aria-label="Owner-facing approval summary"
    >
      <p className="font-medium">Owner-facing approval summary</p>
      <p className="text-sm text-muted-foreground">
        Publish the decision context the owner may see. Internal request text and attachments are
        never copied automatically.
      </p>
      {q.isPending && <p role="status">Checking the current Owner and recipient…</p>}
      {q.error && <p role="alert">{q.error.message}</p>}
      {current && (
        <>
          <p className="text-sm">
            Canonical Owner: {current.ownerName ?? "No eligible recipient linked"}
          </p>
          <p className="text-sm">
            Portal recipient: {current.recipientEmail ?? "No eligible recipient linked"}
          </p>
          {current.blockedReason && <p role="status">{current.blockedReason}</p>}
          {!version ? (
            <Button
              type="button"
              variant="outline"
              disabled={!current.canPublish}
              onClick={() => {
                setVersion(captureApprovalPublicationVersion(current));
                setTitle(current.publishedTitle ?? "");
                setDetail(current.publishedDetail ?? "");
                setReviewed(false);
                setFailure(null);
              }}
            >
              {current.expectedRevision > 0
                ? "Review or revise the published summary"
                : "Review and publish an owner summary"}
            </Button>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate();
              }}
            >
              <label className="block space-y-1">
                <span>Owner-facing title</span>
                <Input
                  value={title}
                  minLength={5}
                  maxLength={180}
                  required
                  disabled={mutation.isPending}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setReviewed(false);
                  }}
                />
              </label>
              <label className="block space-y-1">
                <span>What the owner is deciding and why</span>
                <Textarea
                  value={detail}
                  rows={5}
                  minLength={20}
                  maxLength={4000}
                  required
                  disabled={mutation.isPending}
                  onChange={(event) => {
                    setDetail(event.target.value);
                    setReviewed(false);
                  }}
                />
              </label>
              {changed && (
                <div role="status" className="space-y-2">
                  <p>
                    The request, recipient or published summary changed. Your draft has been kept.
                    Review the current Owner and source before continuing.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={mutation.isPending || !current.canPublish}
                    onClick={() => {
                      setVersion(captureApprovalPublicationVersion(current));
                      setReviewed(false);
                      setFailure(null);
                    }}
                  >
                    I have reviewed the current context
                  </Button>
                </div>
              )}
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={reviewed}
                  required
                  disabled={mutation.isPending || changed}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                <span>
                  I reviewed this summary for the current Owner and recipient. It explains the
                  decision and excludes guest personal details, private staff notes, access
                  credentials and restricted financial information.
                </span>
              </label>
              {failure && <p role="alert">{failure}</p>}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={mutation.isPending || changed || !reviewed || !current.canPublish}
                >
                  Publish reviewed summary
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setVersion(null);
                    setReviewed(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </section>
  );
}
