import { formatPropertyLabel } from "@/lib/property-label";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sunrise } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { StatusBadge, ticketTone } from "@/components/ui/status";
import { usDateTime } from "@/lib/dates";
import { OPEN_STATUSES, STATUSES, labelFor, priorityMeta } from "@/lib/tickets";
import { lastAfterHoursWindow, windowLabel, type CoverageConfig } from "@/lib/coverage";

/**
 * Morning handoff: what came out of the last after-hours window still needing
 * daytime Operations. The Ticket record is the report — nothing separate
 * needs writing up.
 */
type Row = {
  id: string;
  title: string;
  status: string;
  priority: string;
  reported_at: string;
  vendor_status: string | null;
  vendor_dispatched_at: string | null;
  vendor_completed_at: string | null;
  next_review_at: string | null;
  handoff_status: string | null;
  guest_in_residence: boolean | null;
  assignment_note: string | null;
  properties?: { name: string; nickname: string | null; primary_photo_url?: string | null } | null;
};

/** Why this ticket is on the morning list — plain reasons, not internal codes. */
function reasons(t: Row) {
  const out: string[] = [];
  if (t.priority === "p1" || t.priority === "p2")
    out.push(`Unresolved ${priorityMeta(t.priority).short}`);
  if (t.vendor_dispatched_at && !t.vendor_completed_at) out.push("Vendor action pending");
  if (t.next_review_at) out.push("Promised follow-up");
  if (t.handoff_status === "pending") out.push("Handed into Operations — not accepted");
  if (t.guest_in_residence) out.push("Guest in residence");
  if (t.status === "waiting") out.push("Waiting on someone");
  return out;
}

export function OvernightHandoffPanel({ className }: { className?: string | undefined }) {
  const { data, isLoading } = useQuery({
    queryKey: ["overnight-handoff"],
    queryFn: async () => {
      const { data: cfg } = await supabase
        .from("coverage_config")
        .select("after_hours_start_minute, after_hours_end_minute, timezone")
        .maybeSingle();

      const window = lastAfterHoursWindow(cfg as CoverageConfig | null);
      if (!window)
        return { cfg: (cfg ?? null) as CoverageConfig | null, window: null, rows: [] as Row[] };

      const { data: rows, error } = await supabase
        .from("tickets")
        .select(
          "id, title, status, priority, reported_at, vendor_status, vendor_dispatched_at, vendor_completed_at, next_review_at, handoff_status, guest_in_residence, assignment_note, properties(name, nickname, primary_photo_url, address_line1, unit, city, state, postal_code, ownerrez_property_id)",
        )
        .eq("is_demo", false)
        .is("archived_at", null)
        .gte("reported_at", window.startsAt.toISOString())
        .lte("reported_at", window.endsAt.toISOString())
        .order("priority")
        .limit(200);
      if (error) throw error;

      const open = ((rows ?? []) as unknown as Row[]).filter((t) =>
        OPEN_STATUSES.includes(t.status),
      );
      return { cfg: (cfg ?? null) as CoverageConfig | null, window, rows: open };
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading || !data) return <Skeleton className={className ?? "h-48 w-full"} />;

  const label = windowLabel(data.cfg);
  const openCount = data.rows.length;

  return (
    <section className={className ? `surface p-4 ${className}` : "surface p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <Sunrise className="size-4 text-amber" />
        <h2 className="text-base font-semibold tracking-tight">Overnight handoff</h2>
        <StatusBadge tone={openCount === 0 ? "resolved" : "waiting"}>{openCount} open</StatusBadge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.window
          ? `Unresolved work from the ${label} window that started ${data.window.rosterDate}.`
          : "Not available until the after-hours coverage window is configured."}
      </p>

      {data.window ? (
        openCount === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing from overnight still needs attention.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.rows.map((t) => (
              <li key={t.id}>
                <Link
                  to="/tickets/$ticketId"
                  params={{ ticketId: t.id }}
                  className="flex flex-wrap items-center gap-3 py-2.5 transition-colors hover:bg-secondary/60"
                >
                  <PropertyPhoto
                    url={t.properties?.primary_photo_url}
                    name={formatPropertyLabel(t.properties).primary}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatPropertyLabel(t.properties).primary} ·{" "}
                      {usDateTime(t.reported_at)}
                    </span>
                  </span>
                  <StatusBadge tone={ticketTone(t.status)}>
                    {labelFor(STATUSES, t.status)}
                  </StatusBadge>
                  <span className="flex flex-wrap gap-1">
                    {reasons(t).map((r) => (
                      <span
                        key={r}
                        className="chip border-cool-grey/25 bg-cool-grey/10 text-cool-grey"
                      >
                        {r}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}
