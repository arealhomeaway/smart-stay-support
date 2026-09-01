/**
 * Resolve presentation primitives.
 *
 * These are the shared shapes every workspace page is built from, so that
 * Tickets, the Property Hub, Onboarding and Analytics read as one product
 * rather than several separately built screens. They carry no behaviour: no
 * data access, no permissions, no routing decisions. Anything with an opinion
 * about what the user may do stays in the page that owns that decision.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The single page title block. One `h1` per page, an optional plain-language
 * line under it, and actions pinned right so the primary action always lands
 * in the same place.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A titled panel. Used instead of hand-rolled bordered divs. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  tone = "default",
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "default" | "critical" | "attention";
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "surface",
        tone === "critical" && "border-danger/35",
        tone === "attention" && "border-warning/45",
        className,
      )}
    >
      {title || actions ? (
        <header
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b px-5 py-3.5",
            tone === "critical" && "border-danger/25",
            tone === "attention" && "border-warning/30",
          )}
        >
          <div className="min-w-0">
            <h2
              className={cn(
                "text-sm font-semibold tracking-tight",
                tone === "critical" && "text-danger",
              )}
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/**
 * A single headline number. Tone colours the figure only — the label stays
 * neutral so a wall of tiles does not read as a wall of warnings.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "neutral" | "critical" | "attention" | "positive";
  className?: string;
}) {
  return (
    <div className={cn("surface px-4 py-3.5", className)}>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "numeric mt-1.5 text-[1.75rem] font-semibold leading-none",
          tone === "critical" && "text-danger",
          tone === "attention" && "text-accent",
          tone === "positive" && "text-success",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * What staff see when there is genuinely nothing to show. Always says what is
 * empty in this context, and where useful, what to do next.
 */
export function EmptyState({
  title,
  hint,
  action,
  icon,
  className,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/30 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-muted-foreground/70">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Skeleton shape used while a list or panel is still loading. */
export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** Standard page-level loading shape: title, tiles, then a list. */
export function LoadingPage({ tiles = 4 }: { tiles?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: tiles }).map((_, i) => (
          <Skeleton key={i} className="h-[5.5rem] w-full rounded-lg" />
        ))}
      </div>
      <LoadingRows rows={4} />
    </div>
  );
}

/**
 * Priority marker for list rows. Colour is never the only signal — the rail is
 * paired with the "P1"/"P2"/"P3" text label everywhere it is used.
 */
export function PriorityRail({ priority }: { priority: string | null | undefined }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute inset-y-0 left-0 w-1 rounded-l-lg",
        priority === "p1"
          ? "bg-danger"
          : priority === "p2"
            ? "bg-warning"
            : "bg-border",
      )}
    />
  );
}
