import { formatPropertyLabel, matchesPropertySearch } from "@/lib/property-label";
import { canReviewOnboardingGate } from "@/lib/onboarding-review-capabilities";
import { onboardingWorkspaceKey } from "@/lib/onboarding-workspace-view";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Database, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingPage, SectionCard } from "@/components/ui/page";
import { needsMyAttention } from "@/lib/onboarding-hub";
import heroImage from "@/assets/hero-arha-property.jpg";
import { bannerCaption, dailyHomePhoto } from "@/lib/daily-home-photo";
import {
  centralHour,
  centralToday,
  dueLabel,
  firstNameOf,
  greetingFor,
  handoffDate,
  healthFor,
  sixStageFor,
  stepperFor,
  todayForMe,
  type BoardTask,
} from "@/lib/onboarding-board";
import { canQuickComplete } from "@/lib/onboarding-work-views";
import { taskViewsFor } from "@/lib/onboarding-task-views";
import { taskPayload } from "@/components/onboarding/TaskDrawer";
import {
  OnboardingBoardHome,
  BOARD_VIEWS,
  type BoardHome,
  type BoardView,
  type NeedRow,
  type TodayHome,
} from "@/components/onboarding/board/OnboardingBoardHome";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalRecordsPanel } from "@/components/onboarding/ExternalRecordsPanel";
import { DirectorHub, type Lens } from "@/components/onboarding/DirectorHub";
import { AddPropertyDialog } from "@/components/property/AddPropertyDialog";
import { canAddHome } from "@/lib/property-page";

