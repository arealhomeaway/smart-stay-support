/**
 * Four fixed summary cards on the homeowner dashboard. Each opens the one
 * Opportunities workspace with that filter applied — never a separate page.
 * Counts come straight from canonical Opportunity data.
 */
import { OWNER_QUEUES, type OwnerQueue } from "@/lib/owner-opportunity-filters";
import { useOwnerOpportunityData, type OpportunityHome } from "@/components/owner/OwnerOpportunities";
import { cn } from "@/lib/utils";

const TONE: Record<OwnerQueue, string> = {
  attention: "border-destructive/30 bg-destructive/5 text-destructive",
  awaiting: "border-warning/40 bg-warning/10 text-warning",
  feedback: "border-info/30 bg-info/5 text-info",
  new: "border-sage/30 bg-sage/5 text-sage",
};

export function OwnerQueueCards({
  homes,
  selectedHomeId,
  onOpen,
}: {
  homes: OpportunityHome[];
  selectedHomeId: string | null;
  onOpen: (q: OwnerQueue) => void;
}) {
  const data = useOwnerOpportunityData(homes, selectedHomeId);
  return (
    <section aria-label="Your Opportunities at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {OWNER_QUEUES.map((q) => (
        <button
          key={q.key}
          type="button"
          onClick={() => onOpen(q.key)}
          className={cn(
            "min-w-0 rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            TONE[q.key],
          )}
        >
          <span className="numeric block text-3xl font-semibold leading-none">
            {data.loading ? "–" : data.counts[q.key]}
          </span>
          <span className="mt-2 block text-sm font-medium text-foreground">{q.label}</span>
        </button>
      ))}
    </section>
  );
}
