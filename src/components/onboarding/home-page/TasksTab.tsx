/**
 * Property page Part 1 (1.5 to 1.8): the Tasks tab. A left rail (search, the six stages with
 * done/total, whose Task with open counts) and the stage list: Do now (late or due within 2
 * days, plus late Tasks from other stages), Up next, + Add task to this stage, Done folded.
 * Selection reuses the plan catch-up bar; the rules live in src/lib/onboarding-home-page.ts.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CatchUpBox, type CatchUpSelection } from "@/components/onboarding/PlanCatchUp";
import { stageCheckState, toggleStage } from "@/lib/plan-catch-up";
import { searchPlanTasks } from "@/lib/plan-search";
import { isFinished } from "@/lib/onboarding-board";
import { TASK_KIND_LABEL, type TaskKindCode } from "@/lib/onboarding-task-kinds";
import { assignablePeople } from "@/lib/assignable-people";
import { addStageTaskFn } from "@/lib/onboarding-home-page.functions";
import {
  OWNER_TAG_LABEL,
  OWNER_TAG_ORDER,
  PAGE_STAGE_NAMES,
  canAddOneOff,
  ownerTagFor,
  ownerTagText,
  rowDue,
  stageIndexOf,
  stageKeyFor,
  stageLists,
  stageRail,
  tagCounts,
  type AddViewer,
  type OwnerTag,
  type PageTask,
  type Whose,
} from "@/lib/onboarding-home-page";
import { cn } from "@/lib/utils";

/** Exact role colors (tag background / text / bar), as CSS theme tokens. */
export const TAG_CLASS: Record<OwnerTag, { tag: string; bar: string; ring: string }> = {
  you: { tag: "bg-role-you-bg text-role-you-fg", bar: "bg-role-you-bar", ring: "outline-role-you-bar" },
  designer: { tag: "bg-role-designer-bg text-role-designer-fg", bar: "bg-role-designer-bar", ring: "outline-role-designer-bar" },
  utilities: { tag: "bg-role-utilities-bg text-role-utilities-fg", bar: "bg-role-utilities-bar", ring: "outline-role-utilities-bar" },
  homeowner: { tag: "bg-role-homeowner-bg text-role-homeowner-fg", bar: "bg-role-homeowner-bar", ring: "outline-role-homeowner-bar" },
  director: { tag: "bg-role-director-bg text-role-director-fg", bar: "bg-role-director-bar", ring: "outline-role-director-bar" },
  unassigned: {
    tag: "border border-dashed border-role-unassigned-border bg-role-unassigned-bg text-role-unassigned-fg",
    bar: "bg-role-unassigned-bar",
    ring: "outline-role-unassigned-bar",
  },
};

type Person = { id: string; full_name: string | null; email: string | null; roles?: string[] };

const ADD_ROLES = [
  { code: "onboarding_project_manager", label: "Project Manager" },
  { code: "lead_designer", label: "Lead Designer" },
  { code: "designer", label: "Designer" },
  { code: "utilities", label: "Utilities" },
  { code: "onboarding_manager", label: "Onboarding Manager" },
  { code: "onboarding_director", label: "Director of Onboarding" },
  { code: "staging_team", label: "Staging Team" },
] as const;

