/**
 * "Files from {source step}" on a receiving Task, plus the "Show files from"
 * picker for linking two Tasks on the same home by hand. Read-only view of the
 * source's live files as cards with a preview (Part 3, 3.2): no copies, no delete. Staff-only.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { readTaskFileLinks, setTaskFileSources } from "@/lib/step-file-links.functions";
import { FileCard } from "@/components/onboarding/home-files/FileCard";

export function LinkedStepFiles({ taskId, canManage }: { taskId: string; canManage: boolean }) {
  const read = useServerFn(readTaskFileLinks);
  const save = useServerFn(setTaskFileSources);
  const qc = useQueryClient();
  const key = ["task-file-links", taskId];
  const q = useQuery({ queryKey: key, queryFn: () => read({ data: { taskId } }) });
  const [picking, setPicking] = useState<string[] | null>(null);
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {s.files.map((f) => (
                <FileCard key={f.id} file={f as never} />
              ))}
            </div>
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
