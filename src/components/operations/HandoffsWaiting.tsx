import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { readHandoffsWaitingForMe } from "@/lib/home-context.functions";
import { handoffsWaiting } from "@/lib/home-context";
import { useDemo } from "@/components/DemoProvider";
import { Button } from "@/components/ui/button";

/** My Work section for the Director of Operations seat (or its cover): homes marked ready, oldest first. */
export function HandoffsWaiting() {
  const read = useServerFn(readHandoffsWaitingForMe);
  const { demoMode } = useDemo();
  const q = useQuery({ queryKey: ["handoffs-waiting"], queryFn: () => read() });
  if (!q.data?.show) return null;
  const rows = handoffsWaiting(q.data.rows.filter((r) => r.demo === Boolean(demoMode)), Date.now());
  if (!rows.length) return null;
  return (
    <section className="surface space-y-2 p-4" aria-label="Handoffs waiting for you">
      <h2 className="font-semibold">Handoffs waiting for you</h2>
      <ul>
        {rows.map((r) => (
          <li key={r.projectId} className="flex flex-wrap items-center gap-3 border-b border-border py-2 last:border-0">
            <span className="min-w-0 flex-1 text-sm font-medium">{r.name}</span>
            <span className="text-xs text-muted-foreground">
              {r.days === null ? "Ready date not recorded" : r.days === 1 ? "Waiting 1 day" : `Waiting ${r.days} days`}
            </span>
            <Button size="sm" variant="outline" asChild>
              <Link to="/property/$propertyId" params={{ propertyId: r.propertyId }} search={{ tab: "handoff" }}>Open</Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
