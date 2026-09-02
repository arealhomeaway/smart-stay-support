import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCircle2, Clock, Eye, Home, KeyRound, Mail, MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  answerOwnerReview,
  createOwnerMatterFn,
  logOwnerParticipation,
  markOwnerAlertsRead,
  ownerHome,
  ownerHomePreview,
  redeemInvite,
  resubmitOwnerParticipation,
  saveOwnerAlertPreferences,
} from "@/lib/owner-portal.functions";
import { useRole } from "@/hooks/useRole";
import { ReviewPhotos } from "@/components/ReviewPhotos";
import { OwnerApprovalPanel } from "@/components/OwnerApprovalPanel";
import { ParticipationReportPanel } from "@/components/ParticipationReportPanel";

import type { ReviewPhoto } from "@/lib/owner-participation";
import { alertLabel, relativeTime } from "@/lib/owner-notify";
import { DECISION_PATHS } from "@/lib/owner-program";
import {
  ACTIVITY_CATEGORIES,
  COMBINED_TOTAL_NOTICE,
  COVERAGE_META,
  formatHours,
  hoursFromMinutes,
  MANUAL_ENTRY_CONFIRMATION,
  MANUAL_ENTRY_NOTICE,
  OPERATING_TARGET_HOURS,
  OWNER_GOAL_LABEL,
  PROGRAM_TOTAL_DAYS,
  PROGRESS_META,
  TASK_TYPE_META,
  type TaskType,
} from "@/lib/owner-participation";
import { findPossibleDuplicate, type ExistingEntry } from "@/lib/owner-duplicate";
import { OwnerBadges } from "@/components/OwnerBadges";
import { OwnerFilesPanel } from "@/components/OwnerFilesPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Owner hub — 90-day participation program" },
      {
        name: "description",
        content:
          "Your 90-day participation progress, the decisions waiting on you, and the hours you have reported across every home in your program.",
      },
      { property: "og:title", content: "Owner hub — 90-day participation program" },
      {
        property: "og:description",
        content: "Track your homes, answer decisions and report participation time in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerHubPage,
});

type HomeData = Extract<Awaited<ReturnType<typeof ownerHome>>, { linked: true }>;
type TimeTarget = {
  reviewId: string | null;
  ticketId: string | null;
  label: string;
  propertyIds: string[];
};

function OwnerHubPage() {
  const qc = useQueryClient();
  const { readOnly } = useRole();
  const load = useServerFn(ownerHome);
  const loadPreview = useServerFn(ownerHomePreview);
  const home = useQuery({
    queryKey: ["owner-home"],
    queryFn: () => (readOnly ? loadPreview() : load()),
  });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["owner-home"] });

  if (home.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!home.data?.linked) {
    return readOnly ? (
      <UnlinkedPreview />
    ) : (
      <LinkInvite onLinked={invalidate} />
    );
  }

  return <OwnerHub data={home.data} onChange={invalidate} readOnly={readOnly} />;
}

