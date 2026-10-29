import { formatPropertyLabel } from "@/lib/property-label";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDemo } from "@/components/DemoProvider";
import { usDate } from "@/lib/dates";
import {
  TURNOVER_THRESHOLDS_KEY,
  isCleanComplete,
  readTurnoverThresholds,
  turnoverRisk,
} from "@/lib/departure-review";
import { DepartureReviewPanel } from "./DepartureReviewPanel";

/** Side panel shared by the Team B queue and the property page. */
export function DepartureReviewSheet({ reviewId, onClose }: { reviewId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!reviewId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Departure Review</SheetTitle>
          <SheetDescription>Review the departure clean, screen for issues and record review outreach.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">{reviewId && <DepartureReviewPanel reviewId={reviewId} />}</div>
      </SheetContent>
    </Sheet>
  );
}

/** Team B: open Departure Reviews + turnovers whose clean is late. */
export function DepartureReviewQueue() {
  const { demoMode } = useDemo();
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["departure-reviews", "queue", demoMode],
    queryFn: async () => {
      const [{ data: rows, error }, { data: setting }, { data: cleans }] = await Promise.all([
        supabase.from("departure_reviews").select("id, status, guest_name, stay_departure, clean_completed_at, claimed_by, properties(name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id)")
          .eq("team", "property_operations").neq("status", "completed").eq("is_demo", demoMode).order("clean_completed_at"),
        supabase.from("app_settings").select("value").eq("key", TURNOVER_THRESHOLDS_KEY).maybeSingle(),
        supabase.from("breezeway_work_orders").select("id, name, status, reservation_snapshot, properties!inner(name, is_demo, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id)")
          .eq("department", "housekeeping").not("reservation_snapshot", "is", null).eq("properties.is_demo", demoMode)
          .not("status", "in", "(Finished,Approved,Closed,Deleted)").limit(200),
      ]);
      if (error) throw error;
      const t = readTurnoverThresholds(setting?.value);
      const now = new Date();
      const late = (cleans ?? []).flatMap((c) => {
        const dep = (c.reservation_snapshot as { departure?: string } | null)?.departure;
        const risk = turnoverRisk(dep, isCleanComplete(c.status), now, t);
        return risk ? [{ id: c.id, name: formatPropertyLabel(c.properties).primary, departure: dep!, status: c.status, risk }] : [];
      });
      return { rows: rows ?? [], late, t };
    },
    refetchInterval: 60_000,
  });

  const rows = q.data?.rows ?? [];
  const late = q.data?.late ?? [];
  if (!rows.length && !late.length) return null;

  return (
    <section aria-label="Departure Reviews" className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Departure Reviews · {rows.length}</h2>
        <span className="text-xs text-muted-foreground">Team B · created when the departure clean is finished</span>
      </div>
      {late.length > 0 && (
        <ul className="space-y-1" aria-label="Turnover exceptions">
          {late.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              <Badge variant={l.risk === "overdue" ? "destructive" : "outline"}>{l.risk === "overdue" ? "Turnover overdue" : "High risk"}</Badge>
              <span className="font-medium">{l.name}</span>
              <span className="text-muted-foreground">checked out {usDate(l.departure)} · clean {l.status ?? "not started"} in Breezeway</span>
            </li>
          ))}
        </ul>
      )}
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <div>
              <span className="font-medium">{formatPropertyLabel(r.properties).primary}</span>
              <span className="text-muted-foreground"> · {r.guest_name ?? "Guest"} · departed {r.stay_departure ? usDate(r.stay_departure) : "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{r.claimed_by ? "In progress" : "Unclaimed"}</Badge>
              <Button size="sm" onClick={() => setOpen(r.id)}>Open</Button>
            </div>
          </li>
        ))}
      </ul>
      <DepartureReviewSheet reviewId={open} onClose={() => setOpen(null)} />
    </section>
  );
}

/** Property page history: every Departure Review for the home, completed ones kept. */
export function PropertyDepartureReviews({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["departure-reviews", "property", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("departure_reviews")
        .select("id, status, guest_name, stay_arrival, stay_departure, reservation_code, completed_at, claim_id")
        .eq("property_id", propertyId).order("stay_departure", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  if (!q.data?.length) return null;
  return (
    <section aria-label="Departure Reviews" className="space-y-2 rounded-lg border border-border bg-card p-4">
      <h3 className="font-semibold">Departure Reviews</h3>
      <ul className="divide-y divide-border text-sm">
        {q.data.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>{r.guest_name ?? "Guest"} · {r.stay_arrival ? usDate(r.stay_arrival) : "—"}–{r.stay_departure ? usDate(r.stay_departure) : "—"}{r.reservation_code ? ` · ${r.reservation_code}` : ""}</span>
            <span className="flex items-center gap-2">
              {r.claim_id && <Badge variant="outline">Claim linked</Badge>}
              <Badge variant={r.status === "completed" ? "secondary" : "default"}>{r.status === "completed" ? "Completed" : "Open"}</Badge>
              <Button size="sm" variant="outline" onClick={() => setOpen(r.id)}>View</Button>
            </span>
          </li>
        ))}
      </ul>
      <DepartureReviewSheet reviewId={open} onClose={() => setOpen(null)} />
    </section>
  );
}
