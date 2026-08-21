import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCircle2, Clock, KeyRound, Mail, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import {
  answerOwnerReview,
  logOwnerParticipation,
  markOwnerAlertsRead,
  ownerHome,
  redeemInvite,
  saveOwnerAlertPreferences,
} from "@/lib/owner-portal.functions";
import { alertLabel, relativeTime } from "@/lib/owner-notify";
import { DECISION_PATHS, formatHours, hoursFromMinutes, paceState, PACE_LABELS } from "@/lib/owner-program";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      { title: "Owner hub — Active Owner Participation" },
      {
        name: "description",
        content:
          "Your home's live activity, the decisions waiting on you, and the participation hours you have logged toward the 90-day program.",
      },
      { property: "og:title", content: "Owner hub — Active Owner Participation" },
      {
        property: "og:description",
        content: "Track your home, answer reviews and log participation time in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OwnerHubPage,
});

type TimeTarget = { reviewId: string | null; ticketId: string | null; label: string };

function OwnerHubPage() {
  const qc = useQueryClient();
  const load = useServerFn(ownerHome);
  const home = useQuery({ queryKey: ["owner-home"], queryFn: () => load() });
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["owner-home"] });

  if (home.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!home.data?.linked) return <LinkInvite onLinked={invalidate} />;

  return <OwnerHub data={home.data} onChange={invalidate} />;
}

