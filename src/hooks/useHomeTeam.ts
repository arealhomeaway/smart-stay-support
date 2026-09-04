import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TEAM_A, TEAM_B, teamOf } from "@/lib/coverage-model";

export const HOME_TEAM_LABEL: Record<string, string> = {
  [TEAM_A]: "A · Guest Experience",
  [TEAM_B]: "B · Property Operations",
  leadership: "Leadership",
};

export const HOME_TEAM_SHORT: Record<string, string> = {
  [TEAM_A]: "Team A",
  [TEAM_B]: "Team B",
  leadership: "Leadership",
};

/**
 * Which home team each coordinator normally works.
 *
 * This is read from the seat register, and it is context only — Resolve never
 * uses it to decide what a person may open. Coverage moves through the day and
 * A team routinely picks up B team work.
 */
export function useHomeTeams() {
  const query = useQuery({
    queryKey: ["home-teams"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("functional_roles")
        .select("code, team, current_seat_holder")
        .eq("active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const byUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of query.data ?? []) {
      if (!row.current_seat_holder) continue;
      const team = row.team ?? teamOf(row.code) ?? null;
      if (team) map.set(row.current_seat_holder, team);
    }
    return map;
  }, [query.data]);

  return {
    byUser,
    homeTeamOf: (userId: string | null) => (userId ? (byUser.get(userId) ?? null) : null),
    isLoading: query.isLoading,
  };
}
