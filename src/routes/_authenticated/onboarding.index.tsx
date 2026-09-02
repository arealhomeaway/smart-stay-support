import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { toast } from "sonner";
import { LoadingPage, PageHeader } from "@/components/ui/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandoffGatePanel } from "@/components/onboarding/HandoffGatePanel";
import { ExternalRecordsPanel } from "@/components/onboarding/ExternalRecordsPanel";
import { DirectorHub } from "@/components/onboarding/DirectorHub";
import { useRole } from "@/hooks/useRole";
import { useFeatureFlags } from "@/lib/feature-flags";
import { summarizeProject, type ProjectProperty } from "@/lib/onboarding-lifecycle";
import { type WorkflowTask } from "@/lib/onboarding-workflow";
import {
  getOnboardingWorkspace,
  resolveExternalRecordFn,
  reviewHandoffFn,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/")({
  head: () => ({
    meta: [
      { title: "Director onboarding hub — Resolve" },
      {
        name: "description",
        content:
          "What needs attention today across every home in onboarding: derived risk, first-class blockers, review gates, upcoming handoffs and workload by project manager.",
      },
      { property: "og:title", content: "Director onboarding hub — Resolve" },
      {
        property: "og:description",
        content:
          "Exception-first view of the whole onboarding pipeline, without opening every property.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Hub,
  errorComponent: () => <p className="text-muted-foreground">The hub could not be loaded.</p>,
});

function Hub() {
  const load = useServerFn(getOnboardingWorkspace);
  const qc = useQueryClient();
  const { can, readOnly, userId } = useRole();
  const { enabled } = useFeatureFlags();

  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-workspace"],
    queryFn: () => load(),
  });
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

  const projects = useMemo(() => {
    if (!data) return [];
    return data.properties
      .filter((p) => data.pipeline.includes(p.id))
      .map((p) => {
        const tasks = data.tasks.filter((t) => t.property_id === p.id) as unknown as WorkflowTask[];
        const handoff =
          data.handoffs.find(
            (h) =>
              h.property_id === p.id &&
              (h.status === "requested" || h.status === "accepted_pending_live"),
          ) ?? null;
        const pm = data.people.find((x) => x.id === p.onboarding_owner);
        return summarizeProject(
          { property: p as unknown as ProjectProperty, tasks, handoff },
          pm?.full_name ?? pm?.email ?? null,
        );
      });
  }, [data]);

  if (isLoading || !data) return <LoadingPage />;

  const pendingReviews = data.handoffs.filter(
    (h) => h.status === "requested" || h.status === "accepted_pending_live",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Onboarding"
        title="Director hub"
        description="What needs attention today, what is at risk and why, which homes are waiting on a review gate, and which handoffs land this week."
      />

      <Tabs defaultValue="hub" className="space-y-5">
        <TabsList>
          <TabsTrigger value="hub">Hub ({projects.length})</TabsTrigger>
          <TabsTrigger value="reviews">Handoff gate ({pendingReviews.length})</TabsTrigger>
          <TabsTrigger value="records">Source records</TabsTrigger>
        </TabsList>

        <TabsContent value="hub">
          <DirectorHub projects={projects} />
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
