/**
 * Shared Work Order reads and row presentation.
 *
 * Every maintenance view asks a different question of the same rows, so the
 * queries, the row and the workspace wiring live here once. Nothing on the row
 * is a hand-kept status: the bucket, the checkpoint and the next action are
 * derived from what has been recorded.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { usDate } from "@/lib/dates";
import { displayName, useCurrentUserId, useStaffDirectory } from "@/hooks/useTeam";
import { WorkOrderDrawer } from "@/components/workorders/WorkOrderDrawer";
import type { RequirementLike } from "@/lib/claims";
import {
  BUCKET_LABELS,
  CHECKPOINT_LABELS,
  PHASE_LABELS,
  money,
  nextAction,
  nextCheckpoint,
  workOrderBucket,
  type WorkOrderBucket,
} from "@/lib/work-orders";
import type { WorkOrderRow } from "@/lib/work-order-types";

export function useWorkOrders() {
  // Demo work orders belong to the demo lens only: live queues, counts and
  // supervisor views never mix the two.
  const { demoMode } = useDemo();
  return useQuery({
    queryKey: ["work-orders", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
        .eq("is_demo", demoMode)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as WorkOrderRow[];
    },
  });
}

/** Evidence checklists for every Work Order, keyed by Work Order id. */
export function useWorkOrderRequirements() {
  return useQuery({
    queryKey: ["work-order-requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_requirements")
        .select("subject_id, slot_key, label, required, status")
        .eq("subject_type", "work_order");
      if (error) throw error;
      const map = new Map<string, RequirementLike[]>();
      for (const row of data ?? []) {
        const list = map.get(row.subject_id) ?? [];
        list.push(row as RequirementLike);
        map.set(row.subject_id, list);
      }
      return map;
    },
  });
}

export function useWorkOrderPropertyNames() {
  return useQuery({
    queryKey: ["work-order-property-names"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id, name, nickname, city");
      if (error) throw error;
      const map = new Map<string, string>();
      for (const p of data ?? []) map.set(p.id, p.nickname || p.name || p.city || "Property");
      return map;
    },
  });
}

/** Property photo, for leading a row or the workspace header with a real home. */
export function useWorkOrderPropertyPhotos() {
  return useQuery({
    queryKey: ["work-order-property-photos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id, primary_photo_url");
      if (error) throw error;
      const map = new Map<string, string | null>();
      for (const p of data ?? [])
        map.set(p.id, (p as { primary_photo_url: string | null }).primary_photo_url);
      return map;
    },
  });
}

function bucketTone(bucket: WorkOrderBucket): StatusTone {
  if (bucket === "closed") return "resolved";
  if (bucket === "needs_action") return "escalated";
  if (bucket === "permanent_pending" || bucket === "evidence_missing") return "progress";
  return "waiting";
}

