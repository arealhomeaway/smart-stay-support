import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Clock,
  Download,
  Home as HomeIcon,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import { participationEvidenceUrlFn } from "@/lib/owner-evidence.functions";
import { EmptyState, LoadingPage, PageHero, ProgressRing, SectionCard } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Celebrate } from "@/components/ui/feedback";
import { useRole } from "@/hooks/useRole";
import { usCalendarDate, usDate, usDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { answerOwnerReview, ownerHome, ownerHomePreview } from "@/lib/owner-portal.functions";
import { OWNER_GOAL_LABEL } from "@/lib/owner-participation";
import { LogTimeContext, LogTimeDialog, useOpenLogTime, type LogTimeAnchor } from "@/components/owner/LogTimeDialog";
import { OwnerOpportunities } from "@/components/owner/OwnerOpportunities";
import { OwnerQueueCards } from "@/components/owner/OwnerQueueCards";
import { isOwnerQueue, type OwnerQueue } from "@/lib/owner-opportunity-filters";
import { captureReviewedOpportunity, captureReviewedResponse } from "@/lib/owner-reviewed-update";
import { ownerTicketResponseGuidance } from "@/lib/owner-ticket-intent";
import { OwnerApprovalPanel } from "@/components/OwnerApprovalPanel";
import { OnboardingActions } from "@/components/owner/OnboardingActions";
import { StrReportPanel } from "@/components/owner/StrReportPanel";
import { OwnerTaskDialog, taskDeadlineLabel } from "@/components/owner/OwnerTaskDialog";
import { ownerOnboardingActions } from "@/lib/owner-onboarding.functions";
import type { OwnerOnboardingAction } from "@/lib/owner-onboarding.server";
import { ownerReviewPresentation } from "@/lib/owner-review-presentation";
import type { OwnerTicketRequest } from "@/lib/owner-ticket-authority";
import { ArhaContacts } from "@/components/owner/ArhaContacts";
import { AfterDayNinety } from "@/components/owner/AfterDayNinety";
import { JAMES, contactsFor, contactPhaseFor } from "@/lib/arha-contacts";
import { ownerContacts } from "@/lib/owner-contacts.functions";
import { OwnerFilesPanel, useOwnerDocuments } from "@/components/OwnerFilesPanel";
import { OnboardingProgress } from "@/components/owner/OnboardingProgress";
import { ownerReportFile } from "@/lib/owner-report.functions";
import { saveOwnerReportFile } from "@/lib/owner-report-download";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOwnerPreview } from "@/lib/owner-preview";
import { useDemo } from "@/components/DemoProvider";