/** Platform Owner previewing the portal with no sample program to show. */
function UnlinkedPreview() {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="size-5 text-primary" /> Homeowner preview
        </CardTitle>
        <CardDescription>
          This account isn't linked to a 90-day participation program, so there's
          no owner dashboard to preview. Pick a homeowner invite code to see the
          real portal, or open the program you want to review from the Seats page.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

/** First run: the owner types the code ARHA gave them to attach their program. */
function LinkInvite({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState("");
  const redeem = useServerFn(redeemInvite);
  const link = useMutation({
    mutationFn: () => redeem({ data: { code } }),
    onSuccess: () => {
      toast.success("Your program is connected.");
      onLinked();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" /> Connect your program
        </CardTitle>
        <CardDescription>
          Enter the invite code from your ARHA contact to open your participation program.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          className="text-center text-lg tracking-[0.3em]"
        />
        <Button className="w-full" disabled={code.length < 4 || link.isPending} onClick={() => link.mutate()}>
          {link.isPending ? "Connecting…" : "Connect"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function OwnerHub({ data, onChange, readOnly }: { data: HomeData; onChange: () => void; readOnly: boolean }) {
  const {
    program,
    properties,
    alerts,
    reviews,
    tickets,
    entries,
    badges,
    reportedMinutes,
    approvedMinutes,
    pendingReviewMinutes,
    returnedMinutes,
    onboardingMinutes,
    operationalMinutes,
    snapshot,
  } = data;

  const [timeTarget, setTimeTarget] = useState<TimeTarget | null>(null);
  const [correcting, setCorrecting] = useState<(typeof entries)[number] | null>(null);
  const [answering, setAnswering] = useState<(typeof reviews)[number] | null>(null);
  const [openingMatter, setOpeningMatter] = useState(false);

  const markRead = useServerFn(markOwnerAlertsRead);
  const unread = useMemo(() => alerts.filter((a) => !a.read_at), [alerts]);

  // Opening the hub is the acknowledgement — clear the badge once seen.
  // (Preview mode is read-only: never touch a real homeowner's alert state.)
  useEffect(() => {
    if (readOnly || unread.length === 0) return;
    const ids = unread.map((a) => a.id);
    const timer = setTimeout(() => {
      void markRead({ data: { ids } }).then(onChange);
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.length, readOnly]);

  const included = properties.filter((p) => p.inclusionStatus === "included");
  const progress = PROGRESS_META[snapshot.state];
  const waiting = reviews.filter((r) => r.status === "awaiting_owner" || r.status === "prepared");
  const openTickets = tickets.filter((t) => !["resolved", "closed"].includes(t.status));
  const varianceLabel =
    snapshot.variance >= 0
      ? `${snapshot.variance.toFixed(1)} hrs ahead of pace`
      : `${Math.abs(snapshot.variance).toFixed(1)} hrs below pace`;
  const propertyName = (id: string) => included.find((p) => p.propertyId === id)?.name ?? "";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active owner participation</p>
        <h1 className="font-display text-2xl font-semibold">Your 90-day participation progress</h1>
        <p className="text-sm text-muted-foreground">
          {included.length} {included.length === 1 ? "property" : "properties"} in one program ·{" "}
          {OWNER_GOAL_LABEL} combined
        </p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">
              {program.startedOn ? `Day ${snapshot.day} of ${PROGRAM_TOTAL_DAYS}` : "Not started yet"}
            </CardTitle>
            <Badge variant="outline" className={progress.tone}>
              {progress.label}
            </Badge>
          </div>
          <CardDescription>{COMBINED_TOTAL_NOTICE}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={snapshot.percentOfTarget} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Reported hours"
              value={formatHours(reportedMinutes)}
              hint={`${snapshot.percentOfTarget}% of ${OPERATING_TARGET_HOURS} hrs · awaiting review + approved`}
            />
            <Stat label="Pace benchmark" value={`${Math.round(snapshot.benchmark)} hrs`} hint={varianceLabel} />
            <Stat
              label="Days remaining"
              value={String(snapshot.daysLeft)}
              hint={program.endsOn ? `Ends ${program.endsOn}` : "Start date pending"}
            />
            <Stat
              label="To exceed 100"
              value={snapshot.hoursToGoal > 0 ? `${snapshot.hoursToGoal} hrs` : "Reached"}
              hint={`Next milestone: day ${snapshot.next.day} · ${snapshot.next.hours} hrs`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding</p>
              <p className="font-medium">{formatHours(onboardingMinutes)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Operations</p>
              <p className="font-medium">{formatHours(operationalMinutes)}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">ARHA-approved hours</p>
              <p className="font-medium">{formatHours(approvedMinutes)}</p>
              <p className="text-xs text-muted-foreground">Reviewed and approved by your ARHA contact</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Awaiting review</p>
              <p className="font-medium">{formatHours(pendingReviewMinutes)}</p>
              <p className="text-xs text-muted-foreground">Included in reported hours · not yet approved</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Returned to you</p>
              <p className="font-medium">{formatHours(returnedMinutes)}</p>
              <p className="text-xs text-muted-foreground">Not counted until corrected</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            All hours are self-reported. ARHA never estimates, prefills or auto-calculates your time.
          </p>
          <Button
            size="sm"
            onClick={() =>
              setTimeTarget({ reviewId: null, ticketId: null, label: "General participation", propertyIds: [] })
            }
          >
            <Clock className="size-4" /> Log my participation
          </Button>
        </CardContent>
      </Card>

      <ParticipationReportPanel />

      <Card>
        <CardHeader className="pb-3">

          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="size-4 text-primary" /> Your properties
          </CardTitle>
          <CardDescription>
            Each home is measured by the activities and decisions it needs — not by separate hour targets.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {included.length === 0 && (
            <p className="text-sm text-muted-foreground">No properties are attached to your program yet.</p>
          )}
          {included.map((p) => {
            const coverage = COVERAGE_META[p.coverage];
            return (
              <div key={p.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  <Badge variant="outline" className={coverage.tone}>
                    {coverage.label}
                  </Badge>
                </div>
                {p.address && <p className="text-xs text-muted-foreground">{p.address}</p>}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Onboarding: {p.onboardingStatus.replace(/_/g, " ")}</span>
                  <span>Launch: {p.launchStatus.replace(/_/g, " ")}</span>
                  <span>
                    {p.completedTasks} complete · {p.openTasks} open
                  </span>
                  <span>{p.outstandingDecisions} decisions waiting</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last activity: {p.lastOwnerActivityAt ? relativeTime(p.lastOwnerActivityAt) : "none yet"}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setTimeTarget({
                      reviewId: null,
                      ticketId: null,
                      label: p.name,
                      propertyIds: [p.propertyId],
                    })
                  }
                >
                  <Clock className="size-4" /> Log my participation
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <OwnerApprovalPanel readOnly={readOnly} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Waiting on you</CardTitle>
          <CardDescription>Activities and decisions ARHA has prepared for you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {waiting.length === 0 && <p className="text-sm text-muted-foreground">Nothing needs you right now.</p>}
          {waiting.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                  {TASK_TYPE_META[(r.task_type ?? "program_wide") as TaskType].label}
                </Badge>
                <Badge variant="outline" className={DECISION_PATHS[r.decision_path as keyof typeof DECISION_PATHS]?.tone}>
                  {DECISION_PATHS[r.decision_path as keyof typeof DECISION_PATHS]?.label ?? r.decision_path}
                </Badge>
                <span className="text-sm font-medium">{r.title}</span>
                {r.respond_by && <span className="ml-auto text-xs text-muted-foreground">By {r.respond_by}</span>}
              </div>
              {r.propertyIds.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.propertyIds.map(propertyName).filter(Boolean).join(" · ")}
                </p>
              )}
              {(r.business_question || r.recommendation) && (
                <p className="mt-1 text-sm text-muted-foreground">{r.business_question ?? r.recommendation}</p>
              )}
              {r.impact && <p className="mt-1 text-xs text-muted-foreground">Potential impact: {r.impact}</p>}
              <ReviewPhotos photos={r.photos ?? []} size="lg" />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setAnswering(r)}>
                  Respond
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setTimeTarget({
                      reviewId: r.id,
                      ticketId: r.ticket_id,
                      label: r.title,
                      propertyIds: r.propertyIds,
                    })
                  }
                >
                  <Clock className="size-4" /> Log my participation
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <OwnerFilesPanel />

      <OwnerBadges earned={badges} reportedHours={hoursFromMinutes(reportedMinutes)} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-primary" /> Alerts
            {unread.length > 0 && <Badge className="ml-1">{unread.length} new</Badge>}
          </CardTitle>
          <CardDescription>Everything ARHA has sent you, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {alerts.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          {alerts.slice(0, 15).map((a) => {
            const label = alertLabel(a.kind);
            return (
              <div
                key={a.id}
                className={`rounded-md border p-3 ${a.read_at ? "border-border" : "border-primary/40 bg-primary/5"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={label.tone}>
                    {label.label}
                  </Badge>
                  <span className="text-sm font-medium">{a.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{relativeTime(a.created_at)}</span>
                </div>
                {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.email_status === "sent" ? "Emailed" : "In-app"}
                  {a.sms_status === "escalated" ? " · your ARHA contact is reaching out personally" : ""}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Activity at your homes</CardTitle>
              <CardDescription>
                Every ticket our team opens appears here automatically — {openTickets.length} open now.
              </CardDescription>
            </div>
            {!readOnly && included.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setOpeningMatter(true)}>
                <Plus className="size-4" /> Open a ticket
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {tickets.length === 0 && <p className="text-sm text-muted-foreground">No matters logged yet.</p>}
          {tickets.slice(0, 20).map((t) => (
            <div key={t.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    t.priority === "p1"
                      ? "border-destructive/20 bg-destructive/10 text-destructive"
                      : "border-border bg-muted text-muted-foreground"
                  }
                >
                  {t.priority.toUpperCase()}
                </Badge>
                <span className="text-sm font-medium">
                  #{t.ref} {t.title}
                </span>
                {t.owner_submitted && (
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                    You opened this
                    {t.owner_participation_path ? ` · ${t.owner_participation_path}` : ""}
                  </Badge>
                )}
                <span className="ml-auto text-xs capitalize text-muted-foreground">
                  {t.status.replace(/_/g, " ")}
                </span>
              </div>
              {t.property_id && (
                <p className="mt-0.5 text-xs text-muted-foreground">{propertyName(t.property_id)}</p>
              )}
              {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
              {t.resolution_notes && (
                <p className="mt-1 flex gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="size-4 shrink-0" /> {t.resolution_notes}
                </p>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="mt-2"
                onClick={() =>
                  setTimeTarget({
                    reviewId: null,
                    ticketId: t.id,
                    label: `#${t.ref} ${t.title}`,
                    propertyIds: t.property_id ? [t.property_id] : [],
                  })
                }
              >
                <Clock className="size-4" /> Log my participation
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {!readOnly && <AlertPreferences program={program} onSaved={onChange} />}



      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your participation log</CardTitle>
          <CardDescription>
            {entries.length} entries recorded. A saved entry is never edited. If your ARHA contact returns one,
            you can correct it here — the original stays in your history and only the corrected entry counts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {entries.slice(0, 15).map((e) => (
            <div key={e.id} className="border-b border-border/60 py-1.5 text-sm last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">{e.entry_date}</span>
                <span>{e.activity}</span>
                {e.propertyIds.length > 1 && (
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                    Shared · {e.propertyIds.length} homes
                  </Badge>
                )}
                {e.superseded && (
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                    Superseded · not counted
                  </Badge>
                )}
                {e.amends_entry_id && (
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                    Correction
                  </Badge>
                )}
                {e.review_status && e.review_status !== "submitted" && (
                  <Badge
                    variant="outline"
                    className={
                      e.review_status === "approved"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                        : "border-amber-500/20 bg-amber-500/10 text-amber-700"
                    }
                  >
                    {e.review_status}
                  </Badge>
                )}
                <span className="ml-auto font-medium">{e.minutes} min</span>
              </div>
              {e.review_status === "returned" && (
                <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md bg-muted/60 px-2 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    {e.review_note
                      ? `Sent back for a small correction — ${e.review_note}`
                      : "Sent back for a small correction. Your hours are not lost; adjust the entry and resubmit."}
                  </span>
                  {!readOnly && !e.superseded && (
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => setCorrecting(e)}>
                      Correct and resubmit
                    </Button>
                  )}
                  {e.superseded && (
                    <span className="ml-auto text-xs text-muted-foreground">Corrected already</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {!readOnly && correcting && (
        <CorrectEntryDialog entry={correcting} onClose={() => setCorrecting(null)} onSaved={onChange} />
      )}


      {!readOnly && timeTarget && (
        <LogTimeDialog
          programId={program.id}
          properties={included.map((p) => ({ id: p.propertyId, name: p.name, closingDate: p.closingDate }))}
          existingEntries={entries}
          target={timeTarget}
          onClose={() => setTimeTarget(null)}
          onSaved={onChange}
        />
      )}
      {!readOnly && openingMatter && (
        <OpenMatterDialog
          programId={program.id}
          properties={included.map((p) => ({ id: p.propertyId, name: p.name }))}
          onClose={() => setOpeningMatter(false)}
          onSaved={onChange}
        />
      )}
      {!readOnly && answering && (
        <RespondDialog review={answering} onClose={() => setAnswering(null)} onSaved={onChange} />
      )}
    </div>
  );
}

/**
 * The homeowner corrects an entry a reviewer returned. Nothing is prefilled
 * with an estimate: the minutes and description carry over exactly as the
 * owner first reported them, for the owner to change.
 */
function CorrectEntryDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: HomeData["entries"][number];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [minutes, setMinutes] = useState(String(entry.minutes));
  const [activity, setActivity] = useState(entry.activity);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const resubmit = useServerFn(resubmitOwnerParticipation);

  const total = Number.parseInt(minutes || "0", 10) || 0;
  const valid = total >= 1 && total <= 1440 && activity.trim().length >= 3 && confirmed;

  const mutation = useMutation({
    mutationFn: () =>
      resubmit({
        data: { entryId: entry.id, minutes: total, activity: activity.trim(), note, confirmed: true as const },
      }),
    onSuccess: () => {
      toast.success("Corrected entry resubmitted for review.");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct and resubmit</DialogTitle>
          <DialogDescription>
            {entry.review_note
              ? `Your ARHA contact asked for one change — ${entry.review_note}. Nothing is lost: update the entry below and resubmit it.`
              : "Your ARHA contact asked for a small correction. Nothing is lost — update the entry below and resubmit it."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="correct-minutes">Minutes you actually spent</Label>
            <Input
              id="correct-minutes"
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="correct-activity">What you did</Label>
            <Textarea
              id="correct-activity"
              rows={3}
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="correct-note">Note for your ARHA contact (optional)</Label>
            <Textarea id="correct-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">{MANUAL_ENTRY_NOTICE}</p>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <span>{MANUAL_ENTRY_CONFIRMATION}</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || mutation.isPending} onClick={() => mutation.mutate()}>
            Resubmit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function AlertPreferences({ program, onSaved }: { program: HomeData["program"]; onSaved: () => void }) {
  const [email, setEmail] = useState(program.notifyEmail);
  const [smsP1, setSmsP1] = useState(program.notifySmsP1);
  const [push, setPush] = useState(program.notifyPush);
  const [phone, setPhone] = useState(program.ownerPhone ?? "");
  const save = useServerFn(saveOwnerAlertPreferences);

  const mutation = useMutation({
    mutationFn: () => save({ data: { email, smsP1, push, phone } }),
    onSuccess: () => {
      toast.success("Alert settings saved.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function enablePush(next: boolean) {
    setPush(next);
    if (next && typeof Notification !== "undefined" && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">How we reach you</CardTitle>
        <CardDescription>Urgent tickets reach you personally; everything else comes by email and in-app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="pref-push" className="flex items-center gap-2 font-normal">
            <Bell className="size-4 text-muted-foreground" /> In-app and device alerts
          </Label>
          <Switch id="pref-push" checked={push} onCheckedChange={(v) => void enablePush(v)} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="pref-email" className="flex items-center gap-2 font-normal">
            <Mail className="size-4 text-muted-foreground" /> Email me ({program.ownerEmail ?? "no address on file"})
          </Label>
          <Switch id="pref-email" checked={email} onCheckedChange={setEmail} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="pref-sms" className="flex items-center gap-2 font-normal">
            <MessageSquare className="size-4 text-muted-foreground" /> Call or text me for urgent (P1) tickets
          </Label>
          <Switch id="pref-sms" checked={smsP1} onCheckedChange={setSmsP1} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pref-phone">Mobile number for urgent contact</Label>
          <Input
            id="pref-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 123 4567"
          />
        </div>
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Save settings
        </Button>
      </CardContent>
    </Card>
  );
}

function LogTimeDialog({
  programId,
  properties,
  existingEntries,
  target,
  onClose,
  onSaved,
}: {
  programId: string;
  properties: { id: string; name: string; closingDate: string | null }[];
  existingEntries: ExistingEntry[];
  target: TimeTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Nothing here is ever prefilled or suggested: the owner reports the time they actually spent.
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [activity, setActivity] = useState("");
  const [category, setCategory] = useState("");
  const [output, setOutput] = useState("");
  const [comments, setComments] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<"onboarding" | "ongoing">("onboarding");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<string[]>(target.propertyIds);
  const log = useServerFn(logOwnerParticipation);

  const totalMinutes = (Number.parseInt(hours || "0", 10) || 0) * 60 + (Number.parseInt(minutes || "0", 10) || 0);
  const minutesValid = totalMinutes >= 1 && totalMinutes <= 1440;

  // Warning only — never a block. The homeowner always decides.
  const [duplicate, setDuplicate] = useState<ExistingEntry | null>(null);
  const [dupAcknowledged, setDupAcknowledged] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      log({
        data: {
          programId,
          phase,
          entryDate,
          minutes: totalMinutes,
          activity,
          activityCategory: category,
          output,
          comments,
          attachmentPath: null,
          reviewId: target.reviewId,
          ticketId: target.ticketId,
          propertyIds: selected,
          confirmed: true as const,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        res.awarded.length > 0 ? "Participation recorded — a new achievement is unlocked." : "Participation recorded.",
      );
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  function attemptSave() {
    if (!dupAcknowledged) {
      const match = findPossibleDuplicate(
        { entryDate, minutes: totalMinutes, activity, activityCategory: category, comments },
        existingEntries,
      );
      if (match) {
        setDuplicate(match);
        return;
      }
    }
    mutation.mutate();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log my participation</DialogTitle>
          <DialogDescription>{MANUAL_ENTRY_NOTICE}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="time-date">Date</Label>
              <Input id="time-date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="time-hr">Hours</Label>
              <Input
                id="time-hr"
                type="number"
                inputMode="numeric"
                min={0}
                max={24}
                placeholder="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="time-min">Minutes</Label>
              <Input
                id="time-min"
                type="number"
                inputMode="numeric"
                min={0}
                max={59}
                placeholder="0"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="time-category">Activity category</Label>
            <select
              id="time-category"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category</option>
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="time-activity">What you personally completed</Label>
            <Input
              id="time-activity"
              value={activity}
              placeholder="Describe the review, research, meeting or decision"
              onChange={(e) => setActivity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Related to: {target.label}</p>
          </div>

          {properties.length > 0 && (
            <div className="space-y-2">
              <Label>Properties involved</Label>
              <div className="space-y-1.5 rounded-md border border-border p-3">
                {properties.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                    <span>{p.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                If one activity covered several homes, select each of them and enter the total time once. It is
                counted once toward your combined program total.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="time-output">Decision or outcome</Label>
            <Textarea id="time-output" value={output} onChange={(e) => setOutput(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="time-comments">Comments (optional)</Label>
            <Textarea id="time-comments" value={comments} onChange={(e) => setComments(e.target.value)} rows={2} />
          </div>

          <div className="flex gap-2">
            {(["onboarding", "ongoing"] as const).map((p) => (
              <Button key={p} size="sm" variant={phase === p ? "default" : "outline"} onClick={() => setPhase(p)}>
                {p === "onboarding" ? "Onboarding" : "Operations"}
              </Button>
            ))}
          </div>

          <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
            <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
            <span>{MANUAL_ENTRY_CONFIRMATION}</span>
          </label>

          {duplicate && (
            <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm font-medium text-amber-800">Possible duplicate</p>
              <p className="text-xs text-amber-900/90">
                A similar entry already exists for this date. Review before submitting.
              </p>
              <div className="rounded-md bg-background/70 p-2 text-xs text-muted-foreground">
                <span className="numeric">{duplicate.entry_date}</span> · {duplicate.minutes} min
                {duplicate.activity_category ? ` · ${duplicate.activity_category}` : ""}
                <br />
                {duplicate.activity}
              </div>
              <p className="text-xs text-amber-900/90">
                If this is separate work you actually did, you can submit it anyway — your real hours are never
                capped.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setDuplicate(null)}>
                  Go back and edit
                </Button>
                <Button
                  size="sm"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setDupAcknowledged(true);
                    setDuplicate(null);
                    mutation.mutate();
                  }}
                >
                  Submit anyway
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || !minutesValid || !confirmed || activity.trim().length < 3}
            onClick={attemptSave}
          >
            Save entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RespondDialog({
  review,
  onClose,
  onSaved,
}: {
  review: { id: string; title: string; evidence?: string | null; photos?: ReviewPhoto[] };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [decision, setDecision] = useState("approved");
  const [response, setResponse] = useState("");
  const answer = useServerFn(answerOwnerReview);

  const mutation = useMutation({
    mutationFn: () => answer({ data: { reviewId: review.id, decision, response } }),
    onSuccess: () => {
      toast.success("Your response is with the team.");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{review.title}</DialogTitle>
          <DialogDescription>Your decision goes straight to the team handling your program.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {(review.photos?.length ?? 0) > 0 && (
            <div>
              <p className="text-sm font-medium">Photos from the team</p>
              <p className="text-xs text-muted-foreground">Tap a photo to see it full size.</p>
              <ReviewPhotos photos={review.photos ?? []} size="lg" />
            </div>
          )}
          {review.evidence && <p className="text-sm text-muted-foreground">{review.evidence}</p>}
          <div className="flex flex-wrap gap-2">
            {["approved", "declined", "needs discussion"].map((d) => (
              <Button key={d} size="sm" variant={decision === d ? "default" : "outline"} onClick={() => setDecision(d)}>
                <span className="capitalize">{d}</span>
              </Button>
            ))}
          </div>
          <div className="space-y-1">
            <Label htmlFor="resp">Your notes</Label>
            <Textarea id="resp" rows={4} value={response} onChange={(e) => setResponse(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            Send response
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/**
 * A homeowner opens a ticket at their own enrolled home. ARHA keeps
 * operational control: the owner chooses how they want to participate, not
 * the priority, the assignee or the closure.
 */
const OWNER_PATHS = [
  { id: "inform", label: "Just so you know", blurb: "Share it — ARHA handles it and reports back." },
  { id: "consult", label: "I'd like to weigh in", blurb: "ARHA asks for your input before deciding." },
  { id: "approve", label: "I want to approve this", blurb: "ARHA waits for your authorisation." },
  { id: "emergency", label: "Urgent", blurb: "Something needs attention right now." },
] as const;

function OpenMatterDialog({
  programId,
  properties,
  onClose,
  onSaved,
}: {
  programId: string;
  properties: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const create = useServerFn(createOwnerMatterFn);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [path, setPath] = useState<(typeof OWNER_PATHS)[number]["id"]>("inform");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const save = useMutation({
    mutationFn: () =>
      create({
        data: { programId, propertyId, path, title: title.trim(), description: description.trim(), category: "maintenance" },
      }),
    onSuccess: (r) => {
      toast.success(`Ticket #${r.ref} is with the ARHA team.`);
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a ticket</DialogTitle>
          <DialogDescription>
            Tell us what is going on at your home. Our team takes it from here and keeps you posted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Home</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>How would you like to be involved?</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {OWNER_PATHS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPath(p.id)}
                  className={`rounded-md border p-2 text-left text-sm transition-colors ${
                    path === p.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                  }`}
                >
                  <span className="font-medium">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">{p.blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner-matter-title">What is happening?</Label>
            <Input
              id="owner-matter-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Kitchen faucet is dripping"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner-matter-detail">Any detail that helps</Label>
            <Textarea
              id="owner-matter-detail"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={title.trim().length < 4 || !propertyId || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Sending…" : "Send to ARHA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
