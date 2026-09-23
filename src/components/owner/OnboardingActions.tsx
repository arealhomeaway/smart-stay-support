/**
 * Onboarding items waiting on the homeowner.
 *
 * Same single-shot approval record staff already use: a decision cannot be
 * overwritten, and an item only becomes decidable once ARHA has reviewed and
 * published the owner-facing explanation. Files here are only the ones staff
 * explicitly shared.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Download, FileText, ImageIcon, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { usCalendarDate, usDateTime } from "@/lib/dates";
import { SILENCE_IS_NOT_APPROVAL, deadlineState } from "@/lib/owner-deadline";
import { formatBytes } from "@/lib/attachments";
import { attachmentUrlFn } from "@/lib/attachments.functions";
import { decideOwnerApproval } from "@/lib/owner-portal.functions";
import { ownerOnboardingActions } from "@/lib/owner-onboarding.functions";
import type { OwnerOnboardingAction, OwnerOnboardingFile } from "@/lib/owner-onboarding.server";
import { OnboardingProgress } from "@/components/owner/OnboardingProgress";
import { LogTimeDialog, useOpenLogTime, type LogTimeAnchor } from "@/components/owner/LogTimeDialog";

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

function ActionCard({
  action,
  readOnly,
  onDecide,
  busy,
}: {
  action: OwnerOnboardingAction;
  readOnly: boolean;
  busy: boolean;
  onDecide: (decision: "approved" | "declined", note: string) => void;
}) {
  const [note, setNote] = useState("");
  const decidable = action.canRespond && !readOnly && Boolean(action.publicationId);
  const deadline = deadlineState(action.dueOn);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Onboarding</Badge>
        {action.propertyName && (
          <span className="text-xs text-muted-foreground">{action.propertyName}</span>
        )}
        {deadline && (
          <span
            className={[
              "numeric text-xs",
              deadline.overdue ? "font-semibold text-destructive" : "text-muted-foreground",
            ].join(" ")}
          >
            {deadline.label}
            {deadline.note ? ` · ${deadline.note}` : ""}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold">{action.title}</p>
      {action.detail && (
        <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{action.detail}</p>
      )}

      {action.files.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Shared with you
          </p>
          {action.files.map((file) => (
            <SharedFile key={file.id} file={file} disabled={busy} />
          ))}
        </div>
      )}

      {action.blockedReason && (
        <p className="mt-3 text-sm" role="status">
          {action.blockedReason}
        </p>
      )}

      <Textarea
        className="mt-3"
        rows={2}
        placeholder="Add a note (required if you request changes)"
        aria-label={`Your response to ${action.title}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={!decidable || busy}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={!decidable || busy} onClick={() => onDecide("approved", note)}>
          <CheckCircle2 className="mr-1 size-4" aria-hidden="true" /> Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={!decidable || busy}
          onClick={() => onDecide("declined", note)}
        >
          <RotateCcw className="mr-1 size-4" aria-hidden="true" /> Request changes
        </Button>
      </div>
      {readOnly && (
        <p className="mt-2 text-xs text-muted-foreground">
          Preview only — decisions can only be recorded by the homeowner.
        </p>
      )}
    </div>
  );
}

export function OnboardingActions({
  readOnly,
  programId,
}: {
  readOnly: boolean;
  programId: string | null;
}) {
  const qc = useQueryClient();
  const load = useServerFn(ownerOnboardingActions);
  const decide = useServerFn(decideOwnerApproval);
  const [busy, setBusy] = useState<string | null>(null);
  // After a decision, the homeowner may record the time they actually spent
  // reviewing it — only where staff already opened a participation
  // opportunity for the task. No amount is ever suggested.
  const [logPrompt, setLogPrompt] = useState<{
    anchor: LogTimeAnchor;
    activity: string;
    title: string;
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const openShared = useOpenLogTime();

  const q = useQuery({
    queryKey: ["owner-onboarding", programId, readOnly],
    queryFn: () => load({ data: { programId, preview: readOnly } }),
  });

  const submit = useMutation({
    mutationFn: (input: {
      action: OwnerOnboardingAction;
      decision: "approved" | "declined";
      note: string;
    }) =>
      decide({
        data: {
          approvalId: input.action.approvalId,
          publicationId: input.action.publicationId!,
          expectedUpdatedAt: input.action.updatedAt,
          decision: input.decision,
          comment: input.note,
        },
      }),
    onMutate: (v) => setBusy(v.action.approvalId),
    onSettled: () => setBusy(null),
    onSuccess: (_r, v) => {
      toast.success(
        v.decision === "approved"
          ? "Approved — thank you. Your project manager has been notified."
          : "Sent back to your project manager with your note.",
      );
      const p = v.action.participation;
      if (p) {
        setLogPrompt({
          anchor: {
            id: p.reviewId,
            phase: p.phase,
            ticketId: p.ticketId,
            propertyIds: p.propertyIds,
            ownerUpdateRevision: null,
          },
          activity: `Reviewed and responded to "${v.action.title}".`,
          title: v.action.title,
        });
      }
      void qc.invalidateQueries({ queryKey: ["owner-onboarding"] });
      void qc.invalidateQueries({ queryKey: ["owner-approvals"] });
      void qc.invalidateQueries({ queryKey: ["owner-home"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void qc.invalidateQueries({ queryKey: ["owner-onboarding"] });
    },
  });

  if (q.isLoading) return <Skeleton className="h-40 w-full" />;
  const data = q.data;
  if (q.error || !data || !data.inOnboarding) return null;

  return (
    <div className="space-y-6">
      <SectionCard
        title="Onboarding actions"
        description="Choices your setup team needs from you before the work can move forward."
      >
        <p className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {SILENCE_IS_NOT_APPROVAL}
        </p>
        {!openShared && logPrompt && data.programId && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                Log the time you spent on “{logPrompt.title}”?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add it to your participation record now. Enter the time you actually spent — we
                never fill that in for you.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (openShared && logPrompt) {
                    openShared({
                      anchor: logPrompt.anchor,
                      activity: logPrompt.activity,
                      onDone: () => setLogPrompt(null),
                    });
                  } else setLogOpen(true);
                }}
              >
                <Clock className="mr-1 size-4" aria-hidden="true" /> Log my time
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLogPrompt(null)}>
                Not now
              </Button>
            </div>
          </div>
        )}

        {data.pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing from your setup team is waiting on you right now.
          </p>
        ) : (
          <div className="space-y-3">
            {data.pending.map((action) => (
              <ActionCard
                key={action.approvalId}
                action={action}
                readOnly={readOnly}
                busy={busy === action.approvalId}
                onDecide={(decision, note) => submit.mutate({ action, decision, note })}
              />
            ))}
          </div>
        )}

        {data.decided.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recently decided
            </p>
            {data.decided.map((action) => (
              <div
                key={action.approvalId}
                className="rounded-lg border border-border/60 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={action.status === "approved" ? "default" : "outline"}>
                    {action.status === "approved" ? "Approved" : "Changes requested"}
                  </Badge>
                  <span className="font-medium">{action.title}</span>
                  {action.decidedAt && (
                    <span className="numeric text-xs text-muted-foreground">
                      {usDateTime(action.decidedAt)}
                    </span>
                  )}
                </div>
                {action.decisionNote && (
                  <p className="mt-1 text-muted-foreground">{action.decisionNote}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <OnboardingProgress homes={data.homes} />

      {!openShared && logPrompt && data.programId && (
        <LogTimeDialog
          open={logOpen}
          onOpenChange={setLogOpen}
          programId={data.programId}
          anchor={logPrompt.anchor}
          defaultActivity={logPrompt.activity}
          onDone={() => {
            setLogPrompt(null);
            void qc.invalidateQueries({ queryKey: ["owner-home"] });
            void qc.invalidateQueries({ queryKey: ["owner-report"] });
          }}
        />
      )}
    </div>
  );
}
