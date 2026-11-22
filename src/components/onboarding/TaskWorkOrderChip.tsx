import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { taskWorkOrderStatusesFn, type TaskWorkOrderStatus } from "@/lib/onboarding-work-order-status.functions";
import { cn } from "@/lib/utils";

/** One read per list: the Breezeway status of every Task shown. */
export function useTaskWorkOrderStatuses(taskIds: string[]) {
  const fn = useServerFn(taskWorkOrderStatusesFn);
  const ids = [...new Set(taskIds)].sort();
  return useQuery({
    queryKey: ["task-work-orders", ids],
    queryFn: () => fn({ data: { taskIds: ids } }),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });
}

const TONE: Record<TaskWorkOrderStatus["label"], string> = {
  Scheduled: "bg-muted text-foreground",
  "Not scheduled": "bg-muted text-muted-foreground",
  "In Progress": "bg-primary/10 text-primary",
  Completed: "bg-success/15 text-success",
  Canceled: "bg-late/10 text-late",
};

export function TaskWorkOrderChip({ status }: { status: TaskWorkOrderStatus | undefined }) {
  if (!status) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={cn("inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-medium", TONE[status.label])}>
        Breezeway: {status.label}
      </span>
      {status.reopenReason ? <span className="text-xs font-medium text-late">Reopened: {status.reopenReason}</span> : null}
    </span>
  );
}
