import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LoadingPage, PageHeader, Chip, ProgressRing } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { HandoffGatePanel } from "@/components/onboarding/HandoffGatePanel";
import { ExternalRecordsPanel } from "@/components/onboarding/ExternalRecordsPanel";
import { useRole } from "@/hooks/useRole";
import { useFeatureFlags } from "@/lib/feature-flags";
import { stateChip } from "@/lib/semantic";
import { lifecycleMeta, stageLabel } from "@/lib/onboarding";
import { rollupProperty, type WorkflowTask } from "@/lib/onboarding-workflow";
import {
  getOnboardingWorkspace,
  resolveExternalRecordFn,
  reviewHandoffFn,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/")({
  head: () => ({
    meta: [
      { title: "Onboarding pipeline — Resolve" },
      {
        name: "description",
        content:
          "Portfolio view of every home in onboarding: stage, progress, next milestone, blocker, project manager and handoff readiness.",
      },
      { property: "og:title", content: "Onboarding pipeline — Resolve" },
      {
        property: "og:description",
        content: "See the whole onboarding pipeline without opening every property.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagerHub,
  errorComponent: () => <p className="text-muted-foreground">The pipeline could not be loaded.</p>,
});

type Filter = "all" | "blocked" | "owner" | "evidence" | "overdue" | "review";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All homes" },
  { key: "blocked", label: "Blocked" },
  { key: "owner", label: "Owner decision overdue" },
  { key: "evidence", label: "Missing evidence" },
  { key: "overdue", label: "Behind schedule" },
  { key: "review", label: "At a review gate" },
];

function ManagerHub() {
  const load = useServerFn(getOnboardingWorkspace);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can, readOnly, userId } = useRole();
  const { enabled } = useFeatureFlags();
  const [find, setFind] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading } = useQuery({ queryKey: ["onboarding-workspace"], queryFn: () => load() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });

  const reviewHandoff = useMutation({
    mutationFn: useServerFn(reviewHandoffFn),
    onSuccess: () => {
      toast.success("Decision recorded.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resolveRecord = useMutation({
    mutationFn: useServerFn(resolveExternalRecordFn),
    onSuccess: () => {
      toast.success("Record updated.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const pending = new Set(
      data.handoffs
        .filter((h) => h.status === "requested" || h.status === "accepted_pending_live")
        .map((h) => h.property_id),
    );
    return data.properties
      .filter((p) => data.pipeline.includes(p.id))
      .map((p) => {
        const tasks = data.tasks.filter((t) => t.property_id === p.id) as unknown as WorkflowTask[];
        const roll = rollupProperty(tasks);
        const pm = data.people.find((x) => x.id === p.onboarding_owner);
        const target = tasks
          .filter((t) => t.blocks_handoff && t.status !== "complete" && t.due_on)
          .map((t) => t.due_on!)
          .sort()
          .at(-1);
        return {
          property: p,
          roll,
          // A home in the pipeline with no tasks has no onboarding project yet:
          // that is a real state, not a zero-progress project.
          hasProject: tasks.length > 0,
          pm: pm?.full_name ?? pm?.email ?? null,
          target: target ?? null,
          inReview: pending.has(p.id),
        };
      });
  }, [data]);

  const visible = useMemo(() => {
    const q = find.trim().toLowerCase();
    return rows.filter((r) => {
      if (
        q &&
        !`${r.property.name} ${r.pm ?? ""} ${stageLabel(r.property.onboarding_stage)}`.toLowerCase().includes(q)
      )
        return false;
      if (filter === "blocked") return r.roll.blocked > 0;
      if (filter === "owner") return r.roll.ownerPending > 0;
      if (filter === "evidence") return r.roll.missingEvidence > 0;
      if (filter === "overdue") return r.roll.overdue > 0;
      if (filter === "review") return r.inReview;
      return true;
    });
  }, [rows, find, filter]);

  if (isLoading || !data) return <LoadingPage />;

  const pendingReviews = data.handoffs.filter(
    (h) => h.status === "requested" || h.status === "accepted_pending_live",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Onboarding"
        title="Onboarding pipeline"
        description="Every home before handoff, with the stage it is in, how much of its standard workflow is done, and what is holding it up. Open a home to work its sectioned workflow."
      />

      <Tabs defaultValue="pipeline" className="space-y-5">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline ({rows.length})</TabsTrigger>
          <TabsTrigger value="reviews">Handoff gate ({pendingReviews.length})</TabsTrigger>
          <TabsTrigger value="records">Source records</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="Find a home, project manager or stage"
              className="w-full max-w-xs"
            />
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                  filter === f.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="surface overflow-hidden">
            <div className="hidden grid-cols-[1.4fr_1fr_7rem_1fr_1fr_9rem_7rem] gap-3 border-b border-border bg-muted/40 px-3 py-1.5 lg:grid">
              <span className="eyebrow">Property</span>
              <span className="eyebrow">Current stage</span>
              <span className="eyebrow">Progress</span>
              <span className="eyebrow">Next milestone</span>
              <span className="eyebrow">Blocker</span>
              <span className="eyebrow">Project manager</span>
              <span className="eyebrow">Target handoff</span>
            </div>
            {visible.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No home matches this view.</p>
            )}
            {visible.map((r) => (
              <button
                key={r.property.id}
                type="button"
                onClick={() => void navigate({ to: "/onboarding/$propertyId", params: { propertyId: r.property.id } })}
                className="grid w-full grid-cols-1 items-center gap-1.5 border-b border-border/60 px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50 lg:grid-cols-[1.4fr_1fr_7rem_1fr_1fr_9rem_7rem] lg:gap-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.property.name}</span>
                  <span className="flex flex-wrap items-center gap-1 pt-0.5">
                    <Chip className={stateChip(r.inReview ? "waiting" : "info")}>
                      {r.inReview ? "At review gate" : lifecycleMeta(r.property.lifecycle_status).label}
                    </Chip>
                    {!r.hasProject && <Chip className={stateChip("new")}>No onboarding project</Chip>}
                    {r.roll.carryover > 0 && <Chip className={stateChip("info")}>{r.roll.carryover} carryover</Chip>}
                  </span>
                </span>
                <span className="truncate text-xs text-muted-foreground lg:text-sm">
                  {stageLabel(r.property.onboarding_stage)}
                </span>
                {r.hasProject ? (
                  <span className="flex items-center gap-2">
                    <ProgressRing value={r.roll.progress} size={44} tone="onboarding" />
                    <span className="numeric text-xs text-muted-foreground">
                      {r.roll.done}/{r.roll.total}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Not started</span>
                )}
                <span className="truncate text-xs text-muted-foreground lg:text-sm">
                  {r.hasProject ? (r.roll.nextMilestone ?? "—") : "Create the onboarding project"}
                </span>
                <span className="truncate text-xs lg:text-sm">
                  {!r.hasProject ? (
                    <span className="text-state-blocked">No onboarding project yet</span>
                  ) : r.roll.primaryBlocker ? (
                    <span className="text-state-blocked">{r.roll.primaryBlocker}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground lg:text-sm">
                  {r.pm ?? <span className="italic">Not yet assigned</span>}
                </span>
                <span className="numeric text-xs text-muted-foreground lg:text-sm">{r.target ?? "—"}</span>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {pendingReviews.length === 0 && (
            <p className="text-sm text-muted-foreground">No handoff is waiting at a review gate.</p>
          )}
          {pendingReviews.map((h) => (
            <HandoffGatePanel
              key={h.id}
              handoff={h as never}
              reviews={data.reviews as never}
              people={data.people}
              propertyName={data.properties.find((p) => p.id === h.property_id)?.name ?? "Property"}
              canReview={
                can("handoff_review") ||
                (Boolean(userId) &&
                  (h.gate_step ?? "kati_review") === "kati_review" &&
                  data.properties.find((p) => p.id === h.property_id)?.onboarding_owner === userId)
              }
              disabled={readOnly}
              onDecision={(input) => reviewHandoff.mutate({ data: { handoffId: h.id, ...input } })}
            />
          ))}
        </TabsContent>

        <TabsContent value="records">
          <ExternalRecordsPanel
            databases={data.externalDatabases as never}
            records={data.externalRecords as never}
            properties={data.properties}
            syncConfigured={enabled("onboarding_external_sync")}
            disabled={readOnly || !can("handoff_request")}
            onResolve={(input) => resolveRecord.mutate({ data: input })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
