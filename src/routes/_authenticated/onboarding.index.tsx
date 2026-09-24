import { canReviewOnboardingGate } from "@/lib/onboarding-review-capabilities";
import { onboardingWorkspaceKey } from "@/lib/onboarding-workspace-view";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ClipboardList,
  Database,
  ChevronDown,
  Plus,
  Users,
  Workflow,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingPage, PageHero, SectionCard } from "@/components/ui/page";
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
  const { can, readOnly, userId, isAdmin } = useRole();
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
      {lens === "all" ? (
        <header className="space-y-1">
          <p className="eyebrow">Onboarding</p>
          <h1 className="text-2xl font-semibold">Properties</h1>
          <p className="text-sm text-muted-foreground">
            Every onboarding home. Open one to see its Tasks, team and handoff.
          </p>
        </header>
      ) : (
        <>
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
                <Link
                  to="/onboarding/templates"
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-base font-medium text-white backdrop-blur transition-colors hover:bg-white/20"
                >
                  <Workflow className="size-4" /> Manage Workflow
                </Link>
              </>
            }
          />

          <SectionCard
            tone={myDecisions.length > 0 ? "critical" : "default"}
            title="Needs my attention"
            description="Items that need your decision or action."
            bodyClassName="space-y-1.5"
          >
            {myDecisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You are clear. Nothing needs your decision or action right now.
              </p>
            ) : (
              myDecisions.map((p) => (
                <DecisionRow key={p.property.id} project={p} originToken={originToken} />
              ))
            )}
          </SectionCard>

          <p className="text-sm text-muted-foreground">
            <span className="numeric font-semibold text-foreground">{activeProjects.length}</span> active
            {" · "}
            <span className="numeric font-semibold text-foreground">{atRisk.length}</span> need attention
            {" · "}
            <span className="numeric font-semibold text-foreground">{soon.length}</span> handoffs coming up
          </p>
        </>
      )}

      <div className="space-y-4">
        {/* Source records are an administrator reconciliation tool, not daily
            Onboarding work — only a Platform Owner sees them, and only on the
            full Properties list. */}
        {lens === "all" && isAdmin ? (
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
        ) : null}
        {lens !== "all" ? (
          <DashboardSections
            projects={activeProjects}
            originToken={originToken}
            find={find}
            onFindChange={(v) => setParam({ find: v || undefined })}
          />
        ) : (
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
        />
        )}
      </div>
    </div>
  );
}

type PropFilter = "attention" | "handoff" | "all";

/** Director dashboard: one property list plus upcoming handoffs. */
function DashboardSections({
  projects,
  originToken,
  find,
  onFindChange,
}: {
  projects: ProjectSummary[];
  originToken?: string | undefined;
  find: string;
  onFindChange: (v: string) => void;
}) {
  const [filter, setFilter] = useState<PropFilter>("all");
  const [window, setWindow] = useState<7 | 14 | 30>(14);
  const needs = (p: ProjectSummary) => p.risk.reasons.length > 0 && p.risk.level !== "on_track";
  const q = find.trim().toLowerCase();
  const rows = projects
    .filter((p) => !q || `${p.property.name} ${(p.property as { address?: string | null }).address ?? ""}`.toLowerCase().includes(q))
    .filter((p) =>
      filter === "attention" ? needs(p) : filter === "handoff" ? withinDays(p.target, 30) : true,
    )
    .sort((a, b) => Number(needs(b)) - Number(needs(a)) || (a.target ?? "9").localeCompare(b.target ?? "9"));
  const upcoming = projects
    .filter((p) => p.target && withinDays(p.target, window))
    .sort((a, b) => (a.target ?? "").localeCompare(b.target ?? ""));
  const chip = (on: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-sm transition-colors",
      on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
    );
  return (
    <div className="space-y-6">
      <SectionCard title="Onboarding properties" bodyClassName="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {([
            ["attention", "Needs attention"],
            ["handoff", "Upcoming handoff"],
            ["all", "All properties"],
          ] as const).map(([k, l]) => (
            <button key={k} type="button" className={chip(filter === k)} onClick={() => setFilter(k)}>
              {l}
            </button>
          ))}
          <input
            value={find}
            onChange={(e) => onFindChange(e.target.value)}
            placeholder="Search properties"
            aria-label="Search properties"
            className="ml-auto h-9 w-56 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No properties match.</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map((p) => (
              <PropertyRow key={p.property.id} project={p} originToken={originToken} attention={needs(p)} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Upcoming handoffs" bodyClassName="space-y-3">
        <div className="flex gap-2">
          {([7, 14, 30] as const).map((d) => (
            <button key={d} type="button" className={chip(window === d)} onClick={() => setWindow(d)}>
              Next {d} days
            </button>
          ))}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No handoffs in the next {window} days.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((p) => (
              <li key={p.property.id} className="flex items-center justify-between py-2 text-sm">
                <Link
                  to="/onboarding/$propertyId"
                  params={{ propertyId: p.property.id }}
                  search={(originToken ? { from: originToken } : undefined) as never}
                  className="font-medium hover:underline"
                >
                  {p.property.name}
                </Link>
                <span className="numeric text-muted-foreground">{usDate(p.target!)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function PropertyRow({
  project: p,
  originToken,
  attention,
}: {
  project: ProjectSummary;
  originToken?: string | undefined;
  attention: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="surface-row py-3 pl-4 pr-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PropertyPhoto
          url={(p.property as { primary_photo_url?: string | null }).primary_photo_url ?? null}
          name={p.property.name}
          className="size-11"
        />
        <Link
          to="/onboarding/$propertyId"
          params={{ propertyId: p.property.id }}
          search={(originToken ? { from: originToken } : undefined) as never}
          className="min-w-0 flex-1 basis-full sm:basis-auto"
        >
          <span className="block truncate text-base font-semibold hover:underline">{p.property.name}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {p.phaseLabel} · {p.next.headline}
          </span>
        </Link>
        <span className="text-sm text-muted-foreground">{p.owner ?? "No PM"}</span>
        <span className="numeric text-sm text-muted-foreground">
          {p.target ? `Handoff ${usDate(p.target)}` : "No target date"}
        </span>
        {attention ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-full bg-amber/15 px-2.5 py-1 text-xs font-medium text-amber"
          >
            Needs attention: {p.risk.reasons.length}
            <ChevronDown className={cn("size-3 transition-transform", open && "rotate-180")} />
          </button>
        ) : (
          <span className="rounded-full bg-sage/15 px-2.5 py-1 text-xs font-medium text-sage">On track</span>
        )}
        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
      </div>
      {open && (
        <ul className="mt-2 list-disc space-y-0.5 pl-16 text-sm text-muted-foreground">
          {p.risk.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
