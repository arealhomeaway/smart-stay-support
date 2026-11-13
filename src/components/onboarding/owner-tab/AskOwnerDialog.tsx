/**
 * Property page Part 2 (2.3): Ask the owner. One owner item the owner can reply to, approve when it
 * asks for approval, and log time on; it can hold up a Task and carry an answer-by date.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiFileUpload } from "@/components/MultiFileUpload";
import { createAttachmentUploader } from "@/lib/attachment-upload-client";
import { beginUploadFn, completeUploadFn } from "@/lib/attachments.functions";
import { askOwnerFn } from "@/lib/owner-tab.functions";
import { confirmOneOff } from "@/lib/ao-data";
import { ONE_OFF_ACTION, isCardExistsError } from "@/lib/ao-dedupe";

export function AskOwnerDialog(p: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyId: string;
  ownerFirst: string;
  tasks: { id: string; title: string }[];
  today: string;
}) {
  const qc = useQueryClient();
  const ask = useServerFn(askOwnerFn);
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const [question, setQuestion] = useState("");
  const [approval, setApproval] = useState(false);
  const [dueOn, setDueOn] = useState("");
  const [taskId, setTaskId] = useState("");
  const [docs, setDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploadKey, setUploadKey] = useState(0);
  const [upload] = useState(() =>
    createAttachmentUploader(begin, complete, (file, key) => ({
      entityType: "property" as const,
      entityId: p.propertyId,
      uploadKey: key,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      category: null,
    })),
  );
  const reset = () => {
    setQuestion("");
    setApproval(false);
    setDueOn("");
    setTaskId("");
    setDocs([]);
    setUploadKey((k) => k + 1);
  };
  const m = useMutation({
    mutationFn: () =>
      ask({ data: { propertyId: p.propertyId, question: question.trim(), needsApproval: approval, dueOn: dueOn || null, taskId: taskId || null, documentIds: docs } }),
    onSuccess: (r) => {
      toast.success(r.dueSaved ? `Sent to ${p.ownerFirst}` : `Sent to ${p.ownerFirst}. The answer-by date starts once it is switched on.`);
      reset();
      p.onOpenChange(false);
      void qc.invalidateQueries({ queryKey: ["owner-collaboration", p.propertyId] });
      void qc.invalidateQueries({ queryKey: ["owner-tab", p.propertyId] });
    },
    onError: (e: Error) => {
      if (!isCardExistsError(e.message)) {
        toast.error(e.message);
        return;
      }
      toast.error(e.message, {
        duration: 15000,
        action: {
          label: ONE_OFF_ACTION,
          onClick: () => {
            void confirmOneOff(p.propertyId, taskId || null, question.trim().split("\n")[0]!.slice(0, 120))
              .then(() => m.mutate())
              .catch((err: Error) => toast.error(err.message));
          },
        },
      });
    },
  });
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask the owner</DialogTitle>
          <DialogDescription className="sr-only">Send the owner a question</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim().length >= 3 && !busy) m.mutate();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="font-medium">What do you need from them?</span>
            <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} maxLength={4000} required />
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <Checkbox checked={approval} onCheckedChange={(v) => setApproval(v === true)} />
            They need to approve this
          </label>
          <div className="space-y-1 text-sm">
            <span className="font-medium">Files (optional)</span>
            <MultiFileUpload key={uploadKey} autoStart upload={upload} onBusyChange={setBusy} onResults={setDocs} />
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Answer by (optional)</span>
            <Input type="date" className="h-11" min={p.today} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium">Holds up a Task (optional)</span>
            <select className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">None</option>
              {p.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={m.isPending || busy || question.trim().length < 3}>
              Send to the owner
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
