import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getGuestContext } from "@/lib/guest-context.functions";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";

/**
 * Read-only "Current guest/tenant" block for an Operations matter.
 *
 * Shown only to Operations coordinators and supervisors, never in Vendor,
 * Homeowner, demo or executive views. Data comes live from OwnerRez on each
 * view and is never stored or written back.
 */

function dateRange(arrival: string | null, departure: string | null) {
  if (!arrival || !departure) return "—";
  const fmt = (v: string) =>
    new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${fmt(arrival)} → ${fmt(departure)}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function GuestContextPanel({ ticketId }: { ticketId: string }) {
  const { can, isVendor, isOwner } = useRole();
  const { demoMode } = useDemo();
  const fetchContext = useServerFn(getGuestContext);

  const enabled = can("guest_contact") && !isVendor && !isOwner && !demoMode;

  const query = useQuery({
    queryKey: ["guest-context", ticketId],
    enabled,
    staleTime: 60 * 1000,
    queryFn: () => fetchContext({ data: { ticketId } }),
  });

  if (!enabled) return null;
  if (query.isLoading) return <Skeleton className="h-40 w-full" />;

  const result = query.data;
  if (!result || result.visible === false) return null;

  const unavailable = result.status !== "match";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UserRound className="size-4" /> Current guest / tenant
        </CardTitle>
        <CardDescription>
          Live from OwnerRez. Read-only — nothing here is saved or sent back.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {unavailable ? (
          <p className="text-muted-foreground">Guest contact unavailable—verify in OwnerRez.</p>
        ) : (
          <>
            <Row label="Name" value={result.guest_name ?? "—"} />
            <Row label="Phone" value={result.phone ?? "—"} />
            <Row label="Stay" value={dateRange(result.arrival, result.departure)} />
            <Row label="Reservation" value={result.reservation_id ?? "—"} />
            <Row label="Channel" value={result.booking_channel ?? "—"} />
            {result.stay_kind ? (
              <Badge variant="secondary">
                {result.stay_kind === "mid_term" ? "Mid-term tenant" : "Short-term guest"}
              </Badge>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