export const Route = createFileRoute("/_authenticated/owner")({
  // Homeowners with more than one home switch between them here, so the chosen
  // home lives in the URL and stays shareable and bookmarkable.
  validateSearch: (
    search: Record<string, unknown>,
  ): { home?: string; view?: "documents" | "team" | "opportunities"; opportunity?: string; queue?: OwnerQueue } => ({
    ...(isOwnerQueue(search["queue"]) ? { queue: search["queue"] } : {}),
    ...(typeof search["home"] === "string" ? { home: search["home"] as string } : {}),
    ...(search["view"] === "documents" || search["view"] === "team" || search["view"] === "opportunities" ? { view: search["view"] } : {}),
    ...(typeof search["opportunity"] === "string" ? { opportunity: search["opportunity"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Your home — Resolve" },
      {
        name: "description",
        content: "Your participation, your homes, and what needs your attention — in one place.",
      },
    ],
  }),
  component: OwnerHub,
});

type Review = {
  owner_update_revision?: number | null;
  id: string;
  phase: string;
  auto_ticket?: boolean;
  owner_request?: OwnerTicketRequest;
  responded_at?: string | null;
  owner_response?: string | null;
  updated_at?: string;
  title: string;
  recommendation: string | null;
  business_question: string | null;
  respond_by: string | null;
  status: string;
  owner_action_type: string | null;
  ticket_id: string | null;
  propertyIds: string[];
};

/** Company suffixes: an entity name is never used to greet a person. */
const ENTITY_WORDS = /\b(llc|l\.l\.c|inc|incorporated|corp|co|company|ltd|limited|trust|holdings|properties|partners|group|enterprises|solutions|rentals|realty|investments|lp|llp)\b/i;

/**
 * The homeowner's own first name. The owner record is often an entity
 * ("VP Housing Solutions LLC"), whose first word reads as initials, so the
 * signed-in person's own name wins whenever we have it.
 */
function firstName(...candidates: (string | null | undefined)[]) {
  for (const candidate of candidates) {
    const name = (candidate ?? "").trim();
    if (!name || ENTITY_WORDS.test(name)) continue;
    const first = name.split(/\s+/)[0] ?? "";
    // Two-letter all-caps reads as initials, not a name.
    if (first.length < 2 || /^[A-Z]+$/.test(first)) continue;
    return first;
  }
  return "there";
}

function OwnerHub() {
  const { user } = Route.useRouteContext();
  const { ownerPreview } = useOwnerPreview();
  const { demoMode } = useDemo();
  const load = useServerFn(ownerHome);
  const loadPreview = useServerFn(ownerHomePreview);
  // In demo mode the homeowner portal always opens the demo home, so staff can
  // walk the homeowner experience instead of hitting the "no home linked" wall.
  const previewing = Boolean(ownerPreview) || demoMode;
  const { isStaff: isStaffViewer } = useRole();

  const home = useQuery({
    queryKey: [
      "owner-home",
      user.id,
      previewing ? "preview" : "owner",
      ownerPreview?.programId ?? (demoMode ? "demo" : null),
    ],
    queryFn: () =>
      previewing
        ? loadPreview({
            data: { programId: ownerPreview?.programId ?? null, demo: !ownerPreview && demoMode },
          })
        : load(),
  });

  if (home.isLoading) return <LoadingPage tiles={4} />;
  if (!home.data || !home.data.linked) {
    // Staff land here by clicking around; tell them where their own view is
    // rather than leaving them on a homeowner's empty screen.
    if (isStaffViewer) {
      return (
        <EmptyState
          title="You are looking at the homeowner portal."
          hint="This screen only fills in for a homeowner whose account is linked to a home. The program-wide view for staff is Active Owner program oversight."
          icon={<HomeIcon className="size-8" />}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/owner-oversight">Open program oversight</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/owner-programs">Program admin</Link>
              </Button>
            </div>
          }
        />
      );
    }
    return (
      <EmptyState
        title="No home is linked to your account yet."
        hint="Once ARHA links your account to a property, your participation, homes and reports appear here."
        icon={<HomeIcon className="size-8" />}
      />
    );
  }

  return (
    <OwnerHubBody
      key={`${user.id}:${home.data.program.id}:${previewing}`}
      data={home.data}
      preview={previewing}
    />
  );
}

function OwnerHubBody({
  data,
  preview,
}: {
  data: Extract<Awaited<ReturnType<typeof loadHome>>, { linked: true }>;
  preview: boolean;
}) {
  const { user } = Route.useRouteContext();
  const signedInName =
    typeof user.user_metadata?.["full_name"] === "string"
      ? (user.user_metadata["full_name"] as string)
      : null;
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["owner-home"] });
    void qc.invalidateQueries({ queryKey: ["owner-report"] });
  };

  const { program, properties, reviews, badges, alerts, tickets, snapshot } = data;

  const { home: homeParam } = Route.useSearch();
  const selectedHomeId =
    homeParam && properties.some((p) => p.propertyId === homeParam) ? homeParam : null;
  const scopedProperties = selectedHomeId
    ? properties.filter((p) => p.propertyId === selectedHomeId)
    : properties;
  // A home-specific view keeps program-wide items: they still affect this home.
  const inScope = (review: Review) =>
    !selectedHomeId || review.propertyIds.length === 0 || review.propertyIds.includes(selectedHomeId);

  const openReviews = (reviews as Review[])
    .filter((r) => ownerReviewPresentation(r).attention)
    .filter(inScope);
  const availableReviews = (reviews as Review[])
    .filter((r) => r.auto_ticket && !ownerReviewPresentation(r).attention)
    .filter(inScope);
  const heroPhoto = properties.find((p) => p.photoUrl)?.photoUrl ?? undefined;

  /**
   * Homeowners think per home, so the attention list is grouped by the home it
   * belongs to. Items covering the whole program keep their own group.
   */
  const attentionGroups = useMemo(() => {
    const groups: { key: string; name: string; reviews: Review[] }[] = [];
    const push = (key: string, name: string, review: Review) => {
      const found = groups.find((g) => g.key === key);
      if (found) found.reviews.push(review);
      else groups.push({ key, name, reviews: [review] });
    };
    for (const review of openReviews) {
      const ids = properties.filter((p) => review.propertyIds.includes(p.propertyId));
      if (ids.length === 1 && ids[0]) push(ids[0].propertyId, ids[0].name, review);
      else if (ids.length > 1) push("multi", ids.map((p) => p.name).join(" · "), review);
      else push("program", "All your homes", review);
    }
    return groups;
  }, [openReviews, properties]);

  // The Welcome Packet's six milestones, positioned from signals ARHA already
  // tracks on each enrolled home.
  const included = properties.filter((p) => p.inclusionStatus === "included");
  const journeyHomes = (included.length ? included : properties).map((p) => ({
    name: p.name,
    closingConfirmed: p.closingConfirmed ?? null,
    onboardingStatus: p.onboardingStatus ?? null,
    launchStatus: p.launchStatus ?? null,
  }));
  const loadContacts = useServerFn(ownerContacts);
  const contactsQuery = useQuery({
    queryKey: ["owner-contacts", program.id, preview],
    queryFn: () => loadContacts({ data: { programId: program.id, preview } }),
  });
  const handedOff =
    journeyHomes.length > 0 &&
    journeyHomes.every((h) =>
      ["ready", "launching", "launched", "live"].includes((h.launchStatus ?? "").toLowerCase()),
    );
  const contacts =
    contactsQuery.data ??
    contactsFor(
      contactPhaseFor({
        completedAt: program.completedAt ?? null,
        status: program.status,
        handedOff,
      }),
    );
  const closeoutVisible = Boolean(program.completedAt) || snapshot.daysLeft <= 30;

  // Participation time only counts once the program itself has started, so the
  // portal says so plainly instead of letting the homeowner hit a refusal.
  const canLogHours =
    !preview &&
    ["active", "target_reached"].includes(program.status) &&
    Boolean(program.startedOn);
  const logHoursBlockedReason = canLogHours
    ? null
    : program.completedAt
      ? "Your program closed on December 31, so no further hours can be added."
      : "Your Active Owner program has not started yet. Hours can be logged as soon as your ARHA team activates it — usually at closing.";

  // The onboarding task behind an attention item carries the instructions,
  // links and shared files the homeowner needs to actually work it.
  const loadOnboarding = useServerFn(ownerOnboardingActions);
  const onboardingQuery = useQuery({
    queryKey: ["owner-onboarding", preview ? program.id : null, preview],
    queryFn: () => loadOnboarding({ data: { programId: preview ? program.id : null, preview } }),
  });
  const actionByReview = useMemo(() => {
    const map = new Map<string, OwnerOnboardingAction>();
    const all = [...(onboardingQuery.data?.pending ?? []), ...(onboardingQuery.data?.decided ?? [])];
    for (const action of all) {
      if (action.participation?.reviewId) map.set(action.participation.reviewId, action);
    }
    return map;
  }, [onboardingQuery.data]);

  // "Log hours" records whatever the homeowner did on their own initiative:
  // a meeting, a phone call, research or an errand for their home.
  const [heroLogOpen, setHeroLogOpen] = useState(false);
  const [heroLogActivity, setHeroLogActivity] = useState("");
  const [heroLogAnchor, setHeroLogAnchor] = useState<LogTimeAnchor | null>(null);
  const [logKey, setLogKey] = useState(0);
  const [logAfter, setLogAfter] = useState<(() => void) | null>(null);
  const [logHomes, setLogHomes] = useState<string[]>([]);
  // The page's single Log time window; every button opens this one.
  const openLogTime = (opts?: { anchor?: LogTimeAnchor | null; activity?: string; propertyId?: string | null; onDone?: () => void }) => {
    setHeroLogAnchor(opts?.anchor ?? null);
    setLogHomes(opts?.propertyId ? [opts.propertyId] : []);
    setHeroLogActivity(opts?.activity ?? "");
    setLogAfter(() => opts?.onDone ?? null);
    setLogKey((k) => k + 1);
    setHeroLogOpen(true);
  };
  const ownerPhase: "onboarding" | "ongoing" =
    program.status === "ready_for_onboarding" ||
    program.status === "draft" ||
    openReviews.some((r) => r.phase === "onboarding")
      ? "onboarding"
      : "ongoing";
  const openManualLog = (activity: string, propertyId: string | null = null) => openLogTime({ activity, propertyId });

  const percent = snapshot.percentOfTarget;
  const targetReached =
    snapshot.state === "target_reached" || snapshot.state === "program_completed";

  const homeName = (id: string | null | undefined) =>
    properties.find((p) => p.propertyId === id)?.name ?? null;
  const docs = useOwnerDocuments();
  const inHome = (ids: (string | null | undefined)[]) =>
    !selectedHomeId || ids.includes(selectedHomeId);
  const propertyLabel = (ids: (string | null | undefined)[]) => {
    const names = ids.map(homeName).filter(Boolean) as string[];
    return names.length ? names.join(" · ") : properties.length > 1 ? "All your homes" : properties[0]?.name ?? "";
  };

  // Recent activity: what happened, always labelled with the home it belongs to.
  const activity = useMemo(() => {
    type Item = { id: string; at: string; property: string; label: string; entryId?: string; files?: number };
    const items: Item[] = [
      ...data.entries
        .filter((e) => !e.superseded && inHome(e.propertyIds))
        .map((e) => ({
          id: `entry-${e.id}`,
          at: e.entry_date,
          property: propertyLabel(e.propertyIds),
          label: `Logged ${Math.round((e.minutes / 60) * 100) / 100} hours — ${e.activity}`,
          entryId: e.id,
          files: attachmentCount(e),
        })),
      ...(docs.data?.files ?? [])
        .filter((f) => f.uploaded_by_name === "You" && inHome([f.property_id]))
        .map((f) => ({
          id: `file-${f.id}`,
          at: f.uploaded_at ?? f.created_at,
          property: propertyLabel([f.property_id]),
          label: `Uploaded ${f.title}`,
        })),
      ...tickets
        .filter((t) => t.status === "closed" && inHome([t.property_id]))
        .map((t) => ({
          id: `ticket-${t.id}`,
          at: t.reported_at,
          property: propertyLabel([t.property_id]),
          label: `Completed: ${t.title}`,
        })),
      ...(reviews as Review[])
        .filter((r) => r.responded_at && (r.propertyIds.length === 0 || inHome(r.propertyIds)))
        .map((r) => ({
          id: `review-${r.id}`,
          at: r.responded_at as string,
          property: propertyLabel(r.propertyIds),
          label: `You responded: ${r.title}`,
        })),
    ];
    return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.entries, docs.data, tickets, reviews, selectedHomeId, properties]);

  const ownerHomes = properties.map((p) => ({ propertyId: p.propertyId, name: p.name, address: (p as { address?: string | null }).address ?? null }));
  const navigate = Route.useNavigate();
  // Same data OnboardingActions renders: keeps one consistent empty state.
  const onboardingPending = (onboardingQuery.data?.pending ?? []).filter(
    (a) => !selectedHomeId || !a.propertyId || a.propertyId === selectedHomeId,
  ).length;
  const search = Route.useSearch();
  const view = search.view ?? "home";

  return (
    <LogTimeContext.Provider value={preview ? null : openLogTime}>
    <div className="space-y-6">
      {preview ? (
        <StatusBadge tone="review">Preview only — staff view, read-only</StatusBadge>
      ) : null}

      <PageHero
        image={heroPhoto}
        eyebrow="Active Owner"
        title={`Welcome back, ${firstName(signedInName, program.ownerName)}`}
        description="Here is where things stand across your homes, and anything that needs your attention."
        aside={
          <div className="rounded-2xl border border-border bg-card/95 p-5 shadow-sm">
            <p className="eyebrow mb-3">Active Owner Participation</p>
            <div className="flex items-center gap-4">
              <ProgressRing value={percent} tone="owner" label="of target" />
              <div className="min-w-0">
                <p className="text-2xl font-semibold leading-none">{snapshot.reportedHours} hrs</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  reported toward {OWNER_GOAL_LABEL.toLowerCase()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Program period ends {snapshot.endsOn ? usDate(snapshot.endsOn) : "December 31"}
                </p>
                {properties.filter((p) => p.inclusionStatus === "included" && p.windowStart).length > 1 ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground" aria-label="Hours counted per home">
                    {properties
                      .filter((p) => p.inclusionStatus === "included" && p.windowStart)
                      .map((p) => (
                        <li key={p.propertyId}>
                          {p.name}: {Math.round((p.windowMinutes / 60) * 10) / 10} hrs (from {usDate(p.windowStart!)})
                        </li>
                      ))}
                    <li>Homes overlap — your total counts each activity once.</li>
                  </ul>
                ) : null}
                {preview ? null : <ReportDownloads />}
              </div>
            </div>
          </div>
        }
        actions={
          preview || !canLogHours ? null : (
            <Button onClick={() => openManualLog("")}>
              <Clock className="size-4" aria-hidden="true" /> Log hours
            </Button>
          )
        }
      />

      <LogTimeDialog
        key={logKey}
        open={heroLogOpen}
        onOpenChange={setHeroLogOpen}
        programId={program.id}
        anchor={heroLogAnchor}
        defaultActivity={heroLogActivity}
        defaultPropertyIds={logHomes}
        phase={ownerPhase}
        properties={properties
          .filter(
            (p) =>
              p.inclusionStatus === "included" &&
              p.closingConfirmed &&
              !!p.closingDate &&
              p.closingDate <= new Date().toISOString().slice(0, 10),
          )
          .map((p) => ({ id: p.propertyId, name: p.name }))}
        onDone={() => {
          logAfter?.();
          invalidate();
        }}
      />

      {!preview && logHoursBlockedReason ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm" role="status">
          <p className="font-medium">Logging hours is not open yet</p>
          <p className="mt-1 text-muted-foreground">{logHoursBlockedReason}</p>
        </div>
      ) : null}

      {targetReached ? (
        <Celebrate title="You've reached at least 100 hours of reported participation.">
          Thank you for the time you've put in. Your final report will be ready when your program closes on
          December 31.
        </Celebrate>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-4">
        {properties.length > 1 ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="owner-home-filter" className="text-sm text-muted-foreground">Viewing:</Label>
            <Select
              value={selectedHomeId ?? "all"}
              onValueChange={(v) =>
                void navigate({ search: (prev) => { const { home: _h, ...rest } = prev; return v === "all" ? rest : { ...rest, home: v }; } })
              }
            >
              <SelectTrigger id="owner-home-filter" className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Homes</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.propertyId} value={p.propertyId}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {view === "documents" ? (
        <OwnerFilesPanel homes={ownerHomes} selectedHomeId={selectedHomeId} readOnly={preview} />
      ) : view === "opportunities" ? (
        <OwnerOpportunities
          variant="full"
          queue={search.queue ?? null}
          onQueueChange={(q) => void navigate({ search: (prev) => { const { queue: _q, ...rest } = prev; return q ? { ...rest, queue: q } : rest; } })}
          onBackToDashboard={() => void navigate({ search: (prev) => { const { queue: _q, view: _v, opportunity: _o, ...rest } = prev; return rest; } })}
          focusId={search.opportunity ?? null}
          homes={ownerHomes}
          selectedHomeId={selectedHomeId}
          readOnly={preview}
          blockedReason={preview ? null : logHoursBlockedReason}
          {...(preview || logHoursBlockedReason ? {} : { onLogHours: openManualLog })}
        />
      ) : view === "team" ? (
        <ArhaContacts
          contacts={contacts}
          supports={selectedHomeId ? homeName(selectedHomeId) ?? "This home" : properties.length > 1 ? `All your homes: ${properties.map((p) => p.name).join(", ")}` : properties[0]?.name ?? null}
        />
      ) : (
        <>
      <OwnerQueueCards
        homes={ownerHomes}
        selectedHomeId={selectedHomeId}
        onOpen={(q) => void navigate({ search: (prev) => { const { opportunity: _o, ...rest } = prev; return { ...rest, view: "opportunities" as const, queue: q }; } })}
      />

      <div id="owner-decisions" className="scroll-mt-24">
      <SectionCard
        title="Decisions & approvals"
        description="Approvals and property decisions your ARHA team has sent you."
      >
        <div className="space-y-5">
        {openReviews.length > 0 && (
          <div className="space-y-5">
            {attentionGroups.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{group.name}</h3>
                  <span className="numeric rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {group.reviews.length}
                  </span>
                </div>
                {group.reviews.map((r) => (
                  <ReviewRow
                    key={r.id}
                    review={r}
                    properties={properties}
                    programId={program.id}
                    onDone={invalidate}
                    readOnly={preview}
                    action={actionByReview.get(r.id) ?? null}
                    canLogHours={canLogHours}
                    logHoursBlockedReason={logHoursBlockedReason}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        <OnboardingActions readOnly={preview} programId={preview ? program.id : null} homeId={selectedHomeId} />
        <OwnerApprovalPanel readOnly={preview} embedded hasOtherItems={openReviews.length > 0 || onboardingPending > 0} />
        </div>
      </SectionCard>
      </div>

      <OwnerOpportunities
        variant="preview"
        onViewAll={() => void navigate({ search: (prev) => { const { queue: _q, ...rest } = prev; return { ...rest, view: "opportunities" as const }; } })}
        focusId={search.opportunity ?? null}
        homes={ownerHomes}
        selectedHomeId={selectedHomeId}
        readOnly={preview}
        blockedReason={preview ? null : logHoursBlockedReason}
        {...(preview || logHoursBlockedReason ? {} : { onLogHours: openManualLog })}
        arhaExtra={
          availableReviews.length ? (
            <div className="space-y-3">
              {availableReviews.map((r) => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  properties={properties}
                  programId={program.id}
                  onDone={invalidate}
                  readOnly={preview}
                  action={actionByReview.get(r.id) ?? null}
                  canLogHours={canLogHours}
                  logHoursBlockedReason={logHoursBlockedReason}
                />
              ))}
            </div>
          ) : undefined
        }
      />

      <OnboardingProgress
        readOnly={preview}
        programId={preview ? program.id : null}
        homeId={selectedHomeId}
        phaseFor={(id) => {
          const p = properties.find((x) => x.propertyId === id);
          return p ? titleCase(p.onboardingStatus) : null;
        }}
      />

      {closeoutVisible && (
        <AfterDayNinety
          daysLeft={Math.max(0, snapshot.daysLeft)}
          completed={Boolean(program.completedAt)}
          primaryContact={contacts.primary ?? JAMES}
        />
      )}

      <SectionCard title="Recent activity">
        {activity.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="numeric text-xs text-muted-foreground">
                    {usCalendarDate(a.at.slice(0, 10))} · <span className="font-medium text-foreground">{a.property}</span>
                  </p>
                  <p className="mt-0.5">{a.label}</p>
                </div>
                {a.entryId && a.files ? (
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: a.files }, (_, i) => (
                      <EvidenceLink key={`${a.id}-${i}`} entryId={a.entryId!} index={i} label={a.files! > 1 ? `File ${i + 1}` : "View attachment"} />
                    ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <StrReportPanel />
        </>
      )}
    </div>
    </LogTimeContext.Provider>
  );
}

/** PDF / CSV of the homeowner's own hours — kept, without a dashboard card. */
function ReportDownloads() {
  const fetchFile = useServerFn(ownerReportFile);
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const download = async (format: "pdf" | "csv") => {
    setBusy(format);
    try {
      saveOwnerReportFile(await fetchFile({ data: { format } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the report");
    } finally {
      setBusy(null);
    }
  };
  return (
    <p className="mt-2 flex gap-3 text-xs">
      <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" disabled={busy !== null} onClick={() => void download("pdf")}>
        <Download className="size-3.5" aria-hidden="true" /> Report (PDF)
      </button>
      <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" disabled={busy !== null} onClick={() => void download("csv")}>
        <Download className="size-3.5" aria-hidden="true" /> CSV
      </button>
    </p>
  );
}

function reviewTone(status: string): StatusTone {
  if (status === "returned") return "waiting";
  return "review";
}

type OwnerHome = {
  id: string;
  propertyId: string;
  name: string;
  address: string;
  photoUrl: string | null;
  closingDate: string | null;
  closingConfirmed: boolean;
  addedOn: string;
  inclusionStatus: string;
  onboardingStatus: string;
  launchStatus: string;
  lastOwnerActivityAt: string | null;
  requiredTasks: number;
  completedTasks: number;
  outstandingDecisions: number;
  overdueDecisions: number;
};

function titleCase(value: string) {
  const text = (value ?? "").replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
}

/**
 * One item waiting on the homeowner. The row stays short; opening it gives the
 * homeowner everything the team sent and every action they can take on it.
 */
function ReviewRow({
  review,
  properties,
  programId,
  onDone,
  readOnly,
  action = null,
  canLogHours = true,
  logHoursBlockedReason = null,
}: {
  review: Review;
  properties: { propertyId: string; name: string }[];
  programId: string;
  onDone: () => void;
  readOnly: boolean;
  /** The onboarding task behind this item, when there is one. */
  action?: OwnerOnboardingAction | null;
  canLogHours?: boolean;
  logHoursBlockedReason?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const openShared = useOpenLogTime();
  const [reviewed, setReviewed] = useState<ReturnType<typeof captureReviewedOpportunity> | null>(
    null,
  );
  const presentation = ownerReviewPresentation(review);
  const canRespond =
    !readOnly &&
    ["awaiting_owner", "returned"].includes(review.status) &&
    Boolean(review.updated_at);
  const [responseContext, setResponseContext] = useState<ReturnType<
    typeof captureReviewedResponse
  > | null>(null);
  const setResponseOpen = (next: boolean) => {
    if (next && !open) setResponseContext(captureReviewedResponse(review));
    setOpen(next);
  };
  const answer = useServerFn(answerOwnerReview);

  const respond = useMutation({
    mutationFn: (response: string) =>
      answer({
        data: {
          reviewId: responseContext?.id ?? review.id,
          expectedUpdatedAt: responseContext?.expectedUpdatedAt ?? "",
          ownerUpdateRevision: responseContext?.ownerUpdateRevision ?? null,
          decision: "acknowledged",
          response,
        },
      }),
    onSuccess: () => {
      toast.success("Thanks — your response was recorded.");
      setOpen(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const names = properties
    .filter((p) => review.propertyIds.includes(p.propertyId))
    .map((p) => p.name)
    .join(", ");
  const fileCount = action?.files.length ?? 0;
  const timeLoggable = canLogHours && !readOnly && review.status !== "closed";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{review.title}</p>
          <StatusBadge tone={reviewTone(review.status)}>{presentation.label}</StatusBadge>
        </div>
        {review.business_question ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {review.business_question}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {names ? `${names} · ` : ""}
          {taskDeadlineLabel(review.respond_by)}
          {fileCount > 0
            ? ` · ${fileCount} file${fileCount === 1 ? "" : "s"} attached`
            : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={() => setResponseOpen(true)}>
          <MessageSquare className="size-4" /> Open and work this
        </Button>
      </div>

      <OwnerTaskDialog
        open={open}
        onOpenChange={setResponseOpen}
        details={{
          title: responseContext?.title ?? review.title,
          statusLabel: presentation.label,
          source: review.auto_ticket ? "Property work" : "Onboarding",
          homes: names,
          respondBy: review.respond_by,
          question: review.business_question ?? responseContext?.description ?? null,
          recommendation: review.recommendation,
          guidance: review.auto_ticket
            ? ownerTicketResponseGuidance(responseContext?.requestCategory)
            : null,
          priorResponse: review.owner_response ?? null,
        }}
        action={action}
        canRespond={canRespond}
        responding={respond.isPending}
        onRespond={(value) => respond.mutate(value)}
        canLogTime={timeLoggable}
        logTimeBlockedReason={logHoursBlockedReason}
        onLogTime={() => {
          const anchor = captureReviewedOpportunity(review);
          if (openShared) {
            setOpen(false);
            openShared({ anchor, onDone });
            return;
          }
          setReviewed(anchor);
          setLogOpen(true);
        }}
        onDecided={onDone}
      />

      {!openShared && (
        <LogTimeDialog
          open={logOpen}
          onOpenChange={setLogOpen}
          programId={programId}
          anchor={reviewed}
          onDone={onDone}
        />
      )}
    </div>
  );
}

/** How many files a homeowner attached to one logged entry. */
function attachmentCount(entry: { attachment_path?: string | null; attachment_paths?: unknown }) {
  const many = Array.isArray(entry.attachment_paths) ? entry.attachment_paths.length : 0;
  if (many > 0) return many;
  return entry.attachment_path ? 1 : 0;
}

/** Opens one file a homeowner attached to a logged entry. */
function EvidenceLink({
  entryId,
  index = 0,
  label = "View attachment",
}: {
  entryId: string;
  index?: number;
  label?: string;
}) {
  const getUrl = useServerFn(participationEvidenceUrlFn);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { url } = await getUrl({ data: { entryId, download: false, index } });
          window.open(url, "_blank", "noopener");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not open the file");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Paperclip className="size-4" /> {label}
    </Button>
  );
}

async function loadHome() {
  return {} as Awaited<ReturnType<typeof ownerHome>>;
}
