/** "Reviews waiting for me" on My Work. Hidden when there is nothing to review. */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { SectionCard } from "@/components/ui/page";
import { listMyReviews } from "@/lib/onboarding-reviews.functions";
import { roleLabel } from "@/lib/v2-workflow.functions";
import { usDateTime } from "@/lib/dates";

export function ReviewsWaiting({ propertyName }: { propertyName: (id: string) => string }) {
  const list = useServerFn(listMyReviews);
  const q = useQuery({ queryKey: ["my-reviews"], queryFn: () => list(), retry: false });
  const rows = q.data ?? [];
  if (!rows.length) return null;
  const now = Date.now();
  return (
    <SectionCard title="Reviews waiting for me" description="Steps submitted to you for approval, soonest due first.">
      <ul className="divide-y divide-border text-sm">
        {rows.map((r) => {
          const late = r.due_at ? new Date(r.due_at).getTime() < now : false;
          return (
            <li key={r.review_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <a className="font-medium underline-offset-2 hover:underline" href={`/onboarding/${r.property_id}?tab=work&task=${r.task_id}`}>
                {r.title}
              </a>
              <span className="text-xs text-muted-foreground">
                {propertyName(r.property_id)} · {(r.roles ?? []).map(roleLabel).join(", ")} · from {r.submitted_by_name}
                {r.due_at ? ` · ${late ? "Overdue since" : "Due"} ${usDateTime(r.due_at)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
