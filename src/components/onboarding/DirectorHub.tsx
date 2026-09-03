/**
 * Director Onboarding Hub — the exception surface.
 *
 * Presentation only. Every number, risk reason and blocker here is derived by
 * `src/lib/onboarding-lifecycle.ts` from records that already exist. Nothing
 * is written from this component; rows navigate to the project workspace.
 */

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Chip, ProgressRing } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { stateChip } from "@/lib/semantic";
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
import { applyTestDataFilter, countTestRecords } from "@/lib/test-data";

type Lens =
  | "attention"
  | "mine"
  | "at_risk"
  | "blocked"
  | "review"
  | "corrections"
  | "handoffs"
  | "up7"
  | "up14"
  | "up30"
  | "all";

export type HubViewer = {
  userId: string | null;
  /** True for Director / Operations reviewers who own a gate decision. */
  canReview: boolean;
};

const LENSES: { key: Lens; label: string; hint: string }[] = [
  { key: "attention", label: "Needs attention", hint: "Something an ARHA person must do today." },
  {
    key: "mine",
    label: "Awaiting my review",
    hint: "A gate decision that is yours to make right now.",
  },
  { key: "corrections", label: "Corrections", hint: "Returned from a review gate." },
  { key: "at_risk", label: "At risk", hint: "Derived from overdue, blocked or evidence gaps." },
  { key: "blocked", label: "Blocked", hint: "Nothing can move until the blocker clears." },
  { key: "review", label: "Handoff queue", hint: "Sitting at a handoff review gate." },
  { key: "handoffs", label: "Upcoming handoffs", hint: "Target handoff within 14 days." },
  { key: "up7", label: "Next 7 days", hint: "Target handoff within 7 days." },
  { key: "up14", label: "Next 14 days", hint: "Target handoff within 14 days." },
  { key: "up30", label: "Next 30 days", hint: "Target handoff within 30 days." },
  { key: "all", label: "All projects", hint: "The whole pipeline." },
];

/** Lenses shown as chips; the day-window lenses are reached from the tiles. */
const CHIP_LENSES: Lens[] = [
  "attention",
  "mine",
  "corrections",
  "at_risk",
  "blocked",
  "review",
  "handoffs",
  "all",
];

function awaitingMyReview(p: ProjectSummary, viewer?: HubViewer) {
  if (!p.inReview || !viewer) return false;
  const step = p.gateStep ?? "kati_review";
  if (step === "kati_review" && viewer.userId && p.property.onboarding_owner === viewer.userId)
    return true;
  return viewer.canReview;
}

/**
 * Every lens reads the same authoritative summary, so the counts reconcile:
 * a live home appears in no attention queue, "blocked" and "at risk" are
 * mutually exclusive derived levels, and a project in review is never also
 * counted as needing a project manager's action.
 */
function matches(p: ProjectSummary, lens: Lens, viewer?: HubViewer) {
  // Accepted homes are history: they belong to Operations, not this hub.
  const live = p.accepted || p.stage === "live";
  switch (lens) {
    case "attention":
      return (
        !live &&
        (p.risk.level === "blocked" ||
          p.risk.level === "at_risk" ||
          p.property.lifecycle_status === "handoff_corrections" ||
          awaitingMyReview(p, viewer) ||
          (!p.next.waiting && !p.inReview))
      );
    case "mine":
      return !live && awaitingMyReview(p, viewer);
    case "at_risk":
      return !live && p.risk.level === "at_risk";
    case "blocked":
      return !live && p.risk.level === "blocked";
    case "review":
      return !live && p.inReview;
    case "corrections":
      return !live && p.property.lifecycle_status === "handoff_corrections";
    case "handoffs":
      return !live && withinDays(p.target, 14);
    case "up7":
      return !live && withinDays(p.target, 7);
    case "up14":
      return !live && withinDays(p.target, 14);
    case "up30":
      return !live && withinDays(p.target, 30);
    default:
      return true;
  }
}

