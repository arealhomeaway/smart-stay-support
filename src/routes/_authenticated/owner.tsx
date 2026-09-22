import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Award,
  Bell,
  Clock,
  FolderOpen,
  Home as HomeIcon,
  MessageSquare,
  Paperclip,
  ShieldCheck,
} from "lucide-react";
import { participationEvidenceUrlFn } from "@/lib/owner-evidence.functions";
import { EmptyState, LoadingPage, PageHero, ProgressRing, SectionCard } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Celebrate } from "@/components/ui/feedback";
import { ActivityList, type ActivityEvent } from "@/components/ui/activity";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { MilestonePacing } from "@/components/owner/MilestonePacing";
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
import { LogTimeDialog } from "@/components/owner/LogTimeDialog";
import { WaysToParticipate } from "@/components/owner/WaysToParticipate";
import { captureReviewedOpportunity, captureReviewedResponse } from "@/lib/owner-reviewed-update";
import { ownerTicketResponseGuidance, reviewedTicketRequestText } from "@/lib/owner-ticket-intent";
import { OwnerApprovalPanel } from "@/components/OwnerApprovalPanel";
import { OnboardingActions } from "@/components/owner/OnboardingActions";
import { ownerReviewPresentation } from "@/lib/owner-review-presentation";
import type { OwnerTicketRequest } from "@/lib/owner-ticket-authority";
import { OwnerBadges } from "@/components/OwnerBadges";
import { JourneyStrip } from "@/components/owner/JourneyStrip";
import { ArhaContacts } from "@/components/owner/ArhaContacts";
import { AfterDayNinety } from "@/components/owner/AfterDayNinety";
import { programStage } from "@/lib/owner-journey";
import { JAMES, contactsFor, contactPhaseFor } from "@/lib/arha-contacts";
import { ownerContacts } from "@/lib/owner-contacts.functions";
import { OwnerFilesPanel } from "@/components/OwnerFilesPanel";
import { ParticipationReportPanel } from "@/components/ParticipationReportPanel";
import { useOwnerPreview } from "@/lib/owner-preview";
import { useDemo } from "@/components/DemoProvider";

