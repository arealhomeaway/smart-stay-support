import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Award, Flame, Camera, Clock } from "lucide-react";
import { myScorecard } from "@/lib/scorecard.functions";
import { TIER_BLURB, TIER_LABEL } from "@/lib/scorecard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/vendor/scorecard")({
  component: Scorecard,
  head: () => ({
    meta: [
      { title: "My scorecard | Resolve vendor portal" },
      {
        name: "description",
        content:
          "Your private A Real Home Away scorecard: points earned for thorough work, your partner tier and progress toward Gold Standard.",
      },
      { property: "og:title", content: "My scorecard | Resolve vendor portal" },
      { property: "og:description", content: "Points, tier and progress toward Gold Standard partner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Scorecard() {
  const load = useServerFn(myScorecard);
  const card = useQuery({ queryKey: ["my-scorecard"], queryFn: () => load() });

  if (card.isLoading) return <Skeleton className="h-96 w-full" />;
  const s = card.data;
  if (!s) return null;

  const goldProgress = Math.min(100, ((5 - s.jobsToGold) / 5) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/vendor">
          <ArrowLeft className="size-4" /> My jobs
        </Link>
      </Button>

      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">My scorecard</h1>
        <p className="text-sm text-muted-foreground">
          Private to you. We never show your scores to other vendors, and you never see theirs — the ranking below
          is anonymous.
        </p>
      </header>

      <Card className="border-primary/40 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <Award className="size-5 text-primary" />
            {TIER_LABEL[s.tier]}
            {s.percentile !== null && <Badge variant="secondary">Top {s.percentile}% of ARHA vendors</Badge>}
          </CardTitle>
          <CardDescription>{TIER_BLURB[s.tier]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Points" value={String(s.points)} />
            <Stat label="Jobs scored" value={String(s.ratedJobs)} />
            <Stat
              label="Average score"
              value={s.averageOverall !== null ? `${s.averageOverall.toFixed(1)}/5` : "—"}
            />
            <Stat label="Streak" value={`${s.streak}`} icon={<Flame className="size-4 text-amber-500" />} />
          </div>

          {s.tier !== "gold" && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span>Progress to Gold Standard</span>
                <span className="text-muted-foreground">
                  {5 - s.jobsToGold}/5 above-average jobs
                </span>
              </div>
              <Progress value={goldProgress} />
              <p className="text-xs text-muted-foreground">
                {s.jobsToGold} more job{s.jobsToGold === 1 ? "" : "s"} scored above the ARHA vendor average and
                you're Gold Standard — first call on urgent work.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Camera className="size-4" /> Photo evidence
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {s.photoRate !== null ? `${s.photoRate}%` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4" /> On time
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {s.onTimeRate !== null ? `${s.onTimeRate}%` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Callbacks</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{s.reopenCount}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">How points work</CardTitle>
          <CardDescription>Thoroughness is worth the most — finish the job, don't just stop the leak.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Every completed job starts at 10 points.</p>
          <p>Thoroughness moves your score the most, then communication and timeliness.</p>
          <p>+10 for complete photo evidence, +8 for finishing inside the window, +6 for taking urgent P1 work.</p>
          <p>−20 if we have to send you back for the same issue.</p>
        </CardContent>
      </Card>

      {s.recent.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent scored jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {s.recent.map((r) => (
              <div
                key={r.ticketId}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="font-medium">
                  {r.ref ? `#${r.ref} ` : ""}
                  {r.title}
                </span>
                <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                <span className="ml-auto">{r.overall.toFixed(1)}/5</span>
                <Badge variant="secondary">+{r.points}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="flex items-center gap-1.5 text-2xl font-semibold">
        {icon}
        {value}
      </p>
    </div>
  );
}
