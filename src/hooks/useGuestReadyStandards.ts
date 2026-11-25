import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_STANDARDS, parseStandardRow, type GuestReadyStandard } from "@/lib/guest-ready-standards";

type Db = { from: (t: string) => any };

/**
 * The saved Guest-ready standards rows. Before the staged database change is applied the table is missing:
 * the starting rows show read only (`saved: false`) and nothing on a ticket is locked.
 */
export function useGuestReadyStandards() {
  return useQuery({
    queryKey: ["guest-ready-standards"],
    staleTime: 60_000,
    queryFn: async (): Promise<{ rows: GuestReadyStandard[]; saved: boolean }> => {
      const { data, error } = await (supabase as unknown as Db)
        .from("guest_ready_standards")
        .select("id, label, must_be_done, locked, rule, rule_days, work_type_id, match_priority, lock_note, sort_order, work_types(name)")
        .order("sort_order");
      if (error) return { rows: DEFAULT_STANDARDS, saved: false };
      return { rows: (data as Record<string, unknown>[]).map(parseStandardRow), saved: true };
    },
  });
}