export const Route = createFileRoute("/_authenticated/owner")({
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

function firstName(name: string | null | undefined) {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "there";
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
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["owner-home"] });
    void qc.invalidateQueries({ queryKey: ["owner-report"] });
  };

  const { program, properties, reviews, badges, alerts, tickets, snapshot } = data;

  const openReviews = (reviews as Review[]).filter((r) => ownerReviewPresentation(r).attention);
  const availableReviews = (reviews as Review[]).filter(
    (r) => r.auto_ticket && !ownerReviewPresentation(r).attention,
  );
  const heroPhoto = properties.find((p) => p.photoUrl)?.photoUrl ?? undefined;
  const unreadAlerts = alerts.filter((a) => !a.read_at).length;
  const attentionCount = openReviews.length + unreadAlerts;

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
  const stage = programStage(
    {
      status: program.status,
      completedAt: program.completedAt ?? null,
      programDay: snapshot.day,
    },
    journeyHomes,
  );

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

  // "Log hours" records whatever the homeowner did on their own initiative:
  // a meeting, a phone call, research or an errand for their home.
  const [heroLogOpen, setHeroLogOpen] = useState(false);
  const [heroLogActivity, setHeroLogActivity] = useState("");
  const heroLogAnchor = null;
  const ownerPhase: "onboarding" | "ongoing" =
    program.status === "ready_for_onboarding" ||
    program.status === "draft" ||
    openReviews.some((r) => r.phase === "onboarding")
      ? "onboarding"
      : "ongoing";
  const openManualLog = (activity: string) => {
    setHeroLogActivity(activity);
    setHeroLogOpen(true);
  };
  const scrollToSection = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const percent = snapshot.percentOfTarget;
  const targetReached =
    snapshot.state === "target_reached" || snapshot.state === "program_completed";

  const events: ActivityEvent[] = useMemo(() => {
    const fromAlerts: ActivityEvent[] = alerts.slice(0, 8).map((a) => ({
      id: `alert-${a.id}`,
      kind: a.kind === "urgent" ? "escalation" : "note",
      label: a.title,
      when: usDateTime(a.created_at),
    }));
    const fromTickets: ActivityEvent[] = tickets.slice(0, 6).map((t) => ({
      id: `ticket-${t.id}`,
      kind: t.status === "closed" ? "completed" : "handoff",
      label: t.title,
      when: usDate(t.reported_at),
    }));
    return [...fromAlerts, ...fromTickets]
      .sort((a, b) => (a.when && b.when ? (a.when < b.when ? 1 : -1) : 0))
      .slice(0, 10);
  }, [alerts, tickets]);

  return (
    <div className="space-y-6">
      {preview ? (
        <StatusBadge tone="review">Preview only — staff view, read-only</StatusBadge>
      ) : null}

      <PageHero
        image={heroPhoto}
        eyebrow="Active Owner"
        title={`Welcome back, ${firstName(program.ownerName)}`}
        description="Here is where things stand across your homes, and anything that needs your attention."
        actions={
          <>
            {preview ? null : (
              <Button onClick={() => openManualLog("")}>
                <Clock className="size-4" aria-hidden="true" /> Log hours
              </Button>
            )}
            <Button
              variant={attentionCount > 0 ? "default" : "outline"}
              aria-label={`${attentionCount} items need your attention`}
              onClick={() => scrollToSection("owner-decisions")}
            >
              <Bell className="size-4" aria-hidden="true" />
              {attentionCount > 0 ? (
                <span className="numeric ml-1 rounded-full bg-background/20 px-2 py-0.5 text-xs">
                  {attentionCount}
                </span>
              ) : (
                "All caught up"
              )}
            </Button>
            <Button variant="outline" onClick={() => scrollToSection("owner-decisions")}>
              Pending decisions
              {openReviews.length > 0 ? (
                <span className="numeric ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {openReviews.length}
                </span>
              ) : null}
            </Button>
            <Button variant="outline" onClick={() => scrollToSection("owner-documents")}>
              Shared documents
            </Button>
          </>
        }
      />

      <LogTimeDialog
        open={heroLogOpen}
        onOpenChange={setHeroLogOpen}
        programId={program.id}
        // Without an open opportunity the homeowner records the activity
        // themselves: a meeting, a call, research or an errand.
        anchor={heroLogAnchor}
        defaultActivity={heroLogActivity}
        phase={ownerPhase}
        properties={properties.map((p) => ({ id: p.id, name: p.name }))}
        onDone={invalidate}
      />

      {targetReached ? (
        <Celebrate title="You've reached at least 100 hours of reported participation.">
          Thank you for the time you've put in. Your final report will be ready when your 90 days
          close.
        </Celebrate>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
          <ProgressRing value={percent} tone="owner" label="of target" />
          <div>
            <p className="text-2xl font-semibold leading-none">{snapshot.reportedHours} hrs</p>
            <p className="mt-1 text-sm text-muted-foreground">
              reported toward {OWNER_GOAL_LABEL.toLowerCase()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Day {snapshot.day} of 90 · {snapshot.daysLeft} days left
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {properties.map((p) => (
            <OwnerPropertyCard
              key={p.id}
              property={p}
              attention={
                openReviews.filter((r) => r.propertyIds.includes(p.propertyId)).length
              }
            />
          ))}
        </div>
      </div>

      <MilestonePacing
        day={snapshot.day}
        reportedHours={snapshot.reportedHours}
        benchmark={snapshot.benchmark}
        goalMet={targetReached}
        audience="owner"
      />

      <JourneyStrip current={stage} />

      <div id="owner-decisions" className="scroll-mt-24">
      <SectionCard
        title="Needs your attention"
        description="A short question or decision from your ARHA team."
      >
        {openReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting on you right now.</p>
        ) : (
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
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
      </div>

      <OnboardingActions readOnly={preview} programId={preview ? program.id : null} />

      <WaysToParticipate
        // A home is still being set up when its open work is onboarding work.
        phase={ownerPhase}
        openReviews={openReviews.length}
        {...(preview ? {} : { onLogHours: openManualLog })}
      />

      <OwnerApprovalPanel readOnly={preview} />

      <SectionCard
        title="Property work to review"
        description="Review what is happening at your homes, retain your participation history, and log time you actually spend reviewing."
      >
        {availableReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No property work is available to review yet.
          </p>
        ) : (
          <div className="space-y-3">
            {availableReviews.map((r) => (
              <ReviewRow
                key={r.id}
                review={r}
                properties={properties}
                programId={program.id}
                onDone={invalidate}
                readOnly={preview}
              />
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ParticipationReportPanel />
        {data.badgeRefreshPending && (
          <p className="text-sm text-muted-foreground">
            Achievements are awaiting a refresh. Your participation record is still available;
            reopening this page will retry.
          </p>
        )}
        <OwnerBadges earned={badges} reportedHours={snapshot.reportedHours} />
      </div>

      {closeoutVisible && (
        <AfterDayNinety
          daysLeft={Math.max(0, snapshot.daysLeft)}
          completed={Boolean(program.completedAt)}
          primaryContact={contacts.primary ?? JAMES}
        />
      )}

      <ArhaContacts contacts={contacts} />

      <SectionCard
        title="Your logged participation"
        description="Everything you have recorded, with any photos or receipts you attached."
      >
        {data.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You have not logged any participation time yet.
          </p>
        ) : (
          <div className="space-y-2">
            {data.entries.slice(0, 25).map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{entry.activity}</p>
                  <p className="numeric text-xs text-muted-foreground">
                    {usCalendarDate(entry.entry_date)} · {entry.minutes} minutes
                  </p>
                </div>
                {entry.attachment_path && <EvidenceLink entryId={entry.id} />}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Reviewed updates in your participation history">
        <div className="space-y-2">
          {data.entries
            .filter((entry) => entry.owner_update_snapshot)
            .map((entry) => {
              const reviewed = entry.owner_update_snapshot!;
              return (
                <details key={entry.id} className="rounded-lg border p-3 text-sm">
                  <summary className="cursor-pointer">
                    {usCalendarDate(entry.entry_date)} · {entry.activity} · Revision{" "}
                    {reviewed.revision}
                    {entry.superseded ? " · Superseded entry" : ""}
                  </summary>
                  <div className="mt-2 space-y-2 whitespace-pre-wrap">
                    <p>{reviewed.issue}</p>
                    <p>{reviewed.work_performed}</p>
                    {reviewed.outcome && <p>{reviewed.outcome}</p>}
                    {reviewedTicketRequestText(reviewed) && (
                      <p>{reviewedTicketRequestText(reviewed)}</p>
                    )}
                    <p className="text-muted-foreground">
                      Owner update reviewed {usDate(reviewed.reviewed_at)}. Retained with this
                      participation entry.
                    </p>
                  </div>
                </details>
              );
            })}
          {!data.entries.some((entry) => entry.owner_update_snapshot) && (
            <p className="text-sm text-muted-foreground">
              No participation entries have a saved owner-update revision yet.
            </p>
          )}
        </div>
      </SectionCard>

      <div id="owner-documents" className="scroll-mt-24">
        <OwnerFilesPanel />
      </div>

      <SectionCard title="Your recorded review responses">
        <div className="space-y-2">
          {data.responseReceipts.map((receipt) => (
            <details key={receipt.id} className="rounded-lg border p-3 text-sm">
              <summary className="cursor-pointer">
                {usDateTime(receipt.createdAt)} · Review response
                {receipt.ownerUpdate ? ` · Revision ${receipt.ownerUpdate.revision}` : ""}
              </summary>
              <div className="mt-2 space-y-2 whitespace-pre-wrap">
                <p className="text-muted-foreground">
                  {properties.find((property) => property.propertyId === receipt.propertyId)
                    ?.name ??
                    (receipt.propertyId ? "Previously enrolled property" : "Program opportunity")}
                  {receipt.ticketId
                    ? ` · ${tickets.find((ticket) => ticket.id === receipt.ticketId)?.title ?? "Property work"}`
                    : ""}
                </p>
                <p>{receipt.response || "Review acknowledged without a note."}</p>
                {receipt.ownerUpdate ? (
                  <>
                    <p>{receipt.ownerUpdate.issue}</p>
                    <p>{receipt.ownerUpdate.work_performed}</p>
                    {receipt.ownerUpdate.outcome && <p>{receipt.ownerUpdate.outcome}</p>}
                    {reviewedTicketRequestText(receipt.ownerUpdate) && (
                      <p>{reviewedTicketRequestText(receipt.ownerUpdate)}</p>
                    )}
                    <p className="text-muted-foreground">
                      This is the reviewed narrative retained with this response. A response does
                      not add participation hours.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    No narrative revision was retained with this response.
                  </p>
                )}
              </div>
            </details>
          ))}
          {data.responseReceipts.length === 0 && (
            <p className="text-sm text-muted-foreground">No review responses recorded yet.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Recent activity" description="What's happened lately across your homes.">
        <ActivityList events={events} emptyLabel="Nothing has happened yet." />
      </SectionCard>
    </div>
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

/**
 * A homeowner's own home, opened read-only. Same details staff see in the
 * Property Hub, minus anything operational they cannot act on.
 */
function OwnerPropertyCard({
  property,
  attention,
}: {
  property: OwnerHome;
  attention: number;
}) {
  const [open, setOpen] = useState(false);
  const rows: { label: string; value: string }[] = [
    { label: "Address", value: property.address || "—" },
    {
      label: "Closing date",
      value: property.closingDate
        ? `${usCalendarDate(property.closingDate)}${property.closingConfirmed ? " (confirmed)" : " (not confirmed yet)"}`
        : "Not set",
    },
    { label: "Added to your program", value: usCalendarDate(property.addedOn) },
    { label: "Enrollment", value: titleCase(property.inclusionStatus) },
    { label: "Onboarding", value: titleCase(property.onboardingStatus) },
    { label: "Listing", value: titleCase(property.launchStatus) },
    {
      label: "Setup work",
      value: `${property.completedTasks} of ${property.requiredTasks} of your items done`,
    },
    {
      label: "Waiting on you",
      value: property.outstandingDecisions
        ? `${property.outstandingDecisions} item${property.outstandingDecisions === 1 ? "" : "s"}${property.overdueDecisions ? ` · ${property.overdueDecisions} past due` : ""}`
        : "Nothing right now",
    },
    {
      label: "Your last activity",
      value: property.lastOwnerActivityAt ? usDate(property.lastOwnerActivityAt) : "None recorded",
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-w-56 flex-1 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:border-primary/60 hover:bg-accent/40"
      >
        <PropertyPhoto url={property.photoUrl} name={property.name} rounded="rounded-lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{property.name}</p>
          <p className="truncate text-xs text-muted-foreground">{property.address || "—"}</p>
          {attention > 0 ? (
            <span className="numeric mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {attention} waiting on you
            </span>
          ) : null}
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{property.name}</DialogTitle>
            <DialogDescription>Your home's details, view only.</DialogDescription>
          </DialogHeader>
          <dl className="space-y-2">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function titleCase(value: string) {
  const text = (value ?? "").replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
}

function ReviewRow({
  review,
  properties,
  programId,
  onDone,
  readOnly,
}: {
  review: Review;
  properties: { propertyId: string; name: string }[];
  programId: string;
  onDone: () => void;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState("");
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
    mutationFn: (decision: string) =>
      answer({
        data: {
          reviewId: responseContext?.id ?? review.id,
          expectedUpdatedAt: responseContext?.expectedUpdatedAt ?? "",
          ownerUpdateRevision: responseContext?.ownerUpdateRevision ?? null,
          decision,
          response: response.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Thanks — your response was recorded.");
      setOpen(false);
      setResponse("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const names = properties
    .filter((p) => review.propertyIds.includes(p.propertyId))
    .map((p) => p.name)
    .join(", ");

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{review.title}</p>
          <StatusBadge tone={reviewTone(review.status)}>{presentation.label}</StatusBadge>
        </div>
        {review.business_question ? (
          <p className="mt-1 text-sm text-muted-foreground">{review.business_question}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {names ? `${names} · ` : ""}
          {review.respond_by
            ? `Please respond by ${usCalendarDate(review.respond_by)}`
            : "No due date"}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <LogTimeButton
          review={review}
          programId={programId}
          onDone={onDone}
          readOnly={readOnly || review.status === "closed"}
        />
        <Button size="sm" variant="outline" onClick={() => setResponseOpen(true)}>
          <MessageSquare className="size-4" />{" "}
          {review.auto_ticket || !canRespond ? "Review details" : "Respond"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setResponseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{responseContext?.title ?? review.title}</DialogTitle>
            <DialogDescription>
              {responseContext?.description ?? "Share your decision or note below."}
            </DialogDescription>
          </DialogHeader>
          {review.auto_ticket ? (
            <p className="text-sm text-muted-foreground">
              {ownerTicketResponseGuidance(responseContext?.requestCategory)}
            </p>
          ) : null}
          {review.owner_response ? (
            <p className="text-sm whitespace-pre-wrap">
              Your recorded response: {review.owner_response}
            </p>
          ) : null}
          {canRespond ? (
            <Textarea
              rows={4}
              placeholder="Your response"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {canRespond ? (
              <Button disabled={respond.isPending} onClick={() => respond.mutate("acknowledged")}>
                Send response
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Opens the photo or receipt a homeowner attached to a logged entry. */
function EvidenceLink({ entryId }: { entryId: string }) {
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
          const { url } = await getUrl({ data: { entryId, download: false } });
          window.open(url, "_blank", "noopener");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not open the file");
        } finally {
          setBusy(false);
        }
      }}
    >
      <Paperclip className="size-4" /> View attachment
    </Button>
  );
}

function LogTimeButton({
  review,
  programId,
  onDone,
  readOnly,
}: {
  review: Review;
  programId: string;
  onDone: () => void;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reviewed, setReviewed] = useState<ReturnType<typeof captureReviewedOpportunity> | null>(
    null,
  );

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={readOnly}
        onClick={() => {
          setReviewed(captureReviewedOpportunity(review));
          setOpen(true);
        }}
      >
        <Clock className="size-4" /> Log time
      </Button>
      <LogTimeDialog
        open={open}
        onOpenChange={setOpen}
        programId={programId}
        anchor={reviewed}
        onDone={onDone}
      />
    </>
  );
}

async function loadHome() {
  return {} as Awaited<ReturnType<typeof ownerHome>>;
}
