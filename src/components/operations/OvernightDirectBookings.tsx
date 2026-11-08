/**
 * Team Queue: Direct Booking requests that arrived overnight and nobody has started.
 * They wait at the top as Right now for Team A (register D2). Alerts and the morning
 * hand-off happen in the database; this only shows them. Rules in direct-bookings.ts.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PriorityRail } from "@/components/ui/page";
import {
  OVERNIGHT_COPY,
  arrivalTime,
  beforeOvernightClock,
  clockTimeLabel,
  isMissingColumn,
  readSettings,
  overnightQueueRows,
  type OvernightQueueRow,
} from "@/lib/direct-bookings";

type Db = { from: (t: string) => any };

export function OvernightDirectBookings({ demoMode }: { demoMode: boolean }) {
  const q = useQuery({
    queryKey: ["team-queue-overnight-direct-bookings", demoMode],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as Db)
        .from("leads")
        .select("id, partner_name, company, subject, created_at, overnight_until, owned_by, reply_sent_at, outcome")
        .eq("is_demo", demoMode)
        .eq("kind", "direct_booking")
        .not("overnight_until", "is", null)
        .is("owned_by", null)
        .is("outcome", null)
        .order("created_at", { ascending: true })
        .limit(20);
      // Before the database step is applied the column is missing: show nothing.
      if (error) {
        if (isMissingColumn(error)) return [] as OvernightQueueRow[];
        throw error;
      }
      return (data ?? []) as OvernightQueueRow[];
    },
  });
  // The overnight clock start time is a setting (register D3); read, never hardcoded.
  const settings = useQuery({
    queryKey: ["direct-booking-settings-overnight-start"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await (supabase as unknown as Db).from("app_settings").select("value").eq("key", "direct_booking_settings").maybeSingle();
      return readSettings(data?.value).overnightClockStart;
    },
  });
  const start = settings.data;
  const now = new Date();
  const rows = overnightQueueRows(q.data ?? []);
  if (rows.length === 0) return null;
  return (
    <section aria-label={OVERNIGHT_COPY.queueTitle} className="space-y-2 rounded-lg border border-border bg-card p-3" data-testid="overnight-direct-bookings">
      <div>
        <h2 className="text-sm font-semibold">
          {OVERNIGHT_COPY.queueTitle} <span className="numeric text-muted-foreground">· {rows.length}</span>
        </h2>
        <p className="text-xs text-muted-foreground">{OVERNIGHT_COPY.queueHint}</p>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              to="/direct-bookings/$requestId"
              params={{ requestId: r.id }}
              className="relative flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border py-2 pl-4 pr-3 text-sm hover:bg-muted"
            >
              <PriorityRail priority="p1" />
              <span className="font-medium text-danger">{OVERNIGHT_COPY.urgency}</span>
              <span className="font-medium">{r.partner_name || r.company || "Partner"}</span>
              {r.subject ? <span className="min-w-0 truncate text-muted-foreground">{r.subject}</span> : null}
              <span className="text-muted-foreground">{OVERNIGHT_COPY.team}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {OVERNIGHT_COPY.arrived(arrivalTime(r.created_at))}
                {start && beforeOvernightClock(r, now, start) ? ` ${OVERNIGHT_COPY.clockStarts(clockTimeLabel(start))}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
