/**
 * Apply the ARHA Full Furnishing onboarding template to a property.
 * Preview first, then apply. Duplicates are skipped, never re-created.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { applyOnboardingTemplateFn, previewOnboardingTemplateFn } from "@/lib/onboarding.functions";
import { templateCounts } from "@/lib/onboarding-template";
import { stageLabel } from "@/lib/onboarding";

type Preview = Awaited<ReturnType<typeof previewOnboardingTemplateFn>>;

export function TemplatePanel({
  propertyId,
  propertyName,
  readOnly,
}: {
  propertyId: string;
  propertyName: string;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const previewFn = useServerFn(previewOnboardingTemplateFn);
  const applyFn = useServerFn(applyOnboardingTemplateFn);
  const [preview, setPreview] = useState<Preview | null>(null);
  const counts = templateCounts();

  const doPreview = useMutation({
    mutationFn: () => previewFn({ data: { propertyId } }),
    onSuccess: (p) => setPreview(p),
    onError: (e: Error) => toast.error(e.message),
  });

  const doApply = useMutation({
    mutationFn: () => applyFn({ data: { propertyId } }),
    onSuccess: (r) => {
      toast.success(
        `Added ${r.created} task${r.created === 1 ? "" : "s"} and ${r.subtasksCreated} subtasks. ${r.skipped} already existed.`,
      );
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4" /> Full Furnishing template
        </CardTitle>
        <CardDescription>
          The ARHA onboarding plan for this home: {counts.tasks} tasks and {counts.subtasks}{" "}
          subtasks across seven phases, {counts.workOrders} linked Breezeway templates,{" "}
          {counts.ownerApprovals} homeowner decisions and {counts.evidence} evidence-gated steps.
          Dates are only pre-filled for the {counts.scheduled} tasks whose written instructions
          state the timing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={readOnly || doPreview.isPending}
            onClick={() => doPreview.mutate()}
          >
            {doPreview.isPending ? "Checking…" : "Preview for " + propertyName}
          </Button>
          {preview ? (
            <Button
              size="sm"
              disabled={
                readOnly ||
                doApply.isPending ||
                (preview.toCreate.length === 0 && preview.subtasksToCreate === 0)
              }
              onClick={() => doApply.mutate()}
            >
              {doApply.isPending
                ? "Applying…"
                : preview.toCreate.length > 0
                  ? `Add ${preview.toCreate.length} tasks`
                  : `Add ${preview.subtasksToCreate} subtasks`}
            </Button>
          ) : null}
        </div>

        {preview ? (
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{preview.toCreate.length} to add</Badge>
              <Badge variant="secondary">{preview.subtasksToCreate} subtasks to add</Badge>
              <Badge variant="outline">{preview.skipped.length} already present</Badge>
              {preview.anchors.planned_closing ? (
                <Badge variant="outline">Planned closing {preview.anchors.planned_closing}</Badge>
              ) : (
                <Badge variant="outline">No closing date recorded — dates left blank</Badge>
              )}
            </div>
            <ScrollArea className="h-64">
              <ul className="space-y-1 pr-3 text-sm">
                {preview.toCreate.map((t) => (
                  <li key={t.key} className="flex items-start justify-between gap-3 border-b py-1">
                    <span>
                      <span className="text-muted-foreground">{stageLabel(t.stage)} · </span>
                      {t.title}
                      {t.subtasks ? (
                        <span className="text-muted-foreground"> (+{t.subtasks} subtasks)</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t.dueOn ?? "—"}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
