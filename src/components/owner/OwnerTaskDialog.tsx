/**
 * One place a homeowner opens an item waiting on them and actually works it.
 *
 * Everything the internal team attached to the task travels here: the written
 * instructions (with any links made clickable), the documents and photos staff
 * shared, the deadline, the homes it affects, and the response or decision the
 * team asked for. The decision record itself is unchanged — approvals still go
 * through the single-shot published approval, and a written response still
 * goes through the review record.
 */
import { OwnerItemConversation } from "@/components/owner/OwnerItemConversation";
import { useState, type ReactNode } from "react";
import { OwnerSidePanel, PanelSection } from "@/components/owner/OwnerSidePanel";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Download, FileText, ImageIcon, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { usCalendarDate, usDateTime } from "@/lib/dates";
import { SILENCE_IS_NOT_APPROVAL, deadlineState } from "@/lib/owner-deadline";
import { formatBytes } from "@/lib/attachments";
import { attachmentUrlFn } from "@/lib/attachments.functions";
import { decideOwnerApproval } from "@/lib/owner-portal.functions";
import type { OwnerOnboardingAction, OwnerOnboardingFile } from "@/lib/owner-onboarding.server";
import { linkifyText } from "@/lib/linkify";

function SharedFile({ file, disabled }: { file: OwnerOnboardingFile; disabled: boolean }) {
  const getUrl = useServerFn(attachmentUrlFn);
  const [busy, setBusy] = useState(false);

  const open = async (download: boolean) => {
    setBusy(true);
    try {
      const result = await getUrl({ data: { documentId: file.id, download } });
      const url = (result as { url?: string }).url;
      if (!url) throw new Error("That file could not be opened.");
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That file could not be opened.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        {file.kind === "photo" ? (
          <ImageIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {file.filename ?? ""}
            {file.sizeBytes ? ` · ${formatBytes(file.sizeBytes)}` : ""}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="sm" variant="ghost" disabled={busy || disabled} onClick={() => open(false)}>
          View
        </Button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Download ${file.title}`}
          disabled={busy || disabled}
          onClick={() => open(true)}
        >
          <Download className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}


export type OwnerTaskDetails = {
  title: string;
  statusLabel: string;
  source: string;
  homes: string;
  respondBy: string | null;
  /** What the team wrote for the homeowner, in the order it should be read. */
  question: string | null;
  recommendation: string | null;
  guidance: string | null;
  priorResponse: string | null;
  /** When it was sent to the homeowner. */
  sentAt?: string | null;
};

export function OwnerTaskDialog({
  open,
  onOpenChange,
  details,
  action,
  canRespond,
  responding,
  onRespond,
  canLogTime,
  onLogTime,
  logTimeBlockedReason,
  onDecided,
  sharedFiles,
  reviewId,
  readOnly = false,
  extra = null,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  details: OwnerTaskDetails;
  /** The onboarding task behind this item, when there is one. */
  action: OwnerOnboardingAction | null;
  canRespond: boolean;
  responding: boolean;
  onRespond: (response: string) => void;
  canLogTime: boolean;
  onLogTime: () => void;
  logTimeBlockedReason: string | null;
  onDecided: () => void;
  /** Files shared on the card's linked onboarding step, when no decision carries them. */
  sharedFiles?: OwnerOnboardingFile[];
  /** The owner item; a Task sent as a conversation shows it here instead of the one-time reply. */
  reviewId?: string;
  readOnly?: boolean;
  /** Extra sections for this item, such as a photo download. */
  extra?: ReactNode;
}) {
  const [response, setResponse] = useState("");
  const [note, setNote] = useState("");
  const decide = useServerFn(decideOwnerApproval);
  const deadline = deadlineState(details.respondBy ?? action?.dueOn ?? null);
  const decidable = Boolean(action?.canRespond && action?.publicationId);
  const files = action?.files?.length ? action.files : (sharedFiles ?? []);

  const submitDecision = useMutation({
    mutationFn: (decision: "approved" | "declined") =>
      decide({
        data: {
          approvalId: action!.approvalId,
          publicationId: action!.publicationId!,
          expectedUpdatedAt: action!.updatedAt,
          decision,
          comment: note,
        },
      }),
    onSuccess: (_r, decision) => {
      toast.success(
        decision === "approved"
          ? "Approved: thank you. Your project manager has been notified."
          : "Sent back to your project manager with your note.",
      );
      setNote("");
      onOpenChange(false);
      onDecided();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reply = canRespond ? (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Your reply</p>
      <Textarea
        rows={4}
        placeholder="Write your answer, question or decision"
        aria-label="Your reply"
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        disabled={responding}
      />
      <Button className="min-h-11" size="sm" disabled={responding} onClick={() => onRespond(response.trim())}>
        Send to ARHA
      </Button>
    </div>
  ) : null;

  return (
    <OwnerSidePanel
      open={open}
      onOpenChange={onOpenChange}
      status={details.statusLabel}
      title={details.title}
      home={[details.homes, details.source].filter(Boolean).join(" · ")}
      sentAt={details.sentAt ?? null}
      answerBy={details.respondBy ?? action?.dueOn ?? null}
      footer={
        <>
          {canLogTime ? (
            <Button className="min-h-11" size="sm" variant="outline" onClick={onLogTime}>
              <Clock className="mr-1 size-4" aria-hidden="true" /> Log hours for this
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              {logTimeBlockedReason ?? "Logging time is not available for this item."}
            </p>
          )}
          <Button className="min-h-11 sm:ml-auto" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </>
      }
    >
      {deadline?.overdue ? (
        <p className="numeric text-sm font-semibold text-destructive">
          {deadline.label}
          {deadline.note ? ` · ${deadline.note}` : ""}
        </p>
      ) : null}

      {details.question || action?.detail ? (
        <PanelSection label="What we're asking">
          <div className="space-y-2">
            {details.question ? <p className="whitespace-pre-wrap">{linkifyText(details.question)}</p> : null}
            {action?.detail ? <p className="whitespace-pre-wrap text-muted-foreground">{linkifyText(action.detail)}</p> : null}
          </div>
        </PanelSection>
      ) : null}
      {details.recommendation ? (
        <PanelSection label="Our recommendation"><p className="whitespace-pre-wrap">{linkifyText(details.recommendation)}</p></PanelSection>
      ) : null}
      {details.guidance ? <p className="text-sm text-muted-foreground">{details.guidance}</p> : null}
      {extra}

      {files.length > 0 ? (
        <PanelSection label="Files">
          <div className="space-y-2">
            {files.map((file) => (
              <SharedFile key={file.id} file={file} disabled={submitDecision.isPending} />
            ))}
          </div>
        </PanelSection>
      ) : null}

      {action?.blockedReason ? (
        <p className="text-sm" role="status">
          {action.blockedReason}
        </p>
      ) : null}

      {details.priorResponse ? (
        <PanelSection label="Your recorded response"><p className="whitespace-pre-wrap">{details.priorResponse}</p></PanelSection>
      ) : null}

      {action?.decidedAt ? (
        <p className="text-xs text-muted-foreground">Decision recorded {usDateTime(action.decidedAt)}.</p>
      ) : null}

      {decidable ? (
        <div className="rounded-xl border border-border p-3">
          <p className="text-sm font-medium">Your decision</p>
          <p className="mt-1 text-xs text-muted-foreground">{SILENCE_IS_NOT_APPROVAL}</p>
          <Textarea
            className="mt-2"
            rows={3}
            placeholder="Add a note (required if you request changes)"
            aria-label="Note with your decision"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitDecision.isPending}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <Button className="min-h-11" size="sm" disabled={submitDecision.isPending} onClick={() => submitDecision.mutate("approved")}>
              <CheckCircle2 className="mr-1 size-4" aria-hidden="true" /> Approve
            </Button>
            <Button className="min-h-11" size="sm" variant="outline" disabled={submitDecision.isPending} onClick={() => submitDecision.mutate("declined")}>
              <RotateCcw className="mr-1 size-4" aria-hidden="true" /> Request changes
            </Button>
          </div>
        </div>
      ) : null}

      {reviewId && open ? (
        <OwnerItemConversation reviewId={reviewId} side="owner" readOnly={readOnly} onChanged={onDecided} fallback={reply} />
      ) : (
        reply
      )}
    </OwnerSidePanel>
  );
}

/** Deadline text shown next to a task row, matching the dialog. */
export function taskDeadlineLabel(respondBy: string | null) {
  return respondBy ? `Please respond by ${usCalendarDate(respondBy)}` : "No due date";
}
