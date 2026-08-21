/**
 * "My Achievements" — restrained, ARHA-branded recognition of legitimate
 * participation. Badges never add, estimate or suggest time and they never
 * imply tax qualification.
 */

import { Award, Lock } from "lucide-react";
import { BADGES, BADGE_HOURS_NOTE, nextHourBadge } from "@/lib/owner-participation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="size-4 text-primary" /> My achievements
        </CardTitle>
        <CardDescription>{BADGE_HOURS_NOTE}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {next && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Next: {next.badge.name}</p>
              <span className="text-xs text-muted-foreground">
                {next.hoursAway} hr{next.hoursAway === 1 ? "" : "s"} of reported participation away
              </span>
            </div>
            <Progress value={next.percent} className="mt-2" />
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {BADGES.map((def) => {
            const got = earned.find((b) => b.code === def.code);
            return (
              <div
                key={def.code}
                className={`flex gap-3 rounded-lg border p-3 transition-colors ${
                  got
                    ? "animate-in fade-in border-primary/30 bg-primary/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                    got ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {got ? <Award className="size-4" /> : <Lock className="size-3.5" />}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{def.name}</p>
                    {got?.needs_review && (
                      <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-700">
                        Under review
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{def.requirement}</p>
                  {got && (
                    <p className="text-xs text-primary">
                      Earned {new Date(got.awarded_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
