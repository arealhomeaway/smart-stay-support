/**
 * Mark done for many Tasks on a home's Plan tab (Kati ticket 65, extended by plan catch-up,
 * Admin approval Nov 12). One form for all selected Tasks: when it was done (Today, or Earlier
 * as Done before Resolve on a date up to two years back), one proof note (required, decision O7)
 * and one optional file, saved as the evidence on every Task. Before saving it lists the owner
 * cards these Tasks cover, the owner approvals recorded as approved outside Resolve (Earlier only)
 * and the Tasks that cannot be marked, with the reason. The database saves each Task completely
 * or not at all and skips the ones it lists (item 8).
 */
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { bulkCompleteHomeTasksFn, type BulkCompleteResult } from "@/lib/onboarding-kati.functions";
import { beginUploadFn, completeUploadFn } from "@/lib/attachments.functions";
import { createAttachmentUploader } from "@/lib/attachment-upload-client";
import { earliestDoneOn, markDoneProblem, type DoneWhen } from "@/lib/plan-catch-up";
import { CoveredList, HeldList } from "@/components/onboarding/PlanCatchUp";

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
  onSaved: (result: BulkCompleteResult, doneOn: string | null) => void;
}) {
  const run = useServerFn(bulkCompleteHomeTasksFn);
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const today = centralToday();
  const earliest = earliestDoneOn(today);
  const [preview, setPreview] = useState<BulkCompleteResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [when, setWhen] = useState<DoneWhen>("today");
  const [doneOn, setDoneOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const datedOn = when === "earlier" && doneOn && doneOn <= today && doneOn >= earliest ? doneOn : null;

  // The list depends on the date: owner approvals can be marked only with Earlier.
  useEffect(() => {
    let live = true;
    setPreview(null);
    setPreviewError(null);
    run({ data: { propertyId, taskIds: selectedIds, note: "preview", doneOn: datedOn, fileTaskId: null, dryRun: true } })
      .then((r) => live && setPreview(r))
      .catch((e: Error) => live && setPreviewError(e.message));
    return () => {
      live = false;
    };
  }, [propertyId, run, selectedIds, datedOn]);

  const ready = preview?.ready ?? [];
  const held = preview?.held ?? [];
  const problem = markDoneProblem({ note, when, doneOn: doneOn || null, today, count: ready.length });
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
      // The one shared file is stored on the first Task; every other Task shows it.
      if (file && uploader) await uploader(file, () => {}, `bulk-${fileTaskId}-${file.name}-${file.size}`);
      const r = await run({
        data: {
          propertyId,
          taskIds: ready.map((t) => t.taskId),
          note: note.trim(),
          doneOn: datedOn,
          fileTaskId: file ? fileTaskId : null,
          dryRun: false,
        },
      });
      onSaved(r, datedOn);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Nothing was marked done. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mark done · {homeName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">When was it done</legend>
            <RadioGroup value={when} onValueChange={(v) => setWhen(v as DoneWhen)} className="grid gap-1">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <RadioGroupItem value="today" aria-label="Today" /> Today
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <RadioGroupItem value="earlier" aria-label="Earlier" /> Earlier
              </label>
            </RadioGroup>
            {when === "earlier" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="bulk-done-on">Date it was done</Label>
                <Input id="bulk-done-on" type="date" className="min-h-11" min={earliest} max={today} value={doneOn} onChange={(e) => setDoneOn(e.target.value)} />
              </div>
            ) : null}
          </fieldset>

          {previewError ? <p className="text-sm text-destructive">{previewError}</p> : null}
          {!preview && !previewError ? <p className="text-sm text-muted-foreground">Checking the selected Tasks…</p> : null}
          {preview ? (
            <>
              <div>
                <p className="text-sm font-medium">
                  {ready.length} Task{ready.length === 1 ? "" : "s"} will be marked done
                </p>
                <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
                  {ready.map((t) => (
                    <li key={t.taskId}>{t.title}</li>
                  ))}
                </ul>
              </div>
              {(preview.approvedOutside ?? []).length > 0 ? (
                <div>
                  <p className="text-sm font-medium">Recorded as approved outside Resolve. Nothing is sent to the owner.</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {preview.approvedOutside!.map((t) => (
                      <li key={t.taskId}>{t.title}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <CoveredList covered={preview.covered ?? []} />
              <HeldList held={held} title="Not marked" />
            </>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="bulk-note">Proof</Label>
            <Textarea
              id="bulk-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For example: Signed copy is in the SharePoint home folder"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bulk-file">One file (optional)</Label>
            <Input id="bulk-file" type="file" className="min-h-11" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {problem && ready.length > 0 ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
          {failure ? <p className="text-sm text-destructive">{failure}</p> : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button className="min-h-11" disabled={saving || !preview || Boolean(problem)} onClick={save}>
            {saving ? "Saving…" : `Mark ${ready.length} done`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
