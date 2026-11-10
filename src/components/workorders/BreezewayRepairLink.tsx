/**
 * Repair card while Resolve work orders are switched off (register C4, C5; Emily, Nov 10).
 *
 * The only work orders are Breezeway work orders. The coordinator makes it in Breezeway, then
 * picks it from the home's mirrored work orders (or pastes its number). The ticket then shows
 * that work order's status, assignee, comments and photos from the mirror. Vendor invoices are
 * added to the ticket. Nothing here creates, changes or sends anything to Breezeway.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { linkTicketBreezewayOrderFn, ticketBreezewayOrdersFn } from "@/lib/breezeway-bridge.functions";
import { workOrderComments, workOrderPhotos } from "@/lib/breezeway-workorders.functions";
import { BRIDGE_COPY, type TicketBreezewayOrder } from "@/lib/breezeway-bridge";
import { usDate, usDateTime } from "@/lib/dates";

function LinkedOrder({ order }: { order: TicketBreezewayOrder }) {
  const commentsFn = useServerFn(workOrderComments);
  const photosFn = useServerFn(workOrderPhotos);
  // Mirror only: refresh is off, so opening the ticket never calls Breezeway.
  const comments = useQuery({
    queryKey: ["bw-wo-comments-mirror", order.id],
    queryFn: () => commentsFn({ data: { workOrderId: order.id, refresh: false } }),
  });
  const photos = useQuery({
    queryKey: ["bw-wo-photos-mirror", order.id],
    queryFn: () => photosFn({ data: { workOrderId: order.id, refresh: false } }),
  });
  const list = comments.data?.comments ?? [];
  const pics = photos.data?.photos ?? [];
  return (
    <div className="space-y-2 rounded-lg bg-sunken px-3 py-2.5" data-testid="linked-breezeway-order">
      <div className="flex flex-wrap items-center gap-2">
        <Chip>Breezeway {order.breezewayTaskId}</Chip>
        {order.status ? <Chip>{order.status}</Chip> : null}
        {order.department ? <Chip>{order.department}</Chip> : null}
      </div>
      <p className="font-medium">{order.name ?? "Breezeway work order"}</p>
      <dl className="grid gap-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Assigned to</dt>
          <dd>{order.assignees.length ? order.assignees.join(", ") : "Nobody yet"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Scheduled</dt>
          <dd>{order.scheduledDate ? usDate(order.scheduledDate) : "No date yet"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Finished</dt>
          <dd>{order.finishedAt ? usDateTime(order.finishedAt) : "Not yet"}</dd>
        </div>
      </dl>
      {list.length ? (
        <ul className="space-y-1 text-xs" aria-label="Breezeway comments">
          {list.slice(-5).map((c) => (
            <li key={c.id}>
              <span className="text-muted-foreground">
                {c.resolveAuthorName ?? c.author ?? "Breezeway"}
                {c.commentedAt ? `, ${usDateTime(c.commentedAt)}` : ""}:
              </span>{" "}
              {c.body}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      )}
      {pics.length ? (
        <div className="flex flex-wrap gap-2" aria-label="Breezeway photos">
          {pics.slice(0, 8).map((p) => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer noopener" className="block">
              <img
                src={p.url}
                alt={p.caption ?? "Work order photo"}
                loading="lazy"
                className="h-16 w-16 rounded-md object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
      <Button asChild variant="outline" className="min-h-11">
        <a href={order.link} target="_blank" rel="noreferrer noopener">
          <ExternalLink className="size-4" /> Open in Breezeway
        </a>
      </Button>
    </div>
  );
}

export function BreezewayRepairLink({
  ticketId,
  hasHome,
  readOnly,
}: {
  ticketId: string;
  hasHome: boolean;
  readOnly: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(ticketBreezewayOrdersFn);
  const linkFn = useServerFn(linkTicketBreezewayOrderFn);
  const [picked, setPicked] = useState<string>("");
  const [number, setNumber] = useState("");
  const key = ["ticket-breezeway-orders", ticketId];

  const orders = useQuery({ queryKey: key, queryFn: () => listFn({ data: { ticketId } }) });

  const link = useMutation({
    mutationFn: () =>
      linkFn({
        data: picked ? { ticketId, workOrderId: picked } : { ticketId, taskNumber: number.trim() },
      }),
    onSuccess: async (r) => {
      if (!r.ok) {
        toast.error(r.message);
        return;
      }
      toast.success(`Linked Breezeway work order ${r.breezewayTaskId}.`);
      setPicked("");
      setNumber("");
      await qc.invalidateQueries({ queryKey: key });
      await qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linked = orders.data?.linked ?? [];
  const choices = orders.data?.choices ?? [];

  return (
    <Card data-testid="breezeway-repair-link">
      <CardHeader>
        <CardTitle>{linked.length ? "Breezeway work order" : BRIDGE_COPY.linkTitle}</CardTitle>
        <CardDescription>{BRIDGE_COPY.linkHelp}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {orders.isLoading ? <p className="text-muted-foreground">Loading</p> : null}
        {orders.error ? <p className="text-destructive">{(orders.error as Error).message}</p> : null}
        {linked.map((o) => (
          <LinkedOrder key={o.id} order={o} />
        ))}

        {!readOnly && orders.data ? (
          !hasHome ? (
            <p className="text-muted-foreground">Add the home to this ticket first.</p>
          ) : (
            <div className="space-y-3 rounded-md border p-3">
              <p className="font-medium">{linked.length ? "Link another Breezeway work order" : BRIDGE_COPY.linkTitle}</p>
              <div className="space-y-1">
                <Label className="text-xs">This home's Breezeway work orders</Label>
                {choices.length ? (
                  <Select
                    value={picked}
                    onValueChange={(v) => {
                      setPicked(v);
                      setNumber("");
                    }}
                  >
                    <SelectTrigger className="min-h-11" aria-label="This home's Breezeway work orders">
                      <SelectValue placeholder="Pick a work order" />
                    </SelectTrigger>
                    <SelectContent>
                      {choices.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.breezewayTaskId} · {c.name ?? "Work order"}
                          {c.status ? ` · ${c.status}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">{BRIDGE_COPY.noHomeOrders}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor={`bw-number-${ticketId}`}>
                  {BRIDGE_COPY.pasteLabel}
                </Label>
                <Input
                  id={`bw-number-${ticketId}`}
                  inputMode="numeric"
                  className="min-h-11"
                  value={number}
                  onChange={(e) => {
                    setNumber(e.target.value);
                    if (e.target.value) setPicked("");
                  }}
                  placeholder="For example: 172480884"
                />
              </div>
              <Button
                className="min-h-11 w-full sm:w-auto"
                disabled={link.isPending || (!picked && !number.replace(/[^0-9]/g, ""))}
                onClick={() => link.mutate()}
              >
                Link work order
              </Button>
            </div>
          )
        ) : null}

        <AttachmentsPanel
          entityType="ticket"
          entityId={ticketId}
          title={BRIDGE_COPY.invoices}
          description={BRIDGE_COPY.invoicesHelp}
          readOnly={readOnly}
        />
      </CardContent>
    </Card>
  );
}
