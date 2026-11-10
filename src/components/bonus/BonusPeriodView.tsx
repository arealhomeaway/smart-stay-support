/** Loads one person's bonus for one period and shows it (Build 13; register BN5). */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BonusScorecard } from "@/components/bonus/BonusScorecard";
import { BONUS_COPY, type BonusCard } from "@/lib/bonus";

export const bonusCardKey = (plan: string, user: string, start: string) => ["bonus-card", plan, user, start] as const;

export function BonusPeriodView({ plan, user, start }: { plan: string; user: string; start: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: bonusCardKey(plan, user, start),
    queryFn: async (): Promise<BonusCard> => {
      const { data, error } = await supabase.rpc("bonus_scorecard", { _plan: plan, _user: user, _start: start });
      if (error) throw error;
      return data as unknown as BonusCard;
    },
  });
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (q.error || !q.data) return <p role="alert" className="text-sm">{BONUS_COPY.loadError}</p>;
  return (
    <BonusScorecard
      card={q.data}
      onChanged={() => {
        void qc.invalidateQueries({ queryKey: ["bonus-card"] });
        void qc.invalidateQueries({ queryKey: ["bonus-people"] });
        void qc.invalidateQueries({ queryKey: ["bonus-my-plans"] });
        void qc.invalidateQueries({ queryKey: ["bonus-my-reviews"] });
      }}
    />
  );
}
