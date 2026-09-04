/**
 * Vendor arrival card — check in when you get to the home, check out when you
 * leave. The phone's location is stamped on both so the coordinator can see
 * the visit happened without chasing anyone for confirmation.
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogIn, LogOut, MapPin, ShieldCheck, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { endVisit, getVisits, startVisit } from "@/lib/visits.functions";
import { describeDistance, formatOnSite, readPosition } from "@/lib/visits";

export function VisitCheckInCard({ ticketId, homeName }: { ticketId: string; homeName: string }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const fetchVisits = useServerFn(getVisits);
  const begin = useServerFn(startVisit);
  const finish = useServerFn(endVisit);

  const visits = useQuery({
    queryKey: ["ticket-visits", ticketId],
    queryFn: () => fetchVisits({ data: { ticketId } }),
  });

  const rows = visits.data?.visits ?? [];
  const open = rows.find((v) => !v.checked_out_at) ?? null;

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["ticket-visits", ticketId] });
    void qc.invalidateQueries({ queryKey: ["vendor-job", ticketId] });
  };

  const checkIn = useMutation({
    mutationFn: async () => {
      const fix = await readPosition();
      if (!fix) toast.warning("Couldn't read your location — checking you in without it.");
      return begin({ data: { ticketId, fix } });
    },
    onSuccess: (res) => {
      toast.success(
        res.verified
          ? "Checked in at the home — thank you."
          : "Checked in. Location wasn't confirmed.",
      );
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not check you in"),
  });

  const checkOut = useMutation({
    mutationFn: async () => {
      const fix = await readPosition();
      return finish({ data: { ticketId, fix, notes: notes.trim() } });
    },
    onSuccess: (res) => {
      setNotes("");
      toast.success(`Checked out after ${formatOnSite(res.minutes)} on site.`);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not check you out"),
  });

  return (
    <Card className={open ? "border-primary/50 bg-primary/5" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4" /> Arrival at {homeName}
        </CardTitle>
        <CardDescription>
          {open
            ? "You're checked in. Check out when you leave so the team knows the visit is finished."
            : "Check in when you arrive so your coordinator knows you're on site."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {open ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={open.check_in_verified ? "secondary" : "outline"} className="gap-1">
                {open.check_in_verified ? (
                  <ShieldCheck className="size-3" />
                ) : (
                  <ShieldQuestion className="size-3" />
                )}
                {describeDistance(open.check_in_distance_m, open.check_in_verified)}
              </Badge>
              <span className="text-muted-foreground">
                Since {new Date(open.checked_in_at).toLocaleTimeString()}
              </span>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional: what you did on this visit, and anything still outstanding…"
            />
            <Button disabled={checkOut.isPending} onClick={() => checkOut.mutate()}>
              <LogOut className="size-4" /> Check out
            </Button>
          </>
        ) : (
          <Button disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>
            <LogIn className="size-4" /> I'm on site — check in
          </Button>
        )}

        {rows.filter((v) => v.checked_out_at).length > 0 && (
          <div className="space-y-2 border-t border-border pt-3 text-sm">
            <p className="font-medium">Previous visits</p>
            {rows
              .filter((v) => v.checked_out_at)
              .map((v) => (
                <div key={v.id} className="text-muted-foreground">
                  {new Date(v.checked_in_at).toLocaleString()} · {formatOnSite(v.minutes_on_site)}{" "}
                  on site · {v.check_in_verified ? "location confirmed" : "location unconfirmed"}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
