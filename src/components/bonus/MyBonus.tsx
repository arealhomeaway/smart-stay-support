/**
 * My bonus, on My scorecard (Build 13; register BN5): the person's own plan, bars and dollars
 * for the current period and every closed one. A coordinator sees nothing until their start
 * date; the database decides that (public.bonus_my_plans).
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/ui/page";
import { BonusPeriodView } from "@/components/bonus/BonusPeriodView";
import { BONUS_COPY, VERIFY_COPY, type BonusPlanRef } from "@/lib/bonus";

/** For a reviewer, the COO, the CEO and Admin: the way to Bonus verify. */
export function BonusVerifyLink() {
  const q = useQuery({
    queryKey: ["bonus-people"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bonus_people");
      if (error) return [];
      return (data ?? []) as unknown[];
    },
  });
  if (!q.data || q.data.length === 0) return null;
  return (
    <Button asChild variant="outline" className="min-h-11" data-bonus-verify-link>
      <Link to="/bonus-verify">{VERIFY_COPY.title}</Link>
    </Button>
  );
}

export function useMyBonusPlans(enabled = true) {
  return useQuery({
    queryKey: ["bonus-my-plans"],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BonusPlanRef[]> => {
      const { data, error } = await supabase.rpc("bonus_my_plans");
      if (error) throw error;
      return (data ?? []) as unknown as BonusPlanRef[];
    },
  });
}

export function MyBonus({ userId }: { userId: string }) {
  const plans = useMyBonusPlans();
  if (plans.isPending || plans.error || !plans.data || plans.data.length === 0) return null;
  return (
    <SectionCard title={BONUS_COPY.title} description={BONUS_COPY.hint}>
      <div className="space-y-6" data-my-bonus>
        {plans.data.map((p) => (
          <PlanBlock key={p.plan} plan={p} userId={userId} />
        ))}
      </div>
    </SectionCard>
  );
}

function PlanBlock({ plan, userId }: { plan: BonusPlanRef; userId: string }) {
  const options = [
    ...(plan.current_start && !plan.periods.some((x) => x.period_start === plan.current_start)
      ? [{ period_start: plan.current_start, label: "This period" }]
      : []),
    ...plan.periods.map((x) => ({ period_start: x.period_start, label: x.label })),
  ];
  const [start, setStart] = useState(options[0]?.period_start ?? null);
  if (!start) return null;
  return (
    <div className="space-y-3">
      {options.length > 1 && (
        <label className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          {BONUS_COPY.period}
          <select
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="h-11 rounded-lg border border-input bg-background px-3 text-[15px] text-foreground"
          >
            {options.map((o) => (
              <option key={o.period_start} value={o.period_start}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <BonusPeriodView plan={plan.plan} user={userId} start={start} />
    </div>
  );
}
