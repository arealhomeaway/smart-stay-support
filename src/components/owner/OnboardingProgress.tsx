/**
 * How the homeowner's onboarding is going — counts only.
 *
 * Four tracks, one meter each, plus an overall figure. No task titles,
 * assignees, blockers, vendors or costs ever appear here.
 */
import { CalendarClock } from "lucide-react";
import { SectionCard } from "@/components/ui/page";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { usCalendarDate } from "@/lib/dates";
import { ownerGoLive } from "@/lib/owner-onboarding";
import { todayCalendarDate } from "@/lib/onboarding-golive";
import type { OwnerOnboardingHome } from "@/lib/owner-onboarding.server";

export function OnboardingProgress({ homes }: { homes: OwnerOnboardingHome[] }) {
  if (homes.length === 0) return null;
  const today = todayCalendarDate();

  return (
    <SectionCard
      title="Getting your home ready"
      description="Where each part of the setup stands today. We update this as the work is completed."
    >
      <div className="space-y-6">
        {homes.map((home) => (
          <div key={home.propertyId} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">{home.name}</p>
              <p className="numeric text-xs text-muted-foreground">
                {home.percent}% complete · {home.done} of {home.total} steps done
              </p>
            </div>
            <Progress value={home.percent} aria-label={`${home.name} overall progress`} />
            <div className="grid gap-3 sm:grid-cols-2">
              {home.tracks.map((track) => (
                <div key={track.key} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{track.label}</p>
                    <span className="numeric text-xs text-muted-foreground">
                      {track.done}/{track.total}
                    </span>
                  </div>
                  <Progress
                    className="mt-2 h-1.5"
                    value={track.percent}
                    aria-label={`${home.name} — ${track.label}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
