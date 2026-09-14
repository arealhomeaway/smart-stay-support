/**
 * Active Owner investor showcase — READ-ONLY, frontend-only fixture route.
 *
 * REMOVAL: this file plus src/lib/active-owner-showcase.fixture.ts are the
 * entire showcase. Nothing else in the app imports either one — deleting
 * both files removes it completely, with zero effect on the real /owner,
 * /owner-programs or /owner-analytics routes or any of their components.
 *
 * This route renders the same "Dana Reyes / ZZ QA AO — Willow" investor-demo
 * scenario designed for supabase/migrations/20260908190000_...sql, but reads
 * it from a static, in-memory fixture instead of Supabase. It never calls
 * useQuery/useServerFn/useMutation, and it never imports a *.server.ts
 * module — so nothing on this page can read from or write to Supabase, and
 * nothing depends on that migration having been applied anywhere. Every
 * owner-facing action here is simulated with local React state only: typing
 * a response or logging time updates this page's own view for this browser
 * tab, and nothing is ever sent anywhere. Refreshing the page resets it to
 * the fixture's starting state.
 *
 * The one thing this route shares with the real app is UI: it reuses the
 * same presentational building blocks as /owner (PageHero, SectionCard,
 * ProgressRing, ActivityList, StatusBadge, PropertyPhoto, OwnerBadges) and
 * the same pure, browser-safe participation math (owner-participation.ts,
 * owner-opportunity.ts) — so the numbers and states shown are computed the
 * same way the real owner hub computes them, not hand-typed separately.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, FileText, GraduationCap, Info, MessageSquare } from "lucide-react";
import { PageHero, ProgressRing, SectionCard } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Celebrate } from "@/components/ui/feedback";
import { ActivityList, type ActivityEvent } from "@/components/ui/activity";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { usDate } from "@/lib/dates";
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
import {
  benchmarkHours,
  hoursFromMinutes,
  MANUAL_ENTRY_CONFIRMATION,
  MANUAL_ENTRY_NOTICE,
  OWNER_GOAL_LABEL,
  progressSnapshot,
} from "@/lib/owner-participation";
import { opportunityState, sourceLabel, type OpportunityState } from "@/lib/owner-opportunity";
import { OwnerBadges } from "@/components/OwnerBadges";
import {
  SHOWCASE_BADGES,
  SHOWCASE_ENTRIES,
  SHOWCASE_PROGRAM,
  SHOWCASE_PROPERTY,
  SHOWCASE_REVIEWS,
  SHOWCASE_TICKET,
  type ShowcaseEntry,
  type ShowcaseReview,
} from "@/lib/active-owner-showcase.fixture";

export const Route = createFileRoute("/_authenticated/owner-showcase")({
  head: () => ({
    meta: [
      { title: "Active Owner showcase — Resolve" },
      {
        name: "description",
        content: "Investor-demo fixture for the Active Owner experience. Read-only, no backend writes.",
      },
    ],
  }),
  component: OwnerShowcaseHub,
});

const SIMULATED_NOTICE = "Showcase mode — nothing was saved. This page never writes to the database.";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "there";
}

function countMinutes(entries: ShowcaseEntry[]): number {
  const superseded = new Set(
    entries.map((e) => e.amendsEntryId).filter((id): id is string => Boolean(id)),
  );
  return entries
    .filter((e) => e.reviewStatus !== "returned" && !superseded.has(e.id))
    .reduce((sum, e) => sum + e.minutes, 0);
}

function reviewTone(status: string): StatusTone {
  if (status === "returned") return "waiting";
  return "review";
}

const OPPORTUNITY_TONE: Record<OpportunityState, StatusTone> = {
  available: "progress",
  upcoming: "waiting",
  completed: "resolved",
  closed: "closed",
};

function OwnerShowcaseHub() {
  // Local-only simulation state. Nothing here is ever sent anywhere, and a
  // page refresh resets everything back to the fixture's starting point.
  const [simulatedEntries, setSimulatedEntries] = useState<ShowcaseEntry[]>([]);
  const [answeredLocally, setAnsweredLocally] = useState<Record<string, string>>({});

  const allEntries = useMemo(
    () => [...SHOWCASE_ENTRIES, ...simulatedEntries],
    [simulatedEntries],
  );
  const reportedMinutes = useMemo(() => countMinutes(allEntries), [allEntries]);

  const snapshot = useMemo(
    () =>
      progressSnapshot({
        status: SHOWCASE_PROGRAM.status,
        startedOn: SHOWCASE_PROGRAM.startedOn,
        reportedMinutes,
      }),
    [reportedMinutes],
  );

  const reviews: ShowcaseReview[] = useMemo(
    () =>
      SHOWCASE_REVIEWS.map((r) => {
        const localAnswer = answeredLocally[r.id];
        return localAnswer ? { ...r, status: "answered" as const, ownerResponse: localAnswer } : r;
      }),
    [answeredLocally],
  );

  const openReviews = reviews.filter((r) => r.status === "awaiting_owner" || r.status === "returned");
  const learningItems = reviews.filter((r) => r.ownerActionType === "research" || r.stage === "learning");
  const targetReached = snapshot.state === "target_reached" || snapshot.state === "program_completed";

  const events: ActivityEvent[] = useMemo(() => {
    const fromEntries: ActivityEvent[] = [...allEntries]
      .sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1))
      .slice(0, 8)
      .map((e) => ({
        id: `entry-${e.id}`,
        kind: e.reviewStatus === "returned" ? "waiting" : "owner",
        label: e.activity,
        when: usDate(e.entryDate),
      }));
    const ticketEvent: ActivityEvent = {
      id: `ticket-${SHOWCASE_TICKET.id}`,
      kind: "completed",
      label: SHOWCASE_TICKET.title,
      when: usDate(SHOWCASE_TICKET.reportedAt),
    };
    return [ticketEvent, ...fromEntries].slice(0, 10);
  }, [allEntries]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
        <StatusBadge tone="review" icon={<Info className="size-3.5" />}>
          Investor showcase — fixture data, not connected to Supabase
        </StatusBadge>
        <p className="text-xs text-muted-foreground">
          Everything below is static demo data for Dana Reyes (not a real person) at ZZ QA AO —
          Willow (not a real property). No action on this page reads from or writes to the
          database.
        </p>
      </div>

      <PageHero
        eyebrow="Active Owner"
        title={`Welcome back, ${firstName(SHOWCASE_PROGRAM.ownerName)}`}
        description="Here is where things stand across your homes, and anything that needs your attention."
      />

      {targetReached ? (
        <Celebrate title="You've passed 100 hours of reported participation.">
          Thank you for the time you've put in. Your final report will be ready when your 90 days
          close.
        </Celebrate>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
          <ProgressRing value={snapshot.percentOfTarget} tone="owner" label="of target" />
          <div>
            <p className="text-2xl font-semibold leading-none">{snapshot.reportedHours} hrs</p>
            <p className="mt-1 text-sm text-muted-foreground">
              reported toward {OWNER_GOAL_LABEL.toLowerCase()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Day {snapshot.day} of 90 · {snapshot.daysLeft} days left · {snapshot.hoursToGoal} hrs
              to go
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex min-w-56 flex-1 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
            <PropertyPhoto url={SHOWCASE_PROPERTY.photoUrl} name={SHOWCASE_PROPERTY.name} rounded="rounded-lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{SHOWCASE_PROPERTY.name}</p>
              <p className="truncate text-xs text-muted-foreground">{SHOWCASE_PROPERTY.address}</p>
            </div>
          </div>
        </div>
      </div>

      <SectionCard
        title="Needs your attention"
        description="A short question or decision from your ARHA team."
      >
        {openReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting on you right now.</p>
        ) : (
          <div className="space-y-3">
            {openReviews.map((r) => (
              <ShowcaseReviewRow
                key={r.id}
                review={r}
                onSimulatedLogTime={(entry) => setSimulatedEntries((prev) => [...prev, entry])}
                onSimulatedAnswer={(response) =>
                  setAnsweredLocally((prev) => ({ ...prev, [r.id]: response }))
                }
              />
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <GraduationCap className="size-4 text-primary" /> Learning
          </span>
        }
        description="Reference material and research opportunities — never a decision gate."
      >
        {learningItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here right now.</p>
        ) : (
          <div className="space-y-2">
            {learningItems.map((r) => (
              <div key={r.id} className="rounded-lg border border-border/70 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{r.title}</p>
                  <StatusBadge tone={OPPORTUNITY_TONE[opportunityState({ status: r.status, available_from: r.availableFrom, respond_by: r.respondBy })]}>
                    {r.status === "answered" ? "Completed" : "Available"}
                  </StatusBadge>
                </div>
                {r.recommendation ? (
                  <p className="mt-1 text-sm text-muted-foreground">{r.recommendation}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ShowcaseParticipationRecordPanel entries={allEntries} reportedMinutes={reportedMinutes} />
        <OwnerBadges
          earned={SHOWCASE_BADGES.map((b) => ({
            code: b.code,
            awarded_at: b.awardedAt,
            trigger_rule: b.triggerRule,
            needs_review: b.needsReview,
          }))}
          reportedHours={snapshot.reportedHours}
        />
      </div>

      <SectionCard title="Recent activity" description="What's happened lately across your homes.">
        <ActivityList events={events} emptyLabel="Nothing has happened yet." />
      </SectionCard>

      <p className="text-center text-xs text-muted-foreground">
        Benchmark pace for day {snapshot.day}: {benchmarkHours(snapshot.day)} hrs · This is a
        static presentation fixture, not the real Active Owner production experience.
      </p>
    </div>
  );
}

function ShowcaseReviewRow({
  review,
  onSimulatedLogTime,
  onSimulatedAnswer,
}: {
  review: ShowcaseReview;
  onSimulatedLogTime: (entry: ShowcaseEntry) => void;
  onSimulatedAnswer: (response: string) => void;
}) {
  const [respondOpen, setRespondOpen] = useState(false);
  const [response, setResponse] = useState("");

  const state = opportunityState({
    status: review.status,
    available_from: review.availableFrom,
    respond_by: review.respondBy,
  });

  const sendResponse = () => {
    onSimulatedAnswer(response.trim() || "Acknowledged.");
    toast.info(SIMULATED_NOTICE);
    setRespondOpen(false);
    setResponse("");
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{review.title}</p>
          <StatusBadge tone={reviewTone(review.status)}>
            {review.status === "returned" ? "Sent back to you" : "Waiting on you"}
          </StatusBadge>
          {state === "upcoming" ? <StatusBadge tone="waiting">Upcoming</StatusBadge> : null}
        </div>
        {review.businessQuestion ? (
          <p className="mt-1 text-sm text-muted-foreground">{review.businessQuestion}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {sourceLabel(review.sourceType)} ·{" "}
          {review.respondBy ? `Please respond by ${usDate(review.respondBy)}` : "No due date"}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <ShowcaseLogTimeButton review={review} onSimulatedLogTime={onSimulatedLogTime} />
        <Button size="sm" variant="outline" disabled={state === "upcoming"} onClick={() => setRespondOpen(true)}>
          <MessageSquare className="size-4" /> Respond
        </Button>
      </div>

      <Dialog open={respondOpen} onOpenChange={setRespondOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{review.title}</DialogTitle>
            <DialogDescription>
              {review.recommendation ?? "Share your decision or note below."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{SIMULATED_NOTICE}</p>
          <Textarea
            rows={4}
            placeholder="Your response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRespondOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendResponse}>Send response</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShowcaseLogTimeButton({
  review,
  onSimulatedLogTime,
}: {
  review: ShowcaseReview;
  onSimulatedLogTime: (entry: ShowcaseEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("30");
  const [activity, setActivity] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const save = () => {
    const entry: ShowcaseEntry = {
      id: `showcase-entry-simulated-${review.id}-${Date.now()}`,
      reviewId: review.id,
      reviewTitle: review.title,
      entryDate: new Date().toISOString().slice(0, 10),
      minutes: Math.max(1, Math.min(1440, Number(minutes) || 0)),
      activity: activity.trim(),
      activityCategory: "Other participation",
      output: null,
      reviewStatus: "submitted",
      reviewedAt: null,
      reviewNote: null,
      amendsEntryId: null,
      correctionReason: null,
    };
    onSimulatedLogTime(entry);
    toast.info(SIMULATED_NOTICE);
    setOpen(false);
    setActivity("");
    setMinutes("30");
    setConfirmed(false);
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Clock className="size-4" /> Log time
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log your time</DialogTitle>
            <DialogDescription>{MANUAL_ENTRY_NOTICE}</DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">{SIMULATED_NOTICE}</p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="showcase-log-activity">What did you do?</Label>
              <Textarea
                id="showcase-log-activity"
                rows={3}
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="showcase-log-minutes">Minutes spent</Label>
              <Input
                id="showcase-log-minutes"
                type="number"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
              <span>{MANUAL_ENTRY_CONFIRMATION}</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={activity.trim().length < 3 || !confirmed} onClick={save}>
              Save entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const ENTRY_STATUS_LABEL: Record<ShowcaseEntry["reviewStatus"], string> = {
  approved: "Approved by ARHA",
  submitted: "Awaiting review",
  returned: "Returned for correction",
};

/**
 * A local, static stand-in for ParticipationReportPanel (which normally
 * fetches a real PDF/CSV via a server function). This never calls the
 * network — "Download" only ever shows a toast explaining why.
 */
