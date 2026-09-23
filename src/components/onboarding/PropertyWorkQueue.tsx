import { useMemo } from "react";
import { CalendarDays, CircleAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { WorkflowTable, type Person } from "@/components/onboarding/WorkflowTable";
import { stateChip } from "@/lib/semantic";
import { usDate } from "@/lib/dates";
import {
  PROPERTY_QUEUE_FILTER_LABELS,
  isWaitingTask,
  matchesPropertyQueueFilter,
  orderPropertyWorkQueue,
  type PropertyQueueFilter,
} from "@/lib/onboarding-work-views";
import {
  STATUS_LABEL,
  STATUS_STATE,
  assigneeLabel,
  viewTask,
  type WorkflowTask,
} from "@/lib/onboarding-workflow";
import {
  buildWorkstreams,
  trackForTask,
  workstreamMeta,
} from "@/lib/onboarding-workstreams";
import type { ReleaseContext } from "@/lib/onboarding-state";

export function PropertyWorkQueue({
  tasks,
  people,
  viewerId,
  filter,
  onFilterChange,
  selectedId,
  onSelect,
  outOfScope,
  release,
}: {
  tasks: WorkflowTask[];
  people: Person[];
  viewerId: string | null;
  filter: PropertyQueueFilter;
  onFilterChange: (filter: PropertyQueueFilter) => void;
  selectedId?: string | null;
  onSelect: (task: WorkflowTask) => void;
  outOfScope?: { task: WorkflowTask; reason: string }[];
  release?: ReleaseContext;
}) {
  const views = useMemo(
    () => orderPropertyWorkQueue(tasks.map((task) => viewTask(task, tasks, release))),
    [tasks, release],
  );
  const shown = views.filter((view) => matchesPropertyQueueFilter(view, filter, viewerId));
  const waiting = views.filter(isWaitingTask);
  const waitingOnOwner = waiting.filter(
    (view) => view.task.owner_approval_status === "awaiting_owner",
  ).length;
  const actionable = views.filter(
    (view) => !isWaitingTask(view) && !["complete", "carryover"].includes(view.status),
  ).length;
  const tracks = buildWorkstreams(tasks, release);

  return (
    <section className="surface overflow-hidden" aria-labelledby="work-queue-heading">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="work-queue-heading" className="text-xl font-semibold">Work queue</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Start at the top. Work that can move now comes before anything waiting.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><strong className="numeric text-foreground">{actionable}</strong> ready</span>
            <span><strong className="numeric text-foreground">{waiting.length}</strong> waiting</span>
            {waitingOnOwner > 0 && (
              <span><strong className="numeric text-foreground">{waitingOnOwner}</strong> on homeowner</span>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter work queue">
          {(Object.entries(PROPERTY_QUEUE_FILTER_LABELS) as [PropertyQueueFilter, string][]).map(
            ([key, label]) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={filter === key ? "default" : "outline"}
                aria-pressed={filter === key}
                onClick={() => onFilterChange(key)}
              >
                {label}
                <span className="numeric opacity-75">
                  {views.filter((view) => matchesPropertyQueueFilter(view, key, viewerId)).length}
                </span>
              </Button>
            ),
          )}
        </div>
      </div>

      <div>
        {shown.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No work matches this filter.</p>
        ) : (
          shown.map((view) => {
            const task = view.task;
            const track = workstreamMeta(trackForTask(task));
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelect(task)}
                className="grid w-full gap-2 border-b border-border/60 px-4 py-3 text-left last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={view.status === "complete" ? "truncate text-sm text-muted-foreground line-through" : "truncate text-sm font-medium"}>
                      {task.title}
                    </span>
                    <Chip className={stateChip(STATUS_STATE[view.status])}>{STATUS_LABEL[view.status]}</Chip>
                    {view.overdue && <Chip className={stateChip("blocked")}>Overdue</Chip>}
                  </span>
                  {view.reason && (
                    <span className="mt-1 block truncate text-xs text-muted-foreground">{view.reason}</span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:justify-end">
                  <span>{track.label}</span>
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="size-3.5" /> {assigneeLabel(task, people)}
                  </span>
                  <span className="numeric inline-flex items-center gap-1">
                    <CalendarDays className="size-3.5" />
                    {task.due_on ? usDate(task.due_on) : "No due date"}
                  </span>
                  {isWaitingTask(view) && <CircleAlert className="size-3.5 text-state-waiting" />}
                </span>
              </button>
            );
          })
        )}
      </div>

      <details className="border-t border-border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium hover:bg-muted/50">
          Browse full plan by track or stage
        </summary>
        <div className="space-y-4 border-t border-border bg-muted/20 p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {tracks.map((track) => (
              <div key={track.key} className="rounded-md border border-border bg-background p-3">
                <p className="text-sm font-medium">{track.label}</p>
                <p className="numeric mt-1 text-xs text-muted-foreground">
                  {track.done}/{track.total} complete · {track.ready.length} ready
                </p>
              </div>
            ))}
          </div>
          <WorkflowTable
            tasks={tasks}
            outOfScope={outOfScope}
            people={people}
            selectedId={selectedId}
            release={release}
            onSelect={onSelect}
          />
        </div>
      </details>
    </section>
  );
}