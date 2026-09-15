import { restoreAssignedRelease } from "@/lib/onboarding-assigned-context";
import {
  onboardingWorkspaceKey,
  canManageOnboardingProperty,
} from "@/lib/onboarding-workspace-view";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingPage, PageHeader } from "@/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskRow } from "@/components/onboarding/WorkflowTable";
import { TaskDrawer, type SaveTaskInput } from "@/components/onboarding/TaskDrawer";
import { useRole } from "@/hooks/useRole";
import { viewTask, type WorkflowTask } from "@/lib/onboarding-workflow";
import { projectScope, splitByScope } from "@/lib/onboarding-scope";
import { buildReleaseContext } from "@/lib/onboarding-state";
import { groupMyWork, myWorkSelection, validateMyWorkSearch } from "@/lib/onboarding-work-views";
import { isTestRecord } from "@/lib/test-data";
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
      { title: "My onboarding work — Resolve" },
      {
        name: "description",
        content:
          "Every onboarding task assigned to you across homes, grouped into overdue, today, upcoming, blocked and waiting on review.",
      },
      { property: "og:title", content: "My onboarding work — Resolve" },
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
  const { userId, readOnly, can } = useRole();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const setWho = (who: string) => {
    void navigate({ search: { who }, replace: true });
  };
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: onboardingWorkspaceKey(userId),
    queryFn: () => load(),
    enabled: Boolean(userId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });
  const onError = (e: Error) => toast.error(e.message);

  const saveTask = useMutation({
    mutationFn: useServerFn(saveOnboardingTaskFn) as never,
    onSuccess: () => {
      toast.success("Task saved.");
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
  const mine = selection.tasks.filter((task) => task.status !== "complete");

  if (isLoading || !data) return <LoadingPage />;

  const propertyName = (id: string) =>
    data.properties.find((p) => p.id === id)?.name ?? "Unknown home";
  const views = mine.flatMap((t) => {
    const assignedContext = data.assignedWorkContexts.find(
      (context) => context.propertyId === t.property_id,
    );
    if (assignedContext) {
      const property = data.properties.find((item) => item.id === t.property_id);
      return property && !isTestRecord(property)
        ? [viewTask(t, assignedContext.tasks, restoreAssignedRelease(assignedContext))]
        : [];
    }
    const property = data.properties.find((p) => p.id === t.property_id);
    if (!property || isTestRecord(property)) return [];
    const project =
      data.projects.find((p) => p.property_id === t.property_id && p.status !== "cancelled") ??
      null;
    const scoped = splitByScope(
      allTasks.filter((x) => x.property_id === t.property_id),
      projectScope(project),
    );
    if (!scoped.inScope.some((x) => x.id === t.id)) return [];
    const handoff =
      data.handoffs.find(
        (h) =>
          h.property_id === t.property_id &&
          ["requested", "accepted_pending_live"].includes(h.status),
      ) ?? null;
    const release = buildReleaseContext({
      property,
      project,
      tasks: scoped.inScope,
      handoff,
      stageCaptures: data.stageCaptures.filter((c) => c.propertyId === t.property_id),
      excludedTaskIds: scoped.outOfScope.map((x) => x.task.id),
    });
    return [viewTask(t, scoped.inScope, release)];
  });
  const t0 = today();

  const openTask = mine.find((t) => t.id === openTaskId) ?? null;
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
        title="My work"
        description="Onboarding tasks assigned to you across every home, in the order they need attention."
        actions={
          selection.canBrowseTeam ? (
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="me">Assigned to me</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {data.people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email || "Teammate"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
      />

      {views.length === 0 && (
        <EmptyState
          title="Nothing open"
          hint="No open onboarding task matches this view right now."
        />
      )}

      {groupMyWork(views, t0)
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <details key={g.key} open={g.key !== "future"} className="surface overflow-hidden">
            <summary className="cursor-pointer border-b border-border bg-muted/40 px-3 py-2">
              <p className="text-sm font-semibold">
                {g.label} <span className="numeric text-muted-foreground">({g.items.length})</span>
              </p>
              <p className="text-xs text-muted-foreground">{g.hint}</p>
            </summary>
            {g.items
              .sort((a, b) => (a.task.due_on ?? "9999").localeCompare(b.task.due_on ?? "9999"))
              .map((v) => (
                <TaskRow
                  key={v.task.id}
                  view={v}
                  people={data.people}
                  selected={openTaskId === v.task.id}
                  onSelect={(t) => setOpenTaskId(t.id)}
                  showProperty={propertyName(v.task.property_id)}
                />
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
        onClose={() => setOpenTaskId(null)}
        onSave={(input: SaveTaskInput) => saveTask.mutate({ data: input } as never)}
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
