/**
 * Parallel workstream board for an onboarding project.
 *
 * Onboarding is not one line of work. Four tracks move at the same time, and
 * a project manager needs to see everything that is unblocked right now
 * without opening each stage. Clicking any step opens the existing task
 * drawer, so the board stays clean and the detail stays in one place.
 *
 * Presentation only — every status shown is derived by onboarding-workflow.
 */

import { Chip, SectionCard } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
import { usDate } from "@/lib/dates";
import {
  STATUS_LABEL,
  STATUS_STATE,
  type TaskView,
  type WorkflowTask,
} from "@/lib/onboarding-workflow";
import type { ReleaseContext } from "@/lib/onboarding-state";
import {
  buildWorkstreams,
  overallProgress,
  readyNowQueue,
  type WorkstreamGroup,
} from "@/lib/onboarding-workstreams";

function Meter({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full bg-[var(--module-onboarding,var(--primary))] transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function TaskLine({
  view,
  hint,
  onOpen,
}: {
  view: TaskView;
  hint?: string;
  onOpen: (id: string) => void;
}) {
  const { task } = view;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className="w-full rounded-lg border border-transparent px-2.5 py-2 text-left transition hover:border-border hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
          <Chip className={stateChip(STATUS_STATE[view.status])}>{STATUS_LABEL[view.status]}</Chip>
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {[
            hint,
            task.due_on ? `${view.overdue ? "Overdue " : "Due "}${usDate(task.due_on)}` : null,
            view.reason,
          ]
            .filter(Boolean)
            .join(" · ") || "No date set"}
        </span>
      </button>
    </li>
  );
}

function TrackCard({
  group,
  onOpenTask,
}: {
  group: WorkstreamGroup;
  onOpenTask: (id: string) => void;
}) {
  const show = [...group.ready, ...group.waiting].slice(0, 4);
  return (
    <section className="surface flex flex-col gap-3 p-4">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">{group.label}</h3>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {group.done}/{group.total}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{group.blurb}</p>
      </div>

      <Meter percent={group.percent} label={`${group.label} — ${group.percent}% complete`} />

      {group.total === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing in this track yet.</p>
      ) : group.state === "complete" ? (
        <p className="text-xs text-muted-foreground">All finished.</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {group.ready.length > 0
              ? `${group.ready.length} ready to work now`
              : "Nothing ready in this track yet"}
          </p>
          <ul className="-mx-1 space-y-0.5">
            {show.map((view) => (
              <TaskLine key={view.task.id} view={view} onOpen={onOpenTask} />
            ))}
          </ul>
          {group.ready.length + group.waiting.length > show.length && (
            <p className="text-xs text-muted-foreground">
              + {group.ready.length + group.waiting.length - show.length} more in this track
            </p>
          )}
        </>
      )}
    </section>
  );
}

export function WorkstreamBoard({
  tasks,
  release,
  onOpenTask,
}: {
  tasks: WorkflowTask[];
  release?: ReleaseContext;
  onOpenTask: (id: string) => void;
}) {
  const groups = buildWorkstreams(tasks, release);
  const ready = readyNowQueue(groups);
  const overall = overallProgress(groups);

  return (
    <div className="space-y-4">
      <SectionCard
        title="Ready now"
        description={
          ready.length > 0
            ? "Every step that is unblocked today, across all four tracks. Work these in any order."
            : "Nothing is unblocked right now — each open step is waiting on a date, an approval or another step."
        }
        actions={
          <span className="text-xs tabular-nums text-muted-foreground">
            {overall.done}/{overall.total} steps done · {overall.percent}%
          </span>
        }
      >
        <Meter percent={overall.percent} label={`Onboarding ${overall.percent}% complete`} />
        {ready.length > 0 ? (
          <ul className="-mx-1 mt-3 space-y-0.5">
            {ready.slice(0, 8).map((item) => (
              <TaskLine
                key={item.view.task.id}
                view={item.view}
                hint={item.trackLabel}
                onOpen={onOpenTask}
              />
            ))}
          </ul>
        ) : null}
        {ready.length > 8 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            + {ready.length - 8} more ready in the tracks below.
          </p>
        ) : null}
        {ready.length === 0 && overall.total > 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Open a waiting step below to see exactly what it is waiting on.
          </p>
        ) : null}
      </SectionCard>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <TrackCard key={group.key} group={group} onOpenTask={onOpenTask} />
        ))}
      </div>
    </div>
  );
}
