/**
 * "My milestones" — restrained, ARHA-branded recognition of legitimate
 * participation. These never add, estimate or suggest time and they never
 * imply tax qualification.
 */

import { Award, Lock } from "lucide-react";
import { BADGES, BADGE_HOURS_NOTE, nextHourBadge } from "@/lib/owner-participation";
import { SectionCard } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { usDate } from "@/lib/dates";

export type EarnedBadge = {
  code: string;
  awarded_at: string;
  trigger_rule: string;
  needs_review: boolean;
};

export function OwnerBadges({
  earned,
  reportedHours,
}: {
  earned: EarnedBadge[];
  reportedHours: number;
}) {
  const earnedCodes = earned.map((b) => b.code);
  const next = nextHourBadge(reportedHours, earnedCodes);

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Award className="size-4 text-primary" /> Your milestones
        </span>
      }
      description={BADGE_HOURS_NOTE}
    >
      <div className="space-y-4">
        {next && (
          <div className="rounded-xl border border-sage/25 bg-sage/8 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Next: {next.badge.name}</p>
              <span className="text-xs text-muted-foreground">
                {next.hoursAway} hr{next.hoursAway === 1 ? "" : "s"} of reported time away
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-sage"
                style={{ width: `${Math.max(0, Math.min(100, next.percent))}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {BADGES.map((def) => {
            const got = earned.find((b) => b.code === def.code);
            return (
              <div
                key={def.code}
                className={`flex gap-3 rounded-lg p-3 ${
                  got ? "bg-sage/8" : "bg-sunken"
                }`}
              >
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                    got ? "bg-sage/15 text-sage" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {got ? <Award className="size-4" /> : <Lock className="size-3.5" />}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{def.name}</p>
                    {got?.needs_review && <StatusBadge tone="waiting">Under review</StatusBadge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{def.requirement}</p>
                  {got && (
                    <p className="text-xs text-sage">Earned {usDate(got.awarded_at)}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
