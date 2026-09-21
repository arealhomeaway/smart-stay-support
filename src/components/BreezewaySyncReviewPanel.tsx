import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, GitCompareArrows, Inbox, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  syncReviewBoard,
  syncReviewHoldDrift,
  syncReviewSettleConflict,
} from "@/lib/sync-review.functions";
import { usDateTime } from "@/lib/dates";

type Board = Awaited<ReturnType<typeof syncReviewBoard>>;

/**
 * One board for everything that did not line up between Breezeway and Resolve.
 * Nothing on this screen changes a job: differences are held until a person
 * chooses, which is the standing rule for a transitional system.
 */
export function BreezewaySyncReviewPanel() {
  const load = useServerFn(syncReviewBoard);
  const holdDrift = useServerFn(syncReviewHoldDrift);
  const settle = useServerFn(syncReviewSettleConflict);
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});

  const board = useQuery<Board>({
    queryKey: ["sync-review-board"],
    queryFn: () => load({ data: undefined }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["sync-review-board"] });

  const holdMutation = useMutation({
    mutationFn: () => holdDrift({ data: undefined }),
    onSuccess: (r) => {
      toast.success(
        r.held > 0
          ? `${r.held} difference${r.held === 1 ? "" : "s"} put up for review.`
          : "Nothing new — every difference is already on the board.",
      );
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settleMutation = useMutation({
    mutationFn: (input: { conflictId: string; chosenSource: "resolve" | "breezeway" }) =>
      settle({
        data: {
          conflictId: input.conflictId,
          chosenSource: input.chosenSource,
          note: notes[input.conflictId] ?? "",
        },
      }),
    onSuccess: () => {
      toast.success("Decision recorded.");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const events = board.data?.events ?? [];
  const drift = board.data?.drift ?? [];
  const conflicts = board.data?.conflicts ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4" /> Breezeway sync review
        </CardTitle>
        <CardDescription>
          Updates that never landed, jobs that drifted apart, and differences waiting on a
          decision. Nothing here changes on its own.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {board.isLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
        {board.error ? (
          <p className="text-xs text-destructive">{(board.error as Error).message}</p>
        ) : null}

        <section className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <Inbox className="h-3.5 w-3.5" /> Updates that never landed ({events.length})
          </h4>
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">Every recent update was placed.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-md border p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={e.bucket === "failed" ? "destructive" : "secondary"}>
                      {e.label}
                    </Badge>
                    <span className="text-muted-foreground">
                      {e.receivedAt ? usDateTime(e.receivedAt) : "—"}
                    </span>
                    {e.taskId ? <span>Breezeway job {e.taskId}</span> : null}
                    {e.retryable ? <Badge variant="outline">Can be tried again</Badge> : null}
                  </div>
                  <p className="mt-1 text-muted-foreground">{e.meaning}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator />

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-3.5 w-3.5" /> Jobs that drifted apart ({drift.length})
            </h4>
            <Button
              size="sm"
              variant="outline"
              disabled={drift.length === 0 || holdMutation.isPending}
              onClick={() => holdMutation.mutate()}
            >
              Put these up for a decision
            </Button>
          </div>
          {drift.length === 0 ? (
            <p className="text-xs text-muted-foreground">Both systems agree on every job.</p>
          ) : (
            <ul className="space-y-1">
              {drift.map((d) => (
                <li key={`${d.taskId}-${d.field}`} className="rounded-md border p-3 text-xs">
                  <p>{d.summary}</p>
                  <p className="mt-1 text-muted-foreground">
                    Resolve: {d.resolveValue ?? "—"} · Breezeway: {d.externalValue ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Separator />

        <section className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <ShieldQuestion className="h-3.5 w-3.5" /> Waiting on a decision ({conflicts.length})
          </h4>
          {conflicts.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nothing is being held.</p>
          ) : (
            <ul className="space-y-3">
              {conflicts.map((c) => (
                <li key={c.id} className="space-y-2 rounded-md border p-3 text-xs">
                  <p className="font-medium">{c.fieldLabel}</p>
                  <p className="text-muted-foreground">{c.note}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded border p-2">
                      <p className="text-muted-foreground">What Resolve holds</p>
                      <p>{c.resolveValue ?? "—"}</p>
                    </div>
                    <div className="rounded border p-2">
                      <p className="text-muted-foreground">What Breezeway holds</p>
                      <p>{c.externalValue ?? "—"}</p>
                    </div>
                  </div>
                  <Input
                    value={notes[c.id] ?? ""}
                    placeholder="Why you chose this (required)"
                    onChange={(ev) => setNotes((n) => ({ ...n, [c.id]: ev.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={settleMutation.isPending}
                      onClick={() =>
                        settleMutation.mutate({ conflictId: c.id, chosenSource: "resolve" })
                      }
                    >
                      Keep what Resolve holds
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={settleMutation.isPending}
                      onClick={() =>
                        settleMutation.mutate({ conflictId: c.id, chosenSource: "breezeway" })
                      }
                    >
                      Take the Breezeway value
                    </Button>
                  </div>
                  <p className="text-muted-foreground">
                    Your choice is recorded here. If the Breezeway value wins, make that change on
                    the ticket itself so its own history and rules apply.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
