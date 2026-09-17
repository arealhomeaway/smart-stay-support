import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Award,
  Clock,
  FolderOpen,
  Home as HomeIcon,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { EmptyState, LoadingPage, PageHero, ProgressRing, SectionCard } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { Celebrate } from "@/components/ui/feedback";
import { ActivityList, type ActivityEvent } from "@/components/ui/activity";
import { PropertyPhoto } from "@/components/PropertyPhoto";
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
import {
  answerOwnerReview,
  logOwnerParticipation,
  ownerHome,
  ownerHomePreview,
} from "@/lib/owner-portal.functions";
import {
  MANUAL_ENTRY_CONFIRMATION,
  MANUAL_ENTRY_NOTICE,
  parseOwnerMinutes,
  OWNER_GOAL_LABEL,
} from "@/lib/owner-participation";
import { captureReviewedOpportunity, captureReviewedResponse } from "@/lib/owner-reviewed-update";
import { ownerTicketResponseGuidance, reviewedTicketRequestText } from "@/lib/owner-ticket-intent";
import { OwnerApprovalPanel } from "@/components/OwnerApprovalPanel";
import { ownerReviewPresentation } from "@/lib/owner-review-presentation";
import type { OwnerTicketRequest } from "@/lib/owner-ticket-authority";
import { OwnerBadges } from "@/components/OwnerBadges";
import { OwnerFilesPanel } from "@/components/OwnerFilesPanel";
import { ParticipationReportPanel } from "@/components/ParticipationReportPanel";
import { useOwnerPreview } from "@/lib/owner-preview";

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
  const load = useServerFn(ownerHome);
  const loadPreview = useServerFn(ownerHomePreview);

  const home = useQuery({
    queryKey: [
      "owner-home",
      user.id,
      ownerPreview ? "preview" : "owner",
      ownerPreview?.programId ?? null,
    ],
    queryFn: () =>
      ownerPreview ? loadPreview({ data: { programId: ownerPreview.programId } }) : load(),
  });

  if (home.isLoading) return <LoadingPage tiles={4} />;
  if (!home.data || !home.data.linked) {
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
      key={`${user.id}:${home.data.program.id}:${Boolean(ownerPreview)}`}
      data={home.data}
      preview={Boolean(ownerPreview)}
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
            <div
              key={p.id}
              className="flex min-w-56 flex-1 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
            >
              <PropertyPhoto url={p.photoUrl} name={p.name} rounded="rounded-lg" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">{p.address || "—"}</p>
              </div>
            </div>
          ))}
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
          <p className="text-sm text-muted-foreground">Achievements are awaiting a refresh. Your participation record is still available; reopening this page will retry.</p>
        )}
        <OwnerBadges earned={badges} reportedHours={snapshot.reportedHours} />
      </div>

      <SectionCard title="Reviewed updates in your participation history">
        <div className="space-y-2">
          {data.entries
            .filter((entry) => entry.owner_update_snapshot)
            .map((entry) => {
              const reviewed = entry.owner_update_snapshot!;
              return (
                <details key={entry.id} className="rounded-lg border p-3 text-sm">
                  <summary className="cursor-pointer">
                    {usCalendarDate(entry.entry_date)} · {entry.activity} · Revision {reviewed.revision}
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

      <OwnerFilesPanel />

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
          {review.respond_by ? `Please respond by ${usCalendarDate(review.respond_by)}` : "No due date"}
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
  const [minutes, setMinutes] = useState("");
  const [activity, setActivity] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const log = useServerFn(logOwnerParticipation);

  const save = useMutation({
    mutationFn: () => {
      if (!reviewed) throw new Error("Open the opportunity before logging participation.");
      if (reviewed.phase !== "onboarding" && reviewed.phase !== "ongoing") {
        throw new Error("This opportunity needs a valid participation phase.");
      }
      return log({
        data: {
          programId,
          phase: reviewed.phase,
          entryDate: new Date().toISOString().slice(0, 10),
          minutes: parseOwnerMinutes(minutes),
          activity: activity.trim(),
          reviewId: reviewed.id,
          ticketId: reviewed.ticketId,
          ownerUpdateRevision: reviewed.ownerUpdateRevision,
          propertyIds: reviewed.propertyIds,
          confirmed: true,
        },
      });
    },
    onSuccess: () => {
      toast.success("Time logged.");
      setOpen(false);
      setActivity("");
      setMinutes("");
      setConfirmed(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log your time</DialogTitle>
            <DialogDescription>{MANUAL_ENTRY_NOTICE}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {reviewed?.description && (
              <p className="max-h-48 overflow-y-auto text-sm whitespace-pre-wrap">
                {reviewed.description}
              </p>
            )}
            <div className="space-y-1">
              <Label htmlFor="log-activity">What did you do?</Label>
              <Textarea
                id="log-activity"
                rows={3}
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="log-minutes">Minutes spent</Label>
              <Input
                id="log-minutes"
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
            <Button
              disabled={save.isPending || activity.trim().length < 3 || !confirmed}
              onClick={() => save.mutate()}
            >
              Save entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function loadHome() {
  return {} as Awaited<ReturnType<typeof ownerHome>>;
}
