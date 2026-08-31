/**
 * Staff view of the vendor's site visits on a ticket: when they arrived, how
 * long they were there, and whether the phone's location matched the home.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, ShieldCheck, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getVisits } from "@/lib/visits.functions";
import { describeDistance, formatOnSite } from "@/lib/visits";

export function VisitLogPanel({ ticketId }: { ticketId: string }) {
  const fetchVisits = useServerFn(getVisits);
  const visits = useQuery({
    queryKey: ["ticket-visits", ticketId],
    queryFn: () => fetchVisits({ data: { ticketId } }),
  });

  const rows = visits.data?.visits ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4" /> Site visits
        </CardTitle>
        <CardDescription>Location-stamped arrivals from the vendor portal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {visits.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground">No vendor has checked in at the home yet.</p>
        ) : (
          rows.map((v) => (
            <div key={v.id} className="space-y-1 rounded-md border border-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={v.check_in_verified ? "secondary" : "outline"} className="gap-1">
                  {v.check_in_verified ? <ShieldCheck className="size-3" /> : <ShieldQuestion className="size-3" />}
                  {describeDistance(v.check_in_distance_m, v.check_in_verified)}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(v.checked_in_at).toLocaleString()}
                  {v.checked_out_at
                    ? ` → ${new Date(v.checked_out_at).toLocaleTimeString()} · ${formatOnSite(v.minutes_on_site)} on site`
                    : " · still on site"}
                </span>
              </div>
              {v.notes && <p className="whitespace-pre-wrap">{v.notes}</p>}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