function ShowcaseParticipationRecordPanel({
  entries,
  reportedMinutes,
}: {
  entries: ShowcaseEntry[];
  reportedMinutes: number;
}) {
  const superseded = new Set(
    entries.map((e) => e.amendsEntryId).filter((id): id is string => Boolean(id)),
  );
  const countable = entries.filter((e) => e.reviewStatus !== "returned" && !superseded.has(e.id));
  const approvedMinutes = countable
    .filter((e) => e.reviewStatus === "approved")
    .reduce((n, e) => n + e.minutes, 0);
  const pendingMinutes = countable
    .filter((e) => e.reviewStatus !== "approved")
    .reduce((n, e) => n + e.minutes, 0);
  const returnedMinutes = entries
    .filter((e) => e.reviewStatus === "returned")
    .reduce((n, e) => n + e.minutes, 0);

  const rows = [...entries].sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <FileText className="size-4 text-primary" /> Participation record
        </span>
      }
      description={`${SHOWCASE_PROGRAM.ownerName} · ${SHOWCASE_PROPERTY.name} · ${usDate(SHOWCASE_PROGRAM.startedOn)} – today`}
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            toast.info("Showcase preview — report generation is disabled in this demo.")
          }
        >
          Download
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-sunken px-2 py-2">
          <p className="numeric text-lg font-semibold">{hoursFromMinutes(reportedMinutes)}</p>
          <p className="text-[0.6875rem] text-muted-foreground">Reported hrs</p>
        </div>
        <div className="rounded-lg bg-sunken px-2 py-2">
          <p className="numeric text-lg font-semibold">{hoursFromMinutes(approvedMinutes)}</p>
          <p className="text-[0.6875rem] text-muted-foreground">Approved hrs</p>
        </div>
        <div className="rounded-lg bg-sunken px-2 py-2">
          <p className="numeric text-lg font-semibold">{hoursFromMinutes(pendingMinutes)}</p>
          <p className="text-[0.6875rem] text-muted-foreground">Pending review</p>
        </div>
      </div>
      {returnedMinutes > 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">
          {hoursFromMinutes(returnedMinutes)} returned hrs are not counted until corrected.
        </p>
      ) : null}
      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {rows.map((e) => (
          <div
            key={e.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm">{e.activity}</p>
              <p className="text-xs text-muted-foreground">
                {usDate(e.entryDate)} · {e.reviewTitle}
                {e.correctionReason ? " · corrected" : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="numeric text-xs text-muted-foreground">
                {hoursFromMinutes(e.minutes)} hr
              </span>
              <StatusBadge tone={e.reviewStatus === "returned" ? "waiting" : "resolved"}>
                {ENTRY_STATUS_LABEL[e.reviewStatus]}
              </StatusBadge>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Participation totals are based on activity and time manually reported by the homeowner —
        the same rule the real report uses. This preview is static demo data.
      </p>
    </SectionCard>
  );
}
