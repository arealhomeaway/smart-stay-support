/**
 * "Send to the homeowner" — the one section on a homeowner Task (Task drawer, B2.3).
 *
 * Presentation only. The note becomes the same canonical owner item or approval
 * record every other path uses, the ticked files are shared through the existing
 * visibility rule, and sending completes the Task when the home has a live
 * Active Owner program (send_task_to_owner_item). Nothing here decides access.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailComposer } from "@/components/EmailComposer";
import { OwnerItemConversation } from "@/components/owner/OwnerItemConversation";
import { listAttachmentsFn } from "@/lib/attachments.functions";
import { sendTaskToOwnerFn } from "@/lib/onboarding.functions";
import { confirmOneOff, loadHomeProgramStatus, loadTaskOwnerSend } from "@/lib/ao-data";
import { ONE_OFF_ACTION, isCardExistsError } from "@/lib/ao-dedupe";
import { canSendToActiveOwner } from "@/lib/ao-engine";
import { usDate } from "@/lib/dates";

export function SendToHomeownerSection({
  taskId,
  taskTitle,
  propertyId,
  disabled,
  alreadyWaiting,
  badge,
  children,
  footerSend = false,
  onReady,
  onSent,
  sendBlocked = null,
}: {
  taskId: string;
  taskTitle: string;
  propertyId: string;
  disabled: boolean;
  alreadyWaiting: boolean;
  /** The verify badge for a linked plan card, shown beside the heading. */
  badge?: ReactNode;
  /** Older approval path controls (record an answer given by email or phone). */
  children?: ReactNode;
  /** Fix 20: the drawer's main button sends (form={sendFormId(taskId)}); the inline button hides. */
  footerSend?: boolean;
  /** Tells the drawer whether Send can go now. */
  onReady?: (ready: boolean) => void;
  /** Item 35: called after a successful send, so the drawer can close. */
  onSent?: () => void;
  /** Item 39: why Send must wait (the step needs a file and the Task has none). */
  sendBlocked?: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [answerBy, setAnswerBy] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const list = useServerFn(listAttachmentsFn);
  const send = useServerFn(sendTaskToOwnerFn);

  const files = useQuery({
    queryKey: ["attachments", "onboarding_task", taskId],
    queryFn: () => list({ data: { entityType: "onboarding_task", entityId: taskId } }),
  });
  const sent = useQuery({ queryKey: ["task-owner-send", taskId], queryFn: () => loadTaskOwnerSend(taskId), retry: false });
  const program = useQuery({ queryKey: ["ao-program-status", propertyId], queryFn: () => loadHomeProgramStatus(propertyId) });
  const hasPortal = canSendToActiveOwner(program.data);

  const shareable = (files.data?.files ?? []).filter((f) => f.upload_status === "stored" && !f.archived_at);
  const sharedCount = shareable.filter((f) => f.visibility === "owner_shared").length;

  const mutation = useMutation({
    mutationFn: (input: { taskId: string; note: string; version: string; documentIds: string[]; respondBy: string | null }) =>
      send({ data: input }),
    onSuccess: (result) => {
      toast.success(
        "completed" in result && result.completed
          ? "Sent. It is in the homeowner's portal and this Task is complete."
          : result.channel === "email"
            ? "Sent. The homeowner received an email."
            : "Sent. It is in the homeowner's portal.",
      );
      setNote("");
      setAnswerBy("");
      setPicked([]);
      // Fix 22: the drawer's status chip reads Complete straight away.
      void queryClient.invalidateQueries();
      void router.invalidate();
      onSent?.();
    },
    onError: (e: Error, input) => {
      if (!isCardExistsError(e.message)) { toast.error(e.message); return; }
      toast.error(e.message, {
        duration: 15000,
        action: {
          label: ONE_OFF_ACTION,
          onClick: () => {
            void confirmOneOff(propertyId, taskId, taskTitle)
              .then(() => mutation.mutate(input))
              .catch((err: Error) => toast.error(err.message));
          },
        },
      });
    },
  });

  const toggle = (id: string) => setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const item = sent.data?.available ? sent.data.data : null;
  const ready = !disabled && !item && !sent.isError && !sendBlocked && note.trim().length >= 20 && !mutation.isPending;
  useEffect(() => onReady?.(ready), [ready, onReady]);
  const submit = () => mutation.mutate({ taskId, note: note.trim(), version: "", documentIds: picked, respondBy: answerBy || null });

  return (
    <section className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4" aria-label="Send to the homeowner">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Send to the homeowner</p>
        {badge}
      </div>

      {sent.isError ? (
        // Unknown whether it was already sent: never offer a second send.
        <LoadError what="What was sent" onRetry={() => void sent.refetch()} />
      ) : item ? (
        <>
          <p className="text-sm text-muted-foreground">
            Sent {usDate(item.sent_at)}
            {item.respond_by ? ` · Answer by ${usDate(item.respond_by)}` : ""}
            {` · ${sharedCount} ${sharedCount === 1 ? "file" : "files"}`}
          </p>
          <OwnerItemConversation reviewId={item.review_id} side="staff" readOnly={disabled} />
        </>
      ) : (
        <form
          id={sendFormId(taskId)}
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) submit();
          }}
        >
          {alreadyWaiting && (
            <p className="text-xs text-muted-foreground">Already waiting on the homeowner. Sending again records a fresh request.</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`send-owner-note-${taskId}`}>What you&apos;re asking</Label>
            <Textarea
              id={`send-owner-note-${taskId}`}
              rows={4}
              value={note}
              disabled={disabled}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What you would like them to look at, and what you need back."
            />
          </div>
          <div className="space-y-1.5">
            <p className="eyebrow">Files to share</p>
            {shareable.length === 0 ? (
              <p className="text-sm text-muted-foreground">{files.isLoading ? "Checking files…" : "No files on this Task yet."}</p>
            ) : (
              <ul className="space-y-1">
                {shareable.map((f) => (
                  <li key={f.id} className="flex min-h-11 items-center gap-2">
                    <Checkbox
                      id={`share-${taskId}-${f.id}`}
                      checked={picked.includes(f.id) || f.visibility === "owner_shared"}
                      disabled={disabled || f.visibility === "owner_shared"}
                      onCheckedChange={() => toggle(f.id)}
                    />
                    <Label htmlFor={`share-${taskId}-${f.id}`} className="text-sm font-normal leading-tight">
                      {f.title || f.original_filename || "File"}
                      {f.visibility === "owner_shared" && <span className="block text-xs text-muted-foreground">Already shared</span>}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`send-owner-by-${taskId}`}>Answer by (optional)</Label>
            <Input
              id={`send-owner-by-${taskId}`}
              type="date"
              className="h-11 w-48"
              value={answerBy}
              disabled={disabled}
              onChange={(e) => setAnswerBy(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!footerSend && (
              <Button type="submit" className="min-h-11 gap-1.5" disabled={!ready}>
                <Send className="size-4" aria-hidden />
                {mutation.isPending ? "Sending…" : "Send to the homeowner"}
              </Button>
            )}
            {/* A standard owner without the portal: the existing email composer. */}
            {!disabled && !hasPortal && program.isFetched && (
              <EmailComposer context="onboarding_task" recordId={taskId} label="Email instead" disabled={Boolean(sendBlocked)} />
            )}
          </div>
          {sendBlocked && (!footerSend || (!disabled && !hasPortal && program.isFetched)) && (
            <p className="text-xs text-muted-foreground">{sendBlocked}</p>
          )}
        </form>
      )}
      {children}
    </section>
  );
}

/** The form the drawer's "Send to the homeowner" button submits. */
export const sendFormId = (taskId: string) => `send-owner-${taskId}`;
