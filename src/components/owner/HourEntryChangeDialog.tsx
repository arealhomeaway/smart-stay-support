/**
 * Edit or Add more on one of the homeowner's own hours entries (approved Nov 18). The original
 * entry stays on file. ARHA does not review owner hours. Files are only added, never removed.
 */
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { validateFile } from "@/lib/attachments";
import { beginParticipationEvidenceFn } from "@/lib/owner-evidence.functions";
import { prepareUploadSelection } from "@/lib/zip-upload";
import { REOPEN_COPY, hoursChangeProblem } from "@/lib/homeowner-reopen";
import { saveHoursChange } from "@/lib/homeowner-reopen.data";
import { HOURS_REPEAT_COPY, isAlreadySaved } from "@/lib/hours-repeat";
import { shortDate } from "@/lib/owner-opportunity-board";
import { centralToday } from "@/lib/central-today";
import { OWNER_ACTIVITY_MAX, activityCounter, ownerSaveMessage } from "@/lib/owner-save-error";

export type ChangeableEntry = {
  id: string;
  activity: string;
  entry_date: string;
  minutes: number;
  reviewed_at?: string | null;
  fileCount: number;
};

const MAX_FILES = 10;
const todayKey = () => centralToday();

export function HourEntryChangeDialog({
  entry,
  mode,
  programId,
  onClose,
  onSaved,
  initial,
}: {
  entry: ChangeableEntry;
  mode: "edit" | "add";
  programId: string;
  onClose: () => void;
  onSaved: () => void;
  /** Nov 21: what she typed in Log your time, carried over when she chose Update. */
  initial?: { activity: string; entryDate: string; minutes: string; files: File[] };
}) {
  const [activity, setActivity] = useState(initial?.activity ?? entry.activity);
  const [entryDate, setEntryDate] = useState(initial?.entryDate ?? entry.entry_date);
  const [minutes, setMinutes] = useState(initial?.minutes || String(entry.minutes));
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>(() => (initial?.files ?? []).slice(0, Math.max(0, MAX_FILES - entry.fileCount)));
  // Nov 21: one save at a time, even on a fast double click (before the button re-renders as disabled).
  const saving = useRef(false);
  const beginEvidence = useServerFn(beginParticipationEvidenceFn);
  const room = Math.max(0, MAX_FILES - entry.fileCount);

  const addFiles = async (chosen: File[]) => {
    const selected = await prepareUploadSelection(chosen, true);
    selected.messages.forEach((m) => toast.error(m));
    const keep = selected.files.filter((f) => {
      const check = validateFile({ name: f.name, type: f.type, size: f.size });
      if (!check.ok) toast.error(`${f.name}: ${check.message}`);
      return check.ok;
    });
    setFiles((cur) => {
      const merged = [...cur, ...keep.filter((k) => !cur.some((c) => c.name === k.name && c.size === k.size))];
      if (merged.length > room) toast.error(`You can attach up to ${MAX_FILES} files on one entry.`);
      return merged.slice(0, room);
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const mins = Number(minutes);
      const problem = hoursChangeProblem(
        { mode, activity, entryDate, minutes: Number.isInteger(mins) ? mins : Number.NaN, note, newFiles: files.length },
        { activity: entry.activity, entry_date: entry.entry_date, minutes: entry.minutes },
        todayKey(),
      );
      if (problem) throw new Error(problem);
      const addPaths: string[] = [];
      for (const f of files) {
        const started = await beginEvidence({ data: { programId, uploadKey: crypto.randomUUID(), filename: f.name, mimeType: f.type, sizeBytes: f.size } });
        const { uploadToSignedSlot } = await import("@/lib/signed-upload");
        await uploadToSignedSlot(started.path, started.token!, f);
        addPaths.push(started.path);
      }
      return saveHoursChange(entry.id, mode === "edit"
        ? { mode, activity: activity.trim(), entryDate, minutes: mins, note: note.trim(), addPaths }
        : { mode, note: note.trim(), addPaths });
    },
    onSuccess: () => {
      const day = shortDate(mode === "edit" ? entryDate : entry.entry_date);
      toast.success(`Saved ${shortDate(todayKey())}: your ${mode === "edit" ? "change" : "addition"} to your hours for ${day}. It shows under Your hours.`);
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(ownerSaveMessage(e)),
    onSettled: () => { saving.current = false; },
  });
  const submit = () => {
    if (saving.current || save.isPending) return;
    saving.current = true;
    save.mutate();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v && !save.isPending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit your hours" : "Add more to your hours"}</DialogTitle>
          <DialogDescription>
            {REOPEN_COPY.keepNote}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {mode === "edit" ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="change-activity">What did you do?</Label>
                <Textarea id="change-activity" rows={3} maxLength={OWNER_ACTIVITY_MAX} value={activity} onChange={(e) => setActivity(e.target.value)} />
                <p className="numeric text-right text-xs text-muted-foreground" aria-live="polite">{activityCounter(activity)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="change-date">Date</Label>
                  <Input id="change-date" type="date" max={todayKey()} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="change-minutes">Minutes spent</Label>
                  <Input id="change-minutes" type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm">{entry.activity}</p>
          )}
          <div className="space-y-1">
            <Label htmlFor="change-note">{mode === "edit" ? "Note (optional)" : "What you want to add"}</Label>
            <Textarea id="change-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="change-files">Add files, documents or photos</Label>
            {entry.fileCount ? (
              <p className="text-xs text-muted-foreground">
                {entry.fileCount} {entry.fileCount === 1 ? "file stays" : "files stay"} with this entry.
              </p>
            ) : null}
            <Input
              id="change-files"
              type="file"
              multiple
              disabled={save.isPending || room === 0}
              onChange={(e) => { void addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
            />
            {files.length ? (
              <ul className="space-y-1">
                {files.map((f) => (
                  <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Paperclip className="size-3 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <Button type="button" variant="ghost" size="sm" className="min-h-11" aria-label={`Remove ${f.name}`} disabled={save.isPending}
                      onClick={() => setFiles((cur) => cur.filter((c) => c !== f))}>
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {save.isError ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {isAlreadySaved(save.error)
                ? HOURS_REPEAT_COPY.alreadySaved
                : ownerSaveMessage(save.error) === save.error.message
                  ? `Not saved: ${save.error.message} Your changes are still here.`
                  : ownerSaveMessage(save.error)}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" className="min-h-11" disabled={save.isPending} onClick={onClose}>Cancel</Button>
          <Button type="button" className="min-h-11" disabled={save.isPending} onClick={submit}>
            {save.isPending ? HOURS_REPEAT_COPY.saving : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
