/**
 * Routine Work, Arrival checks (change 3 of 5). Team A takes open checks here; the work itself
 * happens on the check's ticket. Flagged rechecks sit at the top.
 */
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/ui/page";
import { useCurrentUserId } from "@/hooks/useTeam";
import { takeTicketPatch } from "@/lib/automated-sources";
import { arrivalProgress, arrivalTime, isSameDayBooking } from "@/lib/arrival-check";

type Row = {
  id: string; ticket_id: string; home_label: string; arrival_on: string; check_in_at: string; time_zone: string;
  ownerrez_booking_id: string; steps?: Record<string, unknown> | null; recheck_flag?: boolean | null; is_test: boolean;
  tickets: { assigned_to: string | null; current_action_owner: string | null; record_owner: string | null; accountable_owner: string | null } | null;
};
type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

export function ArrivalChecksSection({ demoMode }: { demoMode: boolean }) {
  const userId = useCurrentUserId();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["routine-arrival-checks", demoMode],
    refetchInterval: 60_000,
    queryFn: async () => {
      const db = supabase as unknown as Db;
      const { data, error } = await db.from("arrival_checks")
        .select("*")
        .eq("status", "open").is("cleared_at", null).order("check_in_at", { ascending: true }).limit(200);
      if (error) throw error;
      const base = (data ?? []) as Row[];
      const tix = new Map<string, Row["tickets"] & { is_demo?: boolean }>();
      const tids = base.map((r) => r.ticket_id).filter(Boolean);
      if (tids.length) {
        const { data: t } = await db.from("tickets").select("id, assigned_to, current_action_owner, record_owner, accountable_owner, is_demo, status").in("id", tids);
        for (const x of (t ?? []) as Array<{ id: string; is_demo: boolean }>) tix.set(x.id, x as never);
      }
      const rows = base.map((r) => ({ ...r, tickets: tix.get(r.ticket_id) ?? null })).filter((r) => r.tickets && Boolean((r.tickets as { is_demo?: boolean }).is_demo) === demoMode);
      const ids = rows.map((r) => r.ownerrez_booking_id);
      const booked = new Map<string, string | null>();
      if (ids.length) {
        const { data: res } = await db.from("arrival_reservations").select("ownerrez_booking_id, booked_at").in("ownerrez_booking_id", ids);
        for (const r of (res ?? []) as Array<{ ownerrez_booking_id: string; booked_at: string | null }>) booked.set(String(r.ownerrez_booking_id), r.booked_at);
      }
      return rows.map((r) => ({ ...r, booked_at: booked.get(String(r.ownerrez_booking_id)) ?? null }))
        .sort((a, b) => Number(Boolean(b.recheck_flag)) - Number(Boolean(a.recheck_flag)));
    },
  });

  async function take(r: Row) {
    if (!userId || !r.tickets) return;
    const db = supabase as unknown as Db;
    const { data, error } = await db.from("tickets").update(takeTicketPatch(r.tickets, userId))
      .eq("id", r.ticket_id).is("assigned_to", null).is("current_action_owner", null).select("id");
    if (error || !data?.length) { toast.error("Someone already took it."); return; }
    toast.success("It is yours.");
    await qc.invalidateQueries({ queryKey: ["routine-arrival-checks"] });
  }

  const rows = q.data ?? [];
  return (
    <SectionCard title={`Arrival checks · ${rows.length}`}>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No arrival checks open.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" data-testid="arrival-checks">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Property</th><th>Check in</th><th>Booking</th><th>Progress</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const owned = Boolean(r.tickets?.assigned_to || r.tickets?.current_action_owner);
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="py-2 font-medium">{r.home_label}{r.recheck_flag ? <Badge variant="outline" className="ml-2">Recheck</Badge> : null}</td>
                    <td>{arrivalTime(r.check_in_at, r.time_zone)}</td>
                    <td>{isSameDayBooking(r.booked_at, r.arrival_on) ? <Badge variant="secondary">Same-day</Badge> : "Booked ahead"}</td>
                    <td>{arrivalProgress(r.steps).label}</td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      {!owned ? <Button size="sm" variant="outline" className="min-h-11" onClick={() => void take(r)}>Take it</Button> : null}
                      <Button asChild size="sm" className="min-h-11"><Link to="/tickets/$ticketId" params={{ ticketId: r.ticket_id }}>Open</Link></Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
