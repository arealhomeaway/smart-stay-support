/**
 * Shared claim reads and row presentation.
 *
 * Every claims view asks a different question but reads the same rows and
 * shows the same derived facts, so the queries, the row and the workspace
 * wiring live here once.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Chip } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
import { displayName, useStaffDirectory } from "@/hooks/useTeam";
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
      const { data, error } = await supabase.from("properties").select("id, name, nickname, city");
      if (error) throw error;
      const map = new Map<string, string>();
      for (const p of data ?? []) map.set(p.id, p.nickname || p.name || p.city || "Property");
      return map;
    },
  });
}

export function ClaimRowCard({
  claim,
  requirements,
  propertyName,
  assigneeName,
  onOpen,
}: {
  claim: ClaimRow;
  requirements: RequirementLike[];
  propertyName: string;
  assigneeName: string;
  onOpen: () => void;
}) {
  const progress = evidenceProgress(requirements);
  const deadline = deadlineState(claim.deadline_on);
  const risk = amountAtRisk(claim);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="resolve-press w-full rounded-lg border bg-card px-4 py-3 text-left shadow-card transition-colors hover:bg-muted/50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{propertyName}</span>
        <Chip className={stateChip(stageState(claim.stage))}>{CLAIM_STAGE_LABELS[claim.stage]}</Chip>
        <Chip>{CLAIM_TYPE_LABELS[claim.claim_type]}</Chip>
        {deadline === "overdue" ? (
          <Chip className="border-danger/40 bg-danger/10 text-danger">Deadline passed</Chip>
        ) : deadline === "today" || deadline === "approaching" ? (
          <Chip className="border-warning/40 bg-warning/10 text-warning">{deadlineLabel(claim.deadline_on)}</Chip>
        ) : null}
        {progress.blocking.length > 0 ? (
          <Chip className="border-border/60">{progress.blocking.length} evidence missing</Chip>
        ) : null}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground/90">{nextAction(claim, { requirements })}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {claim.title} · {claim.guest_name ?? "Guest unrecorded"} · at risk {formatMoney(risk)} ·{" "}
        {assigneeName} · {deadlineLabel(claim.deadline_on)}
      </p>
    </button>
  );
}

/** List plus workspace wiring — the piece every claims view reuses. */
export function ClaimListSection({
  claims,
  requirements,
  propertyNames,
  canEdit,
}: {
  claims: ClaimRow[];
  requirements: Map<string, RequirementLike[]>;
  propertyNames: Map<string, string>;
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
            assigneeName={
              claim.assigned_to
                ? displayName(people.find((p) => p.id === claim.assigned_to))
                : "Unassigned"
            }
            onOpen={() => setOpenId(claim.id)}
          />
        ))}
      </div>
      <ClaimDrawer
        claim={open}
        people={people}
        canEdit={canEdit}
        propertyName={open ? (propertyNames.get(open.property_id ?? "") ?? "Property unlinked") : ""}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
