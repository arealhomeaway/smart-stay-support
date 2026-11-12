/**
 * Plan catch-up (Admin approval Nov 12; board "Plan catch-up: update many Tasks"): one selection
 * shared by the stage lists and Every task, a bar pinned to the bottom of the screen, the forms,
 * the result line and Undo. Rules live in src/lib/plan-catch-up.ts; the database re-checks.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ASSIGN_ROLES,
  NOT_NEEDED_EXAMPLES,
  barActions,
  catchUpSelectable,
  isFinishedTask,
  reasonProblem,
  resultLine,
  selectedLabel,
  toggleSelection,
  undoAvailable,
  UNDO_MINUTES,
  type BarAction,
  type CatchUpTask,
  type CatchUpViewer,
  type StageCheck,
} from "@/lib/plan-catch-up";
import { planCatchUpTasksFn, undoPlanCatchUpFn, type CatchUpResult } from "@/lib/plan-catch-up.functions";
import { roleLabel } from "@/lib/v2-workflow.functions";
import { assignablePeople } from "@/lib/assignable-people";
import { BulkCompleteDialog } from "@/components/onboarding/BulkCompleteDialog";
import { HomeTaskBulkEditDialog } from "@/components/onboarding/HomeTaskBulkEditDialog";
import { homeTaskSelectable, type HomeBulkTask } from "@/lib/home-task-bulk-edit";
import { CoveredList, HeldList } from "@/components/onboarding/CatchUpLists";

export type CatchUpSelection = {
  selectable: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  /** One Task; Shift selects the range from the last one clicked in the same list. */
  toggle: (id: string, shift: boolean, order: string[]) => void;
  replace: (next: Set<string>) => void;
  clear: () => void;
};

export function usePlanCatchUp(tasks: CatchUpTask[], viewer: CatchUpViewer | null): CatchUpSelection {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchor = useRef<string | null>(null);
  const selectable = useMemo(
    () => new Set(viewer ? tasks.filter((t) => catchUpSelectable(viewer, t)).map((t) => t.id) : []),
    [tasks, viewer],
  );
  // Drop anything that disappeared (Not needed, moved) since it was selected.
  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => selectable.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [selectable]);
  const toggle = useCallback(
    (id: string, shift: boolean, order: string[]) => {
      if (!selectable.has(id)) return;
      setSelected((prev) => toggleSelection(prev, id, { shift, anchor: anchor.current, order, selectable }));
      anchor.current = id;
    },
    [selectable],
  );
  const replace = useCallback((next: Set<string>) => setSelected(new Set([...next].filter((id) => selectable.has(id)))), [selectable]);
  const clear = useCallback(() => {
    anchor.current = null;
    setSelected(new Set());
  }, []);
  return { selectable, selected, toggle, replace, clear };
}

/** A 26 px box inside a 44 px tap area. Works inside a <summary> without folding it. */
export function CatchUpBox({
  state,
  label,
  onToggle,
  className,
  large = false,
}: {
  state: StageCheck | boolean;
  label: string;
  onToggle: (shift: boolean) => void;
  className?: string;
  /** Property page Part 1: a 28 px box on the Tasks tab rows. */
  large?: boolean;
}) {
  const checked = state === true || state === "all" ? true : state === "some" ? "indeterminate" : false;
  return (
    <span
      className={cn("flex size-11 shrink-0 cursor-pointer items-center justify-center", className)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(e.shiftKey);
      }}
    >
      <CheckboxPrimitive.Root
        checked={checked}
        aria-label={label}
        onClick={(e) => e.preventDefault()}
        className={cn(large ? "size-7" : "size-[26px]", "grid place-content-center rounded-md border-2 border-primary bg-background text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary")}
      >
        <CheckboxPrimitive.Indicator className="grid place-content-center">
          {checked === "indeterminate" ? <Minus className="size-4" strokeWidth={3} /> : <Check className="size-4" strokeWidth={3} />}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    </span>
  );
}

type BarTask = CatchUpTask & { title: string } & Partial<HomeBulkTask>;
type BarPerson = { id: string; full_name: string | null; email: string | null; roles?: string[] };
type LastSave = { line: string; batchId: string | null; savedAt: number };

const ACTION_TITLE: Record<Exclude<BarAction, "mark_done">, string> = {
  not_needed: "Not needed for this home",
  assign: "Assign to",
  due_date: "Change due date",
  reopen: "Reopen",
};

