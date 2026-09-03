/**
 * Current Work — the dominant zone of a property onboarding workspace.
 *
 * One stage, one next action, first-class blockers, and the review gates shown
 * as milestones that are never actionable early. Presentation only: everything
 * is derived by `src/lib/onboarding-lifecycle.ts`; actions call back into the
 * existing server functions the workspace already owns.
 */

import { ArrowRight, CircleAlert, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
import { cn } from "@/lib/utils";
import {
  LIFECYCLE_STAGES,
  RISK_LABEL,
  RISK_STATE,
  activeBranches,
  gateProgress,
  lifecycleStageMeta,
  stageIndex,
  type Blocker,
  type LifecycleStage,
  type NextAction,
  type OpenHandoff,
  type Risk,
} from "@/lib/onboarding-lifecycle";
import type { WorkflowTask } from "@/lib/onboarding-workflow";

export function CurrentWork({
  stage,
  next,
  risk,
  blockers,
  tasks,
  handoff,
  accepted,
  target,
  chain,
  onOpenTask,
}: {
  stage: LifecycleStage;
  next: NextAction;
  risk: Risk;
  blockers: Blocker[];
  tasks: WorkflowTask[];
  handoff: OpenHandoff;
  accepted: boolean;
  target: string | null;
  /** The authoritative handoff chain, when the caller has derived it. */
  chain?: { key: string; label: string; blurb: string; state: "done" | "current" | "upcoming" }[];
  onOpenTask: (taskId: string) => void;
}) {
  const meta = lifecycleStageMeta(stage);
  const current = stageIndex(stage);
  const branches = activeBranches(tasks);
  const gates =
    chain ??
    gateProgress(handoff, accepted).map((g) => ({
      key: g.value,
      label: g.label,
      blurb: g.blurb,
      state: g.state,
    }));

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ stage rail */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {LIFECYCLE_STAGES.map((s, i) => (
          <div
            key={s.value}
            title={s.blurb}
            className={cn(
              "min-w-24 flex-1 rounded-md border px-2.5 py-1.5 text-xs font-medium",
              i === current ? s.accent : "border-border bg-card/40 text-muted-foreground",
              i < current && "opacity-70",
            )}
          >
            {s.label}
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------- next action */}
      <section className={cn("rounded-xl border p-5 shadow-card", meta.accent)}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{next.waiting ? "Waiting" : "Do this next"}</span>
          <Chip className={stateChip(RISK_STATE[risk.level])}>{RISK_LABEL[risk.level]}</Chip>
          {target && (
            <span className="numeric ml-auto text-xs opacity-80">Target handoff {target}</span>
          )}
        </div>
        <h2 className="pt-1 text-xl font-semibold tracking-tight">{next.headline}</h2>
        <p className="pt-1 text-sm opacity-90">{next.detail}</p>
        {risk.reasons.length > 0 && (
          <p className="pt-2 text-xs font-medium">{risk.reasons.join(" · ")}</p>
        )}
        {next.taskId && (
          <Button size="sm" className="mt-3" onClick={() => onOpenTask(next.taskId!)}>
            Open this step <ArrowRight className="size-4" />
          </Button>
        )}
      </section>

      {/* --------------------------------------------------------- blockers */}
      {blockers.length > 0 && (
        <section className="surface p-4">
          <p className="font-medium">Waiting on</p>
          <div className="mt-2 space-y-1.5">
            {blockers.slice(0, 6).map((b, i) => (
              <button
                key={`${b.taskId}-${i}`}
                type="button"
                disabled={!b.taskId}
                onClick={() => b.taskId && onOpenTask(b.taskId)}
                className="flex w-full flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm disabled:cursor-default hover:enabled:bg-muted/50"
              >
                <CircleAlert className="size-4 shrink-0 text-state-blocked" />
                <span className="min-w-0 flex-1 truncate">{b.what}</span>
                <Chip className={stateChip("waiting")}>{b.owner}</Chip>
                {b.followUp && (
                  <span className="numeric inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" /> {b.followUp}
                  </span>
                )}
              </button>
            ))}
            {blockers.length > 6 && (
              <p className="text-xs text-muted-foreground">
                +{blockers.length - 6} more in the workflow.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ---------------------------------------------- applicable branches */}
      {branches.length > 0 && (
        <section className="surface p-4">
          <p className="eyebrow">This home&apos;s work</p>
          <p className="pb-2 text-xs text-muted-foreground">
            Only the branches that apply to this property. Nothing here needs an N/A.
          </p>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <span
                key={b.key}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium",
                  b.done === b.total
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-border bg-card text-muted-foreground",
                )}
              >
                {b.label} · {b.done}/{b.total}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ review gates */}
      <section className="surface p-4">
        <p className="eyebrow">Handoff gates</p>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-6">
          {gates.map((g) => (
            <div
              key={g.key}
              title={g.blurb}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs",
                g.state === "done" && "border-emerald-200 bg-emerald-50 text-emerald-800",
                g.state === "current" && "border-primary bg-primary/10 font-medium text-primary",
                g.state === "upcoming" && "border-border bg-card/40 text-muted-foreground",
              )}
            >
              {g.label}
            </div>
          ))}
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          Gates run in order. A future gate is a milestone, not an action.
        </p>
      </section>
    </div>
  );
}
