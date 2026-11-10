import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/ui/page";
import { useDemo } from "@/components/DemoProvider";
import { formatPropertyLabel } from "@/lib/property-label";
import { repeatLine } from "@/lib/record-work";
import { usDate } from "@/lib/dates";

type Flag = {
  property_id: string;
  work_type_id: string;
  problem_type: string;
  times: number;
  last_at: string;
  window_days: number;
  is_demo: boolean;
};

const rpc = supabase as unknown as { rpc: (n: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> };

async function readFlags(propertyId: string | null, since: string | null): Promise<Flag[]> {
  const { data, error } = await rpc.rpc("home_repeat_flags", { _property_id: propertyId, _since: since });
  if (error) throw new Error(error.message);
  return (data as Flag[] | null) ?? [];
}

/** Property page: problem types that happened often enough at this home to be a repeat (register T11). */
export function HomeRepeatFlags({ propertyId }: { propertyId: string }) {
  const { data = [] } = useQuery({
    queryKey: ["home-repeat-flags", propertyId],
    queryFn: () => readFlags(propertyId, null),
  });
  if (data.length === 0) return null;
  return (
    <SectionCard title="Repeat problems">
      <ul className="space-y-2 text-sm" data-testid="home-repeat-flags">
        {data.map((f) => (
          <li key={f.work_type_id}>
            <details className="group" data-testid="repeat-detail">
              <summary className="flex min-h-11 cursor-pointer items-center font-bold text-warning-ink">
                {repeatLine(f.problem_type, f.times, f.window_days)}
              </summary>
              <RepeatEntries propertyId={propertyId} flag={f} />
            </details>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

type RepeatEntry = { id: string; at: string; what: string; did: string | null; ticketRef: number | null; ticketId: string | null };

/** The entries behind one repeat line: One touch saves with what was done, and tickets. */
function RepeatEntries({ propertyId, flag }: { propertyId: string; flag: Flag }) {
  const since = new Date(Date.now() - flag.window_days * 24 * 60 * 60 * 1000).toISOString();
  const { data, isLoading, error } = useQuery({
    queryKey: ["home-repeat-entries", propertyId, flag.work_type_id, flag.window_days],
    queryFn: async (): Promise<RepeatEntry[]> => {
      const db = supabase as unknown as { from: (t: string) => any };
      const [touches, tickets] = await Promise.all([
        db
          .from("property_activity_log")
          .select("id, occurred_at, what_happened, outcome, one_touch")
          .eq("property_id", propertyId)
          .eq("problem_type_id", flag.work_type_id)
          .gte("occurred_at", since)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("tickets")
          .select("id, ref, title, reported_at")
          .eq("property_id", propertyId)
          .eq("work_type_id", flag.work_type_id)
          .is("archived_at", null)
          // Same rule as the repeat count: a Notion import counts once reopened in Resolve.
          .or("external_source.is.null,external_source.neq.notion,external_status.eq.reopened_in_resolve")
          .gte("reported_at", since)
          .order("reported_at", { ascending: false }),
      ]);
      if (touches.error) throw new Error(touches.error.message);
      if (tickets.error) throw new Error(tickets.error.message);
      const a: RepeatEntry[] = ((touches.data ?? []) as { id: string; occurred_at: string; what_happened: string | null; outcome: string | null; one_touch: boolean | null }[]).map((r) => ({
        id: r.id,
        at: r.occurred_at,
        what: r.what_happened ?? "",
        did: r.one_touch ? (r.outcome ?? null) : null,
        ticketRef: null,
        ticketId: null,
      }));
      const b: RepeatEntry[] = (tickets.data ?? []).map((t) => ({
        id: t.id,
        at: t.reported_at,
        what: t.title ?? "",
        did: null,
        ticketRef: t.ref ?? null,
        ticketId: t.id,
      }));
      return [...a, ...b].sort((x, y) => y.at.localeCompare(x.at));
    },
  });
  if (isLoading) return <p className="py-1 text-muted-foreground">Loading</p>;
  if (error) return <p className="py-1 text-danger">This list could not load. Try again.</p>;
  const rows = data ?? [];
  if (rows.length === 0) return <p className="py-1 text-muted-foreground">Nothing to show.</p>;
  return (
    <ul className="mt-1 space-y-2 border-l-2 border-warning/40 pl-3" data-testid="repeat-entries">
      {rows.map((r) => (
        <li key={r.id}>
          <p className="text-muted-foreground">{usDate(r.at)}{r.ticketRef ? ` · Ticket #${r.ticketRef}` : " · One touch"}</p>
          <p>{r.what}</p>
          {r.did && <p data-testid="repeat-did"><span className="font-medium">What you did:</span> {r.did}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Supervisor check: every home that reached a repeat this week. */
export function WeeklyRepeatList() {
  const { demoMode } = useDemo();
  const { data } = useQuery({
    queryKey: ["home-repeat-flags", "week", demoMode],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const flags = (await readFlags(null, since)).filter((f) => f.is_demo === demoMode);
      const ids = [...new Set(flags.map((f) => f.property_id))];
      const { data: homes, error } = ids.length
        ? await supabase
            .from("properties")
            .select("id, name, nickname, listing_alias, address_line1, unit, city, state, postal_code")
            .in("id", ids)
        : { data: [], error: null };
      if (error) throw new Error(error.message);
      const byId = new Map((homes ?? []).map((h) => [h.id, h]));
      return flags.map((f) => ({ ...f, home: byId.get(f.property_id) }));
    },
  });
  const rows = data ?? [];
  return (
    <SectionCard title={`Repeat problems this week (${rows.length})`}>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No home had a repeat this week.</p>
      ) : (
        <ul className="divide-y divide-border text-sm" data-testid="weekly-repeat-list">
          {rows.map((r) => (
            <li key={`${r.property_id}-${r.work_type_id}`}>
              <Link
                to="/property/$propertyId"
                params={{ propertyId: r.property_id }}
                className="flex min-h-11 flex-wrap items-center gap-x-3 py-2 hover:text-primary"
              >
                <span className="font-medium">{r.home ? formatPropertyLabel(r.home).primary : "Home"}</span>
                <span className="font-bold text-warning-ink">{repeatLine(r.problem_type, r.times, r.window_days)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
