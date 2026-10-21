import { LaunchStateGate } from "@/components/LaunchStateGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Award, Flame, Camera, Clock } from "lucide-react";
import { myScorecard } from "@/lib/scorecard.functions";
import { TIER_BLURB, TIER_LABEL } from "@/lib/scorecard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LoadingRows, PageHeader, SectionBand, SectionCard, StatTile } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { usDate } from "@/lib/dates";

export const Route = createFileRoute("/_authenticated/vendor/scorecard")({
  component: GatedScorecard,
  head: () => ({
    meta: [
      { title: "My scorecard | Resolve vendor portal" },
      {
        name: "description",
        content:
          "Your private A Real Home Away scorecard: points earned for thorough work, your partner tier and progress toward Gold Standard.",
      },
      { property: "og:title", content: "My scorecard | Resolve vendor portal" },
      {
        property: "og:description",
        content: "Points, tier and progress toward Gold Standard partner.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function GatedScorecard() {
  return (
    <LaunchStateGate
      flag="vendor_portal"
      title="Scorecards are not part of the Operations beta"
      description="Vendor scoring launches with the Vendor Portal workstream."
    >
      <Scorecard />
    </LaunchStateGate>
  );
}

function Scorecard() {
  const load = useServerFn(myScorecard);
  const card = useQuery({ queryKey: ["my-scorecard"], queryFn: () => load() });

  if (card.isLoading) return <LoadingRows rows={5} />;
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

      <PageHeader
        title="My scorecard"
        description="Private to you. We never show your scores to other vendors, and you never see theirs — the ranking below is anonymous."
      />

      <SectionCard
        className="border-primary/30 bg-primary/5"
        title={
          <span className="flex flex-wrap items-center gap-2">
            <Award className="size-5 text-primary" />
            {TIER_LABEL[s.tier]}
            {s.percentile !== null && (
              <StatusBadge tone="brand">Top {s.percentile}% of ARHA vendors</StatusBadge>
            )}
          </span>
        }
        description={TIER_BLURB[s.tier]}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Points" value={s.points} />
            <StatTile label="Work orders scored" value={s.ratedJobs} />
            <StatTile
              label="Average score"
              value={s.averageOverall !== null ? `${s.averageOverall.toFixed(1)}/5` : "—"}
            />
            <StatTile
              label="Streak"
              value={
                <span className="flex items-center gap-1.5">
                  <Flame className="size-4 text-amber" />
                  {s.streak}
                </span>
              }
            />
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
                {s.jobsToGold} more job{s.jobsToGold === 1 ? "" : "s"} scored above the ARHA vendor
                average and you're Gold Standard — first call on urgent work.
              </p>
            </div>
          )}
        </div>
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Photo evidence"
          value={s.photoRate !== null ? `${s.photoRate}%` : "—"}
          hint={
            <span className="flex items-center gap-1.5">
              <Camera className="size-3.5" /> Complete photo sets
            </span>
          }
        />
        <StatTile
          label="On time"
          value={s.onTimeRate !== null ? `${s.onTimeRate}%` : "—"}
          hint={
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" /> Finished inside the window
            </span>
          }
        />
        <StatTile
          label="Callbacks"
          value={s.reopenCount}
          tone={s.reopenCount > 0 ? "attention" : "neutral"}
        />
      </div>

      <SectionCard
        title="How points work"
        description="Thoroughness is worth the most — finish the job, don't just stop the leak."
      >
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>Every completed Work Order starts at 10 points.</p>
          <p>Thoroughness moves your score the most, then communication and timeliness.</p>
          <p>
            +10 for complete photo evidence, +8 for finishing inside the window, +6 for taking
            urgent P1 work.
          </p>
          <p>−20 if we have to send you back for the same issue.</p>
        </div>
      </SectionCard>

      {s.recent.length > 0 && (
        <div className="space-y-3">
          <SectionBand title="Recent scored Work Orders" />
          <div className="space-y-1.5">
            {s.recent.map((r) => (
              <div
                key={r.ticketId}
                className="surface-row flex flex-wrap items-center gap-2 py-2.5 pl-4 pr-4 text-sm"
              >
                <span className="font-medium">
                  {r.ref ? `#${r.ref} ` : ""}
                  {r.title}
                </span>
                <span className="text-muted-foreground">{usDate(r.createdAt)}</span>
                <span className="numeric ml-auto">{r.overall.toFixed(1)}/5</span>
                <StatusBadge tone="brand">+{r.points}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
