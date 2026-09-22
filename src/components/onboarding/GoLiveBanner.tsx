/**
 * Header banner for one home in onboarding: the target go-live date, how many
 * days are left, and the single thing most in the way right now.
 *
 * Presentation only — every value is derived from records Resolve already
 * holds.
 */
import { CalendarClock, CircleAlert } from "lucide-react";
import { Chip } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { stateChip } from "@/lib/semantic";
import { usCalendarDate } from "@/lib/dates";
import { goLiveCountdown, todayCalendarDate } from "@/lib/onboarding-golive";
import type { Blocker } from "@/lib/onboarding-lifecycle";

export function GoLiveBanner({
  target,
  blockers,
  accepted,
  onOpenTask,
}: {
  target: string | null;
  blockers: Blocker[];
  accepted: boolean;
  onOpenTask?: (taskId: string) => void;
}) {
  const view = goLiveCountdown({ target, blockers, accepted, today: todayCalendarDate() });

  const tone =
    view.state === "overdue"
      ? "blocked"
      : view.state === "soon"
        ? "waiting"
        : view.state === "live"
          ? "done"
          : "info";

  return (
    <section className="surface flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
      <div className="flex items-center gap-3">
        <CalendarClock className="size-5 text-muted-foreground" aria-hidden />
        <div>
          <p className="eyebrow">Target go-live</p>
          <p className="numeric text-lg font-semibold">
            {view.target ? usCalendarDate(view.target) : "Not set"}
          </p>
        </div>
        <Chip className={stateChip(tone)}>{view.countdownLabel}</Chip>
      </div>

      <div className="min-w-[14rem] flex-1">
        <p className="eyebrow">Current bottleneck</p>
        {view.bottleneck ? (
          <p className="flex items-start gap-2 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              {view.bottleneck}
              {view.bottleneckOwner && (
                <span className="text-muted-foreground"> · {view.bottleneckOwner}</span>
              )}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {accepted ? "This home is live with Operations." : "Nothing is blocking this home."}
          </p>
        )}
      </div>

      {view.bottleneckTaskId && onOpenTask && (
        <Button size="sm" variant="secondary" onClick={() => onOpenTask(view.bottleneckTaskId!)}>
          Open the step
        </Button>
      )}
    </section>
  );
}
