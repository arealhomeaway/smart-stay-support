import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/ui/page";
import { useDemo } from "@/components/DemoProvider";
import { formatPropertyLabel } from "@/lib/property-label";
import { repeatLine } from "@/lib/record-work";

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
      <ul className="space-y-1 text-sm" data-testid="home-repeat-flags">
        {data.map((f) => (
          <li key={f.work_type_id} className="font-bold text-warning-ink">
            {repeatLine(f.problem_type, f.times, f.window_days)}
          </li>
        ))}
      </ul>
    </SectionCard>
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
