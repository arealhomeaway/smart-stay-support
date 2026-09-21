/**
 * Stage-by-stage progress for a home's onboarding plan: how much of each of
 * the eight operational stages is finished, what is stuck, and what is late.
 * Counting lives in `onboarding-stage-progress.ts` so the numbers here match
 * every other surface.
 */
import { useMemo, useState } from "react";
import { CheckCircle2, Circle, CircleAlert, Clock } from "lucide-react";
import { usShortDate } from "@/lib/dates";
import {
  planSummary,
  stageProgress,
  type StageProgress,
  type StageTask,
} from "@/lib/onboarding-stage-progress";

const STATE_COPY: Record<StageProgress["state"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  blocked: "Held up",
  complete: "Finished",
};

export function StageProgressPanel({
  tasks,
  today,
  onOpenTask,
}: {
  tasks: StageTask[];
  today?: string;
  onOpenTask?: (taskId: string) => void;
}) {
  const day = today ?? new Date().toISOString().slice(0, 10);
  const progress = useMemo(() => stageProgress(tasks, day), [tasks, day]);
  const summary = useMemo(() => planSummary(progress), [progress]);
  const [open, setOpen] = useState<string | null>(null);

  if (!summary.total)
    return (
      <section className="surface p-4">
        <p className="font-medium">Stage progress</p>
        <p className="text-sm text-muted-foreground">
          No onboarding plan has been started for this home yet.
        </p>
      </section>
    );

  return (
    <section className="surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-medium">Stage progress</p>
          <p className="text-sm text-muted-foreground">
            {summary.complete} of {summary.total} finished · currently in {summary.currentStage}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {summary.blocked > 0 && (
            <span className="rounded-full border border-state-blocked/40 bg-state-blocked/10 px-2.5 py-1">
              {summary.blocked} held up
            </span>
          )}
          {summary.overdue > 0 && (
            <span className="rounded-full border border-state-waiting/40 bg-state-waiting/10 px-2.5 py-1">
              {summary.overdue} past due
            </span>
          )}
          <span className="rounded-full border px-2.5 py-1">{summary.percent}% done</span>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {progress.map((stage) => {
          const expanded = open === stage.stage;
          const detail = stage.blockedTasks.length + stage.overdueTasks.length > 0;
          return (
            <div key={stage.stage} className="rounded-md border">
              <button
                type="button"
                disabled={!detail}
                onClick={() => setOpen(expanded ? null : stage.stage)}
                className="flex w-full items-start gap-3 p-3 text-left"
              >
                {stage.state === "complete" ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-state-done" />
                ) : stage.state === "blocked" ? (
                  <CircleAlert className="mt-0.5 size-4 text-state-blocked" />
                ) : (
                  <Circle className="mt-0.5 size-4 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium">{stage.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {stage.steps} · {STATE_COPY[stage.state]}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${stage.percent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {stage.complete} of {stage.total} finished
                    {stage.carryover > 0 ? ` · ${stage.carryover} carried over` : ""}
                    {stage.blocked > 0 ? ` · ${stage.blocked} held up` : ""}
                    {stage.overdue > 0 ? ` · ${stage.overdue} past due` : ""}
                    {stage.awaitingOwner > 0
                      ? ` · ${stage.awaitingOwner} waiting on the homeowner`
                      : ""}
                  </p>
                </div>
              </button>
              {expanded && (
                <div className="space-y-1 border-t p-3 text-sm">
                  {stage.blockedTasks.map((t) => (
                    <button
                      key={`b-${t.id}`}
                      type="button"
                      className="block text-left text-primary underline"
                      onClick={() => onOpenTask?.(t.id)}
                    >
                      Held up: {t.title}
                      {t.blocker?.trim() ? ` — ${t.blocker.trim()}` : ""}
                    </button>
                  ))}
                  {stage.overdueTasks.map((t) => (
                    <button
                      key={`o-${t.id}`}
                      type="button"
                      className="flex items-center gap-1.5 text-left text-primary underline"
                      onClick={() => onOpenTask?.(t.id)}
                    >
                      <Clock className="size-3.5" />
                      Past due {t.dueOn ? usShortDate(t.dueOn) : ""}: {t.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
