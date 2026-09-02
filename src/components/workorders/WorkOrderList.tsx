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
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
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
  return useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
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

function bucketState(bucket: WorkOrderBucket) {
  if (bucket === "closed") return "done" as const;
  if (bucket === "needs_action") return "blocked" as const;
  if (bucket === "permanent_pending" || bucket === "evidence_missing") return "active" as const;
  return "waiting" as const;
}

export function WorkOrderRowCard({
  workOrder,
  requirements,
  propertyName,
  ownerName,
  canEdit,
  onOpen,
}: {
  workOrder: WorkOrderRow;
  requirements: RequirementLike[];
  propertyName: string;
  ownerName: string;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const bucket = workOrderBucket(workOrder);
  const checkpoint = nextCheckpoint(workOrder);

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
    <div className="rounded-lg border bg-card shadow-card transition-colors hover:bg-muted/50">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onOpen} className="resolve-press flex-1 px-4 py-3 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{propertyName}</span>
            <Chip className={stateChip(bucketState(bucket))}>{BUCKET_LABELS[bucket]}</Chip>
            <Chip>{workOrder.priority.toUpperCase()}</Chip>
            <Chip>{PHASE_LABELS[workOrder.phase]}</Chip>
            {workOrder.warranty_may_apply && !workOrder.warranty_override_reason ? (
              <Chip className="border-warning/40 bg-warning/10 text-warning">Warranty may apply</Chip>
            ) : null}
            {workOrder.occupied_now ? <Chip>Guest in home</Chip> : null}
            {workOrder.missed_commitments > 0 ? (
              <Chip className="border-danger/40 bg-danger/10 text-danger">
                {workOrder.missed_commitments} missed
              </Chip>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground/90">{nextAction(workOrder)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {workOrder.title} · {workOrder.vendor_name ?? "No vendor yet"} · quote{" "}
            {money(workOrder.quote_amount)} · final {money(workOrder.final_cost)} · {ownerName} ·{" "}
            {CHECKPOINT_LABELS[checkpoint]}
            {requirements.length
              ? ` · ${requirements.filter((r) => r.status === "verified" || r.status === "accepted_exception").length}/${requirements.length} evidence`
              : ""}
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1 py-3 pr-4 text-xs">
          {canAssignToMe ? (
            <Button size="sm" variant="outline" disabled={assignToMe.isPending} onClick={() => assignToMe.mutate()}>
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
  // Recording a checkpoint can move a work order out of the section it was
  // opened from; the workspace stays on the job being worked.
  const lastOpen = useRef<WorkOrderRow | null>(null);
  const fromList = workOrders.find((w) => w.id === openId) ?? null;
  if (fromList) lastOpen.current = fromList;
  const open = openId ? (fromList ?? lastOpen.current) : null;
  useEffect(() => {
    if (!openId) lastOpen.current = null;
  }, [openId]);

  const nameFor = (id: string | null) => (id ? displayName(people.find((p) => p.id === id)) : "Unassigned");

  return (
    <>
      <div className="space-y-2">
        {workOrders.map((workOrder) => (
          <WorkOrderRowCard
            key={workOrder.id}
            workOrder={workOrder}
            requirements={requirements.get(workOrder.id) ?? []}
            propertyName={propertyNames.get(workOrder.property_id ?? "") ?? "Property unlinked"}
            ownerName={nameFor(workOrder.assigned_to)}
            canEdit={canEdit}
            onOpen={() => setOpenId(workOrder.id)}
          />
        ))}
      </div>
      <WorkOrderDrawer
        workOrder={open}
        people={people}
        canEdit={canEdit}
        propertyName={open ? (propertyNames.get(open.property_id ?? "") ?? "Property unlinked") : ""}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
