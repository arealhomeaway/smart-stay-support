import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CircleAlert, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HomeTaskBulkEditDialog } from "@/components/onboarding/HomeTaskBulkEditDialog";
import { homeTaskSelectable, type HomeBulkTask } from "@/lib/home-task-bulk-edit";
import { stageLabel } from "@/lib/onboarding";
import { Chip } from "@/components/ui/page";
import type { Person } from "@/components/onboarding/WorkflowTable";
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
import { trackForTask, workstreamMeta } from "@/lib/onboarding-workstreams";
import type { ReleaseContext } from "@/lib/onboarding-state";

export function PropertyWorkQueue({
  tasks,
  people,
  viewerId,
  filter,
  onFilterChange,
  onSelect,
  release,
  voided = [],
  bulk,
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
  /** Voided Tasks — kept on record, never counted as work. */
  voided?: { id: string; title: string; archived_at: string; exception_reason: string | null }[];
  /** Present only for people who can edit this home's Tasks; the server re-checks. */
  bulk?: { propertyId: string; homeName: string; onSaved: () => void } | undefined;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkTasks = tasks as unknown as HomeBulkTask[];
  const selectableIds = useMemo(
    () => new Set(bulkTasks.filter(homeTaskSelectable).map((t) => t.id)),
    [bulkTasks],
  );
  const stages = useMemo(
    () => [...new Set(bulkTasks.filter((t) => !t.archived_at).map((t) => t.stage))],
    [bulkTasks],
  );
  // Drop anything that completed or disappeared since it was ticked.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => selectableIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [selectableIds]);
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const selectIds = (ids: string[]) => setSelected((prev) => new Set([...prev, ...ids]));
  const allOpenSelected = selectableIds.size > 0 && [...selectableIds].every((id) => selected.has(id));
  const views = useMemo(
    () => orderPropertyWorkQueue(tasks.map((task) => viewTask(task, tasks, release))),
    [tasks, release],
  );
  const shown = views.filter((view) => matchesPropertyQueueFilter(view, filter, viewerId));
  const voidedRows = voided.filter((v) => (v.exception_reason ?? "").startsWith("Voided"));
  const open = views.filter((view) => !["complete", "carryover"].includes(view.status)).length;
  const waiting = views.filter(
    (view) => isWaitingTask(view) && !["complete", "carryover"].includes(view.status),
  );
  const countFor = (key: PropertyQueueFilter) =>
    key === "voided"
      ? voidedRows.length
      : views.filter((view) => matchesPropertyQueueFilter(view, key, viewerId)).length;

  return (
    <section className="surface overflow-hidden" aria-labelledby="work-queue-heading">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="work-queue-heading" className="text-xl font-semibold">Tasks</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every current Task for this Project. Any Task can be opened and worked at any time.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><strong className="numeric text-foreground">{open}</strong> open</span>
            <span><strong className="numeric text-foreground">{waiting.length}</strong> waiting on something</span>
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
                  {countFor(key)}
                </span>
              </Button>
            ),
          )}
        </div>
        {bulk && selectableIds.size > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <Checkbox
                checked={allOpenSelected}
                onCheckedChange={(v) => (v ? selectIds([...selectableIds]) : setSelected(new Set()))}
                aria-label="Select all open"
              />
              Select all open
            </label>
            <Select
              value=""
              onValueChange={(stage) =>
                selectIds(bulkTasks.filter((t) => t.stage === stage && selectableIds.has(t.id)).map((t) => t.id))
              }
            >
              <SelectTrigger className="h-8 w-56" aria-label="Select all in this stage">
                <SelectValue placeholder="Select all in this stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage} value={stage}>{stageLabel(stage)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div>
        {filter === "voided" ? (
          voidedRows.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No Tasks have been voided.</p>
          ) : (
            voidedRows.map((v) => (
              <div key={v.id} className="border-b border-border/60 px-4 py-3 last:border-b-0">
                <p className="text-sm text-muted-foreground line-through">{v.title}</p>
                <p className="text-xs text-muted-foreground">
                  {(v.exception_reason ?? "").replace(/^Voided — not needed: /, "Not needed: ")} ·{" "}
                  {usDate(v.archived_at.slice(0, 10))}
                </p>
              </div>
            ))
          )
        ) : shown.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No work matches this filter.</p>
        ) : (
          shown.map((view) => {
            const task = view.task;
            const track = workstreamMeta(trackForTask(task));
            const canTick = Boolean(bulk) && selectableIds.has(task.id);
            return (
              <div key={task.id} className="flex items-stretch border-b border-border/60 last:border-b-0">
              {bulk ? (
                <span className="flex w-10 shrink-0 items-center justify-center">
                  {canTick ? (
                    <Checkbox
                      checked={selected.has(task.id)}
                      onCheckedChange={(v) => toggle(task.id, v === true)}
                      aria-label={`Select ${task.title}`}
                    />
                  ) : null}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => onSelect(task)}
                className="grid w-full min-w-0 gap-2 px-4 py-3 text-left last:border-b-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
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
              </div>
            );
          })
        )}
      </div>
      {bulk && selected.size > 0 ? (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-3">
          <span className="text-sm font-medium">
            {selected.size} Task{selected.size === 1 ? "" : "s"} selected
          </span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" onClick={() => setBulkOpen(true)}>Edit selected</Button>
          </span>
        </div>
      ) : null}
      {bulk && bulkOpen ? (
        <HomeTaskBulkEditDialog
          propertyId={bulk.propertyId}
          homeName={bulk.homeName}
          tasks={bulkTasks}
          stages={stages}
          selectedIds={[...selected]}
          onClose={() => setBulkOpen(false)}
          onSaved={() => {
            setBulkOpen(false);
            setSelected(new Set());
            bulk.onSaved();
          }}
        />
      ) : null}

    </section>
  );
}