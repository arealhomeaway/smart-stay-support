import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  beginLibraryVideoUpload, completeLibraryVideoUpload, manageLibraryVideo, relabelLibraryVideo, removeLibraryVideo,
} from "@/lib/library-video.functions";
import { LIBRARY_VIDEO_DEFAULT_LABEL, formatBytes, validateVideoFile } from "@/lib/library-video";
import { LibraryVideoPlayer } from "./LibraryVideoPlayer";

/** Sends the file straight to private storage with a one-time ticket, reporting progress. */
function putWithProgress(url: string, file: File, mime: string, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", mime);
    xhr.setRequestHeader("x-upsert", "false");
    const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined;
    if (key) xhr.setRequestHeader("apikey", key);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.status === 413 ? "That file is larger than storage allows." : "The upload did not finish. Please try again.")));
    xhr.onerror = () => reject(new Error("The upload was interrupted. Please check your connection and try again."));
    xhr.send(file);
  });
}

export function LibraryVideoSection({ libraryId, poster }: { libraryId: string; poster?: string }) {
  const qc = useQueryClient();
  const manage = useServerFn(manageLibraryVideo);
  const begin = useServerFn(beginLibraryVideoUpload);
  const complete = useServerFn(completeLibraryVideoUpload);
  const remove = useServerFn(removeLibraryVideo);
  const relabel = useServerFn(relabelLibraryVideo);
  const q = useQuery({ queryKey: ["library-video-manage", libraryId], queryFn: () => manage({ data: { libraryId } }) });
  const input = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const current = q.data?.current ?? null;
  const shownLabel = label ?? current?.label ?? LIBRARY_VIDEO_DEFAULT_LABEL;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["library-video-manage", libraryId] });
    void qc.invalidateQueries({ queryKey: ["library-video-index"] });
    void qc.invalidateQueries({ queryKey: ["library-video-url", libraryId] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const check = validateVideoFile(file);
      if (!check.ok) throw new Error(check.reason);
      setPct(0);
      const t = await begin({ data: { libraryId, fileName: file.name, type: check.mime, size: file.size } });
      const base = import.meta.env['VITE_SUPABASE_URL'] as string;
      const url = `${base}/storage/v1/object/upload/sign/${t.bucket}/${t.path}?token=${encodeURIComponent(t.token)}`;
      await putWithProgress(url, file, t.mime, setPct);
      await complete({ data: { libraryId, path: t.path, mime: t.mime, size: file.size, label: shownLabel } });
    },
    onSuccess: () => { toast.success(current ? "Video replaced." : "Video added."); setPct(null); refresh(); },
    onError: (e) => { setPct(null); toast.error(e instanceof Error ? e.message : "Could not upload the video."); },
  });
  const removing = useMutation({
    mutationFn: () => remove({ data: { libraryId } }),
    onSuccess: () => { toast.success("Video removed. It is kept in history."); setConfirm(false); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the video."),
  });
  const saveLabel = useMutation({
    mutationFn: () => relabel({ data: { libraryId, label: shownLabel } }),
    onSuccess: () => { toast.success("Caption saved."); setLabel(null); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the caption."),
  });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading video…</p>;
  if (q.data && !q.data.ready) {
    return <section className="space-y-1 rounded-lg border border-dashed border-border p-3"><p className="font-medium">Video</p><p className="text-sm text-muted-foreground">Library videos are not switched on yet.</p></section>;
  }
  const busy = upload.isPending || removing.isPending;

  return (
    <section className="space-y-3 rounded-lg border border-border p-3" aria-label="Video">
      <div>
        <p className="font-medium">Video</p>
        <p className="text-xs text-muted-foreground">MP4, MOV or WebM, up to 250 MB. Homeowners watch it inside their portal; replacing it updates every homeowner, including Opportunities already started.</p>
      </div>
      {current ? (
        <div className="space-y-2">
          <LibraryVideoPlayer libraryId={libraryId} label={current.label} {...(poster ? { poster } : {})} />
          <p className="text-xs text-muted-foreground">{formatBytes(current.size_bytes)} · uploaded {new Date(current.uploaded_at).toLocaleString()} by {current.uploaded_by_name}</p>
        </div>
      ) : <p className="text-sm text-muted-foreground">No video yet.</p>}
      <div className="space-y-1">
        <Label htmlFor="lv-label">Caption (shown to homeowners)</Label>
        <div className="flex gap-2">
          <Input id="lv-label" maxLength={120} value={shownLabel} onChange={(e) => setLabel(e.target.value)} />
          {current && label !== null && label !== current.label ? <Button variant="outline" disabled={saveLabel.isPending} onClick={() => saveLabel.mutate()}>Save caption</Button> : null}
        </div>
      </div>
      {pct !== null ? <div className="space-y-1"><Progress value={pct} aria-label="Upload progress" /><p className="text-xs text-muted-foreground">Uploading… {pct}% — keep this window open.</p></div> : null}
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload.mutate(f); }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{current ? "Replace video" : "Upload video"}</Button>
        {current ? <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirm(true)}>Remove video</Button> : null}
      </div>
      {q.data && q.data.history.length > (current ? 1 : 0) ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Video history</summary>
          <ul className="mt-1 space-y-0.5">
            {q.data.history.map((h) => (
              <li key={h.id}>{new Date(h.uploaded_at).toLocaleDateString()} · {h.uploaded_by_name} · {formatBytes(h.size_bytes)} · {h.removed_at ? (h.removal_reason === "replaced" ? "Replaced" : "Removed") : "Current"}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this video?</AlertDialogTitle>
            <AlertDialogDescription>Homeowners will no longer see it, including on Opportunities they already started. The file is kept in history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); removing.mutate(); }}>Remove video</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
