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
 * A single headline number on a softly tinted plate. The tint carries the
 * meaning of the figure; the label stays neutral so a row of tiles reads as
 * information rather than a row of alarms.
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
  tone?: "neutral" | "critical" | "attention" | "positive" | "review" | "progress";
  className?: string;
}) {
  const plate =
    tone === "critical"
      ? "border-coral/20 bg-coral/8"
      : tone === "attention"
        ? "border-amber/25 bg-amber/10"
        : tone === "positive"
          ? "border-sage/25 bg-sage/8"
          : tone === "review"
            ? "border-lavender/25 bg-lavender/8"
            : tone === "progress"
              ? "border-sky/25 bg-sky/8"
              : "border-border bg-card";
  const figure =
    tone === "critical"
      ? "text-coral"
      : tone === "attention"
        ? "text-amber"
        : tone === "positive"
          ? "text-sage"
          : tone === "review"
            ? "text-lavender"
            : tone === "progress"
              ? "text-sky"
              : "text-foreground";
  return (
    <div className={cn("rounded-xl border px-4 py-3.5", plate, className)}>
      <p className="eyebrow">{label}</p>
      <p className={cn("numeric mt-1.5 text-[1.75rem] font-semibold leading-none", figure)}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * The editorial hero used at the top of orientation surfaces — Home, portal
 * overviews, welcome. A real ARHA home, a role-specific line, and at most a
 * couple of actions. Never a KPI dashboard.
 */
export function PageHero({
  image,
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  /** A real ARHA property photograph. */
  image?: string;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-warm-deep/60 bg-warm",
        className,
      )}
    >
      {image ? (
        <div className="absolute inset-0">
          <img src={image} alt="" aria-hidden="true" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-plate/85 via-plate/60 to-plate/10" />
        </div>
      ) : null}
      <div
        className={cn(
          "relative px-6 py-8 md:px-9 md:py-11",
          image ? "text-white" : "text-foreground",
        )}
      >
        {eyebrow ? (
          <p
            className={cn(
              "eyebrow mb-2",
              image && "text-white/70",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h1 className="max-w-2xl font-display text-3xl font-semibold leading-tight tracking-tight md:text-[2.5rem]">
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-2 max-w-xl text-base leading-relaxed",
              image ? "text-white/85" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        ) : null}
        {actions ? <div className="mt-6 flex flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
    </section>
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
        "flex flex-col items-center justify-center rounded-lg px-6 py-10 text-center",
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

/**
 * A labelled status chip. The word is required; the colour only reinforces it,
 * so the meaning survives greyscale, print and colour-blind vision.
 */
export function Chip({
  children,
  className,
  icon,
  title,
}: {
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <span className={cn("chip", className)} title={title}>
      {icon ? <span aria-hidden="true" className="[&>svg]:size-3">{icon}</span> : null}
      {children}
    </span>
  );
}

export type Stage = {
  key: string;
  label: string;
  /** Short caption under the step, e.g. a count or a date. */
  hint?: string;
};

/**
 * A horizontal process rail: what is done, where the work is now, what is next.
 * Position is shown with a filled bar and a "Current" word, never with colour
 * alone.
 */
export function StageRail({
  stages,
  currentIndex,
  tone = "primary",
  className,
}: {
  stages: Stage[];
  currentIndex: number;
  tone?: "primary" | "onboarding" | "owner";
  className?: string;
}) {
  const bar =
    tone === "onboarding" ? "bg-module-onboarding" : tone === "owner" ? "bg-module-owner" : "bg-primary";
  const text =
    tone === "onboarding" ? "text-module-onboarding" : tone === "owner" ? "text-module-owner" : "text-primary";
  return (
    <ol className={cn("flex w-full min-w-0 gap-1.5", className)} aria-label="Process stage">
      {stages.map((s, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <li key={s.key} className="min-w-0 flex-1" aria-current={current ? "step" : undefined}>
            <div
              className={cn("h-1.5 rounded-full", done ? cn(bar, "opacity-45") : current ? bar : "bg-border")}
            />
            <p
              className={cn(
                "mt-1.5 truncate text-xs",
                current ? cn("font-semibold", text) : done ? "text-foreground/70" : "text-muted-foreground",
              )}
              title={s.label}
            >
              {s.label}
            </p>
            {current ? (
              <p className="eyebrow">Current</p>
            ) : s.hint ? (
              <p className="truncate text-[0.6875rem] text-muted-foreground">{s.hint}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** A circular percentage indicator. The number is always written inside it. */
export function ProgressRing({
  value,
  size = 96,
  label,
  tone = "primary",
}: {
  value: number;
  size?: number;
  label?: string;
  tone?: "primary" | "owner" | "onboarding";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const stroke =
    tone === "owner" ? "var(--module-owner)" : tone === "onboarding" ? "var(--module-onboarding)" : "var(--primary)";
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${pct}% ${label ?? "complete"}`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="numeric text-xl font-semibold leading-none">{pct}%</span>
        {label ? <span className="mt-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  );
}

/** A heading strip that separates one region of a page from the next. */
export function SectionBand({
  title,
  hint,
  actions,
  className,
}: {
  title: string;
  hint?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("band justify-between", className)}>
      <div className="flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * The one segmented control used for in-page views (queues, filters). Replaces
 * the hand-rolled button rows that had drifted apart across modules.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-sunken p-1", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              active
                ? "bg-card font-semibold text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {o.count != null ? <span className="numeric ml-1.5 text-xs opacity-70">{o.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
