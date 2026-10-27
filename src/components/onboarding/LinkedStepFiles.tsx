/**
 * "Files from {source step}" on a receiving Task, plus the "Show files from"
 * picker for linking two Tasks on the same home by hand. Read-only view of the
 * source's live files: no copies, no delete. Staff-only (drawer is internal).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { attachmentUrlFn } from "@/lib/attachments.functions";
import { readTaskFileLinks, setTaskFileSources } from "@/lib/step-file-links.functions";
import { usDate } from "@/lib/dates";

export function LinkedStepFiles({ taskId, canManage }: { taskId: string; canManage: boolean }) {
  const read = useServerFn(readTaskFileLinks);
  const save = useServerFn(setTaskFileSources);
  const urlFor = useServerFn(attachmentUrlFn);
  const qc = useQueryClient();
  const key = ["task-file-links", taskId];
  const q = useQuery({ queryKey: key, queryFn: () => read({ data: { taskId } }) });
  const [picking, setPicking] = useState<string[] | null>(null);
  const open = useMutation({
    mutationFn: (v: { documentId: string; download: boolean }) => urlFor({ data: v }),
    onSuccess: (r) => window.open(r.url, "_blank", "noopener,noreferrer"),
    onError: (e: Error) => toast.error(e.message || "That file could not be opened."),
  });
  const saveM = useMutation({
    mutationFn: (ids: string[]) => save({ data: { taskId, sourceIds: ids } }),
    onSuccess: () => {
      toast.success("Saved. This step now shows those files.");
      setPicking(null);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message || "The link could not be saved."),
  });

  if (!q.data?.ready) return null;
  const { sections, candidates, selectedIds } = q.data;

  return (
    <section className="space-y-3">
      {sections.map((s) => (
        <div key={s.sourceTaskId} className="space-y-1 rounded-md border border-border p-3">
          <p className="eyebrow">Files from {s.sourceTitle}</p>
          {s.removed ? (
            <p className="text-sm text-muted-foreground">Source step was removed.</p>
          ) : s.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files on that step yet. They appear here as soon as they are added.</p>
          ) : (
            <ul className="space-y-1">
              {s.files.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-sm">
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">
                    {f.original_filename ?? f.title}
                    <span className="text-muted-foreground"> · {f.uploaded_by_name ?? "Unknown"} · {usDate(f.uploaded_at ?? f.created_at)}</span>
                  </span>
                  <Button size="icon" variant="ghost" aria-label={`View ${f.original_filename ?? f.title}`} onClick={() => open.mutate({ documentId: f.id, download: false })}>
                    <Eye className="size-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={`Download ${f.original_filename ?? f.title}`} onClick={() => open.mutate({ documentId: f.id, download: true })}>
                    <Download className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Shown from the other step. To change or remove a file, open that step.</p>
        </div>
      ))}

      {canManage ? (
        picking === null ? (
          <Button size="sm" variant="secondary" onClick={() => setPicking(selectedIds)}>
            Show files from…
          </Button>
        ) : (
          <div className="space-y-2 rounded-md border border-border p-3">
            <p className="eyebrow">Show files from</p>
            <p className="text-xs text-muted-foreground">Pick other steps on this home. Their files appear here automatically. Internal only.</p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {candidates.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={picking.includes(c.id)}
                    onCheckedChange={(v) => setPicking((cur) => (v ? [...(cur ?? []), c.id] : (cur ?? []).filter((x) => x !== c.id)))}
                  />
                  <span className="truncate">{c.title}</span>
                  <span className="text-xs text-muted-foreground">{c.stage}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={saveM.isPending} onClick={() => saveM.mutate(picking)}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setPicking(null)}>Cancel</Button>
            </div>
          </div>
        )
      ) : null}
    </section>
  );
}
