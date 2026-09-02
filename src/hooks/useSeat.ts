import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SEAT_LABELS, TEAM_A, TEAM_B, teamOf } from "@/lib/coverage-model";
import { useRole } from "@/hooks/useRole";

/**
 * The operational seat the signed-in person currently holds.
 *
 * Seats decide what work a person owns (Guest Experience & Reservations vs
 * Property Operations). Permission roles decide what they may do. The two are
 * deliberately separate — this hook only reads the seat register.
 */
export function useSeat() {
  const { userId } = useRole();

  const query = useQuery({
    queryKey: ["my-seat", userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("functional_roles")
        .select("code, name, team")
        .eq("current_seat_holder", userId!)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const code = query.data?.code ?? null;
  const team = query.data?.team ?? (code ? teamOf(code) : null);

  return {
    code,
    team,
    label: code ? (SEAT_LABELS[code] ?? query.data?.name ?? code) : null,
    isGuestExperience: team === TEAM_A,
    isPropertyOperations: team === TEAM_B,
    isLoading: query.isLoading,
  };
}
