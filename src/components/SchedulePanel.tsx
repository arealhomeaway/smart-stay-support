/**
 * Milestone dates and controlled date recalculation for one onboarding home.
 *
 * Planned closing, actual closing and actual access are three separate dates.
 * Saving access automatically dates all unfinished work. Preview remains
 * available for reviewing future schedule changes; manually overridden and
 * completed dates are always preserved.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  applyScheduleFn,
  previewScheduleFn,
  repaceProjectFromAccessFn,
  saveScheduleAnchorsFn,
} from "@/lib/onboarding.functions";
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
  const repace = useServerFn(repaceProjectFromAccessFn);

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
    onSuccess: (result) => {
      toast.success(
        `Milestone dates saved. ${result.dated} work date${result.dated === 1 ? "" : "s"} updated.`,
      );
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

  // Re-pace the whole plan from the access date, then show what would move.
  const repaceAll = useMutation({
    mutationFn: () => repace({ data: { propertyId } }),
    onSuccess: (r) => {
      toast.success(`${r.updated} steps re-paced from the access date. Review the dates below.`);
      load.mutate();
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
          Planned closing, actual closing and actual access are recorded separately. Saving access
          automatically dates all unfinished work while preserving completed and manually dated work.
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
          <Button
            size="sm"
            variant="outline"
            disabled={load.isPending}
            onClick={() => load.mutate()}
          >
            Preview date changes
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canEdit || repaceAll.isPending || !access}
            onClick={() => repaceAll.mutate()}
            title={access ? undefined : "Record the access date first"}
          >
            {repaceAll.isPending ? "Re-pacing…" : "Re-pace plan from access date"}
          </Button>
        </div>

        {preview && (
          <div className="rounded-md border border-border p-3">
            {preview.rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No task is anchored to a milestone date yet, so there is nothing to recalculate.
                Anchors and offsets are recorded per task.
              </p>
            )}
            {preview.rows.map((r) => (
              <div
                key={r.taskId}
                className="flex items-start gap-2 border-b border-border/50 py-2 last:border-0"
              >
                <Checkbox
                  checked={selected.includes(r.taskId)}
                  disabled={!canEdit || !r.changed}
                  onCheckedChange={() => toggle(r.taskId)}
                  aria-label={`Apply new date to ${r.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.currentDue ?? "no date"} →{" "}
                    <span className="font-medium">{r.proposedDue}</span> ·{" "}
                    {r.anchor.replace("_", " ")}{" "}
                    {r.offsetDays >= 0 ? `+${r.offsetDays}` : r.offsetDays}d
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
                Preserved without change:{" "}
                {preview.skipped.map((s) => `${s.title} (${s.reason})`).join("; ")}
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
