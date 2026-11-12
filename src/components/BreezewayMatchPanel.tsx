/** B3: onboarding homes not yet matched to Breezeway, with suggested homes and Confirm match (Admin). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { confirmBreezewayMatchFn, onboardingBreezewayMatchesFn } from "@/lib/breezeway-match.functions";

export function BreezewayMatchPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(onboardingBreezewayMatchesFn);
  const confirmFn = useServerFn(confirmBreezewayMatchFn);
  const q = useQuery({ queryKey: ["breezeway-matches"], queryFn: () => listFn() });
  const confirm = useMutation({
    mutationFn: (v: { propertyId: string; breezewayHomeId: number }) => confirmFn({ data: v }),
    onSuccess: () => {
      toast.success("Matched. This home can now reach Breezeway.");
      void qc.invalidateQueries({ queryKey: ["breezeway-matches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <SectionCard title="Match onboarding homes to Breezeway">
      {q.isLoading ? <p className="text-sm text-muted-foreground">Checking homes…</p> : null}
      {q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : null}
      {q.data?.error ? <p className="text-sm text-destructive">{q.data.error}</p> : null}
      {q.data && q.data.rows.length === 0 ? <p className="text-sm text-muted-foreground">Every onboarding home is matched.</p> : null}
      <ul className="divide-y divide-border">
        {(q.data?.rows ?? []).map((r) => (
          <li key={r.propertyId} className="space-y-2 py-3">
            <p className="font-medium">{r.address}</p>
            {r.suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Breezeway home with this street address yet.</p>
            ) : (
              r.suggestions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span>
                    Breezeway home {s.id}
                    {s.name ? ` · ${s.name}` : ""}
                    {s.address ? ` · ${s.address}` : ""}
                    {s.city ? `, ${s.city}` : ""}
                  </span>
                  <Button
                    size="sm"
                    className="min-h-11"
                    disabled={confirm.isPending}
                    onClick={() => {
                      if (window.confirm(`Match ${r.address} to Breezeway home ${s.id}?`))
                        confirm.mutate({ propertyId: r.propertyId, breezewayHomeId: s.id });
                    }}
                  >
                    Confirm match
                  </Button>
                </div>
              ))
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