import { useRole } from "@/hooks/useRole";
import { useWorkspaceOrigin } from "@/components/nav/NavContext";
import { useFeatureFlags } from "@/lib/feature-flags";
import { summarizeProject, type ProjectProperty } from "@/lib/onboarding-lifecycle";
import { type WorkflowTask } from "@/lib/onboarding-workflow";
import { projectScope, splitByScope } from "@/lib/onboarding-scope";
import { applyTestDataFilter } from "@/lib/test-data";
import {
  getOnboardingWorkspace,
  resolveExternalRecordFn,
  saveOnboardingTaskFn,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/_authenticated/onboarding/")({
  head: () => ({
    meta: [
      { title: "Onboarding Home: Resolve" },
      {
        name: "description",
        content:
          "Today's onboarding work, what needs you now, every home in onboarding by stage, status and handoff, and the handoffs coming up.",
      },
      { property: "og:title", content: "Onboarding Home: Resolve" },
      {
        property: "og:description",
        content:
          "Every home in onboarding in one place: gallery, active projects, status, Gantt and work load.",
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
    if (typeof raw["view"] === "string" && BOARD_VIEWS.some((v) => v.value === raw["view"]))
      out.view = raw["view"] as BoardView;
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
  /** The Homes in onboarding view; Gallery when absent. */
  view?: BoardView | undefined;
};

function Hub() {
  const load = useServerFn(getOnboardingWorkspace);
  const qc = useQueryClient();
  const { can, readOnly, userId, isAdmin, roles, isOnboardingDirector } = useRole();
  const mayAddHome = canAddHome({ roles, onboardingDirector: isOnboardingDirector, readOnly });
  const { enabled } = useFeatureFlags();
  const { token: originToken } = useWorkspaceOrigin("Onboarding hub");
  const navigate = Route.useNavigate();
  const params = Route.useSearch();
  const lens = params.lens ?? "attention";
  const find = params.find ?? "";
  const owner = params.owner ?? null;
  const showTest = params.showTest === true;
  const view: BoardView = params.view ?? "gallery";
  const [bannerFailed, setBannerFailed] = useState(false);
  const setParam = (patch: HubSearch) =>
    void navigate({
      search: (prev: HubSearch) => {
        const next: HubSearch = { ...prev, ...patch };
        if (!next.lens || next.lens === "attention") delete next.lens;
        if (!next.find) delete next.find;
        if (!next.owner) delete next.owner;
        if (!next.showTest) delete next.showTest;
        if (!next.view || next.view === "gallery") delete next.view;
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
        .select("first_name, full_name")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const firstName = firstNameOf(me);

  // Ticking a Task on Today, for me is the same save My Tasks makes.
  const saveTask = useMutation({
    mutationFn: useServerFn(saveOnboardingTaskFn) as never,
    onSuccess: () => {
      toast.success("Task done.");
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

  const projectRows = useMemo(() => {
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
        return { summary: summarizeProject(
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
        ), project, inScope: scoped.inScope };
      });
  }, [data]);
  const projects = useMemo(() => projectRows.map((r) => r.summary), [projectRows]);

  const today = centralToday();
  const allTasks = (data?.tasks ?? []) as unknown as (WorkflowTask & BoardTask)[];

  if (isLoading || !data) return <LoadingPage />;

  const label = (id: string) => {
    const p = data.properties.find((x) => x.id === id);
    return p ? formatPropertyLabel(p).primary : "A home";
  };

  // Today, for me: the person's own Tasks due today and overdue, grouped by home.
  const mineViews = taskViewsFor(
    data as never,
    allTasks,
    allTasks.filter((t) => userId && t.assigned_to === userId),
  );
  const viewById = new Map(mineViews.map((v) => [v.task.id, v]));
  const todayList = todayForMe(
    mineViews.map((v) => v.task as unknown as BoardTask),
    userId,
    today,
  );
  const stageOf = (propertyId: string) => {
    const row = projectRows.find((r) => r.summary.property.id === propertyId);
    if (row) return stepperFor(row.inScope as unknown as BoardTask[]).currentStage;
    const ctx = data.assignedWorkContexts.find((c) => c.propertyId === propertyId);
    const own = (ctx?.tasks ?? []) as unknown as BoardTask[];
    return own.length ? stepperFor(own).currentStage : sixStageFor(own[0]?.stage) ?? "";
  };
  const todayHomes: TodayHome[] = todayList.groups.map((g) => ({
    propertyId: g.propertyId,
    address: label(g.propertyId),
    stage: stageOf(g.propertyId),
    rows: g.tasks.map((t) => {
      const v = viewById.get(t.id);
      return {
        id: t.id,
        title: t.title,
        label: dueLabel(t, today),
        canTick: Boolean(v && canQuickComplete(v) && !readOnly),
      };
    }),
  }));
  const tick = (taskId: string) => {
    const v = viewById.get(taskId);
    if (!v) return;
    saveTask.mutate({ data: taskPayload(v.task, { status: "complete", blocker: "" }) } as never);
  };

  const greetingLine = `${greetingFor(centralHour())}${firstName ? `, ${firstName}` : ""}.`;
  const dateLine = new Date().toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const addHome = (
    <>
      {mayAddHome ? (
    <AddPropertyDialog
      disabled={readOnly}
      trigger={
        <button
          type="button"
          disabled={readOnly}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-base font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-4" /> Add a home
        </button>
      }
    />
      ) : null}
    </>
  );

  // The homes on the board: every active onboarding home this person may see.
  const scopedRows = applyTestDataFilter(projectRows, showTest, (r) => r.summary.property);
  const activeRows = scopedRows.filter((r) => r.summary.stage !== "live");
  const viewer = { userId, reviewCapabilities: data.reviewCapabilities };
  const isDirector = Boolean(
    data.reviewCapabilities.can_review_stages || data.reviewCapabilities.kati_review,
  );
  const homes: BoardHome[] = activeRows
    .map((r) => {
      const p = r.summary.property as ProjectProperty & {
        city?: string | null;
        primary_photo_url?: string | null;
        actual_closing_on?: string | null;
      };
      const pr = (r.project ?? {}) as {
        owner_type?: string | null;
        greater_area?: string | null;
        pma_status?: string | null;
        invoice_status?: string | null;
        project_status?: string | null;
        committed_handoff_on?: string | null;
      };
      const handoffOn = handoffDate(pr.committed_handoff_on, r.summary.target);
      return {
        propertyId: p.id,
        address: formatPropertyLabel(p).primary,
        city: p.city ?? "",
        photo: p.primary_photo_url ?? null,
        stepper: stepperFor(r.inScope as unknown as BoardTask[]),
        ownerType: pr.owner_type ?? null,
        greaterArea: pr.greater_area ?? null,
        pmaStatus: pr.pma_status ?? null,
        invoiceStatus: pr.invoice_status ?? null,
        status: pr.project_status ?? null,
        projectManager: r.summary.owner,
        closingOn: p.actual_closing_on ?? p.planned_closing_on ?? null,
        estimateOn: r.summary.target,
        committedOn: pr.committed_handoff_on ?? null,
        handoffOn,
        health: healthFor({
          risk: r.summary.risk,
          handoffOn,
          accepted: r.summary.accepted,
          today,
        }),
      };
    })
    .sort((a, b) => (a.handoffOn ?? "9").localeCompare(b.handoffOn ?? "9"));

  // Needs you now: reviews waiting on this person, their late Tasks, and for
  // the Director the homes already at risk or with corrections open.
  const attention = needsMyAttention(
    activeRows.map((r) => r.summary),
    data.tasks as never,
    viewer,
    isDirector,
    today,
  );
  const needs: NeedRow[] = [
    ...attention.mine.map((r) => ({
      key: `m-${r.project.property.id}`,
      title: formatPropertyLabel(r.project.property).primary,
      why: [
        r.review ? "A review is waiting on you" : null,
        r.overdueTasks ? `${r.overdueTasks} of your tasks overdue` : null,
      ]
        .filter(Boolean)
        .join(", "),
      propertyId: r.project.property.id,
    })),
    ...attention.oversight.map((r) => ({
      key: `o-${r.project.property.id}`,
      title: formatPropertyLabel(r.project.property).primary,
      why: r.reasons.join(", "),
      propertyId: r.project.property.id,
    })),
  ];

  // The banner: a home in onboarding with a photo, the same one for everyone today.
  const bannerHome = bannerFailed
    ? null
    : dailyHomePhoto(
        homes.map((h) => ({ id: h.propertyId, photo: h.photo ?? "", name: h.address, city: null })),
        new Date(),
      );

  const assignedHomes = applyTestDataFilter(data.properties, false, (p) => p)
    .map((p) => ({
      id: p.id,
      name: formatPropertyLabel(p).primary,
      open: data.tasks.filter(
        (t) => t.property_id === p.id && t.status !== "complete" && t.assigned_to === userId,
      ).length,
    }))
    .filter((h) => h.open > 0);
  // All properties, for someone who only works assigned Tasks: their own homes only.
  if (lens === "all" && data.workspaceMode === "assigned")
    return <AssignedOverview lens="all" firstName={firstName} homes={assignedHomes} />;

  if (lens !== "all")
    return (
      <OnboardingBoardHome
        today={today}
        dateLine={dateLine}
        greeting={greetingLine}
        banner={bannerHome ? { photo: bannerHome.photo, caption: bannerCaption(bannerHome) } : null}
        fallbackImage={heroImage}
        onBannerError={() => setBannerFailed(true)}
        addHome={addHome}
        countLine={todayList.countLine}
        todayHomes={todayHomes}
        onTick={tick}
        ticking={saveTask.isPending}
        needs={needs}
        homes={homes}
        view={view}
        onViewChange={(v) => setParam({ view: v })}
        originToken={originToken}
        homesOverride={
          data.workspaceMode === "assigned" ? (
            <AssignedHomes homes={assignedHomes} />
          ) : undefined
        }
      />
    );

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="eyebrow">Onboarding</p>
        <h1 className="text-2xl font-semibold">Properties</h1>
        <p className="text-sm text-muted-foreground">
          Every onboarding home. Open one to see its Tasks, team and handoff.
        </p>
      </header>

      <div className="space-y-4">
        {/* Source records are an administrator reconciliation tool, not daily
            Onboarding work — only an Admin sees them, and only on the
            full Properties list. */}
        {isAdmin ? (
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
        {(
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

/** The homes where someone who only works assigned Tasks has work. */
function AssignedHomes({ homes }: { homes: { id: string; name: string; open: number }[] }) {
  if (homes.length === 0)
    return <p className="text-sm text-muted-foreground">You have no onboarding tasks right now.</p>;
  return (
    <ul className="divide-y divide-border" aria-label="Where you have work">
      {homes.map((h) => (
        <li key={h.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
          <span className="font-medium">{h.name}</span>
          <Link
            to="/onboarding/my-work"
            search={{ who: "me", home: h.id } as never}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {h.open} open task{h.open === 1 ? "" : "s"}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function greeting() {
  return greetingFor(centralHour());
}

/** Dashboard / Properties for Onboarding staff who only work assigned Tasks. */
function AssignedOverview({
  lens,
  firstName,
  homes,
}: {
  lens: "all" | "dashboard";
  firstName: string | null | undefined;
  homes: { id: string; name: string; open: number }[];
}) {
  const open = homes.reduce((n, h) => n + h.open, 0);
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="eyebrow">Onboarding</p>
        <h1 className="text-2xl font-semibold">
          {lens === "all" ? "Properties" : `${greeting()}${firstName ? `, ${firstName}` : ""}.`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lens === "all"
            ? "The onboarding homes where you have Tasks. Open one to work its Tasks."
            : `You have ${open} open Task${open === 1 ? "" : "s"} across ${homes.length} home${homes.length === 1 ? "" : "s"}.`}
        </p>
      </header>
      <SectionCard title={lens === "all" ? "My homes" : "Where you have work"}>
        {homes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have no onboarding Tasks assigned right now. New assignments will appear here and in
            My Work.
          </p>
        ) : (
          <ul className="divide-y">
            {homes.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium">{h.name}</span>
                <Link
                  to="/onboarding/my-work"
                  search={{ who: "me", home: h.id } as never}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {h.open} open Task{h.open === 1 ? "" : "s"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <Link
        to="/onboarding/my-work"
        search={{ who: "me" } as never}
        className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        Go to My Work
      </Link>
    </div>
  );
}
