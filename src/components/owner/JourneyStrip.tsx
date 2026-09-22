import { Check } from "lucide-react";
import { journeyView, type JourneyKey } from "@/lib/owner-journey";

/** The six milestones the Welcome Packet promises, and where the home is now. */
export function JourneyStrip({ current }: { current: JourneyKey }) {
  const steps = journeyView(current);
  return (
    <section
      aria-labelledby="owner-journey-heading"
      className="rounded-xl border border-border bg-card p-5 shadow-card"
    >
      <h2 id="owner-journey-heading" className="font-display text-lg font-semibold">
        Your journey at a glance
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The path every Active Owner home follows, from first conversation to the Day-90 review.
      </p>
      <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className={[
              "rounded-lg border p-3",
              step.state === "current"
                ? "border-primary bg-primary/5"
                : step.state === "done"
                  ? "border-border bg-muted/40"
                  : "border-dashed border-border",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              <span
                className={[
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
                  step.state === "done"
                    ? "bg-primary text-primary-foreground"
                    : step.state === "current"
                      ? "border-2 border-primary text-primary"
                      : "border border-border text-muted-foreground",
                ].join(" ")}
              >
                {step.state === "done" ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className="text-sm font-semibold">{step.label}</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.blurb}</p>
            {step.state === "current" && (
              <p className="mt-2 text-xs font-medium text-primary">You are here</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
