/**
 * The one place a homeowner records participation time.
 *
 * Nothing here suggests, prefills or estimates an amount of time: the
 * homeowner types the real minutes they spent. An optional photo, receipt or
 * document can be attached as their own evidence of the work.
 */
import { createContext, useContext, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes, validateFile } from "@/lib/attachments";
import { logOwnerParticipation } from "@/lib/owner-portal.functions";
import { beginParticipationEvidenceFn } from "@/lib/owner-evidence.functions";
import { MANUAL_ENTRY_CONFIRMATION, MANUAL_ENTRY_NOTICE, parseOwnerMinutes } from "@/lib/owner-participation";

export type LogTimeAnchor = {
  /** The participation opportunity this time belongs to. */
  id: string;
  phase: string;
  ticketId: string | null;
  propertyIds: string[];
  ownerUpdateRevision: number | null;
  description?: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

/**
 * One Log time window per page. Any button (a review row, an onboarding item,
 * a participation idea) asks the page's single dialog to open instead of
 * mounting its own copy.
 */
export type OpenLogTime = (opts?: {
  anchor?: LogTimeAnchor | null;
  activity?: string;
  onDone?: () => void;
}) => void;
export const LogTimeContext = createContext<OpenLogTime | null>(null);
export function useOpenLogTime() {
  return useContext(LogTimeContext);
}

/** Enough for a receipt, a couple of photos and a document on one activity. */
const MAX_FILES = 10;

export function LogTimeDialog({
  open,
  onOpenChange,
  programId,
  anchor,
  defaultActivity = "",
  onDone,
  phase = "ongoing",
  properties = [],
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  programId: string;
  /** Null records an activity the homeowner did on their own initiative. */
  anchor: LogTimeAnchor | null;
  defaultActivity?: string;
  onDone: () => void;
  /** Used only when there is no anchor. */
  phase?: "onboarding" | "ongoing";
  /** Homes the owner may attribute a self-recorded activity to. */
  properties?: { id: string; name: string }[];
}) {
  const [minutes, setMinutes] = useState("");
  const [activity, setActivity] = useState(defaultActivity);
  const [confirmed, setConfirmed] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [entryDate, setEntryDate] = useState(today);
  const [homes, setHomes] = useState<string[]>([]);
  const log = useServerFn(logOwnerParticipation);
  const beginEvidence = useServerFn(beginParticipationEvidenceFn);

  const reset = () => {
    setMinutes("");
    setActivity(defaultActivity);
    setConfirmed(false);
    setFiles([]);
    setEntryDate(today());
    setHomes([]);
  };

  /** Files build up across picks and drops, so nothing already chosen is lost. */
  const addFiles = (chosen: File[]) => {
    const keep: File[] = [];
    for (const item of chosen) {
      const check = validateFile({ name: item.name, type: item.type, size: item.size });
      if (!check.ok) {
        toast.error(`${item.name}: ${check.message}`);
        continue;
      }
      keep.push(item);
    }
    if (keep.length === 0) return;
    setFiles((current) => {
      const merged = [...current];
      for (const item of keep) {
        if (merged.some((f) => f.name === item.name && f.size === item.size)) continue;
        merged.push(item);
      }
      if (merged.length > MAX_FILES) {
        toast.error(`You can attach up to ${MAX_FILES} files on one entry.`);
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const entryPhase = anchor ? anchor.phase : phase;
      if (entryPhase !== "onboarding" && entryPhase !== "ongoing") {
        throw new Error("This opportunity needs a valid participation phase.");
      }
      const attachmentPaths: string[] = [];
      for (const item of files) {
        const started = await beginEvidence({
          data: {
            programId,
            uploadKey: crypto.randomUUID(),
            filename: item.name,
            mimeType: item.type,
            sizeBytes: item.size,
          },
        });
        const { supabase } = await import("@/integrations/supabase/client");
        const put = await supabase.storage
          .from("resolve-attachments")
          .uploadToSignedUrl(started.path, started.token!, item, { upsert: false });
        if (put.error) throw new Error(`${item.name} did not finish uploading. Try again.`);
        attachmentPaths.push(started.path);
      }
      return log({
        data: {
          programId,
          phase: entryPhase,
          entryDate: anchor ? today() : entryDate,
          minutes: parseOwnerMinutes(minutes),
          activity: activity.trim(),
          attachmentPath: attachmentPaths[0] ?? null,
          attachmentPaths,
          reviewId: anchor ? anchor.id : null,
          ticketId: anchor ? anchor.ticketId : null,
          ownerUpdateRevision: anchor ? anchor.ownerUpdateRevision : null,
          propertyIds: anchor ? anchor.propertyIds : homes,
          confirmed: true,
        },
      });
    },
    onSuccess: () => {
      toast.success("Time logged.");
      onOpenChange(false);
      reset();
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log your time</DialogTitle>
          <DialogDescription>{MANUAL_ENTRY_NOTICE}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {anchor?.description && (
            <p className="max-h-48 overflow-y-auto text-sm whitespace-pre-wrap">
              {anchor.description}
            </p>
          )}
          {!anchor && (
            <>
              <div className="space-y-1">
                <Label htmlFor="log-date">Date</Label>
                <Input
                  id="log-date"
                  type="date"
                  max={today()}
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
              {properties.length > 1 && (
                <div className="space-y-1">
                  <Label>Which homes did this involve?</Label>
                  <div className="space-y-1">
                    {properties.map((home) => (
                      <label key={home.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={homes.includes(home.id)}
                          onCheckedChange={(v) =>
                            setHomes((current) =>
                              v === true
                                ? [...current, home.id]
                                : current.filter((id) => id !== home.id),
                            )
                          }
                        />
                        <span>{home.name}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    If one activity covered several homes, select them all and enter the total time
                    once.
                  </p>
                </div>
              )}
            </>
          )}
          <div className="space-y-1">
            <Label htmlFor="log-activity">What did you do?</Label>
            <Textarea
              id="log-activity"
              rows={3}
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="log-minutes">Minutes spent</Label>
            <Input
              id="log-minutes"
              type="number"
              min={1}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="log-evidence">Attach files, documents or photos (optional)</Label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addFiles(Array.from(e.dataTransfer.files));
              }}
              className="rounded-xl border border-dashed border-border bg-muted/30 p-3"
            >
              <Input
                id="log-evidence"
                type="file"
                multiple
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Drag files here or choose them above. Receipts, notes, screenshots and photos are
                all kept with this entry as your record of the work.
              </p>
            </div>
            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((item) => (
                  <li
                    key={`${item.name}-${item.size}`}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Paperclip className="size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {item.name} · {formatBytes(item.size)}
                    </span>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 underline"
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((f) => !(f.name === item.name && f.size === item.size)),
                        )
                      }
                    >
                      <X className="size-3" aria-hidden="true" /> Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span>{MANUAL_ENTRY_CONFIRMATION}</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={save.isPending || activity.trim().length < 3 || !confirmed}
            onClick={() => save.mutate()}
          >
            Save entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
