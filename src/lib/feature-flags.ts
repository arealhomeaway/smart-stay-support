import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flags — safe controls for workflows that are unfinished or
 * deliberately paused for the Stage 1 launch (email intake, quarterly
 * scheduling, owner alerts, Breezeway bridge).
 *
 * A flag being OFF means the UI must not offer the action. It is a guard
 * rail, not a security boundary: the underlying jobs stay paused server-side.
 */
export type FeatureFlag = {
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  updated_at: string;
};

export const FLAG_KEYS = [
  "email_intake",
  "quarterly_scheduler",
  "owner_alerts",
  "breezeway_bridge",
  "breezeway_outbound",

  "operations_queue_v2",
  "onboarding_portal_v2",
  "onboarding_sharepoint_docs",
  "onboarding_external_sync",
  // Launch-state gates for workstreams that ship after the Operations beta.
  "vendor_portal",
  "quarterly_reviews",
  // Guided ticket checklists, one per category (src/lib/ticket-checklists.ts).
  "checklist_lockout",
  "checklist_cleaning",
  "checklist_maintenance",
  "checklist_other_complaint",
  "checklist_damage",
  "checklist_booking",
  // Survey reviews in Record routine work (src/lib/record-routine.ts). Off until surveys go live.
  "survey_review_check",
  // Menu cleanup (lib/shell-nav.ts). Off: the pages stay reachable by direct link.
  "work_orders_page",
  "work_map",
  // Guest Claims & Refunds in the menu. Off: Databases holds claims and refunds.
  "claims_menu",
  // The old Admin imported tickets lists (Imported tickets tab and the Integrations list). Off: Databases, Tickets holds them.
  "imported_tickets_page",
  // Resolve work orders and Breezeway sends from Resolve (register C4). Off: work orders are
  // made in Breezeway and linked on the ticket.
  "internal_work_orders",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

export function useFeatureFlags() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["feature-flags"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags")
        .select("key, label, description, enabled, updated_at")
        .order("label");
      if (error) throw error;
      return (data ?? []) as FeatureFlag[];
    },
  });

  const map = new Map((query.data ?? []).map((f) => [f.key, f]));

  return {
    flags: query.data ?? [],
    isLoading: query.isLoading,
    /** Unknown flags default to OFF — never assume an unfinished workflow is live. */
    enabled: (key: FlagKey | string) => map.get(key)?.enabled ?? false,
    async setEnabled(key: string, enabled: boolean) {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("feature_flags")
        .update({ enabled, updated_by: auth.user?.id ?? null })
        .eq("key", key);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["feature-flags"] });
    },
  };
}
