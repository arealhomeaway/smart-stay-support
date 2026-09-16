/** Canonical source summaries returned by the protected readiness RPC. */
export type IndependentReadinessItem = {
  id: string;
  title: string;
  taskIds: string[];
  issue: string | null;
  sourceType?: "work_order" | "breezeway_outbound" | "breezeway_work_order";
  ticketId?: string | null;
};
export type IndependentReadiness = {
  propertyId: string;
  pendingFacts: number;
  financials: IndependentReadinessItem[];
  fieldWork: IndependentReadinessItem[];
};

/** Scope comes from the existing task applicability model, never title guesses here. */
export function independentReadinessForTasks(
  source: IndependentReadiness | undefined,
  tasks: {
    id: string;
    status: string;
    assigned_to?: string | null;
    due_on?: string | null;
    carryover_reason?: string | null;
  }[],
) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const relevant = (row: IndependentReadinessItem) =>
    row.taskIds.length === 0 || row.taskIds.some((id) => byId.has(id));
  const financial = (source?.financials ?? []).filter((row) => row.issue && relevant(row));
  const field = (source?.fieldWork ?? []).filter(
    (row) => row.issue && row.taskIds.some((id) => byId.has(id)),
  );
  const deferred = (row: IndependentReadinessItem) =>
    row.taskIds
      .filter((id) => byId.has(id))
      .every((id) => {
        const task = byId.get(id)!;
        return (
          task.status === "carryover" &&
          Boolean(task.assigned_to && task.due_on && task.carryover_reason?.trim())
        );
      });
  const fieldBlockers = field.filter((row) => !deferred(row));
  return {
    financialBlockers: financial,
    fieldBlockers,
    retainedFieldWork: field.filter(deferred),
    extras: {
      independentReadinessUnavailable: !source,
      pendingFacts: source?.pendingFacts ?? 0,
      openFinancials: financial.length,
      openFieldWork: fieldBlockers.length,
      financialReasons: financial.map((row) => `${row.title}: ${row.issue}`),
      fieldReasons: fieldBlockers.map((row) => `${row.title}: ${row.issue}`),
    },
  };
}
