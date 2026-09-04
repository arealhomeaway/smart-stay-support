/**
 * Quiet, positive feedback and sequential progress.
 *
 * Momentum is the reward in Resolve: a clear check, a plain sentence about what
 * happened and what is next. No confetti, no bouncing, no celebration that
 * interrupts the work.
 *
 * Pure presentation.
 */
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Soft green confirmation surface: what just happened, and what happens next. */
export function SuccessNote({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border border-sage/25 bg-sage/8 px-4 py-3.5",
        className,
      )}
      role="status"
    >
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-sage/15 text-sage">
        <Check className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {children ? (
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{children}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export type ProgressStep = {
  key: string;
  label: string;
  /** Short caption under the step — usually a date. */
  hint?: string;
};

/**
 * A genuinely sequential workflow: Created → Assigned → In progress → Completed.
 * Only use this where the stages really do happen in order. Completed steps
 * carry a check, the current step is named "Now", so position never depends on
 * colour alone.
 */
export function ProgressSteps({
  steps,
  currentIndex,
  className,
}: {
  steps: ProgressStep[];
  currentIndex: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex w-full min-w-0 items-start", className)} aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const reached = done || current;
        return (
          <li
            key={s.key}
            className="relative flex min-w-0 flex-1 flex-col items-center text-center"
            aria-current={current ? "step" : undefined}
          >
            {i > 0 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[-50%] top-3 h-0.5 w-full",
                  reached ? "bg-primary/45" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-6 items-center justify-center rounded-full border-2 bg-card",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : current
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground",
              )}
            >
              {done ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
              )}
            </span>
            <span
              className={cn(
                "mt-2 truncate text-xs font-semibold",
                reached ? "text-foreground" : "text-muted-foreground",
              )}
              title={s.label}
            >
              {s.label}
            </span>
            <span className="truncate text-[0.6875rem] text-muted-foreground">
              {current ? "Now" : (s.hint ?? "")}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
