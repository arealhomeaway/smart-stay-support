/**
 * Register T1: My scorecard, shown only to a person who has a scorecard record
 * (recorded by them or about them, not demo) and who can open the view it leads
 * to. Today nobody has one, so nobody sees it; nobody ever sees a dead button.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/useRole";
import { MY_SCORECARD_LABEL, MY_SCORECARD_TO, myScorecardVisible } from "@/lib/home-needs";

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
  if (!myScorecardVisible(q.data === true, canOpenView)) return null;
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
