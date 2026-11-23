/**
 * My Tasks controls (Nov 23, filters, search and views): one Filter button that opens the selection
 * panel, the Views list (each person's named views), and the Kanban board for one home picked from a
 * dropdown. Rules live in src/lib/my-tasks-saved-views.ts and src/lib/onboarding-task-search.ts.
 */
import { useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { stateChip } from "@/lib/semantic";
import { cn } from "@/lib/utils";
import {
  FOLLOWED_HOMES,
  MY_TASKS_QUICK_LABELS,
  WORK_FILTER_LABELS,
  toggleMyTasksQuick,
  type MyTasksPrefs,
  type MyTasksQuick,
} from "@/lib/onboarding-work-views";
import { TASK_TYPE_LABEL, TASK_TYPE_ORDER } from "@/lib/onboarding-task-search";
import { kanbanColumns, type MyTasksAddress, type MyTasksSavedView } from "@/lib/my-tasks-saved-views";
import { assigneeLabel, STATUS_LABEL, STATUS_STATE, type TaskView, type WorkflowTask } from "@/lib/onboarding-workflow";

type Person = { id: string; full_name: string | null; email: string | null };
type Home = { id: string; label: string };

const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm";

function Choice(p: { on: boolean; label: string; onClick: () => void }) {
  return (
    <Button type="button" size="sm" className="min-h-11" variant={p.on ? "default" : "outline"} aria-pressed={p.on} onClick={p.onClick}>
      {p.label}
    </Button>
  );
}

export function MyTasksFilterPanel(p: {
  address: MyTasksAddress;
  prefs: MyTasksPrefs;
  count: number;
  canBrowseTeam: boolean;
  people: Person[];
  homes: Home[];
  followsCount: number;
  onAddress: (patch: Partial<MyTasksAddress>) => void;
  onPrefs: (patch: Partial<MyTasksPrefs>) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={p.count ? "secondary" : "outline"} className="min-h-11 gap-1">
          <SlidersHorizontal className="size-4" aria-hidden="true" /> Filter{p.count ? ` (${p.count})` : ""}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filter tasks</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 py-4">
          {p.canBrowseTeam ? (
            <div className="space-y-1">
              <Label htmlFor="f-who">Assigned to</Label>
              <select id="f-who" className={selectClass} value={p.address.who} onChange={(e) => p.onAddress({ who: e.target.value })}>
                <option value="me">Assigned to me</option>
                <option value="all">Every assignee</option>
                <option value="unassigned">Unassigned</option>
                {p.people.map((x) => (
                  <option key={x.id} value={x.id}>{x.full_name || x.email || "Teammate"}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="f-program">Program</Label>
            <select id="f-program" className={selectClass} value={p.address.program} onChange={(e) => p.onAddress({ program: e.target.value })}>
              <option value="all">Every program</option>
              <option value="active_owner">Active Owner only</option>
              <option value="standard">Standard only</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-home">Home</Label>
            <select id="f-home" className={selectClass} value={p.address.home} onChange={(e) => p.onAddress({ home: e.target.value })}>
              <option value="all">Every home</option>
              <option value={FOLLOWED_HOMES}>Homes I follow ({p.followsCount})</option>
              {p.homes.map((h) => (
                <option key={h.id} value={h.id}>{h.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-state">Work</Label>
            <select id="f-state" className={selectClass} value={p.address.state} onChange={(e) => p.onAddress({ state: e.target.value })}>
              {Object.entries(WORK_FILTER_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Show</legend>
            <div className="flex flex-wrap gap-1">
              {(Object.entries(MY_TASKS_QUICK_LABELS) as [MyTasksQuick, string][]).map(([key, label]) => (
                <Choice key={key} on={p.prefs.quick.includes(key)} label={label} onClick={() => p.onPrefs({ quick: toggleMyTasksQuick(p.prefs.quick, key) })} />
              ))}
            </div>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Due between</legend>
            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" aria-label="Due from" className="min-h-11 w-40" value={p.prefs.from} onChange={(e) => p.onPrefs({ from: e.target.value })} />
              <span className="text-xs text-muted-foreground">and</span>
              <Input type="date" aria-label="Due to" className="min-h-11 w-40" value={p.prefs.to} onChange={(e) => p.onPrefs({ to: e.target.value })} />
              {p.prefs.from || p.prefs.to ? (
                <Button variant="ghost" size="sm" className="min-h-11" onClick={() => p.onPrefs({ from: "", to: "" })}>
                  Clear dates
                </Button>
              ) : null}
            </div>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Task type</legend>
            <div className="flex flex-wrap gap-1">
              {TASK_TYPE_ORDER.map((t) => (
                <Choice
                  key={t}
                  on={p.prefs.types.includes(t)}
                  label={TASK_TYPE_LABEL[t]}
                  onClick={() => p.onPrefs({ types: p.prefs.types.includes(t) ? p.prefs.types.filter((x) => x !== t) : [...p.prefs.types, t] })}
                />
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="f-sort">Sort</Label>
              <select id="f-sort" className={selectClass} value={p.prefs.sort} onChange={(e) => p.onPrefs({ sort: e.target.value === "home" ? "home" : "due" })}>
                <option value="due">By due date</option>
                <option value="home">By home</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="f-group">Group</Label>
              <select
                id="f-group"
                className={selectClass}
                value={p.prefs.group}
                onChange={(e) => p.onPrefs({ group: e.target.value === "home" || e.target.value === "role" ? e.target.value : "due" })}
              >
                <option value="due">By due date</option>
                <option value="home">By home</option>
                <option value="role">By role</option>
              </select>
            </div>
          </div>
        </div>
        <SheetFooter className="gap-2">
          <Button variant="outline" className="min-h-11" disabled={p.count === 0} onClick={p.onClear}>
            Clear filters
          </Button>
          <Button className="min-h-11" onClick={() => setOpen(false)}>
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function MyTasksViewsMenu(p: {
  views: MyTasksSavedView[];
  pending: boolean;
  saving: boolean;
  onSave: (name: string) => void;
  onOpen: (v: MyTasksSavedView) => void;
  onRemove: (v: MyTasksSavedView) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="min-h-11 gap-1">
            Views <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem className="min-h-11" disabled={p.pending} onSelect={() => setNaming(true)}>
            Save this view
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">Your saved views</DropdownMenuLabel>
          {p.pending ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Saved views are not available yet.</p>
          ) : p.views.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">None yet.</p>
          ) : (
            p.views.map((v) => (
              <div key={v.id} className="flex items-center gap-1">
                <DropdownMenuItem className="min-h-11 flex-1" onSelect={() => p.onOpen(v)}>
                  {v.name}
                </DropdownMenuItem>
                <button type="button" aria-label={`Remove ${v.name}`} onClick={() => p.onRemove(v)} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted">
                  <X className="size-4" />
                </button>
              </div>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save this view</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              p.onSave(name.trim());
              setNaming(false);
              setName("");
            }}
          >
            <p className="text-sm text-muted-foreground">Keeps your filters, grouping, sort and search. A name you used before is replaced.</p>
            <Label htmlFor="my-view-name">Name</Label>
            <Input id="my-view-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="min-h-11" autoFocus />
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={!name.trim() || p.saving}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** List or Board. */
export function MyTasksLayoutSwitch(p: { layout: MyTasksPrefs["layout"]; onLayout: (l: MyTasksPrefs["layout"]) => void }) {
  return (
    <div role="tablist" aria-label="Layout" className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
      {(["list", "board"] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="tab"
          aria-selected={p.layout === l}
          onClick={() => p.onLayout(l)}
          className={cn("min-h-11 rounded-md px-3 text-sm font-medium", p.layout === l ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {l === "list" ? "List" : "Board"}
        </button>
      ))}
    </div>
  );
}

/** Kanban for one home: To do, In progress, Waiting, Done. Cards open the Task window. */
export function MyTasksBoard(p: {
  views: TaskView[];
  homes: Home[];
  home: string | null;
  onHome: (id: string) => void;
  people: Person[];
  onOpen: (task: WorkflowTask) => void;
}) {
  if (!p.home || p.homes.length === 0) {
    return <p className="text-sm text-muted-foreground">No home has tasks in this view.</p>;
  }
  const columns = kanbanColumns(p.views, p.home);
  return (
    <section className="space-y-3" aria-label="Board">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="board-home" className="text-sm font-medium">Home</Label>
        <select id="board-home" className={cn(selectClass, "w-auto min-w-[16rem]")} value={p.home} onChange={(e) => p.onHome(e.target.value)}>
          {p.homes.map((h) => (
            <option key={h.id} value={h.id}>{h.label}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((c) => (
          <div key={c.key} className="surface flex min-w-0 flex-col overflow-hidden">
            <p className="border-b border-border bg-muted/40 px-3 py-2 text-sm font-semibold">
              {c.label} <span className="numeric font-normal text-muted-foreground">({c.items.length})</span>
            </p>
            {c.items.length === 0 ? (
              <p className="px-3 py-3 text-sm text-muted-foreground">Nothing here.</p>
            ) : (
              <ul className="space-y-2 p-2">
                {c.items.map((v) => (
                  <li key={v.task.id}>
                    <button
                      type="button"
                      onClick={() => p.onOpen(v.task)}
                      className="w-full min-h-11 rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-muted/50"
                    >
                      <span className={cn("block text-sm font-medium", c.key === "done" && "text-muted-foreground line-through")}>{v.task.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{assigneeLabel(v.task, p.people)}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Chip className={stateChip(STATUS_STATE[v.status])}>{STATUS_LABEL[v.status]}</Chip>
                        {v.task.due_on ? (
                          <span className={cn("numeric text-xs", v.overdue && c.key !== "done" ? "font-medium text-state-blocked" : "text-muted-foreground")}>{v.task.due_on}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
