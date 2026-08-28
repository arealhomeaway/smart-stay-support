/**
 * Milestone dates and controlled date recalculation for one onboarding home.
 *
 * Planned closing, actual closing and actual access are three separate dates.
 * Saving them never moves a task. Recalculation is always preview-first: the
 * proposed dates are shown next to the current dates, completed tasks and
 * manually overridden dates are preserved, conflicts are flagged, and only the
 * rows that are ticked are written. Nothing is pushed to outside systems.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { applyScheduleFn, previewScheduleFn, saveScheduleAnchorsFn } from "@/lib/onboarding.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Preview = Awaited<ReturnType<typeof previewScheduleFn>>;

export function SchedulePanel({
  propertyId,
  plannedClosingOn,
  actualClosingOn,
  actualAccessOn,
  canEdit,
  onChange,
}: {
  propertyId: string;
  plannedClosingOn: string | null;
  actualClosingOn: string | null;
  actualAccessOn: string | null;
  canEdit: boolean;
  onChange: () => void;
}) {
  const qc = useQueryClient();
  const saveAnchors = useServerFn(saveScheduleAnchorsFn);
  const runPreview = useServerFn(previewScheduleFn);
  const apply = useServerFn(applyScheduleFn);

  const [planned, setPlanned] = useState(plannedClosingOn ?? "");
  const [closing, setClosing] = useState(actualClosingOn ?? "");
  const [access, setAccess] = useState(actualAccessOn ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  const save = useMutation({
    mutationFn: () =>
      saveAnchors({
        data: {
          propertyId,
          plannedClosingOn: planned || null,
          actualClosingOn: closing || null,
          actualAccessOn: access || null,
        },
      }),
    onSuccess: () => {
      toast.success("Milestone dates saved. No task dates were changed.");
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const load = useMutation({
    mutationFn: () => runPreview({ data: { propertyId } }),
    onSuccess: (p) => {
      setPreview(p);
      setSelected(p.rows.filter((r) => r.changed && !r.conflict).map((r) => r.taskId));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: () => apply({ data: { propertyId, taskIds: selected } }),
    onSuccess: (r) => {
      toast.success(`${r.applied} date${r.applied === 1 ? "" : "s"} updated.`);
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          Milestone dates
        </CardTitle>
        <CardDescription>
          Planned closing, actual closing and actual access are recorded separately. Saving a date never moves a task
          on its own — recalculation is previewed and confirmed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor={`planned-${propertyId}`}>Planned closing</Label>
            <Input
              id={`planned-${propertyId}`}
              type="date"
              value={planned}
              disabled={!canEdit}
              onChange={(e) => setPlanned(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`closing-${propertyId}`}>Actual closing</Label>
            <Input
              id={`closing-${propertyId}`}
              type="date"
              value={closing}
              disabled={!canEdit}
              onChange={(e) => setClosing(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`access-${propertyId}`}>Actual access</Label>
            <Input
              id={`access-${propertyId}`}
              type="date"
              value={access}
              disabled={!canEdit}
              onChange={(e) => setAccess(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!canEdit || save.isPending} onClick={() => save.mutate()}>
            Save dates
          </Button>
          <Button size="sm" variant="outline" disabled={load.isPending} onClick={() => load.mutate()}>
            Preview date changes
          </Button>
        </div>

        {preview && (
          <div className="rounded-md border border-border p-3">
            {preview.rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No task is anchored to a milestone date yet, so there is nothing to recalculate. Anchors and offsets
                are recorded per task.
              </p>
            )}
            {preview.rows.map((r) => (
              <div key={r.taskId} className="flex items-start gap-2 border-b border-border/50 py-2 last:border-0">
                <Checkbox
                  checked={selected.includes(r.taskId)}
                  disabled={!canEdit || !r.changed}
                  onCheckedChange={() => toggle(r.taskId)}
                  aria-label={`Apply new date to ${r.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.currentDue ?? "no date"} → <span className="font-medium">{r.proposedDue}</span> ·{" "}
                    {r.anchor.replace("_", " ")} {r.offsetDays >= 0 ? `+${r.offsetDays}` : r.offsetDays}d
                  </p>
                  {r.conflict && (
                    <Badge variant="outline" className="mt-1">
                      {r.conflict}
                    </Badge>
                  )}
                  {!r.changed && <span className="text-xs text-muted-foreground">Unchanged</span>}
                </div>
              </div>
            ))}
            {preview.skipped.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Preserved without change: {preview.skipped.map((s) => `${s.title} (${s.reason})`).join("; ")}
              </p>
            )}
            {preview.rows.some((r) => r.changed) && (
              <Button
                size="sm"
                className="mt-3"
                disabled={!canEdit || selected.length === 0 || confirm.isPending}
                onClick={() => confirm.mutate()}
              >
                Apply {selected.length} selected
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
