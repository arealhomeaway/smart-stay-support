/**
 * Director Onboarding Hub — the exception surface.
 *
 * Presentation only. Every number, risk reason and blocker here is derived by
 * `src/lib/onboarding-lifecycle.ts` from records that already exist. Nothing
 * is written from this component; rows navigate to the project workspace.
 */

import { useMemo, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Chip, ProgressRing } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { stateChip } from "@/lib/semantic";
import { usDate } from "@/lib/dates";
import {
  LIFECYCLE_STAGES,
  RISK_LABEL,
  RISK_STATE,
  bottleneckStage,
  lifecycleStageMeta,
  withinDays,
  workloadByOwner,
  type LifecycleStage,
  type ProjectSummary,
} from "@/lib/onboarding-lifecycle";
import { cn } from "@/lib/utils";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { applyTestDataFilter, countTestRecords } from "@/lib/test-data";
import { workspaceSearchFromLens } from "@/lib/onboarding-work-views";

export type { Lens } from "@/lib/onboarding-hub";
import { matchesOnboardingLens, type Lens, type HubViewer } from "@/lib/onboarding-hub";

const LENSES: { key: Lens; label: string; hint: string }[] = [
  {
    key: "attention",
    label: "Needs attention",
    hint: "Blocked, overdue, at risk, or returned for correction.",
  },
  {
    key: "mine",
    label: "Awaiting my review",
    hint: "A gate decision that is yours to make right now.",
  },
  { key: "corrections", label: "Corrections", hint: "Returned from a review gate." },
  { key: "at_risk", label: "At risk", hint: "Derived from overdue, blocked or evidence gaps." },
  { key: "blocked", label: "Blocked", hint: "Nothing can move until the blocker clears." },
  { key: "review", label: "Review queue", hint: "Stage captures and handoffs awaiting review." },
  { key: "handoffs", label: "Upcoming handoffs", hint: "Target handoff within 14 days." },
  { key: "up7", label: "Next 7 days", hint: "Target handoff within 7 days." },
  { key: "up14", label: "Next 14 days", hint: "Target handoff within 14 days." },
  { key: "up30", label: "Next 30 days", hint: "Target handoff within 30 days." },
  {
    key: "reviews",
    label: "Handoffs & reviews",
    hint: "Handoff gates and stage reviews waiting, and handoffs due within 14 days.",
  },
  {
    key: "pipeline",
    label: "Active pipeline",
    hint: "Every home still in onboarding, soonest target handoff first.",
  },
  { key: "all", label: "All homes", hint: "The whole pipeline, including live homes." },
];

/** Lenses shown as chips; the day-window lenses are reached from secondary detail. */
const CHIP_LENSES: Lens[] = ["attention", "reviews", "pipeline", "all"];

