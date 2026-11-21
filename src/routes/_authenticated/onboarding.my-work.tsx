import { formatPropertyLabel } from "@/lib/property-label";
import { doneRecently, taskSavedMessage, type DoneTask } from "@/lib/task-proof";
import { loadTaskProof } from "@/lib/homeowner-has.data";
import { DoneRecentlySection, taskProofText } from "@/components/onboarding/DoneRecently";
import { overrideOnboardingTaskDateFn } from "@/lib/onboarding.functions";
import { restoreAssignedRelease } from "@/lib/onboarding-assigned-context";
import {
  onboardingWorkspaceKey,
  canManageOnboardingProperty,
} from "@/lib/onboarding-workspace-view";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingPage, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskRow } from "@/components/onboarding/WorkflowTable";
import { TaskDrawer, taskPayload, type SaveTaskInput } from "@/components/onboarding/TaskDrawer";
import { Checkbox } from "@/components/ui/checkbox";
import { useRole } from "@/hooks/useRole";
import { viewTask, type WorkflowTask } from "@/lib/onboarding-workflow";
import { projectScope, splitByScope } from "@/lib/onboarding-scope";
import { buildReleaseContext } from "@/lib/onboarding-state";
import {
  canQuickComplete,
  myWorkSelection,
  followedHomeTasks,
  FOLLOWED_HOMES,
  matchesWorkFilter,
  validateMyWorkSearch,
  WORK_FILTER_LABELS,
  MY_TASKS_QUICK_LABELS,
  MY_TASKS_PREFS_DEFAULTS,
  loadMyTasksPrefs,
  saveMyTasksPrefs,
  matchesMyTasksQuicks,
  toggleMyTasksQuick,
  matchesMyTasksDueRange,
  sortMyTasks,
  groupMyTasks,
  type MyTasksPrefs,
  type MyTasksQuick,
  type WorkFilter,
} from "@/lib/onboarding-work-views";
import { isTestRecord } from "@/lib/test-data";
import { taskViewsFor } from "@/lib/onboarding-task-views";
import { assignablePeople } from "@/lib/assignable-people";
import { ReviewsWaiting } from "@/components/onboarding/ReviewsWaiting";
import { HomeownerTaskChip, MyHomeownersSection, useHomeownerStatus } from "@/components/ao/HomeownerStatus";
import { myHomeownerHomes, taskChip, type StatusRow } from "@/lib/homeowner-status";
import {
  getOnboardingWorkspace,
  addOnboardingNoteFn,
  recordTaskExceptionFn,
  reopenOnboardingTaskFn,
  saveOnboardingTaskFn,
  submitOwnerApprovalFn,
  recordOwnerTaskDecisionFn,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/my-work")({
  validateSearch: validateMyWorkSearch,
  head: () => ({
    meta: [
      { title: "My Tasks: Resolve" },
      {
        name: "description",
        content:
          "Every onboarding task assigned to you across homes, grouped into overdue, today, upcoming, blocked and waiting on review.",
      },
      { property: "og:title", content: "My Tasks: Resolve" },
      {
        property: "og:description",
        content: "Your onboarding tasks across every home in one list.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyWork,
});

const today = () => new Date().toISOString().slice(0, 10);

function MyWork() {
  const load = useServerFn(getOnboardingWorkspace);
  const qc = useQueryClient();
  const { userId, readOnly, can, demoMode, isAdmin, isOnboardingDirector } = useRole();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const setFilter = (patch: Record<string, string>) => {
    void navigate({ search: { ...search, ...patch }, replace: true });
  };
  const linkedTask = (search as { task?: string }).task ?? null;
  const [openTaskId, setOpenTaskId] = useState<string | null>(linkedTask);
  // A Task opened from My homeowners may belong to a teammate on one of this person's homes.
  const [openedFromHomeowners, setOpenedFromHomeowners] = useState(false);
  useEffect(() => {
    if (linkedTask) setOpenTaskId(linkedTask);
  }, [linkedTask]);

  const { data, isLoading } = useQuery({
    queryKey: onboardingWorkspaceKey(userId),
    queryFn: () => load(),
    enabled: Boolean(userId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
  const onError = (e: Error) => toast.error(e.message);

  const saveDate = useMutation({
    mutationFn: useServerFn(overrideOnboardingTaskDateFn),
    onSuccess: () => {
      toast.success("Date override recorded.");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const saveTask = useMutation({
    mutationFn: useServerFn(saveOnboardingTaskFn) as never,
    onSuccess: (_r: unknown, vars: { data?: SaveTaskInput } | undefined) => {
      // Nov 17: the Saved message names the Task, and says when it was marked done.
      const before = ((data?.tasks ?? []) as unknown as WorkflowTask[]).find((t) => t.id === vars?.data?.id);
      toast.success(taskSavedMessage({ title: vars?.data?.title ?? before?.title, status: vars?.data?.status, wasDone: before?.status === "complete" }));
      void refresh();
    },
    onError,
  });
  const submitApproval = useMutation({
    mutationFn: useServerFn(submitOwnerApprovalFn) as never,
    onSuccess: () => {
      toast.success("Sent to the homeowner for approval.");
      void refresh();
    },
    onError,
  });
  const recordOwnerDecision = useMutation({
    mutationFn: useServerFn(recordOwnerTaskDecisionFn) as never,
    onSuccess: () => {
      toast.success("Homeowner's answer recorded.");
      void refresh();
    },
    onError,
  });
  const reopenTask = useMutation({
    mutationFn: useServerFn(reopenOnboardingTaskFn) as never,
    onSuccess: () => {
      toast.success("Task reopened.");
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addObservation = useMutation({
    mutationFn: useServerFn(addOnboardingNoteFn) as never,
    onSuccess: () => {
      toast.success("Observation recorded.");
      void qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const recordException = useMutation({
    mutationFn: useServerFn(recordTaskExceptionFn) as never,
    onSuccess: () => {
      toast.success("Exception recorded.");
      void refresh();
    },
    onError,
  });

  const allTasks = useMemo(() => (data?.tasks ?? []) as unknown as WorkflowTask[], [data?.tasks]);
  const selection = myWorkSelection(
    allTasks,
    userId,
    search.who,
    can("handoff_review"),
    data?.projects ?? [],
  );
  const who = selection.who;
  // Part 3 (3.5): the homes this person added to My homes.
  const follows = useQuery({
    queryKey: ["onboarding-follows-mine", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("onboarding_follows").select("property_id").eq("user_id", userId!);
      if (error) throw new Error(error.message);
      return new Set((rows ?? []).map((r) => r.property_id as string));
    },
  });
  const followedOnly = search.home === FOLLOWED_HOMES;
  // Completed tasks stay in the pool so the Completed quick filter can show them.
  const mine = followedOnly ? followedHomeTasks(allTasks, follows.data ?? new Set<string>(), search.who, userId) : selection.tasks;

  // Homeowner status (Admin, Nov 16): the homes this person works on, for "My homeowners", plus
  // the homes of the listed Tasks for their row chips. Read only.
  const homeownerPerson = who === "me" ? userId : who === "all" || who === "unassigned" ? null : who;
  const homeownerHomes = useMemo(() => {
    const projects = (data?.projects ?? []) as { property_id: string; project_manager: string | null; status: string }[];
    // Everyone's Tasks: the homes this person may see the whole team's work on.
    if (who === "all" || who === "unassigned") {
      return myHomeownerHomes({ person: userId, allHomes: can("handoff_review"), projects, tasks: [] });
    }
    return myHomeownerHomes({
      person: homeownerPerson,
      allHomes: who === "me" && (isOnboardingDirector || isAdmin),
      projects,
      tasks: allTasks as unknown as { property_id: string; assigned_to: string | null; status: string; archived_at?: string | null }[],
    });
  }, [data?.projects, allTasks, who, homeownerPerson, isOnboardingDirector, isAdmin, can, userId]);
  const statusHomes = useMemo(
    () => [...new Set([...homeownerHomes, ...mine.map((t) => t.property_id)])],
    [homeownerHomes, mine],
  );
  const homeownerStatus = useHomeownerStatus(statusHomes, demoMode, Boolean(data));
  const statusNow = useMemo(() => new Date(), [homeownerStatus.data]);

  // Nov 17: the person's own finished Tasks (last 7 days) and the proof on finished rows.
  const doneNow = useMemo(() => new Date(), [data]);
  const recentDone = useMemo(
    () => doneRecently(allTasks as unknown as (DoneTask & { evidence_note?: string | null })[], homeownerPerson, doneNow),
    [allTasks, homeownerPerson, doneNow],
  );
  const proofTasks = useMemo(() => {
    const byId = new Map<string, DoneTask>();
    for (const t of [...recentDone, ...(mine as unknown as DoneTask[]).filter((t) => t.status === "complete")]) byId.set(t.id, t);
    return [...byId.values()];
  }, [recentDone, mine]);
  const proofKey = proofTasks.map((t) => t.id).sort();
  const taskProof = useQuery({
    queryKey: ["task-proof", proofKey],
    enabled: proofKey.length > 0,
    staleTime: 60_000,
    queryFn: () => loadTaskProof({ taskIds: proofKey, completerIds: proofTasks.map((t) => t.completed_by ?? "").filter(Boolean) }),
  });

  // Each person's last view choices, remembered in their own browser.
  const [prefs, setPrefs] = useState<MyTasksPrefs>(MY_TASKS_PREFS_DEFAULTS);
  useEffect(() => {
    if (userId) setPrefs(loadMyTasksPrefs(window.localStorage, userId));
  }, [userId]);
  const updatePrefs = (patch: Partial<MyTasksPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      saveMyTasksPrefs(window.localStorage, userId, next);
      return next;
    });
  };

  if (isLoading || !data) return <LoadingPage />;

  const propertyName = (id: string) =>
    data.properties.find((p) => p.id === id)?.name ?? "Unknown home";
  // Same reading as Onboarding Home's Today, for me (src/lib/onboarding-task-views.ts).
  const views = taskViewsFor(data as never, allTasks, mine);
  const t0 = today();

  // Active Owner homes are the ones whose live project carries the module.
  const activeOwnerHomes = new Set(
    (data.projects ?? [])
      .filter((p) => p.status !== "cancelled" && (p.modules ?? []).includes("active_owner"))
      .map((p) => p.property_id),
  );
  const filtered = views
    .filter((v) =>
      search.program === "all"
        ? true
        : search.program === "active_owner"
          ? activeOwnerHomes.has(v.task.property_id)
          : !activeOwnerHomes.has(v.task.property_id),
    )
    .filter((v) => (search.home === "all" || followedOnly ? true : v.task.property_id === search.home))
    .filter((v) => matchesWorkFilter(v, search.state as WorkFilter))
    .filter((v) => matchesMyTasksQuicks(v, prefs.quick, t0))
    .filter((v) => matchesMyTasksDueRange(v, prefs.from, prefs.to));
  const sorted = sortMyTasks(filtered, prefs.sort, propertyName);
  const groups = groupMyTasks(sorted, prefs.group, t0, propertyName);

  const openTask =
    mine.find((t) => t.id === openTaskId) ??
    (openedFromHomeowners ? allTasks.find((t) => t.id === openTaskId) : undefined) ??
    null;
  const openHomeownerRow = (row: StatusRow) => {
    if (row.taskId && allTasks.some((t) => t.id === row.taskId)) {
      setOpenedFromHomeowners(true);
      setOpenTaskId(row.taskId);
      return;
    }
    void navigate({ to: "/onboarding/$propertyId", params: { propertyId: row.propertyId }, search: { tab: "owner" } as never });
  };
  const assignedDrawerContext = data.assignedWorkContexts.find(
    (context) => context.propertyId === openTask?.property_id,
  );
  const drawerSiblings = assignedDrawerContext
    ? assignedDrawerContext.tasks
    : openTask
      ? splitByScope(
          allTasks.filter((t) => t.property_id === openTask.property_id),
          projectScope(
            data.projects.find(
              (p) => p.property_id === openTask.property_id && p.status !== "cancelled",
            ) ?? null,
          ),
        ).inScope
      : [];
  const drawerProperty = data.properties.find((p) => p.id === openTask?.property_id);
  const drawerRelease = assignedDrawerContext
    ? restoreAssignedRelease(assignedDrawerContext)
    : drawerProperty
      ? buildReleaseContext({
          property: drawerProperty,
          project:
            data.projects.find(
              (p) => p.property_id === drawerProperty.id && p.status !== "cancelled",
            ) ?? null,
          tasks: drawerSiblings,
          handoff:
            data.handoffs.find(
              (h) =>
                h.property_id === drawerProperty.id &&
                ["requested", "accepted_pending_live"].includes(h.status),
            ) ?? null,
          stageCaptures: data.stageCaptures.filter(
            (capture) => capture.propertyId === drawerProperty.id,
          ),
          excludedTaskIds: allTasks
            .filter(
              (task) =>
                task.property_id === drawerProperty.id &&
                !drawerSiblings.some((sibling) => sibling.id === task.id),
            )
            .map((task) => task.id),
        })
      : undefined;
  const canEdit = !readOnly && can("handoff_request");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Onboarding"
        title="My Tasks"
        description="Onboarding tasks assigned to you across every home, in the order they need attention."
      />

      <MyHomeownersSection
        data={homeownerStatus.data}
        homes={homeownerHomes}
        loading={homeownerStatus.isLoading}
        failed={homeownerStatus.isError}
        onRetry={() => void homeownerStatus.refetch()}
        onOpen={openHomeownerRow}
      />

      {homeownerPerson ? (
        <DoneRecentlySection
          tasks={recentDone}
          proof={taskProof.data}
          propertyName={propertyName}
          onOpen={(id) => {
            setOpenedFromHomeowners(!mine.some((t) => t.id === id));
            setOpenTaskId(id);
          }}
        />
      ) : null}

      <ReviewsWaiting propertyName={propertyName} />

      <div className="flex flex-wrap gap-2">
        {selection.canBrowseTeam && (
          <Select value={who} onValueChange={(v) => setFilter({ who: v })}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="me">Assigned to me</SelectItem>
              <SelectItem value="all">Every assignee</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {assignablePeople(data.people).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name || p.email || "Teammate"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={search.program} onValueChange={(v) => setFilter({ program: v })}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every program</SelectItem>
            <SelectItem value="active_owner">Active Owner only</SelectItem>
            <SelectItem value="standard">Standard only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={search.home} onValueChange={(v) => setFilter({ home: v })}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every home</SelectItem>
            <SelectItem value={FOLLOWED_HOMES}>Homes I follow ({follows.data?.size ?? 0})</SelectItem>
            {data.properties
              .filter((p) => !isTestRecord(p))
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {formatPropertyLabel(p).primary}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select value={search.state} onValueChange={(v) => setFilter({ state: v })}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WORK_FILTER_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label="My Tasks view">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Quick filters">
          {(Object.entries(MY_TASKS_QUICK_LABELS) as [MyTasksQuick, string][]).map(
            ([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={prefs.quick.includes(key) ? "default" : "outline"}
                aria-pressed={prefs.quick.includes(key)}
                onClick={() => updatePrefs({ quick: toggleMyTasksQuick(prefs.quick, key) })}
              >
                {label}
              </Button>
            ),
          )}
        </div>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          Due from
          <Input
            type="date"
            className="h-8 w-36"
            value={prefs.from}
            onChange={(e) => updatePrefs({ from: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          to
          <Input
            type="date"
            className="h-8 w-36"
            value={prefs.to}
            onChange={(e) => updatePrefs({ to: e.target.value })}
          />
        </label>
        {(prefs.from || prefs.to) && (
          <Button size="sm" variant="ghost" onClick={() => updatePrefs({ from: "", to: "" })}>
            Clear dates
          </Button>
        )}
        <Select value={prefs.sort} onValueChange={(v) => updatePrefs({ sort: v as MyTasksPrefs["sort"] })}>
          <SelectTrigger className="w-48" aria-label="Sort tasks">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due">Sort by due date</SelectItem>
            <SelectItem value="home">Sort by home</SelectItem>
          </SelectContent>
        </Select>
        <Select value={prefs.group} onValueChange={(v) => updatePrefs({ group: v as MyTasksPrefs["group"] })}>
          <SelectTrigger className="w-48" aria-label="Group tasks">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due">Group by due date</SelectItem>
            <SelectItem value="home">Group by home</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <EmptyState
          title="Nothing matches"
          hint="No onboarding task matches this view right now."
        />
      )}

      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <details key={g.key} open className="surface overflow-hidden">
            <summary className="cursor-pointer border-b border-border bg-muted/40 px-3 py-2">
              <p className="text-sm font-semibold">
                {g.label} <span className="numeric text-muted-foreground">({g.items.length})</span>
              </p>
              <p className="text-xs text-muted-foreground">{g.hint}</p>
            </summary>
            {g.items
              .map((v) => (
                <div key={v.task.id} className="flex items-center border-b border-border/60 last:border-b-0">
                  <span className="flex w-10 shrink-0 justify-center">
                    {canQuickComplete(v) && canEdit ? (
                      <Checkbox
                        aria-label={`Mark "${v.task.title}" done`}
                        disabled={saveTask.isPending}
                        onCheckedChange={(checked) => {
                          if (checked)
                            saveTask.mutate({
                              data: taskPayload(v.task, { status: "complete", blocker: "" }),
                            } as never);
                        }}
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <TaskRow
                      view={v}
                      people={data.people}
                      selected={openTaskId === v.task.id}
                      onSelect={(t) => {
                        setOpenedFromHomeowners(false);
                        setOpenTaskId(t.id);
                      }}
                      showProperty={propertyName(v.task.property_id)}
                      extra={(() => {
                        const chip = homeownerStatus.data
                          ? taskChip(
                              { id: v.task.id, done: v.task.status === "complete", completedAt: (v.task as { completed_at?: string | null }).completed_at ?? null },
                              homeownerStatus.data,
                              statusNow,
                            )
                          : null;
                        const done = v.task.status === "complete" ? (
                          <span className="mt-1 block text-xs text-muted-foreground" data-task-proof={v.task.id}>
                            {taskProofText(v.task as unknown as DoneTask, taskProof.data)}
                          </span>
                        ) : null;
                        return chip || done ? <>{chip ? <HomeownerTaskChip chip={chip} /> : null}{done}</> : null;
                      })()}
                    />
                  </div>
                </div>
              ))}
          </details>
        ))}

      <TaskDrawer
        task={openTask}
        tasks={drawerSiblings}
        {...(drawerRelease ? { release: drawerRelease } : {})}
        people={data.people}
        propertyName={openTask ? propertyName(openTask.property_id) : ""}
        disabled={!canEdit || !drawerRelease || drawerRelease.locked}
        canRecordException={can("handoff_review")}
        canManageTask={canManageOnboardingProperty(
          userId,
          can("handoff_review"),
          openTask?.property_id,
          data.projects,
        )}
        onClose={() => {
          setOpenTaskId(null);
          setOpenedFromHomeowners(false);
        }}
        onAdvance={(id) => setOpenTaskId(mine.some((t) => t.id === id) ? id : null)}
        onSave={(input: SaveTaskInput) => saveTask.mutate({ data: input } as never)}
        onSaveDate={(taskId, expectedUpdatedAt, dueOn, reason) =>
          saveDate.mutate({ data: { taskId, expectedUpdatedAt, dueOn, reason } })
        }
        onSubmitApproval={(taskId, version, note) =>
          submitApproval.mutate({ data: { taskId, version, note } } as never)
        }
        onReopen={(taskId, reason) => reopenTask.mutate({ data: { taskId, reason } } as never)}
        onAddObservation={(taskId, body) =>
          addObservation.mutate({
            data: { propertyId: openTask?.property_id ?? "", taskId, body, mentions: [] },
          } as never)
        }
        onRecordOwnerDecision={(taskId, approved, note, evidenceUrl) =>
          recordOwnerDecision.mutate({
            data: { taskId, approved, note, ...(evidenceUrl ? { evidenceUrl } : {}) },
          } as never)
        }
        onRecordException={(taskId, reason) =>
          recordException.mutate({ data: { taskId, reason } } as never)
        }
      />
    </div>
  );
}