export function PlanCatchUpBar({
  propertyId,
  homeName,
  tasks,
  people,
  selection,
  canEditSelected,
  stages,
  onChanged,
}: {
  propertyId: string;
  homeName: string;
  tasks: BarTask[];
  people: BarPerson[];
  selection: CatchUpSelection;
  /** The existing Edit selected (home plan edit) for the people it allows. */
  canEditSelected: boolean;
  stages: string[];
  onChanged: () => void;
}) {
  const [dialog, setDialog] = useState<BarAction | "edit" | null>(null);
  const [last, setLast] = useState<LastSave | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [, tick] = useState(0);
  const undo = useServerFn(undoPlanCatchUpFn);
  // Pinned beside the side menu, never over it: follow the page's main column.
  const [span, setSpan] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const measure = () => {
      const r = main.getBoundingClientRect();
      setSpan({ left: r.left, width: r.width });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  const selectedTasks = useMemo(() => tasks.filter((t) => selection.selected.has(t.id)), [tasks, selection.selected]);
  const ids = selectedTasks.map((t) => t.id);
  const actions = barActions(selectedTasks);
  const editable = canEditSelected && selectedTasks.length > 0 && selectedTasks.every((t) => homeTaskSelectable(t as HomeBulkTask));

  // The result line and Undo stay for 10 minutes.
  useEffect(() => {
    if (!last) return;
    const left = UNDO_MINUTES * 60_000 - (Date.now() - last.savedAt);
    const id = window.setTimeout(() => tick((n) => n + 1), Math.max(0, left) + 50);
    return () => window.clearTimeout(id);
  }, [last]);
  const showLast = Boolean(last && undoAvailable(last.savedAt));
  if (selectedTasks.length === 0 && !showLast && !dialog) return null;

  const saved = (line: string, batchId: string | null | undefined) => {
    setDialog(null);
    selection.clear();
    setLast({ line, batchId: batchId ?? null, savedAt: Date.now() });
    onChanged();
  };

  const runUndo = async () => {
    if (!last?.batchId) return;
    setUndoing(true);
    try {
      const r = await undo({ data: { batchId: last.batchId } });
      const n = r.restored.length;
      toast.success(`Undone. ${n} Task${n === 1 ? "" : "s"} back as before.${r.held.length ? ` ${r.held.length} changed since and were left as they are.` : ""}`);
      setLast(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not undo.");
    } finally {
      setUndoing(false);
    }
  };

  return (
    <>
      <div
        role="region"
        aria-label="Selected Tasks"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card shadow-lg print:hidden"
        style={span ? { left: span.left, width: span.width, right: "auto" } : undefined}
      >
        <div className="mx-auto max-w-6xl space-y-2 px-3 py-3 pr-16 sm:px-4">
          {showLast && last ? (
            <div className="flex flex-wrap items-center gap-2 text-sm" role="status">
              <span className="min-w-0 flex-1 font-medium">{last.line}</span>
              {last.batchId ? (
                <Button size="sm" variant="outline" className="min-h-11" disabled={undoing} onClick={runUndo}>
                  {undoing ? "Undoing…" : "Undo"}
                </Button>
              ) : null}
              <Button size="icon" variant="ghost" className="size-11" aria-label="Close" onClick={() => setLast(null)}>
                <X className="size-4" />
              </Button>
            </div>
          ) : null}
          {selectedTasks.length > 0 ? (
            // Phone: count, Mark done and Clear on one line, the rest scroll sideways underneath.
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-2 sm:contents">
                <span className="numeric mr-1 text-sm font-semibold">{selectedLabel(selectedTasks.length)}</span>
                <Button className="min-h-11" onClick={() => setDialog("mark_done")}>Mark done</Button>
                <Button variant="ghost" className="ml-auto min-h-11 sm:order-last sm:ml-0" onClick={selection.clear}>Clear</Button>
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:contents">
                <Button variant="outline" className="min-h-11 shrink-0" onClick={() => setDialog("not_needed")}>Not needed for this home</Button>
                <Button variant="outline" className="min-h-11 shrink-0" onClick={() => setDialog("assign")}>Assign to…</Button>
                <Button variant="outline" className="min-h-11 shrink-0" onClick={() => setDialog("due_date")}>Change due date…</Button>
                {actions.includes("reopen") ? (
                  <Button variant="outline" className="min-h-11 shrink-0" onClick={() => setDialog("reopen")}>Reopen</Button>
                ) : null}
                {editable ? (
                  <Button variant="outline" className="min-h-11 shrink-0" onClick={() => setDialog("edit")}>Edit selected</Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {dialog === "mark_done" ? (
        <BulkCompleteDialog
          propertyId={propertyId}
          homeName={homeName}
          selectedIds={ids}
          onClose={() => setDialog(null)}
          onSaved={(r, doneOn) =>
            saved(
              resultLine({ action: "mark_done", done: r.completed, doneOn, covered: r.covered?.length ?? 0, skipped: r.held.length }),
              r.batchId,
            )
          }
        />
      ) : null}
      {dialog === "edit" && editable ? (
        <HomeTaskBulkEditDialog
          propertyId={propertyId}
          homeName={homeName}
          tasks={tasks as unknown as HomeBulkTask[]}
          stages={stages}
          selectedIds={ids}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            selection.clear();
            onChanged();
          }}
        />
      ) : null}
      {dialog && dialog !== "mark_done" && dialog !== "edit" ? (
        <CatchUpActionDialog
          action={dialog}
          propertyId={propertyId}
          homeName={homeName}
          selectedIds={ids}
          people={people}
          onClose={() => setDialog(null)}
          onSaved={(r) =>
            saved(resultLine({ action: dialog, done: r.done, covered: r.covered?.length ?? 0, skipped: r.held.length }), r.batchId)
          }
        />
      ) : null}
    </>
  );
}

function CatchUpActionDialog({
  action,
  propertyId,
  homeName,
  selectedIds,
  people,
  onClose,
  onSaved,
}: {
  action: Exclude<BarAction, "mark_done">;
  propertyId: string;
  homeName: string;
  selectedIds: string[];
  people: BarPerson[];
  onClose: () => void;
  onSaved: (r: CatchUpResult) => void;
}) {
  const run = useServerFn(planCatchUpTasksFn);
  const [preview, setPreview] = useState<CatchUpResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    run({ data: { propertyId, taskIds: selectedIds, action, dryRun: true } })
      .then((r) => live && setPreview(r))
      .catch((e: Error) => live && setPreviewError(e.message));
    return () => {
      live = false;
    };
  }, [action, propertyId, run, selectedIds]);
  const team = useMemo(
    () => assignablePeople(people.filter((p) => (p.roles ?? []).some((r) => r === "onboarding" || r === "admin"))),
    [people],
  );
  const count = preview?.ready.length ?? 0;
  const problem =
    action === "not_needed" || action === "reopen"
      ? reasonProblem(reason, count)
      : count === 0
        ? "None of the selected Tasks can be changed."
        : action === "assign"
          ? assignee ? null : "Choose a person or a role."
          : dueOn ? null : "Pick a due date.";
  const save = async () => {
    if (problem) return;
    setSaving(true);
    setFailure(null);
    try {
      const [kind, value] = assignee.split(":");
      const r = await run({
        data: {
          propertyId,
          taskIds: preview!.ready.map((t) => t.taskId),
          action,
          reason: action === "not_needed" || action === "reopen" ? reason.trim() : null,
          role: action === "assign" && kind === "role" ? (value as (typeof ASSIGN_ROLES)[number]) : null,
          person: action === "assign" && kind === "person" ? value! : null,
          dueOn: action === "due_date" ? dueOn : null,
          dryRun: false,
        },
      });
      onSaved(r);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Nothing was changed. Try again.");
    } finally {
      setSaving(false);
    }
  };
  const button =
    action === "not_needed" ? `Mark ${count} not needed` : action === "reopen" ? `Reopen ${count}` : "Apply";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {ACTION_TITLE[action]} · {homeName}
          </DialogTitle>
        </DialogHeader>
        {previewError ? <p className="text-sm text-destructive">{previewError}</p> : null}
        {!preview && !previewError ? <p className="text-sm text-muted-foreground">Checking the selected Tasks…</p> : null}
        {preview ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">
                {count} Task{count === 1 ? "" : "s"}
              </p>
              <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2 text-sm">
                {preview.ready.map((t) => (
                  <li key={t.taskId}>{t.title}</li>
                ))}
              </ul>
            </div>
            {action === "not_needed" ? <CoveredList covered={preview.covered ?? []} /> : null}
            <HeldList held={preview.held} />
            {action === "not_needed" || action === "reopen" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="catch-up-reason">Reason</Label>
                <Input id="catch-up-reason" className="min-h-11" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                {action === "not_needed" ? (
                  <div className="flex flex-wrap gap-2">
                    {NOT_NEEDED_EXAMPLES.map((ex) => (
                      <Button key={ex} type="button" size="sm" variant="outline" className="min-h-11" onClick={() => setReason(ex)}>
                        {ex}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {action === "assign" ? (
              <div className="grid gap-1.5">
                <Label>Assign to</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger className="min-h-11" aria-label="Assign to">
                    <SelectValue placeholder="Choose a person or a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Roles</SelectLabel>
                      {ASSIGN_ROLES.map((r) => (
                        <SelectItem key={r} value={`role:${r}`}>{roleLabel(r)}</SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>People</SelectLabel>
                      {team.map((p) => (
                        <SelectItem key={p.id} value={`person:${p.id}`}>{p.full_name || p.email}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {action === "due_date" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="catch-up-due">New due date</Label>
                <Input id="catch-up-due" type="date" className="min-h-11" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
              </div>
            ) : null}
            {problem && count > 0 ? <p className="text-xs text-muted-foreground">{problem}</p> : null}
            {failure ? <p className="text-sm text-destructive">{failure}</p> : null}
          </div>
        ) : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" className="min-h-11" onClick={onClose}>Cancel</Button>
          <Button className="min-h-11" disabled={saving || !preview || Boolean(problem)} onClick={save}>
            {saving ? "Saving…" : button}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** For the stage header and "Select all open": the open Tasks this person may select. */
export function openSelectable<T extends { id: string; status: string }>(list: T[], selection: CatchUpSelection) {
  return list.filter((t) => !isFinishedTask(t) && t.status !== "carryover" && selection.selectable.has(t.id)).map((t) => t.id);
}
