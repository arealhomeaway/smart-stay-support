import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";

type Payload = {
  since?: string; fetched?: number; imported?: number; updated?: number; duplicates?: number;
  unmatched?: { source_review_id: string; ownerrez_property_id: string | null; reason: string }[];
};

const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });

/** Nightly OwnerRez review import: last runs, failures and reviews that could not be matched. */
export function ReviewImportStatusPanel() {
  const q = useQuery({
    queryKey: ["review-import-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_events")
        .select("id, status, created_at, error_message, request_payload")
        .eq("system", "ownerrez_reviews")
        .eq("operation", "nightly_sync")
        .order("created_at", { ascending: false })
        .limit(7);
      if (error) throw error;
      return data ?? [];
    },
  });
  const runs = q.data ?? [];
  const latest = runs[0];
  const unmatched = ((latest?.request_payload as Payload | null)?.unmatched) ?? [];
  return (
    <SectionCard title="OwnerRez reviews: nightly import" description="Runs every night around 2 a.m. Central. New reviews are added and edited reviews are refreshed. Each review is stored once by its OwnerRez review ID.">
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : q.error ? <p className="text-sm text-destructive">Could not load import history.</p>
        : runs.length === 0 ? <p className="text-sm text-muted-foreground">No nightly import has run yet. The first one runs tonight.</p>
        : (
          <div className="space-y-3">
            <ul className="space-y-1 text-sm">
              {runs.map((r) => {
                const p = (r.request_payload ?? {}) as Payload;
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    <span>{fmt(r.created_at)}</span>
                    <Badge variant={r.status === "failed" ? "destructive" : r.status === "completed" ? "secondary" : "outline"}>
                      {r.status === "completed" ? "Finished" : r.status === "failed" ? "Failed" : "Running or stopped"}
                    </Badge>
                    {r.status === "completed" && <span className="text-muted-foreground">{p.imported ?? 0} new, {p.updated ?? 0} updated, {p.unmatched?.length ?? 0} not matched</span>}
                    {r.status === "failed" && <span className="text-destructive">{r.error_message}</span>}
                  </li>
                );
              })}
            </ul>
            {unmatched.length > 0 && (
              <div>
                <p className="text-sm font-medium">Reviews from the last run that need a look</p>
                <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                  {unmatched.map((u) => (
                    <li key={u.source_review_id}>OwnerRez review {u.source_review_id}{u.ownerrez_property_id ? ` (OwnerRez property ${u.ownerrez_property_id})` : ""}: {u.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
    </SectionCard>
  );
}
