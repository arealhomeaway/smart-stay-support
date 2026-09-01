/**
 * Breezeway Work Orders for one property, inside Resolve.
 *
 * This is a mirror of work Breezeway is executing — not Resolve Tickets. The
 * distinction is deliberate and stays visible: every card is badged "Breezeway"
 * and closing one here closes the Breezeway work order only. A Resolve Ticket
 * keeps its own closure requirements.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Camera, MessageSquare, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  propertyWorkOrders,
  replyToWorkOrderFn,
  workOrderComments,
  workOrderLifecycle,
} from "@/lib/breezeway-workorders.functions";
import type { BreezewayWorkOrder } from "@/lib/breezeway-workorders";

function stageTone(stage: string | null) {
  const s = (stage ?? "").toLowerCase();
  if (s.includes("start") || s.includes("resume")) return "default" as const;
  if (s.includes("pause")) return "destructive" as const;
  return "secondary" as const;
}

function WhenLine({ order }: { order: BreezewayWorkOrder }) {
  if (!order.scheduledDate) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <CalendarClock className="size-3" />
      {order.scheduledDate}
      {order.scheduledTime ? ` · ${order.scheduledTime}` : ""}
    </span>
  );
}

function CommentThread({ workOrderId }: { workOrderId: string }) {
  const load = useServerFn(workOrderComments);
  const reply = useServerFn(replyToWorkOrderFn);
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["bw-wo-comments", workOrderId],
    queryFn: () => load({ data: { workOrderId } }),
  });

  const send = useMutation({
    mutationFn: () => reply({ data: { workOrderId, body: draft } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message ?? "Could not send that comment.");
        return;
      }
      setDraft("");
      toast.success("Comment sent to Breezeway.");
      void qc.invalidateQueries({ queryKey: ["bw-wo-comments", workOrderId] });
    },
    onError: () => toast.error("Could not send that comment."),
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  const comments = data?.comments ?? [];

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
      {data?.notice && <p className="text-xs text-muted-foreground">{data.notice}</p>}
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments on this work order yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="font-medium">{c.author ?? (c.direction === "outbound" ? "Resolve" : "Breezeway")}</span>
              {c.commentedAt && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(c.commentedAt).toLocaleString()}
                </span>
              )}
              <p className="whitespace-pre-wrap text-muted-foreground">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Reply in Breezeway…"
          rows={2}
          className="text-sm"
        />
        <Button
          size="sm"
          disabled={!draft.trim() || send.isPending}
          onClick={() => send.mutate()}
          aria-label="Send comment to Breezeway"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function WorkOrderCard({ order, writable }: { order: BreezewayWorkOrder; writable: boolean }) {
  const [open, setOpen] = useState(false);
  const act = useServerFn(workOrderLifecycle);
  const qc = useQueryClient();
  const lifecycle = useMutation({
    mutationFn: (action: string) => act({ data: { workOrderId: order.id, action } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message ?? "Breezeway refused that change.");
        return;
      }
      toast.success("Breezeway updated.");
      void qc.invalidateQueries({ queryKey: ["bw-work-orders"] });
    },
    onError: () => toast.error("Could not reach Breezeway."),
  });

  return (
    <div className="space-y-2 border-b border-border/50 pb-3 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{order.name ?? `Breezeway task ${order.breezewayTaskId}`}</p>
          <div className="flex flex-wrap items-center gap-2">
            <WhenLine order={order} />
            {order.assignees.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {order.assignees.map((a) => a.name).filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Breezeway</Badge>
          {order.department && <Badge variant="secondary">{order.department}</Badge>}
          <Badge variant={stageTone(order.stage)}>{order.status ?? order.stage ?? "Unknown"}</Badge>
          {order.needsAttention && <Badge variant="destructive">New activity</Badge>}
        </div>
      </div>

      {order.description && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{order.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          <MessageSquare className="mr-1 size-3" />
          {order.commentCount > 0 ? `Comments (${order.commentCount})` : "Comments"}
        </Button>
        {order.photoCount > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Camera className="size-3" /> {order.photoCount} photo{order.photoCount === 1 ? "" : "s"}
          </span>
        )}
        {writable && (
          <>
            <Button variant="outline" size="sm" disabled={lifecycle.isPending} onClick={() => lifecycle.mutate("close")}>
              Close in Breezeway
            </Button>
            <Button variant="outline" size="sm" disabled={lifecycle.isPending} onClick={() => lifecycle.mutate("reopen")}>
              Reopen
            </Button>
            <Button variant="outline" size="sm" disabled={lifecycle.isPending} onClick={() => lifecycle.mutate("approve")}>
              Approve
            </Button>
          </>
        )}
        {order.needsAttention && (
          <Button variant="ghost" size="sm" onClick={() => lifecycle.mutate("acknowledge")}>
            Mark read
          </Button>
        )}
      </div>

      {open && <CommentThread workOrderId={order.id} />}
    </div>
  );
}

export function BreezewayWorkOrderPanel({ propertyId }: { propertyId: string }) {
  const load = useServerFn(propertyWorkOrders);
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["bw-work-orders", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await load({ data: { propertyId, refresh: true } });
      qc.setQueryData(["bw-work-orders", propertyId], res);
      if (res.notice) toast.error(res.notice);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base">Breezeway work orders</CardTitle>
          <CardDescription>
            Current Breezeway work at this home. Resolve stays the source of truth — closing here
            closes the Breezeway work order only.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw className={`mr-1 size-3 ${refreshing ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (data?.workOrders.length ?? 0) === 0 ? (
          <p className="text-muted-foreground">
            {data?.mappingState === "verified"
              ? "No current Breezeway work at this home."
              : "This home is not verified against Breezeway, so no work orders are mirrored."}
          </p>
        ) : (
          data!.workOrders.map((o) => (
            <WorkOrderCard key={o.id} order={o} writable={Boolean(data?.writable)} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
