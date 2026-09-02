/**
 * Shared Guest Recovery reads and row presentation.
 *
 * Every recovery view asks a different question but reads the same rows and
 * shows the same derived facts, so the queries, the row and the workspace
 * wiring live here once.
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
import { RecoveryDrawer } from "@/components/recovery/RecoveryDrawer";
import type { RequirementLike } from "@/lib/claims";
import {
  OUTSIDE_POLICY_BADGE,
  RECOVERY_ACTION_LABELS,
  RECOVERY_STAGE_LABELS,
  communicationOverdue,
  daysUntil,
  effectiveOwner,
  formatMoney,
  handoffPending,
  nextAction,
  stageState,
} from "@/lib/guest-recovery";
import type { RecoveryRow } from "@/lib/recovery-types";

export function useRecoveries() {
  return useQuery({
    queryKey: ["guest-recovery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_recovery")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as RecoveryRow[];
    },
  });
}

/** Evidence checklists for every recovery, keyed by recovery id. */
export function useRecoveryRequirements() {
  return useQuery({
    queryKey: ["recovery-requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_requirements")
        .select("subject_id, slot_key, label, required, status")
        .eq("subject_type", "guest_recovery");
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

export function useRecoveryPropertyNames() {
  return useQuery({
    queryKey: ["recovery-property-names"],
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

export function RecoveryRowCard({
  recovery,
  requirements,
  propertyName,
  ownerName,
  canEdit,
  onOpen,
}: {
  recovery: RecoveryRow;
  requirements: RequirementLike[];
  propertyName: string;
  ownerName: string;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const checkout = daysUntil(recovery.stay_departure);
  const overdue = communicationOverdue(recovery);

  const assignToMe = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No signed-in user");
      const { error } = await supabase
        .from("guest_recovery")
        .update({ assigned_to: userId })
        .eq("id", recovery.id);
      if (error) throw error;
      await supabase.from("guest_recovery_activity").insert({
        recovery_id: recovery.id,
        author_id: userId,
        event_type: "assignment",
        body: "Assigned to self from the recovery queue",
        detail: { assigned_to: userId } as never,
        is_demo: recovery.is_demo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guest-recovery"] });
      toast.success("Recovery assigned to you");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAssignToMe = canEdit && !recovery.assigned_to && !!userId;

  return (
    <div className="rounded-lg border bg-card shadow-card transition-colors hover:bg-muted/50">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onOpen} className="resolve-press flex-1 px-4 py-3 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{propertyName}</span>
            <Chip className={stateChip(stageState(recovery.stage))}>
              {RECOVERY_STAGE_LABELS[recovery.stage]}
            </Chip>
            <Chip>{recovery.priority.toUpperCase()}</Chip>
            {recovery.recovery_action ? (
              <Chip>{RECOVERY_ACTION_LABELS[recovery.recovery_action]}</Chip>
            ) : null}
            {recovery.within_airbnb_policy === false ? (
              <Chip className="border-danger/40 bg-danger/10 text-danger">{OUTSIDE_POLICY_BADGE}</Chip>
            ) : null}
            {overdue ? (
              <Chip className="border-warning/40 bg-warning/10 text-warning">Guest update due</Chip>
            ) : null}
            {handoffPending(recovery) ? <Chip>Handoff not accepted</Chip> : null}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground/90">
            {nextAction(recovery, { requirements })}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {recovery.title} · {recovery.guest_name ?? "Guest unrecorded"} · proposed{" "}
            {formatMoney(recovery.proposed_amount)} · issued {formatMoney(recovery.delivered_amount)} ·{" "}
            {ownerName}
            {checkout !== null ? ` · checkout in ${checkout} day${checkout === 1 ? "" : "s"}` : ""}
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1 py-3 pr-4 text-xs">
          {canAssignToMe ? (
            <Button size="sm" variant="outline" disabled={assignToMe.isPending} onClick={() => assignToMe.mutate()}>
              {assignToMe.isPending ? "Assigning…" : "Assign to me"}
            </Button>
          ) : null}
          <Link
            to="/tickets/$ticketId"
            params={{ ticketId: recovery.ticket_id }}
            className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Originating ticket
          </Link>
        </div>
      </div>
    </div>
  );
}

/** List plus workspace wiring — the piece every recovery view reuses. */
export function RecoveryListSection({
  recoveries,
  requirements,
  propertyNames,
  canEdit,
  initialOpenId,
}: {
  recoveries: RecoveryRow[];
  requirements: Map<string, RequirementLike[]>;
  propertyNames: Map<string, string>;
  canEdit: boolean;
  /** Deep link from an approval notification — opens the exact recovery once. */
  initialOpenId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const deepLinked = useRef<string | null>(null);
  useEffect(() => {
    if (!initialOpenId || deepLinked.current === initialOpenId) return;
    if (!recoveries.some((r) => r.id === initialOpenId)) return;
    deepLinked.current = initialOpenId;
    setOpenId(initialOpenId);
  }, [initialOpenId, recoveries]);
  const people = useStaffDirectory().data ?? [];
  // Advancing a stage can move a recovery out of the section it was opened
  // from; the workspace stays on the case being worked.
  const lastOpen = useRef<RecoveryRow | null>(null);
  const fromList = recoveries.find((r) => r.id === openId) ?? null;
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
        {recoveries.map((recovery) => (
          <RecoveryRowCard
            key={recovery.id}
            recovery={recovery}
            requirements={requirements.get(recovery.id) ?? []}
            propertyName={propertyNames.get(recovery.property_id ?? "") ?? "Property unlinked"}
            ownerName={nameFor(effectiveOwner(recovery))}
            canEdit={canEdit}
            onOpen={() => setOpenId(recovery.id)}
          />
        ))}
      </div>
      <RecoveryDrawer
        recovery={open}
        people={people}
        canEdit={canEdit}
        propertyName={open ? (propertyNames.get(open.property_id ?? "") ?? "Property unlinked") : ""}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
