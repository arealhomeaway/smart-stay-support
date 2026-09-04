/**
 * Shared lead reads and row presentation.
 *
 * Every leads view answers a different question, but they all read the same
 * rows and show the same derived facts — so the query, the row and the drawer
 * wiring live here once.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Chip } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { stateChip } from "@/lib/semantic";
import { displayName, useStaffDirectory } from "@/hooks/useTeam";
import { LeadDrawer, stageState } from "@/components/leads/LeadDrawer";
import {
  SOURCE_LABELS,
  STAGE_LABELS,
  attentionFlags,
  followUpBucket,
  formatDate,
  formatMoney,
  nextAction,
  relativeDays,
} from "@/lib/leads";
import type { LeadRow } from "@/lib/lead-types";

export function useLeads() {
  return useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LeadRow[];
    },
  });
}

/** Which leads already have at least one candidate home linked. */
export function useLeadsWithProperties() {
  return useQuery({
    queryKey: ["leads-with-properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_properties").select("lead_id");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.lead_id));
    },
  });
}

export function LeadRowCard({
  lead,
  hasProperty,
  assigneeName,
  onOpen,
}: {
  lead: LeadRow;
  hasProperty: boolean;
  assigneeName: string;
  onOpen: () => void;
}) {
  const bucket = followUpBucket(lead);
  const flags = attentionFlags(lead, { hasProperty });
  return (
    <button
      type="button"
      onClick={onOpen}
      className="resolve-press w-full rounded-lg border bg-card px-4 py-3 text-left shadow-card transition-colors hover:bg-muted/50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{lead.contact_name}</span>
        {lead.company ? <span className="text-sm text-muted-foreground">· {lead.company}</span> : null}
        <Chip className={stateChip(stageState(lead.stage))}>{STAGE_LABELS[lead.stage]}</Chip>
        <Chip>{SOURCE_LABELS[lead.source]}</Chip>
        {bucket === "overdue" ? (
          <StatusBadge tone="escalated">Overdue</StatusBadge>
        ) : bucket === "today" ? (
          <StatusBadge tone="waiting">Due today</StatusBadge>
        ) : null}
        {flags
          .filter((f) => f.key !== "overdue")
          .slice(0, 2)
          .map((f) => (
            <Chip key={f.key} className="border-border/60">
              {f.label}
            </Chip>
          ))}
      </div>
      <p className="mt-1 text-sm font-medium text-foreground/90">{nextAction(lead, { hasProperty })}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {lead.market ?? "Market unspecified"} · move-in {formatDate(lead.desired_move_in)} ·{" "}
        {formatMoney(lead.budget_monthly)}/mo · {assigneeName} · last contact {relativeDays(lead.last_contact_at)}
      </p>
    </button>
  );
}

/** List plus drawer wiring — the piece every leads view reuses. */
export function LeadListSection({
  leads,
  withProperties,
  canEdit,
}: {
  leads: LeadRow[];
  withProperties: Set<string>;
  canEdit: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const people = useStaffDirectory().data ?? [];
  // Logging contact can move a lead out of the list this view filters to. The
  // workspace should stay open on the row the coordinator is working, so the
  // last known version of it is kept until they close the drawer themselves.
  const lastOpen = useRef<LeadRow | null>(null);
  const fromList = leads.find((l) => l.id === openId) ?? null;
  if (fromList) lastOpen.current = fromList;
  const open = openId ? (fromList ?? lastOpen.current) : null;
  useEffect(() => {
    if (!openId) lastOpen.current = null;
  }, [openId]);

  return (
    <>
      <div className="space-y-2">
        {leads.map((lead) => (
          <LeadRowCard
            key={lead.id}
            lead={lead}
            hasProperty={withProperties.has(lead.id)}
            assigneeName={displayName(people.find((p) => p.id === lead.assigned_to))}
            onOpen={() => setOpenId(lead.id)}
          />
        ))}
      </div>
      <LeadDrawer lead={open} people={people} canEdit={canEdit} onClose={() => setOpenId(null)} />
    </>
  );
}
