/**
 * Property page Part 2 (2.7): owner and staff emails that failed, with Retry (Admin only), one at a
 * time or Retry all. A retry puts the email back in the queue for the next five-minute run; never automatic.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listFailedEmailsFn, retryFailedEmailFn } from "@/lib/owner-tab.functions";
import { useRole } from "@/hooks/useRole";

export function FailedEmailsPanel() {
  const { roles } = useRole();
  const isAdmin = roles.includes("admin");
  const list = useServerFn(listFailedEmailsFn);
  const retry = useServerFn(retryFailedEmailFn);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["failed-emails"], queryFn: () => list(), enabled: isAdmin });
  const m = useMutation({
    mutationFn: (v: { audience: "owner" | "staff" | null; id: string | null }) => retry({ data: v }),
    onSuccess: (r) => {
      toast.success(r.count === 1 ? "1 email will be sent again on the next run." : `${r.count} emails will be sent again on the next run.`);
      void qc.invalidateQueries({ queryKey: ["failed-emails"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!isAdmin) return null;
  const rows = q.data?.rows ?? [];
  return (
    <section className="surface space-y-3 p-4" aria-label="Failed emails">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg">Failed emails</h2>
        {rows.length > 1 ? (
          <Button variant="outline" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate({ audience: null, id: null })}>
            Retry all
          </Button>
        ) : null}
      </div>
      {q.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {q.error ? <p role="alert" className="text-sm">Could not load failed emails.</p> : null}
      {!q.isPending && rows.length === 0 ? <p className="text-sm text-muted-foreground">No failed emails.</p> : null}
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={`${r.audience}-${r.id}`} className="flex flex-wrap items-center gap-3 py-2">
            <span className="rounded bg-muted px-2 py-0.5 text-xs">{r.audience === "owner" ? "Owner" : "Staff"}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {new Date(r.at).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {r.error ? ` · ${r.error}` : ""}
              </p>
            </div>
            <Button variant="outline" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate({ audience: r.audience, id: r.id })}>
              Retry
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
