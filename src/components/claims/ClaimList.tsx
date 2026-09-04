/**
 * Shared claim reads and row presentation.
 *
 * Every claims view asks a different question but reads the same rows and
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
import { StatusBadge } from "@/components/ui/status";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { stateChip } from "@/lib/semantic";
import { displayName, useCurrentUserId, useStaffDirectory } from "@/hooks/useTeam";
import { ClaimDrawer } from "@/components/claims/ClaimDrawer";
import {
  CLAIM_STAGE_LABELS,
  CLAIM_TYPE_LABELS,
  amountAtRisk,
  deadlineLabel,
  deadlineState,
  evidenceProgress,
  formatMoney,
  nextAction,
  stageState,
  type RequirementLike,
} from "@/lib/claims";
import type { ClaimRow } from "@/lib/claim-types";

export function useClaims() {
  return useQuery({
    queryKey: ["claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ClaimRow[];
    },
  });
}

/** Evidence checklists for every claim, keyed by claim id. */
export function useClaimRequirements() {
  return useQuery({
    queryKey: ["claim-requirements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("evidence_requirements")
        .select("subject_id, slot_key, label, required, status")
        .eq("subject_type", "claim");
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

/** Property names for the rows on screen. */
export function usePropertyNames() {
  return useQuery({
    queryKey: ["claim-property-names"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname, city, primary_photo_url");
      if (error) throw error;
      const map = new Map<string, string>();
      for (const p of data ?? []) map.set(p.id, p.nickname || p.name || p.city || "Property");
      return map;
    },
  });
}

/** Property photos for the rows on screen, keyed by property id. */
export function usePropertyPhotos() {
  return useQuery({
    queryKey: ["claim-property-photos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id, primary_photo_url");
      if (error) throw error;
      const map = new Map<string, string | null>();
      for (const p of data ?? []) map.set(p.id, p.primary_photo_url ?? null);
      return map;
    },
  });
}

export function ClaimRowCard({
  claim,
  requirements,
  propertyName,
  propertyPhoto,
  assigneeName,
  canEdit,
  onOpen,
}: {
  claim: ClaimRow;
  requirements: RequirementLike[];
  propertyName: string;
  propertyPhoto?: string | null | undefined;
  assigneeName: string;
  canEdit: boolean;
  onOpen: () => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const progress = evidenceProgress(requirements);
  const deadline = deadlineState(claim.deadline_on);
  const risk = amountAtRisk(claim);

  // Same write the workspace performs: assignment plus its audit entry.
  const assignToMe = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("No signed-in user");
      const { error } = await supabase
        .from("claims")
        .update({ assigned_to: userId })
        .eq("id", claim.id);
      if (error) throw error;
      await supabase.from("claim_activity").insert({
        claim_id: claim.id,
        author_id: userId,
        event_type: "assignment",
        body: "Assigned to self from the claims queue",
        detail: { assigned_to: userId } as never,
        is_demo: claim.is_demo,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["claim-activity", claim.id] });
      toast.success("Claim assigned to you");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canAssignToMe = canEdit && !claim.assigned_to && !!userId;

  return (
    <div className="rounded-lg border bg-card shadow-card transition-colors hover:bg-muted/50">
      <div className="flex items-start gap-3">
        <PropertyPhoto url={propertyPhoto} name={propertyName} className="mt-3 ml-4" />
        <button type="button" onClick={onOpen} className="resolve-press flex-1 px-0 py-3 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{propertyName}</span>
            <Chip className={stateChip(stageState(claim.stage))}>
              {CLAIM_STAGE_LABELS[claim.stage]}
            </Chip>
            <Chip>{CLAIM_TYPE_LABELS[claim.claim_type]}</Chip>
            {deadline === "overdue" ? (
              <StatusBadge tone="escalated">Deadline passed</StatusBadge>
            ) : deadline === "today" || deadline === "approaching" ? (
              <StatusBadge tone="waiting">{deadlineLabel(claim.deadline_on)}</StatusBadge>
            ) : null}
            {progress.blocking.length > 0 ? (
              <Chip className="border-border/60">{progress.blocking.length} evidence missing</Chip>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground/90">
            {nextAction(claim, { requirements })}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {claim.title} · {claim.guest_name ?? "Guest unrecorded"} · at risk {formatMoney(risk)} ·{" "}
            {assigneeName} · {deadlineLabel(claim.deadline_on)}
          </p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1 py-3 pr-4 text-xs">
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
          {claim.ticket_id ? (
            <Link
              to="/tickets/$ticketId"
              params={{ ticketId: claim.ticket_id }}
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

/** List plus workspace wiring — the piece every claims view reuses. */
export function ClaimListSection({
  claims,
  requirements,
  propertyNames,
  propertyPhotos,
  canEdit,
}: {
  claims: ClaimRow[];
  requirements: Map<string, RequirementLike[]>;
  propertyNames: Map<string, string>;
  propertyPhotos?: Map<string, string | null>;
  canEdit: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const people = useStaffDirectory().data ?? [];
  // Advancing a stage can move a claim out of the section it was opened from.
  // The workspace stays on the claim being worked until it is closed by hand.
  const lastOpen = useRef<ClaimRow | null>(null);
  const fromList = claims.find((c) => c.id === openId) ?? null;
  if (fromList) lastOpen.current = fromList;
  const open = openId ? (fromList ?? lastOpen.current) : null;
  useEffect(() => {
    if (!openId) lastOpen.current = null;
  }, [openId]);

  return (
    <>
      <div className="space-y-2">
        {claims.map((claim) => (
          <ClaimRowCard
            key={claim.id}
            claim={claim}
            requirements={requirements.get(claim.id) ?? []}
            propertyName={propertyNames.get(claim.property_id ?? "") ?? "Property unlinked"}
            propertyPhoto={propertyPhotos?.get(claim.property_id ?? "")}
            assigneeName={
              claim.assigned_to
                ? displayName(people.find((p) => p.id === claim.assigned_to))
                : "Unassigned"
            }
            canEdit={canEdit}
            onOpen={() => setOpenId(claim.id)}
          />
        ))}
      </div>
      <ClaimDrawer
        claim={open}
        people={people}
        canEdit={canEdit}
        propertyName={
          open ? (propertyNames.get(open.property_id ?? "") ?? "Property unlinked") : ""
        }
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
