import { canReviewOnboardingGate } from "@/lib/onboarding-review-capabilities";
import { onboardingWorkspaceKey } from "@/lib/onboarding-workspace-view";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { toast } from "sonner";
import { ArrowRight, ClipboardList, Database, Home, Inbox, Plus, Users, Workflow } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingPage, PageHero, ProgressRing, SectionCard } from "@/components/ui/page";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { usDate } from "@/lib/dates";
import { awaitingMyReview } from "@/lib/onboarding-hub";
import { lifecycleStageMeta, withinDays, type ProjectSummary } from "@/lib/onboarding-lifecycle";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/hero-arha-property.jpg";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { HandoffGatePanel } from "@/components/onboarding/HandoffGatePanel";
import { ExternalRecordsPanel } from "@/components/onboarding/ExternalRecordsPanel";
import { DirectorHub, type Lens } from "@/components/onboarding/DirectorHub";
import { AddPropertyDialog } from "@/components/property/AddPropertyDialog";

import { useRole } from "@/hooks/useRole";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { useFeatureFlags } from "@/lib/feature-flags";
import { summarizeProject, type ProjectProperty } from "@/lib/onboarding-lifecycle";
import { type WorkflowTask } from "@/lib/onboarding-workflow";
import { projectScope, splitByScope } from "@/lib/onboarding-scope";
import { applyTestDataFilter, countTestRecords } from "@/lib/test-data";
import {
  getOnboardingWorkspace,
  resolveExternalRecordFn,
  reviewHandoffFn,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/")({
  head: () => ({
    meta: [
      { title: "Onboarding hub — Resolve" },
      {
        name: "description",
        content:
          "What needs attention today across every home in onboarding: derived risk, first-class blockers, review gates, upcoming handoffs and workload by project manager.",
      },
      { property: "og:title", content: "Onboarding hub — Resolve" },
      {
        property: "og:description",
        content:
          "Exception-first view of the whole onboarding pipeline, without opening every property.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Lens, search text and owner filter live in the URL: the hub is
  // shareable, survives a reload, and is exactly what Back restores after a
  // visit to a project workspace.
  validateSearch: (raw: Record<string, unknown>): HubSearch => {
    const out: HubSearch = {};
    if (typeof raw["lens"] === "string" && raw["lens"]) out.lens = raw["lens"] as Lens;
    if (typeof raw["find"] === "string" && raw["find"]) out.find = raw["find"];
    if (typeof raw["owner"] === "string" && raw["owner"]) out.owner = raw["owner"];
    if (raw["showTest"] === true || raw["showTest"] === "true") out.showTest = true;
    return out;
  },
  component: Hub,
  errorComponent: () => <p className="text-muted-foreground">The hub could not be loaded.</p>,
});

type HubSearch = {
  lens?: Lens | undefined;
  find?: string | undefined;
  owner?: string | undefined;
  showTest?: boolean | undefined;
};

function Hub() {
  const load = useServerFn(getOnboardingWorkspace);
  const qc = useQueryClient();
  const { can, readOnly, userId } = useRole();
  const { enabled } = useFeatureFlags();
  const { token: originToken } = useWorkspaceOrigin("Onboarding hub");
  const navigate = Route.useNavigate();
  const params = Route.useSearch();
  const lens = params.lens ?? "attention";
  const find = params.find ?? "";
  const owner = params.owner ?? null;
  const showTest = params.showTest === true;
  const setParam = (patch: HubSearch) =>
    void navigate({
      search: (prev: HubSearch) => {
        const next: HubSearch = { ...prev, ...patch };
        if (!next.lens || next.lens === "attention") delete next.lens;
        if (!next.find) delete next.find;
        if (!next.owner) delete next.owner;
        if (!next.showTest) delete next.showTest;
        return next;
      },
      replace: true,
    });

  const { data, isLoading } = useQuery({
    queryKey: onboardingWorkspaceKey(userId),
    queryFn: () => load(),
    enabled: Boolean(userId),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["onboarding-workspace"] });

  // A person's own name, so the hub greets them the way Operations Home does.
  const { data: me } = useQuery({
    queryKey: ["my-name", userId],
    enabled: Boolean(userId),
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const firstName = (me?.full_name ?? "").trim().split(/\s+/)[0] ?? "";

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
        // The Onboarding Project row is authoritative for lifecycle: without
        // it a home with tasks would read as started when it is not.
        const project =
          (data.projects ?? []).find((x) => x.property_id === p.id && x.status !== "cancelled") ??
          null;
        const pm = data.people.find((x) => x.id === project?.project_manager);
        const scoped = splitByScope(tasks, projectScope(project));
        return summarizeProject(
          {
            property: p as unknown as ProjectProperty,
            tasks: scoped.inScope,
            handoff,
            project: project as never,
            stageCaptures: data.stageCaptures.filter((c) => c.propertyId === p.id),
            excludedTaskIds: scoped.outOfScope.map((x) => x.task.id),
            independentReadiness:
              data.independentReadiness.find((row) => row.propertyId === p.id) ?? null,
          },
          pm?.full_name ?? pm?.email ?? null,
        );
      });
  }, [data]);

  if (isLoading || !data) return <LoadingPage />;
  if (data.workspaceMode === "assigned")
    return <Navigate to="/onboarding/my-work" search={{ who: "me" }} replace />;

  // Homes in the pipeline where nobody has started an Onboarding Project yet.
  // A property existing is not the same as onboarding being under way.
  const notStartedAll = data.properties.filter(
    (p) =>
      data.pipeline.includes(p.id) &&
      !(data.projects ?? []).some((x) => x.property_id === p.id && x.status !== "cancelled"),
  );
  // Same shared QA/demo rule the rest of Resolve uses.
  const notStarted = applyTestDataFilter(notStartedAll, false, (p) => p);
  const notStartedTestCount = countTestRecords(notStartedAll, (p) => p);

  const pendingReviews = data.handoffs.filter(
    (h) =>
      (h.status === "requested" || h.status === "accepted_pending_live") &&
      applyTestDataFilter(data.properties, showTest, (p) => p).some((p) => p.id === h.property_id),
  );

  // The hub's own figures follow the same test/QA opt-in the rows do.
  const scoped = applyTestDataFilter(projects, showTest, (p) => p.property);
  const viewer = { userId, reviewCapabilities: data.reviewCapabilities };
  const activeProjects = scoped.filter((p) => p.stage !== "live");
  const myDecisions = activeProjects.filter((p) => awaitingMyReview(p, viewer));
  const atRisk = activeProjects.filter(
    (p) => p.risk.level === "at_risk" || p.risk.level === "blocked",
  );
  const inReview = activeProjects.filter((p) => p.inReview || p.stageReviewCount > 0);
  const soon = activeProjects.filter((p) => withinDays(p.target, 14));

  return (
    <div className="space-y-8">
      <PageHero
        image={heroImage}
        eyebrow={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}.`}
        description="From keys to kickoff."
        actions={
          <>
            <Link
              to="/onboarding/my-work"
              search={{ who: "me" } as never}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <ClipboardList className="size-4" /> My work
            </Link>
            <button
              type="button"
              onClick={() => setParam({ lens: "reviews" })}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-base font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <Inbox className="size-4" /> Onboarding queue
            </button>
            <AddPropertyDialog
              disabled={readOnly}
              trigger={
                <button
                  type="button"
                  disabled={readOnly}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-base font-medium text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-50"
                >
                  <Plus className="size-4" /> Enroll property
                </button>
              }
            />
            <Link
              to="/onboarding/team"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-base font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <Users className="size-4" /> Manage Team
            </Link>
          </>
        }
      />

      <SectionCard title="Manage Onboarding" bodyClassName="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/onboarding/team">
            <Users className="mr-1.5 size-4" /> Manage Team
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/onboarding/templates">
            <Workflow className="mr-1.5 size-4" /> Manage Workflow &amp; Templates
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/onboarding" search={{ lens: "all" } as never}>
            <Home className="mr-1.5 size-4" /> Onboarding Properties
          </Link>
        </Button>
      </SectionCard>


      <SectionCard
        tone={myDecisions.length > 0 ? "critical" : "default"}
        title="Needs my decision"
        description="Gate reviews and stage captures that are yours to decide right now."
        bodyClassName="space-y-1.5"
      >
        {myDecisions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You are clear. Nothing is waiting on a decision from you.
          </p>
        ) : (
          myDecisions.map((p) => (
            <DecisionRow key={p.property.id} project={p} originToken={originToken} />
          ))
        )}
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HubTile
          value={atRisk.length}
          label="Needs attention"
          tone="attention"
          onClick={() => setParam({ lens: "attention" })}
        />
        <HubTile
          value={pendingReviews.length + inReview.filter((p) => !p.inReview).length}
          label="Handoffs & reviews waiting"
          tone="review"
          onClick={() => setParam({ lens: "reviews" })}
        />
        <HubTile
          value={activeProjects.length}
          label="Active pipeline"
          tone="progress"
          onClick={() => setParam({ lens: "pipeline" })}
        />
        <HubTile
          value={soon.length}
          label="Handoffs in 14 days"
          tone="critical"
          onClick={() => setParam({ lens: "reviews" })}
        />
      </div>

      <div className="space-y-4">
        <div className="flex justify-end">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Database className="size-4" /> Source records
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
              <SheetHeader>
                <SheetTitle>Source records</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <ExternalRecordsPanel
                  databases={data.externalDatabases as never}
                  records={data.externalRecords as never}
                  properties={data.properties}
                  syncConfigured={enabled("onboarding_external_sync")}
                  disabled={readOnly || !can("handoff_request")}
                  onResolve={(input) => resolveRecord.mutate({ data: input })}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
          {notStarted.length > 0 && (
            <section className="surface p-4">
              <p className="eyebrow">Onboarding not started ({notStarted.length})</p>
              <p className="mt-1 text-sm text-muted-foreground">
                These homes are in the pipeline but no one has set the scope yet. Open the home to
                start onboarding.
                {notStartedTestCount > 0
                  ? ` ${notStartedTestCount} QA/test home${notStartedTestCount === 1 ? " is" : "s are"} hidden — find them under Properties.`
                  : ""}
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {notStarted.map((p) => (
                  <li key={p.id}>
                    <Link
                      to="/onboarding/$propertyId"
                      params={{ propertyId: p.id }}
                      search={{ from: originToken } as never}
                      className="inline-flex rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted"
                    >
                      {p.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <DirectorHub
            projects={projects}
            viewer={{ userId, reviewCapabilities: data.reviewCapabilities }}
            originToken={originToken}
            lens={lens}
            onLensChange={(v) => setParam({ lens: v })}
            find={find}
            onFindChange={(v) => setParam({ find: v || undefined })}
            owner={owner}
            onOwnerChange={(v) => setParam({ owner: v ?? undefined })}
            showTest={showTest}
            onShowTestChange={(v) => setParam({ showTest: v ? true : undefined })}
            beforeRows={
              lens === "reviews" ? (
                <div className="space-y-3">
                  <p className="eyebrow">Handoff gate decisions ({pendingReviews.length})</p>
                  {pendingReviews.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No handoff is waiting at a review gate.
                    </p>
                  )}
                  {pendingReviews.map((h) => (
                    <HandoffGatePanel
                      key={h.id}
                      handoff={h as never}
                      reviews={data.reviews as never}
                      people={data.people}
                      propertyName={
                        data.properties.find((p) => p.id === h.property_id)?.name ?? "Property"
                      }
                      canReview={
                        !readOnly && canReviewOnboardingGate(data.reviewCapabilities, h.gate_step)
                      }
                      disabled={readOnly}
                      onDecision={(input) =>
                        reviewHandoff.mutate({ data: { handoffId: h.id, ...input } })
                      }
                    />
                  ))}
                  <p className="eyebrow pt-2">Homes in review or handing off soon</p>
                </div>
              ) : null
            }
          />
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** One compact, colourful figure that focuses the hub below. */
function HubTile({
  value,
  label,
  tone,
  onClick,
}: {
  value: number;
  label: string;
  tone: "critical" | "progress" | "attention" | "review";
  onClick: () => void;
}) {
  const plate = {
    critical: "border-coral/25 bg-coral/8 text-coral",
    progress: "border-sky/25 bg-sky/8 text-sky",
    attention: "border-amber/30 bg-amber/10 text-amber",
    review: "border-lavender/25 bg-lavender/8 text-lavender",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3.5 text-left transition-colors hover:brightness-[0.98]",
        plate,
        value === 0 && "opacity-60",
      )}
    >
      <p className="numeric text-3xl font-semibold leading-none">{value}</p>
      <p className="mt-1.5 text-sm font-medium text-foreground">{label}</p>
    </button>
  );
}

/** One home waiting on this person's decision. */
function DecisionRow({
  project: p,
  originToken,
}: {
  project: ProjectSummary;
  originToken?: string | undefined;
}) {
  const stage = lifecycleStageMeta(p.stage);
  return (
    <Link
      to="/onboarding/$propertyId"
      params={{ propertyId: p.property.id }}
      search={(originToken ? { from: originToken } : undefined) as never}
      className="surface-row relative flex flex-wrap items-center gap-x-3 gap-y-1 py-3 pl-4 pr-3"
    >
      <PropertyPhoto
        url={(p.property as { primary_photo_url?: string | null }).primary_photo_url ?? null}
        name={p.property.name}
        className="size-11"
      />
      <span className="min-w-0 flex-1 basis-full sm:basis-auto">
        <span className="block truncate text-base font-semibold">{p.property.name}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {stage.label} · {p.next.headline}
        </span>
      </span>
      <span className="numeric text-sm text-muted-foreground">
        {p.target ? `Handoff ${usDate(p.target)}` : "No target date"}
      </span>
      <ProgressRing value={p.progress} size={36} tone="onboarding" />
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