/** First run: the owner types the code ARHA gave them to attach their home. */
function LinkInvite({ onLinked }: { onLinked: () => void }) {
  const [code, setCode] = useState("");
  const redeem = useServerFn(redeemInvite);
  const link = useMutation({
    mutationFn: () => redeem({ data: { code } }),
    onSuccess: () => {
      toast.success("Your home is connected.");
      onLinked();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" /> Connect your home
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

type HomeData = Extract<Awaited<ReturnType<typeof ownerHome>>, { linked: true }>;

function OwnerHub({ data, onChange }: { data: HomeData; onChange: () => void }) {
  const { program, alerts, reviews, tickets, entries, reportedMinutes } = data;
  const [timeTarget, setTimeTarget] = useState<TimeTarget | null>(null);
  const [answering, setAnswering] = useState<(typeof reviews)[number] | null>(null);

  const markRead = useServerFn(markOwnerAlertsRead);
  const unread = useMemo(() => alerts.filter((a) => !a.read_at), [alerts]);

  // Opening the hub is the acknowledgement — clear the badge once seen.
  useEffect(() => {
    if (unread.length === 0) return;
    const ids = unread.map((a) => a.id);
    const timer = setTimeout(() => {
      void markRead({ data: { ids } }).then(onChange);
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.length]);

  const pace = paceState(program.startedOn, reportedMinutes, program.targetHours);
  const paceInfo = PACE_LABELS[pace.state];
  const pct = Math.min(100, Math.round((hoursFromMinutes(reportedMinutes) / program.targetHours) * 100));
  const waiting = reviews.filter((r) => r.status === "awaiting_owner" || r.status === "prepared");
  const openTickets = tickets.filter((t) => !["resolved", "closed"].includes(t.status));
  const onboardingMinutes = entries
    .filter((e) => e.phase === "onboarding")
    .reduce((n, e) => n + e.minutes, 0);
  const ongoingMinutes = reportedMinutes - onboardingMinutes;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active owner participation</p>
        <h1 className="font-display text-2xl font-semibold">{program.propertyName}</h1>
        <p className="text-sm text-muted-foreground">{program.location}</p>
      </header>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Your participation</CardTitle>
            <Badge variant="outline" className={paceInfo.tone}>
              {paceInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={pct} />
          <p className="text-sm text-muted-foreground">
            {formatHours(reportedMinutes)} logged of {program.targetHours}+ hours
            {program.endsOn ? ` · program ends ${program.endsOn}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding</p>
              <p className="font-medium">{formatHours(onboardingMinutes)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Operations</p>
              <p className="font-medium">{formatHours(ongoingMinutes)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            All hours are self-reported. ARHA never estimates, prefills or auto-calculates your time.
          </p>
          <Button size="sm" onClick={() => setTimeTarget({ reviewId: null, ticketId: null, label: "General participation" })}>
            <Clock className="size-4" /> Log time
          </Button>
        </CardContent>
      </Card>

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
                  {a.sms_status === "sent" ? " · texted" : ""}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Waiting on you</CardTitle>
          <CardDescription>Reviews ARHA has prepared for your decision.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {waiting.length === 0 && <p className="text-sm text-muted-foreground">Nothing needs you right now.</p>}
          {waiting.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={DECISION_PATHS[r.decision_path as keyof typeof DECISION_PATHS]?.tone}>
                  {DECISION_PATHS[r.decision_path as keyof typeof DECISION_PATHS]?.label ?? r.decision_path}
                </Badge>
                <span className="text-sm font-medium">{r.title}</span>
                {r.respond_by && <span className="ml-auto text-xs text-muted-foreground">By {r.respond_by}</span>}
              </div>
              {r.recommendation && <p className="mt-1 text-sm text-muted-foreground">{r.recommendation}</p>}
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setAnswering(r)}>
                  Respond
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTimeTarget({ reviewId: r.id, ticketId: r.ticket_id, label: r.title })}
                >
                  <Clock className="size-4" /> Log time
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity at your home</CardTitle>
          <CardDescription>
            Every matter our team opens on this home appears here automatically — {openTickets.length} open now.
          </CardDescription>
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
                <span className="ml-auto text-xs capitalize text-muted-foreground">
                  {t.status.replace(/_/g, " ")}
                </span>
              </div>
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
                onClick={() => setTimeTarget({ reviewId: null, ticketId: t.id, label: `#${t.ref} ${t.title}` })}
              >
                <Clock className="size-4" /> Log my review time
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertPreferences program={program} onSaved={onChange} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your time log</CardTitle>
          <CardDescription>{entries.length} entries recorded. Entries cannot be edited once saved.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {entries.slice(0, 12).map((e) => (
            <div key={e.id} className="flex flex-wrap gap-2 border-b border-border/60 py-1.5 text-sm last:border-0">
              <span className="text-muted-foreground">{e.entry_date}</span>
              <span>{e.activity}</span>
              <span className="ml-auto font-medium">{e.minutes} min</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {timeTarget && (
        <LogTimeDialog
          programId={program.id}
          target={timeTarget}
          onClose={() => setTimeTarget(null)}
          onSaved={onChange}
        />
      )}
      {answering && (
        <RespondDialog review={answering} onClose={() => setAnswering(null)} onSaved={onChange} />
      )}
    </div>
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
        <CardDescription>Urgent matters can text you; everything else comes by email and in-app.</CardDescription>
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
            <MessageSquare className="size-4 text-muted-foreground" /> Text me for urgent (P1) matters only
          </Label>
          <Switch id="pref-sms" checked={smsP1} onCheckedChange={setSmsP1} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pref-phone">Mobile number for urgent texts</Label>
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
  target,
  onClose,
  onSaved,
}: {
  programId: string;
  target: TimeTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Nothing here is ever prefilled or suggested: the owner reports the time they actually spent.
  const [minutes, setMinutes] = useState("");
  const [activity, setActivity] = useState("");
  const [output, setOutput] = useState("");
  const [phase, setPhase] = useState<"onboarding" | "ongoing">("onboarding");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const log = useServerFn(logOwnerParticipation);

  const parsedMinutes = Number.parseInt(minutes, 10);
  const minutesValid = Number.isFinite(parsedMinutes) && parsedMinutes >= 1 && parsedMinutes <= 1440;

  const mutation = useMutation({
    mutationFn: () =>
      log({
        data: {
          programId,
          phase,
          entryDate,
          minutes: parsedMinutes,
          activity,
          output,
          reviewId: target.reviewId,
          ticketId: target.ticketId,
        },
      }),
    onSuccess: () => {
      toast.success("Time recorded.");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log participation time</DialogTitle>
          <DialogDescription>
            Record only the time you actually spent. This entry is permanent and appears in your report.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="time-date">Date</Label>
              <Input id="time-date" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="time-min">Minutes you personally spent</Label>
              <Input
                id="time-min"
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                placeholder="Enter minutes"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="time-activity">What you personally did</Label>
            <Input
              id="time-activity"
              value={activity}
              placeholder="Describe the review, research, meeting or decision"
              onChange={(e) => setActivity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Related to: {target.label}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="time-output">Decision or outcome (optional)</Label>
            <Textarea id="time-output" value={output} onChange={(e) => setOutput(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-2">
            {(["onboarding", "ongoing"] as const).map((p) => (
              <Button key={p} size="sm" variant={phase === p ? "default" : "outline"} onClick={() => setPhase(p)}>
                {p === "onboarding" ? "Onboarding" : "Ongoing"}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending || !minutesValid || activity.trim().length < 3}
            onClick={() => mutation.mutate()}
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
  review: { id: string; title: string };
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
          <DialogDescription>Your decision goes straight to the team handling this home.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
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
