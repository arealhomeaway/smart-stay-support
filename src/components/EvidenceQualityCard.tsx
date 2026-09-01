/**
 * Evidence quality as a control metric.
 *
 * This measures the system — how clear our photo requests are and where they
 * fall down — not the people taking the photos. No names appear here by design.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { evidenceQualityStatsFn } from "@/lib/evidence.functions";
import type { EvidenceSubject } from "@/lib/evidence";

const SUBJECT_LABEL: Record<EvidenceSubject, string> = {
  work_order: "Work Orders",
  ticket: "Tickets",
  onboarding_task: "Onboarding tasks",
  assessment: "Assessments",
  property: "Property records",
};

function pct(n: number | null) {
  return n === null ? "—" : `${Math.round(n * 100)}%`;
}

export function EvidenceQualityCard({ windowDays = 30 }: { windowDays?: number }) {
  const load = useServerFn(evidenceQualityStatsFn);
  const { data, isLoading } = useQuery({
    queryKey: ["evidence-quality", windowDays],
    queryFn: () => load({ data: { windowDays } }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="size-4" /> Evidence quality
        </CardTitle>
        <CardDescription>
          Last {windowDays} days. A low first-attempt rate usually means the request was unclear, not
          that someone did poor work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading || !data ? (
          <Skeleton className="h-32 w-full" />
        ) : data.submitted === 0 ? (
          <p className="text-muted-foreground">No photos have been submitted in this window yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xl font-semibold">{pct(data.firstAttemptPassRate)}</p>
                <p className="text-xs text-muted-foreground">Right the first time</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{data.medianAttemptsToPass ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Typical photos per request</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{data.submitted}</p>
                <p className="text-xs text-muted-foreground">Photos checked</p>
              </div>
              <div>
                <p className="text-xl font-semibold">{data.acceptedWithException}</p>
                <p className="text-xs text-muted-foreground">Accepted with exception</p>
              </div>
            </div>

            {data.topReasons.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">Why photos come back</p>
                {data.topReasons.map((r) => (
                  <div key={r.code} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{r.label}</span>
                      <span className="text-muted-foreground">
                        {r.count} · {pct(r.share)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded bg-muted">
                      <div
                        className="h-1.5 rounded bg-primary"
                        style={{ width: `${Math.round(r.share * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {data.bySubject.length > 0 && (
              <div className="space-y-1">
                <p className="font-medium">Where evidence is being asked for</p>
                {data.bySubject.map((s) => (
                  <div key={s.subject} className="flex justify-between text-xs text-muted-foreground">
                    <span>{SUBJECT_LABEL[s.subject] ?? s.subject}</span>
                    <span>
                      {s.satisfied} of {s.requirements} satisfied
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
