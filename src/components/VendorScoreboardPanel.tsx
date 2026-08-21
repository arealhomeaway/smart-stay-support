import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award } from "lucide-react";
import { vendorScoreboard } from "@/lib/scorecard.functions";
import { TIER_LABEL } from "@/lib/scorecard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Internal-only view of vendor performance. Vendors never see this. */
export function VendorScoreboardPanel() {
  const load = useServerFn(vendorScoreboard);
  const board = useQuery({ queryKey: ["vendor-scoreboard"], queryFn: () => load() });

  const vendors = board.data?.vendors ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="size-4" /> Vendor scorecards
        </CardTitle>
        <CardDescription>
          Internal view. Vendors only ever see their own points and an anonymous percentile — no names, no
          leaderboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {board.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : vendors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vendor logins yet. Set a partner to “Vendor” above, dispatch a job, then score it when it's done.
          </p>
        ) : (
          vendors.map((v) => (
            <div
              key={v.vendorUserId}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="font-medium">{v.name}</span>
              <Badge variant={v.tier === "gold" ? "default" : "secondary"}>{TIER_LABEL[v.tier]}</Badge>
              <span className="text-muted-foreground">
                {v.ratedJobs} scored · {v.averageOverall !== null ? `${v.averageOverall.toFixed(1)}/5` : "—"} avg
                {v.reopenCount > 0 ? ` · ${v.reopenCount} callback${v.reopenCount === 1 ? "" : "s"}` : ""}
              </span>
              <span className="ml-auto font-semibold">{v.points} pts</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
