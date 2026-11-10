/**
 * Register T1: My scorecard, shown only to a person who has a scorecard record
 * (recorded by them or about them, not demo) and who can open the view it leads
 * to. Today nobody has one, so nobody sees it; nobody ever sees a dead button.
 * Build 13: a person on a bonus plan (from their start date) also sees it.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/useRole";
import { MY_SCORECARD_LABEL, MY_SCORECARD_TO, myScorecardVisible } from "@/lib/home-needs";
import { useMyBonusPlans } from "@/components/bonus/MyBonus";

export function MyScorecardButton({ userId }: { userId: string }) {
  const { canOpen } = useRole();
  const canOpenView = canOpen(MY_SCORECARD_TO);
  const q = useQuery({
    queryKey: ["my-scorecard-record", userId],
    enabled: canOpenView,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scorecard_records")
        .select("id")
        .or(`recorded_by.eq.${userId},about_user_id.eq.${userId}`)
        .eq("is_demo", false)
        .limit(1);
      if (error) return false;
      return (data ?? []).length > 0;
    },
  });
  // Build 13 (register BN5): a person with a bonus plan also gets the button.
  const plans = useMyBonusPlans(canOpenView);
  const hasPlan = (plans.data ?? []).length > 0;
  if (!myScorecardVisible(q.data === true || hasPlan, canOpenView)) return null;
  return (
    <div>
      <Button asChild variant="outline" className="min-h-11" data-my-scorecard>
        <Link to={MY_SCORECARD_TO}>
          <Award className="size-4" aria-hidden="true" /> {MY_SCORECARD_LABEL}
        </Link>
      </Button>
    </div>
  );
}
