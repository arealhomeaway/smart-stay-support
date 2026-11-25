/**
 * Team B review rows (Emily's answers, Nov 25): Departure Review cleaning reviews and the
 * maintenance and lawn routine checks shown in their Team B tab with the same Due filters.
 * They stay what they are (not tickets); a click opens the existing review.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatPropertyLabel } from "@/lib/property-label";
import { usDate } from "@/lib/dates";
import { inDueFilter, reviewItem, type TeamBDue, type TeamBReviewItem, type TeamBTab } from "@/lib/team-b-view";
import { DepartureReviewSheet } from "@/components/departure/DepartureReviewQueue";
import { RoutineDrawer, type RoutineRow } from "@/components/routines/RoutineDrawer";

const ROUTINE_COLS = "id, kind, status, title, outcome, property_id, ticket_id, follow_up_ticket_id, guest_name, reservation_confirmation, stay_arrival, stay_departure, due_at, findings, notes, evidence_urls, completed_at, assigned_to, event_key, properties(name, nickname, address_line1, unit, city, state, postal_code)";

export function useTeamBReviews(demoMode: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ["team-b-reviews", demoMode],
    enabled,
    queryFn: async () => {
      const [dr, rc] = await Promise.all([
        supabase.from("departure_reviews")
          .select("id, status, clean_name, clean_completed_at, stay_departure, properties(name, nickname, address_line1, unit, city, state, postal_code)")
          .eq("team", "property_operations").eq("is_demo", demoMode).order("clean_completed_at", { ascending: false }).limit(500),
        supabase.from("routine_controls").select(ROUTINE_COLS)
          .eq("kind", "maintenance_review").eq("is_demo", demoMode).order("due_at", { ascending: true }).limit(1000),
      ]);
      if (dr.error) throw dr.error;
      if (rc.error) throw rc.error;
      const label = (p: unknown): string => (p ? formatPropertyLabel(p as never).primary : "");
      const items: TeamBReviewItem[] = [];
      for (const r of dr.data ?? []) {
        const it = reviewItem({ source: "departure", id: r.id, status: r.status, clean_completed_at: r.clean_completed_at, stay_departure: r.stay_departure, title: r.clean_name ? `Cleaning review: ${r.clean_name}` : null, property: label(r.properties) });
        if (it) items.push(it);
      }
      const routines = new Map<string, RoutineRow>();
      for (const r of rc.data ?? []) {
        routines.set(r.id, r as unknown as RoutineRow);
        const it = reviewItem({ source: "routine", id: r.id, status: r.status, due_at: r.due_at, title: r.title, property: label(r.properties) });
        if (it) items.push(it);
      }
      return { items, routines };
    },
  });
}

export function reviewCount(items: TeamBReviewItem[] | undefined, tab: TeamBTab, due: TeamBDue, now: Date) {
  return (items ?? []).filter((i) => i.tab === tab && inDueFilter(i as never, due, now)).length;
}

export function TeamBReviewRows({ items, routines, tab, due, now }: {
  items: TeamBReviewItem[]; routines: Map<string, RoutineRow>; tab: TeamBTab; due: TeamBDue; now: Date;
}) {
  const [departure, setDeparture] = useState<string | null>(null);
  const [routine, setRoutine] = useState<RoutineRow | null>(null);
  const rows = items.filter((i) => i.tab === tab && inDueFilter(i as never, due, now))
    .sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"));
  if (rows.length === 0) return null;
  return (
    <section aria-label="Reviews" className="overflow-x-auto rounded-lg border border-border" data-testid="team-b-reviews">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr><th className="px-3 py-2">Review</th><th className="px-3 py-2">Home</th><th className="px-3 py-2">Due</th><th className="px-3 py-2">Status</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.source}:${r.id}`} className="cursor-pointer border-t border-border hover:bg-muted/40"
              onClick={() => (r.source === "departure" ? setDeparture(r.id) : setRoutine(routines.get(r.id) ?? null))}>
              <td className="px-3 py-2">
                <button type="button" className="min-h-11 text-left font-medium text-primary underline-offset-2 hover:underline">{r.title}</button>
              </td>
              <td className="px-3 py-2">{r.property}</td>
              <td className="px-3 py-2">{r.due_on ? usDate(r.due_on) : ""}</td>
              <td className="px-3 py-2">{r.status === "closed" ? "Closed" : "Open"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <DepartureReviewSheet reviewId={departure} onClose={() => setDeparture(null)} />
      <RoutineDrawer row={routine} open={!!routine} onOpenChange={(v) => { if (!v) setRoutine(null); }} />
    </section>
  );
}