export function TasksTab(p: {
  propertyId: string;
  tasks: PageTask[];
  people: Person[];
  viewerId: string | null;
  pmId: string | null;
  today: string;
  stage: number | null;
  onStage: (stage: number | null) => void;
  tag: OwnerTag | null;
  onTag: (tag: OwnerTag | null) => void;
  catchUp?: CatchUpSelection | undefined;
  onOpen: (taskId: string) => void;
  /** Who may add (null hides Add task, e.g. a locked plan). */
  addViewer: AddViewer | null;
  /** 1.8: the handoff checklist card, shown above Do now on stage 6. */
  handoff?: ReactNode;
  notNeeded?: { id: string; title: string; stage: string; exception_reason: string | null }[];
  notNeededLabel: (reason: string | null) => string;
}) {
  const [term, setTerm] = useState("");
  const nameOf = (id: string) => {
    const x = p.people.find((q) => q.id === id);
    return x?.full_name || x?.email || null;
  };
  const rail = useMemo(() => stageRail(p.tasks), [p.tasks]);
  const inScope = p.stage === null ? p.tasks : p.tasks.filter((t) => stageIndexOf(t.stage) === p.stage);
  const counts = tagCounts(inScope, p.viewerId, p.pmId);
  const lists = stageLists(p.tasks, { stage: p.stage, today: p.today, tag: p.tag, viewerId: p.viewerId, pmId: p.pmId });
  const hits = searchPlanTasks(p.tasks, term);
  const order = [...lists.doNow.map((x) => x.task.id), ...lists.upNext.map((t) => t.id), ...lists.done.map((t) => t.id)];
  const stageRow = p.stage === null ? null : rail[p.stage]!;
  const allDone = p.tasks.filter((t) => !t.parent_task_id && isFinished(t)).length;
  const allTotal = p.tasks.filter((t) => !t.parent_task_id).length;
  const skipped = (p.notNeeded ?? []).filter((t) => p.stage === null || stageIndexOf(t.stage) === p.stage);

  const row = (t: PageTask, from: string | null = null, rowOrder: string[] = order) => {
    const tag = ownerTagFor(t, p.viewerId, p.pmId);
    const due = rowDue(t, p.today);
    const canTick = Boolean(p.catchUp?.selectable.has(t.id));
    const kind = t.task_kind && t.task_kind in TASK_KIND_LABEL ? TASK_KIND_LABEL[t.task_kind as TaskKindCode] : null;
    return (
      <li key={t.id} className="flex min-h-[60px] items-stretch md:min-h-14">
        <span className={cn("w-1.5 shrink-0", TAG_CLASS[tag].bar)} aria-hidden="true" />
        {p.catchUp ? (
          <span className="flex w-12 shrink-0 items-center justify-center">
            {canTick ? (
              <CatchUpBox large state={p.catchUp.selected.has(t.id)} label={`Select ${t.title}`} onToggle={(shift) => p.catchUp!.toggle(t.id, shift, rowOrder)} />
            ) : null}
          </span>
        ) : null}
        <div className={cn("flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 py-2 pr-3", !p.catchUp && "pl-3")}>
          <button type="button" onClick={() => p.onOpen(t.id)} className="min-h-11 min-w-0 flex-1 basis-full text-left text-sm sm:basis-0">
            <span className={cn("font-medium", isFinished(t) && "text-muted-foreground line-through")}>{t.title}</span>
            {kind ? <span className="text-muted-foreground"> · {kind}</span> : null}
            {from ? <span className="text-muted-foreground"> · from {from}</span> : null}
          </button>
          <span className={cn("inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium", TAG_CLASS[tag].tag)}>
            {ownerTagText(t, p.viewerId, p.pmId, nameOf)}
          </span>
          <span className={cn("numeric w-24 text-right text-xs", due.late ? "font-medium text-late" : "text-muted-foreground")}>{due.text}</span>
        </div>
      </li>
    );
  };

  const stageBox = (() => {
    if (!p.catchUp || p.stage === null) return null;
    const ids = p.tasks.filter((t) => stageIndexOf(t.stage) === p.stage && !t.parent_task_id).map((t) => t.id);
    const openIds = p.tasks
      .filter((t) => stageIndexOf(t.stage) === p.stage && !t.parent_task_id && !isFinished(t) && p.catchUp!.selectable.has(t.id))
      .map((t) => t.id);
    if (openIds.length === 0) return null;
    const check = stageCheckState(ids, openIds, p.catchUp.selected);
    return (
      <CatchUpBox
        large
        state={check}
        label={`Select every open Task in ${PAGE_STAGE_NAMES[p.stage]}`}
        onToggle={() => p.catchUp!.replace(toggleStage(p.catchUp!.selected, openIds, check))}
      />
    );
  })();

  return (
    <div className="grid gap-5 md:grid-cols-[15rem_minmax(0,1fr)]">
      {/* Left rail. */}
      <aside className="space-y-4" aria-label="Find Tasks">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search all Tasks" aria-label="Search all Tasks" className="h-11 pl-9" maxLength={120} />
        </div>
        {/* Phone: a Stage dropdown. */}
        <div className="md:hidden">
          <Label htmlFor="stage-pick" className="text-xs text-muted-foreground">Stage</Label>
          <select
            id="stage-pick"
            className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={p.stage === null ? "all" : String(p.stage)}
            onChange={(e) => p.onStage(e.target.value === "all" ? null : Number(e.target.value))}
          >
            {rail.map((s) => (
              <option key={s.index} value={s.index}>
                {s.name} ({s.done}/{s.total}){s.complete ? " ✓" : ""}
              </option>
            ))}
            <option value="all">All stages</option>
          </select>
        </div>
        <nav className="hidden space-y-1 md:block" aria-label="Stages">
          <p className="eyebrow">Stages</p>
          {rail.map((s) => (
            <button
              key={s.index}
              type="button"
              aria-pressed={p.stage === s.index}
              onClick={() => p.onStage(s.index)}
              className={cn(
                "flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm",
                p.stage === s.index ? "bg-stage-selected font-semibold text-stage-selected-fg" : "hover:bg-muted",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className="numeric text-xs opacity-80">
                {s.done}/{s.total}
              </span>
              {s.complete ? <Check className="size-4 shrink-0" aria-label="Complete" /> : null}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={p.stage === null}
            onClick={() => p.onStage(null)}
            className={cn(
              "flex min-h-11 w-full items-center rounded-md border border-dashed border-border px-3 text-left text-sm",
              p.stage === null ? "bg-stage-selected font-semibold text-stage-selected-fg" : "hover:bg-muted",
            )}
          >
            All stages
          </button>
        </nav>
        <div className="space-y-1" aria-label="Whose Task">
          <p className="eyebrow">Whose Task</p>
          <div className="flex gap-2 overflow-x-auto pb-1 md:block md:space-y-1 md:overflow-visible md:pb-0">
            {OWNER_TAG_ORDER.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={p.tag === tag}
                onClick={() => p.onTag(p.tag === tag ? null : tag)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-left text-sm md:w-full",
                  TAG_CLASS[tag].tag,
                  p.tag === tag && cn("outline outline-2 outline-offset-1", TAG_CLASS[tag].ring),
                )}
              >
                <span className="min-w-0 flex-1 truncate">{OWNER_TAG_LABEL[tag]}</span>
                <span className="numeric text-xs font-semibold">{counts[tag]}</span>
              </button>
            ))}
          </div>
          {p.tag ? (
            <Button variant="link" className="h-11 px-0" onClick={() => p.onTag(null)}>
              Show everyone's
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Green is always you, whoever is signed in. Late Tasks from other stages always show in Do now. Unassigned Tasks belong to the PM until handed off.
        </p>
      </aside>

      {/* Stage list. */}
      <section className="min-w-0 space-y-4" aria-label="Tasks">
        {hits ? (
          <div className="surface overflow-hidden">
            <div className="flex min-h-11 items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
              <span className="text-sm font-semibold">{hits.length === 1 ? "1 Task" : `${hits.length} Tasks`}</span>
              <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setTerm("")}>
                Clear
              </Button>
            </div>
            {hits.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">No Tasks match.</p>
            ) : (
              <ul className="divide-y divide-border">
                {hits.map((h) => {
                  const i = stageIndexOf(h.task.stage);
                  return row(h.task, i >= 0 ? PAGE_STAGE_NAMES[i]! : h.stage, hits.map((x) => x.task.id));
                })}
              </ul>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {stageBox}
              <h2 className="min-w-0 flex-1 font-display text-xl">{stageRow ? stageRow.name : "All stages"}</h2>
              <span className="numeric text-sm text-muted-foreground">
                {stageRow ? `${stageRow.done} of ${stageRow.total} done` : `${allDone} of ${allTotal} done`}
              </span>
            </div>
            {p.stage === 5 ? p.handoff : null}
            <div className="surface overflow-hidden">
              <p className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold tracking-wide text-late">DO NOW · {lists.doNow.length}</p>
              {lists.doNow.length ? (
                <ul className="divide-y divide-border">{lists.doNow.map((x) => row(x.task, x.fromStage))}</ul>
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground">Nothing late or due in the next 2 days.</p>
              )}
            </div>
            <div className="surface overflow-hidden">
              <p className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground">UP NEXT · {lists.upNext.length}</p>
              {lists.upNext.length ? (
                <ul className="divide-y divide-border">{lists.upNext.map((t) => row(t))}</ul>
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground">No other open Tasks here.</p>
              )}
              {p.stage !== null && p.addViewer ? (
                <AddTaskRow propertyId={p.propertyId} stageKey={stageKeyFor(p.stage, p.tasks)} stageName={PAGE_STAGE_NAMES[p.stage]!} people={p.people} viewer={p.addViewer} />
              ) : null}
            </div>
            {lists.done.length > 0 ? (
              <details className="surface overflow-hidden">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm text-muted-foreground">Done ({lists.done.length})</summary>
                <ul className="divide-y divide-border border-t border-border">{lists.done.map((t) => row(t))}</ul>
              </details>
            ) : null}
            {skipped.length > 0 ? (
              <details className="surface overflow-hidden">
                <summary className="flex min-h-11 cursor-pointer items-center px-3 text-sm text-muted-foreground">Not needed ({skipped.length})</summary>
                <ul className="divide-y divide-border border-t border-border">
                  {skipped.map((t) => (
                    <li key={t.id} className="px-3 py-2 text-sm">
                      <span className="text-muted-foreground line-through">{t.title}</span>
                      <span className="block text-xs text-muted-foreground">{p.notNeededLabel(t.exception_reason)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

/** 1.7: one inline row. What needs doing, Whose, Due (optional), Add. */
function AddTaskRow(p: { propertyId: string; stageKey: string; stageName: string; people: Person[]; viewer: AddViewer }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [whoseKey, setWhoseKey] = useState("you");
  const [dueOn, setDueOn] = useState("");
  const qc = useQueryClient();
  const add = useServerFn(addStageTaskFn);
  const options = useMemo(() => {
    const out: { key: string; label: string; whose: Whose }[] = [{ key: "you", label: "You", whose: { kind: "you" } }];
    for (const r of ADD_ROLES) out.push({ key: `role:${r.code}`, label: r.label, whose: { kind: "role", role: r.code } });
    for (const x of assignablePeople(p.people)) {
      if (x.id === p.viewer.userId) continue;
      out.push({ key: `person:${x.id}`, label: x.full_name || x.email || "Teammate", whose: { kind: "person", personId: x.id } });
    }
    out.push({ key: "homeowner", label: "Homeowner", whose: { kind: "homeowner" } });
    return out.filter((o) => canAddOneOff(p.viewer, o.whose));
  }, [p.people, p.viewer]);
  const picked = options.find((o) => o.key === whoseKey) ?? options[0];
  const m = useMutation({
    mutationFn: () =>
      add({ data: { propertyId: p.propertyId, stage: p.stageKey, title: title.trim(), whose: picked!.whose as never, dueOn: dueOn || null } }),
    onSuccess: () => {
      toast.success("Task added.");
      setTitle("");
      setDueOn("");
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!picked) return null;
  if (!open)
    return (
      <div className="border-t border-border px-3 py-1">
        <Button variant="ghost" className="min-h-11 px-0 text-primary" onClick={() => setOpen(true)}>
          + Add task to this stage
        </Button>
      </div>
    );
  return (
    <form
      className="grid gap-2 border-t border-border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto] sm:items-end"
      aria-label={`Add task to ${p.stageName}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim().length >= 3) m.mutate();
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="add-what" className="text-xs">What needs doing</Label>
        <Input id="add-what" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required className="h-11" autoFocus />
      </div>
      <div className="space-y-1">
        <Label htmlFor="add-whose" className="text-xs">Whose</Label>
        <select id="add-whose" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={picked.key} onChange={(e) => setWhoseKey(e.target.value)}>
          {options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="add-due" className="text-xs">Due</Label>
        <Input id="add-due" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className="h-11" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="min-h-11" disabled={m.isPending || title.trim().length < 3}>
          Add
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
