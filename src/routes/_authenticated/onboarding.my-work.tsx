import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingPage, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskRow } from "@/components/onboarding/WorkflowTable";
import { TaskDrawer, type SaveTaskInput } from "@/components/onboarding/TaskDrawer";
import { useRole } from "@/hooks/useRole";
import { viewTask, type TaskView, type WorkflowTask } from "@/lib/onboarding-workflow";
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
  head: () => ({
    meta: [
      { title: "My onboarding work — Resolve" },
      {
        name: "description",
        content:
          "Every onboarding task assigned to you across homes, grouped into overdue, today, upcoming, blocked and waiting on review.",
      },
      { property: "og:title", content: "My onboarding work — Resolve" },
      { property: "og:description", content: "Your onboarding tasks across every home in one list." },
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
  const [who, setWho] = useState("me");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["onboarding-workspace"], queryFn: () => load() });
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

  const allTasks = (data?.tasks ?? []) as unknown as WorkflowTask[];
  const target = who === "me" ? userId : who === "unassigned" ? null : who;

  const mine = useMemo(
    () =>
      allTasks
        .filter((t) => (target === null ? !t.assigned_to : t.assigned_to === target))
        .filter((t) => t.status !== "complete"),
    [allTasks, target],
  );

  if (isLoading || !data) return <LoadingPage />;

  const propertyName = (id: string) => data.properties.find((p) => p.id === id)?.name ?? "Unknown home";
  const views = mine.map((t) => viewTask(t, allTasks.filter((x) => x.property_id === t.property_id)));
  const t0 = today();

  const groups: { key: string; label: string; hint: string; items: TaskView[] }[] = [
    {
      key: "overdue",
      label: "Overdue",
      hint: "Past the date Resolve calculated for this step.",
      items: views.filter((v) => v.overdue),
    },
    {
      key: "today",
      label: "Due today",
      hint: "Scheduled to finish today.",
      items: views.filter((v) => !v.overdue && v.task.due_on === t0),
    },
    {
      key: "blocked",
      label: "Blocked",
      hint: "Waiting on a dependency, a homeowner decision, or a recorded blocker.",
      items: views.filter((v) => !v.overdue && (v.status === "blocked" || v.status === "not_ready")),
    },
    {
      key: "review",
      label: "Needs review",
      hint: "Work is done but evidence or an approval is still outstanding.",
      items: views.filter((v) => !v.overdue && v.status === "needs_review"),
    },
    {
      key: "upcoming",
      label: "Upcoming",
      hint: "Released and dated for a later day.",
      items: views.filter(
        (v) => !v.overdue && v.status !== "blocked" && v.status !== "not_ready" && v.status !== "needs_review" && (v.task.due_on ?? "") > t0,
      ),
    },
    {
      key: "undated",
      label: "No date yet",
      hint: "Not scheduled — usually waiting on a milestone date such as closing or access.",
      items: views.filter(
        (v) => !v.task.due_on && !v.overdue && v.status !== "blocked" && v.status !== "not_ready" && v.status !== "needs_review",
      ),
    },
  ];

  const openTask = allTasks.find((t) => t.id === openTaskId) ?? null;
  const drawerSiblings = openTask ? allTasks.filter((t) => t.property_id === openTask.property_id) : [];
  const canEdit = !readOnly && can("handoff_request");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Onboarding"
        title="My work"
        description="Onboarding tasks assigned to you across every home, in the order they need attention."
        actions={
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
        }
      />

      {views.length === 0 && (
        <EmptyState title="Nothing open" hint="No open onboarding task matches this view right now." />
      )}

      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.key} className="surface overflow-hidden">
            <div className="border-b border-border bg-muted/40 px-3 py-2">
              <p className="text-sm font-semibold">
                {g.label} <span className="numeric text-muted-foreground">({g.items.length})</span>
              </p>
              <p className="text-xs text-muted-foreground">{g.hint}</p>
            </div>
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
          </section>
        ))}

      <TaskDrawer
        task={openTask}
        tasks={drawerSiblings}
        people={data.people}
        propertyName={openTask ? propertyName(openTask.property_id) : ""}
        disabled={!canEdit}
        canRecordException={can("handoff_review")}
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
        onRecordException={(taskId, reason) => recordException.mutate({ data: { taskId, reason } } as never)}
      />

    </div>
  );
}
