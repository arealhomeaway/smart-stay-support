/**
 * Breezeway Work Orders for one property, inside Resolve.
 *
 * This is a mirror of work Breezeway is executing — not Resolve Tickets. The
 * distinction is deliberate and stays visible: every card is badged "Breezeway"
 * and closing one here closes the Breezeway Work Order only. A Resolve Ticket
 * keeps its own closure requirements.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  Camera,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Ticket as TicketIcon,
  Upload,
} from "lucide-react";
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
  workOrderPhotos,
  uploadWorkOrderPhotoFn,
  escalateWorkOrderToTicketFn,
} from "@/lib/breezeway-workorders.functions";
import { EvidenceQualityGate } from "@/components/EvidenceQualityGate";
import { usDateTime } from "@/lib/dates";
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
        <p className="text-xs text-muted-foreground">No comments on this Work Order yet.</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <span className="font-medium">
                {c.author ?? (c.direction === "outbound" ? "Resolve" : "Breezeway")}
              </span>
              {c.direction === "outbound" && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {c.identityMode === "staff" ? "sent as themselves" : "sent as ARHA Resolve"}
                  {c.deliveryState === "delivered"
                    ? " · delivered"
                    : c.deliveryState === "failed"
                      ? ` · not delivered${c.deliveryError ? ` (${c.deliveryError})` : ""}`
                      : c.deliveryState === "sending"
                        ? " · sending"
                        : ""}
                </span>
              )}
              {c.commentedAt && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {usDateTime(c.commentedAt)}
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

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

function PhotoStrip({ workOrderId, writable }: { workOrderId: string; writable: boolean }) {
  const load = useServerFn(workOrderPhotos);
  const upload = useServerFn(uploadWorkOrderPhotoFn);
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  // Owner/client report inclusion is OFF unless a staff member ticks it.
  const [includeInReport, setIncludeInReport] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["bw-wo-photos", workOrderId],
    queryFn: () => load({ data: { workOrderId } }),
  });

  const send = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("workOrderId", workOrderId);
      form.append("includeInTaskReport", includeInReport ? "true" : "false");
      form.append("file", file);
      return upload({ data: form });
    },
    // A refused upload is reported as a failure — never as a silent success.
    onSuccess: (res) => {
      if (!res?.ok) {
        toast.error(res?.message ?? "Breezeway did not accept that photo.");
        return;
      }
      toast.success(
        res.includeInTaskReport
          ? "Photo uploaded to Breezeway and included in the owner/client task report."
          : "Photo uploaded to Breezeway (not in the owner/client report).",
      );
      setIncludeInReport(false);
      void qc.invalidateQueries({ queryKey: ["bw-wo-photos", workOrderId] });
      void qc.invalidateQueries({ queryKey: ["bw-work-orders"] });
    },
    onError: () => toast.error("The photo was not uploaded."),
  });

  function pick(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      toast.error("Choose a JPEG, PNG, WebP or HEIC photo.");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      toast.error("That photo is larger than 15 MB.");
      return;
    }
    send.mutate(file);
  }

  const photos = data?.photos ?? [];

  return (
    <div className="space-y-2">
      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : photos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {data?.notice ?? "No photos on this Work Order yet."}
        </p>
      ) : (
        <>
          {data?.notice && <p className="text-xs text-muted-foreground">{data.notice}</p>}
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                title={p.caption ?? "Breezeway photo"}
              >
                <img
                  src={p.url}
                  alt={
                    p.caption ??
                    `Breezeway Work Order photo${p.uploader ? ` from ${p.uploader}` : ""}`
                  }
                  className="size-24 rounded object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </>
      )}

      {writable && (
        <div className="space-y-2 rounded border border-dashed p-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-3.5 accent-current"
              checked={includeInReport}
              disabled={send.isPending}
              onChange={(e) => setIncludeInReport(e.target.checked)}
            />
            Include in owner/client task report
          </label>
          <input
            ref={inputRef}
            type="file"
            accept={PHOTO_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={send.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {send.isPending ? (
              <>
                <RefreshCw className="mr-1 size-3 animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload className="mr-1 size-3" /> Add photo to Breezeway
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Uploads go straight onto the Breezeway task. JPEG, PNG, WebP or HEIC, up to 15 MB.
            Breezeway has no photo delete — check the image before you send it.
          </p>
        </div>
      )}
    </div>
  );
}

function WorkOrderCard({ order, writable }: { order: BreezewayWorkOrder; writable: boolean }) {
  const [open, setOpen] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
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

  // Deliberate escalation: a mirrored Work Order is not a Ticket until someone
  // says so. The new Ticket is auto-routed to the Property Operations queue.
  const promote = useServerFn(escalateWorkOrderToTicketFn);
  const escalate = useMutation({
    mutationFn: () => promote({ data: { workOrderId: order.id, priority: "p3" } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message ?? "Could not create the Ticket.");
        return;
      }
      toast.success(res.ref ? `Ticket #${res.ref} created. ${res.note}` : res.note);
      void qc.invalidateQueries({ queryKey: ["bw-work-orders"] });
    },
    onError: () => toast.error("Could not create the Ticket."),
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
                {order.assignees
                  .map((a) => a.name)
                  .filter(Boolean)
                  .join(", ")}
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
        <Button variant="ghost" size="sm" onClick={() => setShowPhotos((v) => !v)}>
          <Camera className="mr-1 size-3" />
          {order.photoCount > 0 ? `Photos (${order.photoCount})` : "Photos"}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowEvidence((v) => !v)}>
          <ShieldCheck className="mr-1 size-3" /> Evidence
        </Button>
        {writable && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={lifecycle.isPending}
              onClick={() => lifecycle.mutate("close")}
            >
              Close in Breezeway
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={lifecycle.isPending}
              onClick={() => lifecycle.mutate("reopen")}
            >
              Reopen
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={lifecycle.isPending}
              onClick={() => lifecycle.mutate("approve")}
            >
              Approve
            </Button>
          </>
        )}
        {!order.linkedTicketId && (
          <Button
            variant="outline"
            size="sm"
            disabled={escalate.isPending}
            onClick={() => escalate.mutate()}
          >
            <TicketIcon className="mr-1 size-3" />
            {escalate.isPending ? "Creating Ticket…" : "Create Resolve Ticket"}
          </Button>
        )}
        {order.needsAttention && (
          <Button variant="ghost" size="sm" onClick={() => lifecycle.mutate("acknowledge")}>
            Mark read
          </Button>
        )}
      </div>

      {showPhotos && <PhotoStrip workOrderId={order.id} writable={writable} />}
      {showEvidence && order.propertyId && (
        <EvidenceQualityGate
          subjectType="work_order"
          subjectId={order.id}
          attachTo={{ entityType: "property", entityId: order.propertyId }}
          propertyId={order.propertyId}
          title="Evidence for this Work Order"
          description="Resolve's own proof that the work is done. Checked against the same standard everywhere."
        />
      )}
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
          <CardTitle className="text-base">Breezeway Work Orders</CardTitle>
          <CardDescription>
            Current Breezeway work at this home. Resolve stays the source of truth — closing here
            closes the Breezeway Work Order only.
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
              : "This home is not verified against Breezeway, so no Work Orders are mirrored."}
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
