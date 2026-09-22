/**
 * "Send to Homeowner" — one step from a task drawer to the homeowner's
 * Onboarding actions queue.
 *
 * Presentation only. The note becomes the detail of the same canonical
 * approval record every other path uses, and the ticked files are shared
 * through the existing visibility rule. Nothing here decides access.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { listAttachmentsFn } from "@/lib/attachments.functions";
import { sendTaskToOwnerFn } from "@/lib/onboarding.functions";

export function SendToHomeownerDialog({
  taskId,
  taskTitle,
  disabled,
  alreadyWaiting,
}: {
  taskId: string;
  taskTitle: string;
  disabled: boolean;
  alreadyWaiting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [version, setVersion] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const list = useServerFn(listAttachmentsFn);
  const send = useServerFn(sendTaskToOwnerFn);

  const files = useQuery({
    queryKey: ["attachments", "onboarding_task", taskId],
    queryFn: () => list({ data: { entityType: "onboarding_task", entityId: taskId } }),
    enabled: open,
  });

  const shareable = (files.data?.files ?? []).filter((f) => f.upload_status === "stored");

  const mutation = useMutation({
    mutationFn: (input: { taskId: string; note: string; version: string; documentIds: string[] }) =>
      send({ data: input }),
    onSuccess: (result) => {
      toast.success(
        result.channel === "email"
          ? "Sent — the homeowner received a Resolve email."
          : result.published
            ? "Sent — your instructions are in the homeowner's portal and they can respond."
            : "Sent — it is in the homeowner's portal, but your instructions still need publishing.",
      );
      setOpen(false);
      setNote("");
      setVersion("");
      setPicked([]);
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="gap-1.5">
          <Send className="size-4" aria-hidden />
          Send to homeowner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send &ldquo;{taskTitle}&rdquo; to the homeowner</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {alreadyWaiting && (
            <p className="text-xs text-muted-foreground">
              A request is already waiting with the homeowner. Sending again records a fresh request
              — the earlier one stays in history.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="send-owner-note">What are you asking them? (required)</Label>
            <Textarea
              id="send-owner-note"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write it the way you would say it — what you would like them to look at, and what you need back."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="send-owner-version">What they are looking at (optional)</Label>
            <Input
              id="send-owner-version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. Mood boards v2"
            />
          </div>

          {/* Photos belong where they are sent from, not on the step's front page. */}
          <div className="space-y-1.5">
            <p className="eyebrow">Add a photo or document</p>
            <AttachmentsPanel entityType="onboarding_task" entityId={taskId} title="" />
          </div>

          <div className="space-y-1.5">
            <p className="eyebrow">Files to share with them</p>
            {shareable.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {files.isLoading ? "Checking files…" : "No files are attached to this step yet."}
              </p>
            ) : (
              <ul className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                {shareable.map((f) => (
                  <li key={f.id} className="flex items-start gap-2">
                    <Checkbox
                      id={`share-${f.id}`}
                      checked={picked.includes(f.id) || f.visibility === "owner_shared"}
                      disabled={f.visibility === "owner_shared"}
                      onCheckedChange={() => toggle(f.id)}
                    />
                    <Label htmlFor={`share-${f.id}`} className="text-sm font-normal leading-tight">
                      {f.title || f.original_filename || "File"}
                      {f.visibility === "owner_shared" && (
                        <span className="block text-xs text-muted-foreground">Already shared</span>
                      )}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            An enrolled Active Owner sees this in their portal. A standard homeowner gets a
            Resolve-generated email. Sending does not complete the step.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={disabled || note.trim().length < 20 || mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  taskId,
                  note: note.trim(),
                  version: version.trim(),
                  documentIds: picked,
                })
              }
            >
              {mutation.isPending ? "Sending…" : "Send to homeowner"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
