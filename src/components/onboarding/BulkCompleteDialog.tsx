/**
 * Bulk complete on a home's Plan tab (Kati ticket 65): the ticked tasks are
 * completed together with ONE shared note (and optionally one file), saved as
 * the evidence on every task. "Done before Resolve" records the date the work
 * was really done, so work finished outside Resolve can be caught up.
 * The database action completes all or none and records who, when and the
 * evidence on each task.
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { bulkCompleteProblem } from "@/lib/onboarding-evidence";
import { bulkCompleteHomeTasksFn, type BulkCompleteResult } from "@/lib/onboarding-kati.functions";
import { beginUploadFn, completeUploadFn } from "@/lib/attachments.functions";
import { createAttachmentUploader } from "@/lib/attachment-upload-client";

function centralToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
}

export function BulkCompleteDialog({
  propertyId,
  homeName,
  selectedIds,
  onClose,
  onSaved,
}: {
  propertyId: string;
  homeName: string;
  selectedIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const run = useServerFn(bulkCompleteHomeTasksFn);
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const [preview, setPreview] = useState<BulkCompleteResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [doneBefore, setDoneBefore] = useState(false);
  const [doneOn, setDoneOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const today = centralToday();

  useEffect(() => {
    let live = true;
    run({ data: { propertyId, taskIds: selectedIds, note: "check", doneOn: null, fileTaskId: null, dryRun: true } })
      .then((r) => live && setPreview(r))
      .catch((e: Error) => live && setPreviewError(e.message));
    return () => {
      live = false;
    };
  }, [propertyId, run, selectedIds]);

  const ready = preview?.ready ?? [];
  const held = preview?.held ?? [];
  const problem = bulkCompleteProblem({
    note,
    hasFile: Boolean(file),
    doneBeforeResolve: doneBefore,
    doneOn: doneOn || null,
    today,
    count: ready.length,
  });
  const fileTaskId = ready[0]?.taskId ?? null;
  const uploader = useMemo(
    () =>
      fileTaskId
        ? createAttachmentUploader(begin, complete, (f, key) => ({
            entityType: "onboarding_task",
            entityId: fileTaskId,
            uploadKey: key,
            filename: f.name,
            mimeType: f.type,
            sizeBytes: f.size,
            category: null,
            fulfilsRequestId: null,
          }))
        : null,
    [begin, complete, fileTaskId],
  );

  const save = async () => {
    if (problem || !preview) return;
    setSaving(true);
    setFailure(null);
    try {
      // The one shared file is stored on the first task; every other task shows it.
      if (file && uploader) await uploader(file, () => {}, `bulk-${fileTaskId}-${file.name}-${file.size}`);
      const r = await run({
        data: {
          propertyId,
          taskIds: ready.map((t) => t.taskId),
          note: note.trim(),
          doneOn: doneBefore ? doneOn : null,
          fileTaskId: file ? fileTaskId : null,
          dryRun: false,
        },
      });
      toast.success(`${r.completed} task${r.completed === 1 ? "" : "s"} marked complete.`);
      onSaved();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Nothing was completed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark complete · {homeName}</DialogTitle>
        </DialogHeader>
        {previewError ? <p className="text-sm text-destructive">{previewError}</p> : null}
        {!preview && !previewError ? <p className="text-sm text-muted-foreground">Checking the ticked tasks…</p> : null}
        {preview ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">
                {ready.length} task{ready.length === 1 ? "" : "s"} will be marked complete
              </p>
              <ScrollArea className="mt-1 max-h-40 rounded-md border border-border">
                <ul className="space-y-1 p-2 text-sm">
                  {ready.map((t) => (
                    <li key={t.taskId}>{t.title}</li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
            {held.length > 0 ? (
              <div>
                <p className="text-sm font-medium">{held.length} left as they are</p>
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {held.map((t) => (
                    <li key={t.taskId}>
                      {t.title}: {t.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-note">Where the proof is</Label>
              <Textarea
                id="bulk-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For example: Signed copy is in the SharePoint home folder"
              />
              <p className="text-xs text-muted-foreground">Saved as the evidence on every task above.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-file">One file for all of them (optional)</Label>
              <Input
                id="bulk-file"
                type="file"
                className="min-h-11"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox checked={doneBefore} onCheckedChange={(v) => setDoneBefore(v === true)} />
              Done before Resolve
            </label>
            {doneBefore ? (
              <div className="grid gap-1.5">
                <Label htmlFor="bulk-done-on">Date the work was done</Label>
                <Input
                  id="bulk-done-on"
                  type="date"
                  className="min-h-11"
                  max={today}
                  value={doneOn}
                  onChange={(e) => setDoneOn(e.target.value)}
                />
              </div>
            ) : null}
            {problem && ready.length > 0 ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
            {failure ? <p className="text-sm text-destructive">{failure}</p> : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button className="min-h-11" disabled={saving || !preview || Boolean(problem)} onClick={save}>
            {saving ? "Saving…" : `Mark ${ready.length} complete`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
