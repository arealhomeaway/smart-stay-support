import { milestoneCheckpoints, paceHealth } from "@/lib/owner-milestones";

/**
 * The 25 / 50 / 75 / 100-hour checkpoint strip, shared by the supervisor list and the
 * homeowner portal so both read the same picture. Encouraging wording only —
 * it never says anything about tax treatment.
 */
export function MilestonePacing({
  day,
  totalDays,
  reportedHours,
  benchmark,
  goalMet = false,
  audience = "owner",
}: {
  day: number;
  totalDays: number;
  reportedHours: number;
  benchmark: number;
  goalMet?: boolean;
  audience?: "owner" | "staff";
}) {
  const checkpoints = milestoneCheckpoints({ day, totalDays, reportedHours, goalMet });
  const health = paceHealth({ day, reportedHours, benchmark, goalMet });

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Checkpoints
        </p>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(health.tone)}`}
        >
          {health.label}
          {health.behindHours > 0 ? ` · ${health.behindHours} hrs to catch up` : ""}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {checkpoints.map((c, i) => (
          <div
            key={c.day}
            className={`rounded-lg border p-2 ${
              c.inWindow ? "border-primary/40 bg-primary/5" : "border-border bg-background"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">Checkpoint {i + 1}</p>
              <span
                className={`rounded-full border px-1.5 py-0.5 text-[11px] ${chipClass(c.state)}`}
              >
                {c.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {c.state === "met"
                ? `${c.expectedHours} hr pace point reached`
                : `${c.expectedHours} hrs by this point · ${c.shortfallHours} to go`}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {audience === "owner"
          ? "Based on the hours you have entered so far. These checkpoints are a pacing guide only."
          : "Based on hours the homeowner entered. Pacing guide only — no tax conclusion is implied."}
      </p>
    </div>
  );
}

function toneClass(tone: "muted" | "good" | "warn") {
  if (tone === "good") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  if (tone === "warn") return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  return "border-border bg-muted text-muted-foreground";
}

function chipClass(state: string) {
  if (state === "met") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
  if (state === "behind") return "border-amber-500/20 bg-amber-500/10 text-amber-700";
  if (state === "approaching") return "border-primary/20 bg-primary/10 text-primary";
  return "border-border bg-muted text-muted-foreground";
}
