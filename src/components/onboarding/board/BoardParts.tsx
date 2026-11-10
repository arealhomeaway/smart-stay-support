/**
 * Small shared pieces of the two onboarding boards (register O1): the health
 * dot, the segmented stage bar and the six stage stepper.
 */
import { cn } from "@/lib/utils";
import { SIX_STAGES, type HealthLevel, type Stepper } from "@/lib/onboarding-board";

const DOT: Record<HealthLevel, string> = {
  on_track: "bg-state-done",
  watch: "bg-state-info",
  at_risk: "bg-state-waiting",
  blocked: "bg-state-blocked",
};

export function HealthDot({ level, className }: { level: HealthLevel; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2.5 shrink-0 rounded-full", DOT[level], className)} />;
}

/** Six segments, one per stage: full when done, partly filled for the current stage. */
export function StageBar({ stepper, className }: { stepper: Stepper; className?: string }) {
  return (
    <div
      className={cn("flex gap-1", className)}
      role="img"
      aria-label={`Stage ${stepper.current} of ${SIX_STAGES.length}: ${stepper.currentStage}`}
    >
      {stepper.steps.map((s) => (
        <span key={s.stage} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full", s.state === "done" ? "bg-primary" : "bg-primary/60")}
            style={{ width: `${s.state === "done" ? 100 : s.state === "current" ? s.percent : 0}%` }}
          />
        </span>
      ))}
    </div>
  );
}

/** The six stages with each stage's note and bar. */
export function StageStepper({ stepper }: { stepper: Stepper }) {
  return (
    <ol aria-label="Stages" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {stepper.steps.map((s) => (
        <li
          key={s.stage}
          aria-current={s.state === "current" ? "step" : undefined}
          className={cn(
            "rounded-lg border p-3",
            s.state === "current" ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <p className="text-xs text-muted-foreground">Stage {s.index + 1}</p>
          <p className="text-sm font-semibold leading-tight">{s.stage}</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.note}</p>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${s.percent}%` }} />
          </span>
        </li>
      ))}
    </ol>
  );
}
