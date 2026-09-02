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

type Lens = "attention" | "at_risk" | "blocked" | "review" | "corrections" | "handoffs" | "all";

const LENSES: { key: Lens; label: string; hint: string }[] = [
  { key: "attention", label: "Needs attention", hint: "Something an ARHA person must do today." },
  { key: "at_risk", label: "At risk", hint: "Derived from overdue, blocked or evidence gaps." },
  { key: "blocked", label: "Blocked", hint: "Nothing can move until the blocker clears." },
  { key: "review", label: "Awaiting review", hint: "Sitting at Director or Operations review." },
  { key: "corrections", label: "Corrections required", hint: "Returned from a review gate." },
  { key: "handoffs", label: "Upcoming handoffs", hint: "Target handoff within 14 days." },
  { key: "all", label: "All projects", hint: "The whole pipeline." },
];

function matches(p: ProjectSummary, lens: Lens) {
  switch (lens) {
    case "attention":
      return !p.next.waiting && p.stage !== "live";
    case "at_risk":
      return p.risk.level === "at_risk";
    case "blocked":
      return p.risk.level === "blocked" || p.blockers.length > 0;
    case "review":
      return p.inReview;
    case "corrections":
      return p.property.lifecycle_status === "handoff_corrections";
    case "handoffs":
      return withinDays(p.target, 14);
    default:
      return true;
  }
}

export function DirectorHub({ projects }: { projects: ProjectSummary[] }) {
  const [lens, setLens] = useState<Lens>("attention");
  const [find, setFind] = useState("");

  const counts = useMemo(
    () =>
      Object.fromEntries(
        LENSES.map((l) => [l.key, projects.filter((p) => matches(p, l.key)).length]),
      ) as Record<Lens, number>,
    [projects],
  );

  const visible = useMemo(() => {
    const q = find.trim().toLowerCase();
    return projects
      .filter((p) => matches(p, lens))
      .filter((p) => !q || `${p.property.name} ${p.owner ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => (a.target ?? "9999").localeCompare(b.target ?? "9999"));
  }, [projects, lens, find]);

  const active = projects.filter((p) => p.stage !== "live");
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
        />
        <Stat
          label="At risk or blocked"
          value={
            active.filter((p) => p.risk.level === "at_risk" || p.risk.level === "blocked").length
          }
          hint="Derived, not self-reported."
          tone="blocked"
        />
        <Stat
          label="Awaiting review"
          value={active.filter((p) => p.inReview).length}
          hint="Director or Operations gate."
          tone="waiting"
        />
        <Stat
          label="Bottleneck stage"
          value={bottleneck ? lifecycleStageMeta(bottleneck).label : "—"}
          hint="Where most projects are sitting."
        />
      </div>

      {/* ----------------------------------------------- forward windows */}
      <section className="surface p-4">
        <p className="eyebrow">Expected handoffs</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {[7, 14, 30].map((d) => {
            const n = active.filter((p) => withinDays(p.target, d)).length;
            const risky = active.filter(
              (p) => withinDays(p.target, d) && p.risk.level !== "on_track",
            ).length;
            return (
              <div key={d} className="rounded-lg border border-border bg-card/60 p-3">
                <p className="text-2xl font-semibold">{n}</p>
                <p className="text-sm text-muted-foreground">next {d} days</p>
                {risky > 0 && (
                  <p className="pt-1 text-xs text-state-blocked">{risky} not currently on track</p>
                )}
              </div>
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
        {LENSES.map((l) => (
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
        <div className="mt-2 space-y-1.5">
          {workload.length === 0 && (
            <p className="text-sm text-muted-foreground">No active projects.</p>
          )}
          {workload.map((w) => (
            <div key={w.owner} className="flex items-center gap-3 text-sm">
              <span className="w-48 truncate">{w.owner}</span>
              <span className="numeric w-24 text-muted-foreground">{w.projects} project(s)</span>
              {w.atRisk > 0 && <Chip className={stateChip("blocked")}>{w.atRisk} at risk</Chip>}
              {w.blockers > 0 && (
                <Chip className={stateChip("waiting")}>{w.blockers} blocker(s)</Chip>
              )}
            </div>
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
}: {
  label: string;
  value: number | string;
  hint: string;
  tone?: "blocked" | "waiting";
}) {
  return (
    <div className="surface p-4">
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
    </div>
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
          <span className="block truncate text-xs text-state-blocked">
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
