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
export function StageStepper({ stepper, onSelect }: { stepper: Stepper; onSelect?: ((index: number) => void) | undefined }) {
  return (
    <ol aria-label="Stages" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {stepper.steps.map((s) => {
        const body = (
          <>
            <span className="block text-xs text-muted-foreground">Stage {s.index + 1}</span>
            <span className="block text-sm font-semibold leading-tight">{s.stage}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{s.note}</span>
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${s.percent}%` }} />
            </span>
          </>
        );
        const frame = cn(
          "rounded-lg border p-3",
          s.state === "current" ? "border-primary bg-primary/5" : "border-border",
        );
        return (
          <li key={s.stage} aria-current={s.state === "current" ? "step" : undefined} className={onSelect ? undefined : frame}>
            {onSelect ? (
              // Item 31: a stage card opens that stage on the Plan tab.
              <button
                type="button"
                onClick={() => onSelect(s.index)}
                className={cn(frame, "block min-h-11 w-full text-left hover:bg-muted/50")}
              >
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Fix 41: six thin bars, each with the stage name and its note under it; a bar opens that stage on the Plan tab. */
export function StageProgress({ stepper, onSelect }: { stepper: Stepper; onSelect?: ((index: number) => void) | undefined }) {
  return (
    <ol aria-label="Stages" className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
      {stepper.steps.map((s) => {
        const body = (
          <>
            <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${s.percent}%` }} />
            </span>
            <span className={cn("mt-2 block text-sm leading-tight", s.state === "current" ? "font-semibold" : "font-medium")}>{s.stage}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{s.note}</span>
          </>
        );
        return (
          <li key={s.stage} aria-current={s.state === "current" ? "step" : undefined}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(s.index)}
                className="block min-h-11 w-full rounded-md p-1 text-left hover:bg-muted/50"
              >
                {body}
              </button>
            ) : (
              <div className="p-1">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
