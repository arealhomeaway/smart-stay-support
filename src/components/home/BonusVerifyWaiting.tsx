/**
 * Needs you now, Build 13 (register BN6): a closed bonus period waiting for this person to
 * verify it ("[Period] is ready to verify for [role]"). The database lists only periods this
 * person reviews (public.bonus_my_reviews).
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { verifyItemTitle } from "@/lib/bonus";

type Review = { plan: string; plan_name: string; user_id: string; period_start: string; label: string; ready_at: string };

export function BonusVerifyWaiting() {
  const q = useQuery({
    queryKey: ["bonus-my-reviews"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Review[]> => {
      const { data, error } = await supabase.rpc("bonus_my_reviews");
      if (error) return [];
      return (data ?? []) as unknown as Review[];
    },
  });
  return (
    <>
      {(q.data ?? []).map((r) => (
        <Link
          key={`${r.plan}:${r.user_id}:${r.period_start}`}
          to="/bonus-verify"
          search={{ plan: r.plan, user: r.user_id, start: r.period_start }}
          data-needs-row="bonus"
          className="surface-row flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
        >
          <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{verifyItemTitle(r.label, r.plan_name)}</span>
            <span className="block text-sm text-muted-foreground">Check the numbers and verify them</span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ))}
    </>
  );
}