export function DirectorHub({
  projects: allProjects,
  viewer,
}: {
  projects: ProjectSummary[];
  viewer?: HubViewer;
}) {
  const [showTest, setShowTest] = useState(false);
  // Test/QA homes never count towards live onboarding reporting. One shared
  // rule (src/lib/test-data.ts) decides this everywhere in Resolve.
  const testCount = countTestRecords(allProjects, (p) => p.property);
  const projects = useMemo(
    () => applyTestDataFilter(allProjects, showTest, (p) => p.property),
    [allProjects, showTest],
  );
  const [lens, setLens] = useState<Lens>("attention");
  const [find, setFind] = useState("");
  const [owner, setOwner] = useState<string | null>(null);

  const counts = useMemo(
    () =>
      Object.fromEntries(
        LENSES.map((l) => [l.key, projects.filter((p) => matches(p, l.key, viewer)).length]),
      ) as Record<Lens, number>,
    [projects, viewer],
  );

  const visible = useMemo(() => {
    const q = find.trim().toLowerCase();
    return projects
      .filter((p) => matches(p, lens, viewer))
      .filter((p) => !owner || (p.owner ?? "Unassigned") === owner)
      .filter((p) => !q || `${p.property.name} ${p.owner ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (a.target ?? "9999").localeCompare(b.target ?? "9999"));
  }, [projects, lens, find, owner, viewer]);

  const active = projects.filter((p) => !p.accepted && p.stage !== "live");
  const bottleneck = bottleneckStage(active);
  const workload = workloadByOwner(active);


  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------- rollups */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active projects"
          value={active.length}
          hint="Homes not yet live with Operations."
          onClick={() => setLens("all")}
        />
        <Stat
          label="At risk or blocked"
          value={counts.at_risk + counts.blocked}
          hint="Derived, not self-reported."
          tone="blocked"
          onClick={() => setLens("at_risk")}
        />
        <Stat
          label="Awaiting my review"
          value={counts.mine}
          hint="Gate decisions that are yours."
          tone="waiting"
          onClick={() => setLens("mine")}
        />
        <Stat
          label="Bottleneck stage"
          value={bottleneck ? lifecycleStageMeta(bottleneck).label : "—"}
          hint={
            bottleneck
              ? `${active.filter((p) => p.stage === bottleneck).length} project(s) sitting here.`
              : "Where most projects are sitting."
          }
        />
      </div>

      {/* ----------------------------------------------- forward windows */}
      <section className="surface p-4">
        <p className="eyebrow">Expected handoffs</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {([7, 14, 30] as const).map((d) => {
            const n = active.filter((p) => withinDays(p.target, d)).length;
            const risky = active.filter(
              (p) => withinDays(p.target, d) && p.risk.level !== "on_track",
            ).length;
            const key = (d === 7 ? "up7" : d === 14 ? "up14" : "up30") as Lens;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setLens(key)}
                className={cn(
                  "rounded-lg border bg-card/60 p-3 text-left transition hover:bg-muted/40",
                  lens === key ? "border-primary" : "border-border",
                )}
              >
                <p className="text-2xl font-semibold">{n}</p>
                <p className="text-sm text-muted-foreground">next {d} days</p>
                {risky > 0 && (
                  <p className="pt-1 text-xs text-state-blocked">{risky} not currently on track</p>
                )}
              </button>
            );
          })}
        </div>
      </section>


      {/* ------------------------------------------------------ pipeline */}
      <section className="surface p-4">
        <p className="eyebrow">Pipeline</p>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {LIFECYCLE_STAGES.map((s) => {
            const inStage = projects.filter((p) => p.stage === s.value);
            return (
              <div
                key={s.value}
                className={cn("min-w-32 flex-1 rounded-lg border px-3 py-2", s.accent)}
                title={s.blurb}
              >
                <p className="text-xs font-medium">{s.label}</p>
                <p className="numeric text-xl font-semibold">{inStage.length}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* -------------------------------------------------------- lenses */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="Find a home or project manager"
          className="w-full max-w-xs"
        />
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
        <button
          type="button"
          onClick={() => setShowTest((v) => !v)}
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

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="surface p-4 text-sm text-muted-foreground">
            Nothing in this view. {LENSES.find((l) => l.key === lens)?.hint}
          </p>
        )}
        {visible.map((p) => (
          <ProjectRow key={p.property.id} project={p} />
        ))}
      </div>

      {/* ------------------------------------------------------ workload */}
      <section className="surface p-4">
        <p className="eyebrow">Workload by project manager</p>
        <p className="text-xs text-muted-foreground">
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
      </section>

    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone?: "blocked" | "waiting";
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "text-2xl font-semibold",
          tone === "blocked" && Number(value) > 0 && "text-state-blocked",
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </>
  );
  if (!onClick) return <div className="surface p-4">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface p-4 text-left transition hover:bg-muted/40"
    >
      {body}
    </button>
  );
}


function ProjectRow({ project: p }: { project: ProjectSummary }) {
  const stage = lifecycleStageMeta(p.stage);
  return (
    <Link
      to="/onboarding/$propertyId"
      params={{ propertyId: p.property.id }}
      className="surface flex flex-col gap-2 p-3 transition hover:bg-muted/40 lg:flex-row lg:items-center lg:gap-4"
    >
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
            {p.target ? `Handoff ${p.target}` : "No target date"}
          </span>
        </span>
        {p.hasProject && <ProgressRing value={p.progress} size={44} tone="onboarding" />}
      </span>
    </Link>
  );
}
