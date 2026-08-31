import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OUTBOUND_STATUS_LABEL } from "@/lib/breezeway-outbound";
import {
  breezewayOutboundReviewQueue,
  reconcileBreezewayOutboundTask,
} from "@/lib/breezeway-outbound.functions";

/**
 * Admin recovery for outbound Breezeway records Resolve could not confirm.
 *
 * Deliberately manual. Resolve never re-sends a task creation automatically:
 * an unconfirmed create may already exist in Breezeway, and retrying it is how
 * duplicates happen. An admin checks Breezeway and either binds the real task
 * id (verified against the pilot property before it is accepted) or records
 * that nothing was created.
 */
export function BreezewayOutboundReviewPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(breezewayOutboundReviewQueue);
  const reconcileFn = useServerFn(reconcileBreezewayOutboundTask);
  const [taskIds, setTaskIds] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const queue = useQuery({
    queryKey: ["breezeway-outbound-review"],
    queryFn: () => listFn(),
  });

  const reconcile = useMutation({
    mutationFn: (vars: { id: string; action: "link" | "abandon" }) =>
      reconcileFn({
        data: {
          id: vars.id,
          action: vars.action,
          breezewayTaskId: taskIds[vars.id] ?? "",
          note: notes[vars.id] ?? "",
        },
      }),
    onSuccess: (result) => {
      if (result && "ok" in result && !result.ok) toast.error(result.message);
      else toast.success("Record resolved.");
      void qc.invalidateQueries({ queryKey: ["breezeway-outbound-review"] });
      void qc.invalidateQueries({ queryKey: ["breezeway-outbound"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = queue.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4" /> Breezeway outbound review
          {rows.length ? <Badge variant="secondary">{rows.length}</Badge> : null}
        </CardTitle>
        <CardDescription>
          Records where Resolve could not confirm whether Breezeway created the task. Nothing is
          retried automatically — check Breezeway, then record what you found.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {queue.isLoading ? <p className="text-muted-foreground">Loading…</p> : null}
        {!queue.isLoading && rows.length === 0 ? (
          <p className="text-muted-foreground">Nothing awaiting review.</p>
        ) : null}

        {rows.map((row) => (
          <div key={row.id} className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={row.status === "needs_review" ? "secondary" : "outline"}>
                {OUTBOUND_STATUS_LABEL[row.status] ?? row.status}
              </Badge>
              <span className="font-medium">{row.title}</span>
              {row.propertyName ? (
                <span className="text-muted-foreground">{row.propertyName}</span>
              ) : null}
              <span className="text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </span>
            </div>
            {row.errorMessage ? (
              <p className="text-xs text-amber-700">{row.errorMessage}</p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor={`bz-id-${row.id}`}>Breezeway task id (if it exists)</Label>
                <Input
                  id={`bz-id-${row.id}`}
                  inputMode="numeric"
                  placeholder="e.g. 8123456"
                  value={taskIds[row.id] ?? ""}
                  onChange={(e) => setTaskIds((s) => ({ ...s, [row.id]: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`bz-note-${row.id}`}>What you found</Label>
                <Input
                  id={`bz-note-${row.id}`}
                  value={notes[row.id] ?? ""}
                  onChange={(e) => setNotes((s) => ({ ...s, [row.id]: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={reconcile.isPending || !(taskIds[row.id] ?? "").trim()}
                onClick={() => reconcile.mutate({ id: row.id, action: "link" })}
              >
                Link this task id
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={reconcile.isPending}
                onClick={() => reconcile.mutate({ id: row.id, action: "abandon" })}
              >
                No task exists — close it
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