export function WorkOrderRowCard({
  workOrder,
  requirements,
  propertyName,
  propertyPhotoUrl,
  ownerName,
  canEdit,
  onOpen,
}: {
  workOrder: WorkOrderRow;
  requirements: RequirementLike[];
  propertyName: string;
  propertyPhotoUrl?: string | null;
  ownerName: string;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const bucket = workOrderBucket(workOrder);
  const checkpoint = nextCheckpoint(workOrder);
  const timing = workOrder.closed_at
    ? `Closed ${usDate(workOrder.closed_at)}`
    : workOrder.vendor_eta_at || workOrder.scheduled_for
      ? `Scheduled ${usDate(workOrder.vendor_eta_at ?? workOrder.scheduled_for)}`
      : `Opened ${usDate(workOrder.created_at)}`;

  const assignToMe = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No signed-in user");
      const { error } = await supabase
        .from("work_orders")
        .update({ assigned_to: userId })
        .eq("id", workOrder.id);
      if (error) throw error;
      await supabase.from("work_order_events").insert({
        work_order_id: workOrder.id,
        author_id: userId,
        event_type: "assignment",
        body: "Assigned to self from the work order queue",
        is_demo: workOrder.is_demo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success("Work order assigned to you");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAssignToMe = canEdit && !workOrder.assigned_to && !!userId;

  return (
    <div className="flex items-start gap-3 rounded-lg transition-colors hover:bg-muted/40">
      <button
        type="button"
        onClick={onOpen}
        className="resolve-press flex flex-1 items-start gap-3 px-2 py-3 text-left"
      >
        <PropertyPhoto
          url={propertyPhotoUrl ?? null}
          name={propertyName}
          className="mt-0.5 size-11"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{propertyName}</span>
            <StatusBadge tone={bucketTone(bucket)}>{BUCKET_LABELS[bucket]}</StatusBadge>
            {workOrder.warranty_may_apply && !workOrder.warranty_override_reason ? (
              <StatusBadge tone="waiting">Warranty may apply</StatusBadge>
            ) : null}
            {workOrder.occupied_now ? <Chip>Guest in home</Chip> : null}
            {workOrder.missed_commitments > 0 ? (
              <StatusBadge tone="escalated">{workOrder.missed_commitments} missed</StatusBadge>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground/90">{nextAction(workOrder)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {workOrder.title} · {workOrder.vendor_name ?? "No vendor yet"} · {ownerName} · {timing}
            {requirements.length
              ? ` · ${requirements.filter((r) => r.status === "verified" || r.status === "accepted_exception").length}/${requirements.length} evidence`
              : ""}
          </p>
        </div>
      </button>
      <div className="flex shrink-0 flex-col items-end gap-1 py-3 pr-2 text-xs">
        {canAssignToMe ? (
          <Button
            size="sm"
            variant="outline"
            disabled={assignToMe.isPending}
            onClick={() => assignToMe.mutate()}
          >
            {assignToMe.isPending ? "Assigning…" : "Assign to me"}
          </Button>
        ) : null}
        {workOrder.ticket_id ? (
          <Link
            to="/tickets/$ticketId"
            params={{ ticketId: workOrder.ticket_id }}
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Originating ticket
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** List plus workspace wiring — the piece every Work Order view reuses. */
export function WorkOrderListSection({
  workOrders,
  requirements,
  propertyNames,
  canEdit,
}: {
  workOrders: WorkOrderRow[];
  requirements: Map<string, RequirementLike[]>;
  propertyNames: Map<string, string>;
  canEdit: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const people = useStaffDirectory().data ?? [];
  const propertyPhotos = useWorkOrderPropertyPhotos().data ?? new Map<string, string | null>();
  // Recording a checkpoint can move a work order out of the section it was
  // opened from; the workspace stays on the job being worked.
  const lastOpen = useRef<WorkOrderRow | null>(null);
  const fromList = workOrders.find((w) => w.id === openId) ?? null;
  if (fromList) lastOpen.current = fromList;
  const open = openId ? (fromList ?? lastOpen.current) : null;
  useEffect(() => {
    if (!openId) lastOpen.current = null;
  }, [openId]);

  const nameFor = (id: string | null) =>
    id ? displayName(people.find((p) => p.id === id)) : "Unassigned";

  return (
    <>
      <div className="space-y-2">
        {workOrders.map((workOrder) => (
          <WorkOrderRowCard
            key={workOrder.id}
            workOrder={workOrder}
            requirements={requirements.get(workOrder.id) ?? []}
            propertyName={propertyNames.get(workOrder.property_id ?? "") ?? "Property unlinked"}
            propertyPhotoUrl={propertyPhotos.get(workOrder.property_id ?? "") ?? null}
            ownerName={nameFor(workOrder.assigned_to)}
            canEdit={canEdit}
            onOpen={() => setOpenId(workOrder.id)}
          />
        ))}
      </div>
      <WorkOrderDrawer
        key={open?.id ?? "none"}
        workOrder={open}
        people={people}
        canEdit={canEdit}
        propertyName={
          open ? (propertyNames.get(open.property_id ?? "") ?? "Property unlinked") : ""
        }
        propertyPhotoUrl={open ? (propertyPhotos.get(open.property_id ?? "") ?? null) : null}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
