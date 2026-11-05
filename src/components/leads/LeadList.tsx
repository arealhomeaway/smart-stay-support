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
  followUpBucket,
  formatDate,
  nextFollowUpAt,
} from "@/lib/leads";
import {
  LEAD_OUTCOME_LABELS,
  OFFER_OUTCOME_LABELS,
  guestsPetsLabel,
  lastOffer,
  leadFollowUpDate,
  leadOutcome,
  leadRegion,
  offerOutcome,
  stayDatesLabel,
  type LeadOffer,
} from "@/lib/lead-offers";
import type { LeadRow } from "@/lib/lead-types";

export type OfferEntry = LeadOffer & { propertyName: string | null };

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

/**
 * Every lead's offers, grouped by lead. The offer columns come from the
 * staged v2 SQL; until it is applied this query fails and the list simply
 * shows no offer column.
 */
export function useLeadOfferMap() {
  return useQuery({
    queryKey: ["lead-offer-map"],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_properties")
        .select(
          "id, lead_id, property_id, note, presented_at, added_by, created_at, quote_total, quote_currency, outcome, outcome_reason, outcome_at, outcome_by, properties(name, nickname, unit, address_line1, city, state, postal_code)",
        );
      if (error) throw error;
      const map = new Map<string, OfferEntry[]>();
      for (const row of (data ?? []) as unknown as (LeadOffer & { properties: { name: string; nickname: string | null; unit: string | null; address_line1: string | null; city: string | null; state: string | null; postal_code: string | null } | null })[]) {
        const { properties: property, ...offer } = row;
        const entry: OfferEntry = { ...offer, propertyName: property?.nickname ?? property?.name ?? null };
        map.set(offer.lead_id, [...(map.get(offer.lead_id) ?? []), entry]);
      }
      return map;
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
  offers,
  assigneeName,
  onOpen,
}: {
  lead: LeadRow;
  offers: OfferEntry[];
  assigneeName: string;
  onOpen: () => void;
}) {
  const outcome = leadOutcome(lead);
  const last = lastOffer(offers);
  const followUp = leadFollowUpDate(lead) ?? nextFollowUpAt(lead)?.toISOString() ?? null;
  const bucket = followUpBucket(lead);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="resolve-press w-full rounded-lg border bg-card px-4 py-3 text-left shadow-card transition-colors hover:bg-muted/50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{lead.contact_name ?? "Not recorded yet"}</span>
        {lead.company ? (
          <span className="text-sm text-muted-foreground">· {lead.company}</span>
        ) : null}
        <Chip className={stateChip(stageState(lead.stage))}>{LEAD_OUTCOME_LABELS[outcome]}</Chip>
        <Chip>{SOURCE_LABELS[lead.source]}</Chip>
        {outcome === "open" && bucket === "overdue" ? (
          <StatusBadge tone="escalated">Overdue</StatusBadge>
        ) : outcome === "open" && bucket === "today" ? (
          <StatusBadge tone="waiting">Due today</StatusBadge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-foreground/90">
        {leadRegion(lead)} · {stayDatesLabel(lead)} · {guestsPetsLabel(lead)}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {last
          ? `Last offered: ${last.propertyName ?? "a home"} (${OFFER_OUTCOME_LABELS[offerOutcome(last)]})`
          : "No home offered yet"}
        {" · Next follow-up "}
        {followUp ? formatDate(followUp) : "not set"}
        {` · ${assigneeName}`}
      </p>
    </button>
  );
}

/** List plus drawer wiring — the piece every leads view reuses. */
export function LeadListSection({
  leads,
  canEdit,
}: {
  leads: LeadRow[];
  canEdit: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const people = useStaffDirectory().data ?? [];
  const offerMap = useLeadOfferMap().data ?? new Map<string, OfferEntry[]>();
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
            offers={offerMap.get(lead.id) ?? []}
            assigneeName={displayName(people.find((p) => p.id === lead.assigned_to))}
            onOpen={() => setOpenId(lead.id)}
          />
        ))}
      </div>
      <LeadDrawer lead={open} people={people} canEdit={canEdit} onClose={() => setOpenId(null)} />
    </>
  );
}
