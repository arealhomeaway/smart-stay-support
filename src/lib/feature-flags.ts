import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Feature flags — safe controls for workflows that are unfinished or
 * deliberately paused for the Stage 1 launch (email intake, quarterly
 * scheduling, owner alerts, Breezeway bridge, Notion sync).
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

  "notion_sync",
  "operations_queue_v2",
  "onboarding_portal_v2",
  "onboarding_sharepoint_docs",
  "onboarding_external_sync",
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
