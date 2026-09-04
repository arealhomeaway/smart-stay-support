/**
 * Internal review of homeowner-reported participation.
 *
 * Reviewers record a decision only. Nothing here edits, estimates or credits
 * an owner's minutes — the homeowner's original entry stays exactly as they
 * submitted it, and returning or flagging always carries a written reason the
 * owner can read.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Flag, RotateCcw, ShieldCheck } from "lucide-react";
import { ownerTimeReviewQueue, reviewOwnerTimeEntry } from "@/lib/owner-program.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useRole } from "@/hooks/useRole";
import { usDate } from "@/lib/dates";

function hours(minutes: number) {
  return `${Math.round((minutes / 60) * 10) / 10} hr`;
}

export function OwnerTimeReviewQueue() {
  const qc = useQueryClient();
  const { isSupervisor, readOnly } = useRole();
  const load = useServerFn(ownerTimeReviewQueue);
  const decide = useServerFn(reviewOwnerTimeEntry);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queue = useQuery({ queryKey: ["owner-time-review"], queryFn: () => load() });

  const act = useMutation({
    mutationFn: (input: { entryId: string; decision: "approved" | "returned" | "flagged" }) =>
      decide({ data: { ...input, note: notes[input.entryId]?.trim() ?? "" } }),
    onSuccess: () => {
      toast.success("Decision recorded.");
      void qc.invalidateQueries({ queryKey: ["owner-time-review"] });
      void qc.invalidateQueries({ queryKey: ["owner-programs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (queue.isLoading) return <Skeleton className="h-40 w-full" />;
  const entries = queue.data?.entries ?? [];
  const rules = queue.data?.rules ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-4 text-primary" /> Owner participation review
        </CardTitle>
        <CardDescription>
          Owner-reported entries awaiting an internal decision. Reported time is never edited here —
          a return or flag records a reason instead.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rules.map((r) => (
              <Badge key={r.key} variant="outline" className="font-normal">
                {r.label}: {Object.values(r.value).join(" · ") || "not set"}
              </Badge>
            ))}
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is waiting on a reviewer.</p>
        ) : (
          entries.map((e) => (
            <div key={e.id} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{e.activity}</p>
                  <p className="text-sm text-muted-foreground">
                    {e.ownerName || "Owner"} · {usDate(e.entryDate)} · {hours(e.minutes)}
                    {e.propertyNames.length > 0 && ` · ${e.propertyNames.join(", ")}`}
                  </p>
                  {e.output && <p className="mt-1 text-sm">{e.output}</p>}
                </div>
                <Badge
                  variant="outline"
                  className={
                    e.reviewStatus === "flagged"
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                      : ""
                  }
                >
                  {e.reviewStatus}
                </Badge>
              </div>

              {isSupervisor && !readOnly && (
                <>
                  <Textarea
                    rows={2}
                    placeholder="Reason the owner will see (required to return or flag)"
                    value={notes[e.id] ?? ""}
                    onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={act.isPending}
                      onClick={() => act.mutate({ entryId: e.id, decision: "approved" })}
                    >
                      <CheckCircle2 className="size-4" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={act.isPending || (notes[e.id] ?? "").trim().length === 0}
                      title="Add a reason the owner can read"
                      onClick={() => act.mutate({ entryId: e.id, decision: "returned" })}
                    >
                      <RotateCcw className="size-4" /> Return
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={act.isPending || (notes[e.id] ?? "").trim().length === 0}
                      title="Add a reason the owner can read"
                      onClick={() => act.mutate({ entryId: e.id, decision: "flagged" })}
                    >
                      <Flag className="size-4" /> Flag
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
