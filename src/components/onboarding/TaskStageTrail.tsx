/**
 * The stage trail for one onboarding task: where it started, the phase it came
 * from, who owned it, and every move between operational stages since.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { stageLabel } from "@/lib/onboarding";
import { usDateTime } from "@/lib/dates";
import { SEAT_LABELS } from "@/lib/onboarding-ownership";
import { taskStageHistoryFn } from "@/lib/onboarding-stage-history.functions";

export function TaskStageTrail({ taskId }: { taskId: string }) {
  const read = useServerFn(taskStageHistoryFn);
  const { data, isLoading, error } = useQuery({
    queryKey: ["task-stage-trail", taskId],
    queryFn: () => read({ data: { taskId } }),
  });

  return (
    <section className="space-y-2">
      <p className="eyebrow">Stage history</p>
      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-xs text-muted-foreground">This step&apos;s stage history isn&apos;t available.</p>
      )}
      {data && data.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No stage changes recorded for this step yet.
        </p>
      )}
      <ul className="space-y-1.5">
        {(data ?? []).map((entry) => (
          <li key={entry.id} className="text-xs text-muted-foreground">
            <span className="text-foreground">
              {entry.fromStage
                ? `Moved from ${stageLabel(entry.fromStage)} to ${stageLabel(entry.toStage)}`
                : `Filed under ${stageLabel(entry.toStage)}`}
            </span>
            {entry.legacyStage && entry.legacyStage !== entry.toStage
              ? ` · previously ${stageLabel(entry.legacyStage)}`
              : ""}
            {entry.assignedSeat
              ? ` · owned by ${SEAT_LABELS[entry.assignedSeat as keyof typeof SEAT_LABELS] ?? entry.assignedSeat}`
              : ""}
            {entry.assignedToName ? ` (${entry.assignedToName})` : ""}
            {entry.changedByName ? ` · by ${entry.changedByName}` : ""} · {usDateTime(entry.at)}
          </li>
        ))}
      </ul>
    </section>
  );
}