export function DirectorHub({
  projects: allProjects,
  viewer,
  originToken,
  lens,
  onLensChange,
  find,
  onFindChange,
  owner,
  onOwnerChange,
  showTest,
  onShowTestChange,
  beforeRows,
}: {
  projects: ProjectSummary[];
  viewer?: HubViewer;
  /** Remembered-workspace token so a project's Back returns to this exact view. */
  originToken?: string | undefined;
  /** Lifted to the route's own URL search params, so Back restores this exact view. */
  lens: Lens;
  onLensChange: (lens: Lens) => void;
  find: string;
  onFindChange: (find: string) => void;
  owner: string | null;
  onOwnerChange: (owner: string | null) => void;
  showTest: boolean;
  onShowTestChange: (showTest: boolean) => void;
  /** Rendered above the home list (e.g. inline handoff reviews). */
  beforeRows?: ReactNode;
}) {
  // Test/QA homes never count towards live onboarding reporting. One shared
  // rule (src/lib/test-data.ts) decides this everywhere in Resolve.
  const testCount = countTestRecords(allProjects, (p) => p.property);
  const projects = useMemo(
    () => applyTestDataFilter(allProjects, showTest, (p) => p.property),
    [allProjects, showTest],
  );
  // Counts, forecast and portfolio follow the same opt-in the rows do: with
  // test projects shown they are included, otherwise production only.
  const productionProjects = projects;

  const setLens = onLensChange;
  const setFind = onFindChange;
  const setOwner = onOwnerChange;
  const setShowTest = onShowTestChange;

  const counts = useMemo(
    () =>
      Object.fromEntries(
        LENSES.map((l) => [
          l.key,
          productionProjects.filter((p) => matchesOnboardingLens(p, l.key, viewer)).length,
        ]),
      ) as Record<Lens, number>,
    [productionProjects, viewer],
  );

  const visible = useMemo(() => {
    const q = find.trim().toLowerCase();
    return projects
      .filter((p) => matchesOnboardingLens(p, lens, viewer))
      .filter((p) => !owner || (p.owner ?? "Unassigned") === owner)
      .filter((p) => !q || `${p.property.name} ${p.owner ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (a.target ?? "9999").localeCompare(b.target ?? "9999"));
  }, [projects, lens, find, owner, viewer]);

  const active = productionProjects.filter((p) => p.stage !== "live");
  const bottleneck = bottleneckStage(active);
  const workload = workloadByOwner(active);
  const activeLensMeta = LENSES.find((l) => l.key === lens);

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------- needs attention */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find a home or project manager"
            className="w-full max-w-xs"
          />
          <button
            type="button"
            onClick={() => setShowTest(!showTest)}
            title="Test homes are excluded from every count above."
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium",
              showTest
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {showTest ? "Hide" : "Show"} test projects ({testCount})
          </button>

          {LENSES.filter((l) => CHIP_LENSES.includes(l.key)).map((l) => (
            <button
              key={l.key}
              type="button"
              title={l.hint}
              onClick={() => setLens(l.key)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium",
                lens === l.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label} ({counts[l.key]})
            </button>
          ))}
          {owner && (
            <button
              type="button"
              onClick={() => setOwner(null)}
              className="rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {owner} · clear
            </button>
          )}
        </div>

        {beforeRows}
        <div className="space-y-2">
          {visible.length === 0 && (
            <p className="surface p-4 text-sm text-muted-foreground">
              Nothing in this view. {activeLensMeta?.hint}
            </p>
          )}
          {visible.map((p) => (
            <ProjectRow key={p.property.id} project={p} originToken={originToken} lens={lens} />
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- pipeline forecast */}
      <section className="surface space-y-3 p-4">
        <p className="eyebrow">Pipeline forecast</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
          <span>
            <span className="font-semibold">{active.length}</span>{" "}
            <span className="text-muted-foreground">active</span>
          </span>
          <span>
            <span
              className={cn(
                "font-semibold",
                counts.at_risk + counts.blocked > 0 && "text-state-blocked",
              )}
            >
              {counts.at_risk + counts.blocked}
            </span>{" "}
            <span className="text-muted-foreground">at risk or blocked</span>
          </span>
          <span>
            <span className="font-semibold">{counts.mine}</span>{" "}
            <span className="text-muted-foreground">awaiting my review</span>
          </span>
          <span>
            <span className="font-semibold">
              {bottleneck ? lifecycleStageMeta(bottleneck).label : "—"}
            </span>{" "}
            <span className="text-muted-foreground">is the bottleneck stage</span>
          </span>
          <span className="ml-auto flex items-center gap-3 text-muted-foreground">
            {([7, 14, 30] as const).map((d) => {
              const n = active.filter((p) => withinDays(p.target, d)).length;
              const key = (d === 7 ? "up7" : d === 14 ? "up14" : "up30") as Lens;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setLens(key)}
                  className={cn(
                    "underline-offset-2 hover:underline",
                    lens === key && "font-medium text-foreground",
                  )}
                >
                  {n} in {d}d
                </button>
              );
            })}
          </span>
        </div>

        {/* stage distribution — one slim bar, not equal-sized tiles */}
        <div
          className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          title="Where active projects sit"
        >
          {LIFECYCLE_STAGES.filter((s) => s.value !== "live").map((s) => {
            const inStage = active.filter((p) => p.stage === s.value).length;
            const pct = active.length > 0 ? (inStage / active.length) * 100 : 0;
            if (pct === 0) return null;
            return (
              <span
                key={s.value}
                title={`${s.label} · ${inStage}`}
                className={cn("h-full", s.accent, "border-0")}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {LIFECYCLE_STAGES.filter((s) => s.value !== "live").map((s) => {
            const inStage = active.filter((p) => p.stage === s.value).length;
            if (inStage === 0) return null;
            return (
              <span key={s.value}>
                {s.label} · {inStage}
              </span>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------------- portfolio */}
      <section className="space-y-3">
        <p className="eyebrow">Project portfolio</p>
        {active.length === 0 ? (
          <p className="surface p-4 text-sm text-muted-foreground">
            No active onboarding projects.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {active
              .slice()
              .sort((a, b) => (a.target ?? "9999").localeCompare(b.target ?? "9999"))
              .map((p) => (
                <PortfolioCard key={p.property.id} project={p} originToken={originToken} />
              ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------- secondary */}
      <details className="surface p-4">
        <summary className="cursor-pointer text-sm font-semibold">
          Workload by project manager
        </summary>
        <p className="pt-1 text-xs text-muted-foreground">
          Select a project manager to filter the list above.
        </p>
        <div className="mt-2 space-y-1.5">
          {workload.length === 0 && (
            <p className="text-sm text-muted-foreground">No active projects.</p>
          )}
          {workload.map((w) => (
            <button
              key={w.owner}
              type="button"
              onClick={() => {
                setOwner(owner === w.owner ? null : w.owner);
                setLens("all");
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border px-2 py-1.5 text-left text-sm transition hover:bg-muted/40",
                owner === w.owner ? "border-primary" : "border-transparent",
              )}
            >
              <span className="w-48 truncate">{w.owner}</span>
              <span className="numeric w-24 text-muted-foreground">{w.projects} project(s)</span>
              {w.atRisk > 0 && <Chip className={stateChip("blocked")}>{w.atRisk} at risk</Chip>}
              {w.blockers > 0 && (
                <Chip className={stateChip("waiting")}>{w.blockers} blocker(s)</Chip>
              )}
            </button>
          ))}
        </div>
      </details>

    </div>
  );
}

function PortfolioCard({
  project: p,
  originToken,
}: {
  project: ProjectSummary;
  originToken?: string | undefined;
}) {
  const stage = lifecycleStageMeta(p.stage);
  return (
    <Link
      to="/onboarding/$propertyId"
      params={{ propertyId: p.property.id }}
      search={(originToken ? { from: originToken } : undefined) as never}
      className="surface group block overflow-hidden transition hover:bg-muted/40"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <PropertyPhoto
          url={(p.property as { primary_photo_url?: string | null }).primary_photo_url ?? null}
          name={p.property.name}
          className="size-full rounded-none"
          rounded="rounded-none"
        />
        <span className="absolute right-2 top-2">
          <ProgressRing value={p.progress} size={40} tone="onboarding" />
        </span>
      </div>
      <div className="space-y-1 p-3">
        <p className="truncate text-sm font-semibold">{p.property.name}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", stage.accent)}>
            {stage.label}
          </span>
          {p.risk.level !== "on_track" && (
            <Chip className={stateChip(RISK_STATE[p.risk.level])}>{RISK_LABEL[p.risk.level]}</Chip>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {p.owner ?? "Unassigned"} · {p.target ? `Handoff ${usDate(p.target)}` : "No target date"}
        </p>
      </div>
    </Link>
  );
}

function ProjectRow({
  project: p,
  originToken,
  lens,
}: {
  project: ProjectSummary;
  originToken?: string | undefined;
  lens: Lens;
}) {
  const stage = lifecycleStageMeta(p.stage);
  return (
    <Link
      to="/onboarding/$propertyId"
      params={{ propertyId: p.property.id }}
      search={
        {
          ...workspaceSearchFromLens(lens, Boolean(p.gateStep)),
          ...(originToken ? { from: originToken } : {}),
        } as never
      }
      className="surface flex flex-col gap-2 p-3 transition hover:bg-muted/40 lg:flex-row lg:items-center lg:gap-4"
    >
      <PropertyPhoto
        url={(p.property as { primary_photo_url?: string | null }).primary_photo_url ?? null}
        name={p.property.name}
        className="size-12 rounded-xl"
        rounded="rounded-xl"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{p.property.name}</span>
          <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", stage.accent)}>
            {stage.label}
          </span>
          <Chip className={stateChip(RISK_STATE[p.risk.level])}>{RISK_LABEL[p.risk.level]}</Chip>
          {!p.hasProject && <Chip className={stateChip("new")}>No project yet</Chip>}
        </span>
        <span className="block truncate pt-1 text-sm">
          <span className="text-muted-foreground">Next: </span>
          {p.next.headline}
        </span>
        {p.risk.reasons.length > 0 && (
          <span
            className="block truncate text-xs text-state-blocked"
            title={p.risk.reasons.join(" · ")}
          >
            {p.risk.reasons.join(" · ")}
          </span>
        )}
      </span>

      <span className="flex items-center gap-3 lg:w-72 lg:justify-end">
        <span className="text-right text-xs text-muted-foreground">
          <span className="block truncate">{p.owner ?? "Unassigned"}</span>
          <span className="numeric block">
            {p.target ? `Handoff ${usDate(p.target)}` : "No target date"}
          </span>
        </span>
        {p.hasProject && <ProgressRing value={p.progress} size={44} tone="onboarding" />}
      </span>
    </Link>
  );
}
