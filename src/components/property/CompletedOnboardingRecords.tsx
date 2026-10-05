/**
 * Read-only completed onboarding records on the property page. Same rows as
 * the onboarding workspace — never copied, never editable here.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, History } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usDateTime } from "@/lib/dates";
import {
  completedOnboardingFileUrlFn,
  readCompletedOnboardingFn,
  type CompletedOnboardingTask,
} from "@/lib/completed-onboarding.functions";

const label = (s: string | null) => (s ? s.replace(/_/g, " ") : "");

export function CompletedOnboardingRecords({ propertyId }: { propertyId: string }) {
  const read = useServerFn(readCompletedOnboardingFn);
  const fileUrl = useServerFn(completedOnboardingFileUrlFn);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["completed-onboarding", propertyId],
    queryFn: () => read({ data: { propertyId } }),
  });
  const records = q.data;
  const open = records?.tasks.find((t) => t.id === openId) ?? null;

  const openFile = async (id: string) => {
    try {
      const { url } = await fileUrl({ data: { documentId: id } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That file is not available.");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Completed onboarding records</CardTitle>
          <CardDescription>
            Finished Tasks, assessments and files from onboarding. Read-only — changes stay with
            the onboarding team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {q.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {q.error && <p className="text-danger">{(q.error as Error).message}</p>}
          {records?.project?.acceptedAt && (
            <p className="text-muted-foreground">
              Accepted into live operations {usDateTime(records.project.acceptedAt)}
              {records.project.acceptedBy ? ` by ${records.project.acceptedBy}` : ""}
              {records.project.readyAt
                ? ` · marked ready ${usDateTime(records.project.readyAt)}${records.project.readyBy ? ` by ${records.project.readyBy}` : ""}`
                : ""}
            </p>
          )}
          {records && records.tasks.length === 0 && (
            <p className="text-muted-foreground">No onboarding Tasks are complete yet.</p>
          )}
          {records?.tasks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOpenId(t.id)}
              className="flex w-full items-center justify-between gap-4 border-b border-border/50 pb-2 text-left last:border-0 hover:text-primary"
            >
              <div>
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  {label(t.stage)}
                  {t.completedAt ? ` · completed ${usDateTime(t.completedAt)}` : ""}
                  {t.completedBy ? ` by ${t.completedBy}` : ""}
                </div>
              </div>
              <div className="flex gap-1">
                {t.observations.length + t.findings.length > 0 && (
                  <Badge variant="outline">Findings</Badge>
                )}
                {t.files.length > 0 && <Badge variant="outline">{t.files.length} file(s)</Badge>}
              </div>
            </button>
          ))}
          {records && records.history.length > 0 && (
            <div className="pt-2">
              <p className="eyebrow mb-1 flex items-center gap-1">
                <History className="size-3" /> Record history
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {records.history.map((h, i) => (
                  <li key={i}>
                    {usDateTime(h.at)} — {h.summary}
                    {h.actor ? ` · ${h.actor}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      <Sheet open={!!open} onOpenChange={(v) => !v && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && <TaskDetail task={open} onOpenFile={openFile} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function TaskDetail({
  task,
  onOpenFile,
}: {
  task: CompletedOnboardingTask;
  onOpenFile: (id: string) => void;
}) {
  return (
    <div className="space-y-5 text-sm">
      <SheetHeader>
        <SheetTitle>{task.title}</SheetTitle>
        <SheetDescription>
          Completed onboarding Task · read-only
        </SheetDescription>
      </SheetHeader>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="eyebrow">Completed</dt>
          <dd>{task.completedAt ? usDateTime(task.completedAt) : "—"}</dd>
        </div>
        <div>
          <dt className="eyebrow">Completed by</dt>
          <dd>{task.completedBy ?? "—"}</dd>
        </div>
        <div>
          <dt className="eyebrow">Assigned to</dt>
          <dd>{task.assignedTo ?? "—"}</dd>
        </div>
        <div>
          <dt className="eyebrow">Stage</dt>
          <dd className="capitalize">{label(task.stage) || "—"}</dd>
        </div>
      </dl>
      {task.detail && (
        <section>
          <p className="eyebrow">Instructions</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{task.detail}</p>
        </section>
      )}
      {task.evidenceNote && (
        <section>
          <p className="eyebrow">Evidence note</p>
          <p className="whitespace-pre-wrap">{task.evidenceNote}</p>
        </section>
      )}
      <section className="space-y-2">
        <p className="eyebrow">What was found</p>
        {task.observations.length === 0 && task.findings.length === 0 && (
          <p className="text-muted-foreground">No findings were recorded on this Task.</p>
        )}
        {task.observations.map((o) => (
          <div key={o.id} className="rounded-md border border-border p-2">
            <p className="whitespace-pre-wrap">{o.body}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {o.author ?? "ARHA"} · {usDateTime(o.createdAt)}
            </p>
          </div>
        ))}
        {task.findings.map((f) => (
          <div key={f.id} className="rounded-md border border-border p-2">
            <p className="font-medium">{f.title}</p>
            {f.detail && <p className="text-muted-foreground">{f.detail}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              {[f.category, f.severity, f.location, f.status].filter(Boolean).map(label).join(" · ")}
            </p>
          </div>
        ))}
      </section>
      <section className="space-y-2">
        <p className="eyebrow">Files</p>
        {task.files.length === 0 && <p className="text-muted-foreground">No files.</p>}
        {task.files.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <div>
                <div>{f.filename ?? f.title}</div>
                <div className="text-xs text-muted-foreground">
                  {f.uploadedBy ?? "ARHA"} · {usDateTime(f.createdAt)}
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => onOpenFile(f.id)}>
              Open file
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
