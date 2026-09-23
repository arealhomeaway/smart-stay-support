/**
 * Active Owner Opportunities from the shared Work Item engine. Owner-facing
 * language only: Opportunities, never tasks or requirements. Completing one
 * never changes ARHA's internal work.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/SectionCard";
import { completeMyOpportunity, listMyOpportunities } from "@/lib/v2-workflow.functions";

export function OwnerOpportunities({ onLogHours, readOnly = false }: { onLogHours?: (activity: string) => void; readOnly?: boolean }) {
  const qc = useQueryClient();
  const list = useServerFn(listMyOpportunities);
  const complete = useServerFn(completeMyOpportunity);
  const q = useQuery({ queryKey: ["owner-opportunities"], queryFn: () => list() });
  const done = useMutation({
    mutationFn: (id: string) => complete({ data: { id } }),
    onSuccess: () => { toast.success("Marked done. Thank you!"); void qc.invalidateQueries({ queryKey: ["owner-opportunities"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update."),
  });
  const items = q.data ?? [];
  if (!q.isLoading && items.length === 0) return null;

  return (
    <SectionCard title="Opportunities" description="Optional ways to take part in getting your home ready. Log the time you spend on each one.">
      <ul className="space-y-3">
        {items.map((o) => {
          const c = o.owner_content;
          const finished = o.status === "complete";
          return (
            <li key={o.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{o.title}</p>
                  <p className="text-xs text-muted-foreground">{o.propertyName}{o.due_on ? ` · suggested by ${o.due_on}` : ""}</p>
                </div>
                {finished ? <span className="flex items-center gap-1 text-sm text-state-done"><CheckCircle2 className="size-4" /> Done</span> : null}
              </div>
              {c ? (
                <dl className="mt-3 grid gap-2 text-sm">
                  {c.what ? <div><dt className="font-medium">What you'll do</dt><dd className="text-muted-foreground">{c.what}</dd></div> : null}
                  {c.why ? <div><dt className="font-medium">Why this Opportunity matters</dt><dd className="text-muted-foreground">{c.why}</dd></div> : null}
                  {c.how ? <div><dt className="font-medium">How to complete it</dt><dd className="text-muted-foreground">{c.how}</dd></div> : null}
                  {c.ways_to_document ? <div><dt className="font-medium">Ways to Document Your Participation</dt><dd className="text-muted-foreground">{c.ways_to_document}</dd></div> : null}
                  {c.resources.length ? (
                    <div>
                      <dt className="font-medium">Helpful links</dt>
                      <dd className="space-y-0.5">
                        {c.resources.map((r) => (
                          <a key={r} href={r} target="_blank" rel="noreferrer" className="block truncate text-primary underline-offset-2 hover:underline">{r}</a>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
              {!readOnly ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {onLogHours ? <Button size="sm" onClick={() => onLogHours(o.title)}>Log time</Button> : null}
                  {!finished ? <Button size="sm" variant="outline" disabled={done.isPending} onClick={() => done.mutate(o.id)}>Mark done</Button> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
