/**
 * Asana-style sectioned workflow list for one onboarding property.
 *
 * Presentation only: sections, statuses and markers are all derived from the
 * task rows by `src/lib/onboarding-workflow.ts`. Nothing here writes data;
 * completion and edits go through the callbacks the property route supplies.
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CircleAlert, Lock } from "lucide-react";
import { Chip } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import { stateChip } from "@/lib/semantic";
import {
  STATUS_LABEL,
  STATUS_STATE,
  activeSectionKey,
  assigneeLabel,
  buildSections,
  dueExplanation,
  type TaskView,
  type WorkflowSection,
  type WorkflowTask,
} from "@/lib/onboarding-workflow";

export type Person = { id: string; full_name: string | null; email: string | null };

export function WorkflowTable({
  tasks,
  people,
  selectedId,
  onSelect,
}: {
  tasks: WorkflowTask[];
  people: Person[];
  selectedId?: string | null;
  onSelect: (task: WorkflowTask) => void;
}) {
  const sections = useMemo(() => buildSections(tasks), [tasks]);
  const active = useMemo(() => activeSectionKey(sections), [sections]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (tasks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No onboarding tasks yet for this home. Apply the standard workflow template to create them.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((s) => {
        const expanded = open[s.key] ?? (s.state !== "complete" || s.key === active);
        return (
          <Section
            key={s.key}
            section={s}
            expanded={expanded}
            isActive={s.key === active}
            people={people}
            selectedId={selectedId ?? null}
            onToggle={() => setOpen((prev) => ({ ...prev, [s.key]: !expanded }))}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}

function Section({
  section,
  expanded,
  isActive,
  people,
  selectedId,
  onToggle,
  onSelect,
}: {
  section: WorkflowSection;
  expanded: boolean;
  isActive: boolean;
  people: Person[];
  selectedId: string | null;
  onToggle: () => void;
  onSelect: (task: WorkflowTask) => void;
}) {
  const complete = section.state === "complete";
  return (
    <section className="surface overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
      >
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{section.label}</span>
        {section.state === "blocked" && (
          <Chip className={stateChip("blocked")} icon={<CircleAlert />}>
            Blocked
          </Chip>
        )}
        {section.state === "not_ready" && (
          <Chip className={stateChip("new")} icon={<Lock />}>
            Not ready
          </Chip>
        )}
        {isActive && !complete && <Chip className={stateChip("active")}>Active</Chip>}
        <span className="numeric shrink-0 text-xs text-muted-foreground">
          {section.done}/{section.total}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="hidden grid-cols-[1fr_10rem_7rem_9rem] gap-3 border-b border-border bg-muted/40 px-3 py-1.5 md:grid">
            <span className="eyebrow">Task</span>
            <span className="eyebrow">Assignee</span>
            <span className="eyebrow">Due date</span>
            <span className="eyebrow">Status</span>
          </div>
          {section.tasks.map((v) => (
            <TaskRow
              key={v.task.id}
              view={v}
              people={people}
              selected={selectedId === v.task.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function TaskRow({
  view,
  people,
  selected,
  onSelect,
  showProperty,
}: {
  view: TaskView;
  people: Person[];
  selected?: boolean;
  onSelect: (task: WorkflowTask) => void;
  showProperty?: string;
}) {
  const t = view.task;
  const due = dueExplanation(t);
  return (
    <button
      type="button"
      onClick={() => onSelect(t)}
      className={cn(
        "grid w-full grid-cols-1 items-center gap-1.5 border-b border-border/60 px-3 py-2 text-left last:border-b-0 hover:bg-muted/50 md:grid-cols-[1fr_10rem_7rem_9rem] md:gap-3",
        selected && "bg-muted",
      )}
    >
      <span className="min-w-0">
        <span
          className={cn(
            "flex min-w-0 items-center gap-1.5 text-sm",
            t.parent_task_id && "pl-4",
            view.status === "complete" && "text-muted-foreground line-through",
          )}
        >
          <span className="truncate">{t.title}</span>
          {view.markers.map((m) => (
            <span
              key={m.key}
              title={m.explain}
              className="shrink-0 rounded border border-border px-1 text-[0.625rem] font-medium text-muted-foreground"
            >
              {m.label}
            </span>
          ))}
        </span>
        {showProperty && <span className="block truncate text-xs text-muted-foreground">{showProperty}</span>}
        {view.reason && <span className="block truncate text-xs text-muted-foreground">{view.reason}</span>}
      </span>

      <span className="truncate text-xs text-muted-foreground md:text-sm">
        {assigneeLabel(t, people)}
      </span>

      <span className="text-xs md:text-sm">
        {t.due_on ? (
          <span className={cn("numeric", view.overdue && "font-medium text-state-blocked")}>{t.due_on}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {due && <span className="block truncate text-[0.625rem] text-muted-foreground">{due}</span>}
      </span>

      <span className="flex items-center gap-1.5">
        <Chip className={stateChip(STATUS_STATE[view.status])}>{STATUS_LABEL[view.status]}</Chip>
        {view.overdue && view.status !== "complete" && (
          <Chip className={stateChip("blocked")}>Overdue</Chip>
        )}
      </span>
    </button>
  );
}
