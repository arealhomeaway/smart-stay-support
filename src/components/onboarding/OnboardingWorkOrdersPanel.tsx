import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/page";
import { usDate } from "@/lib/dates";
import type { OnboardingWorkOrder, WorkOrderRoute } from "@/lib/onboarding-work-orders";
import { getOnboardingWorkOrders } from "@/lib/onboarding-work-orders.functions";

type Filter = "all" | WorkOrderRoute | "open";

/**
 * Every job booked for this home while it is being set up, whether it went to
 * Breezeway or to a vendor we track here. One column says which.
 */
export function OnboardingWorkOrdersPanel({ propertyId }: { propertyId: string }) {
  const load = useServerFn(getOnboardingWorkOrders);
  const { data, isLoading, error } = useQuery({
    queryKey: ["onboarding-work-orders", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => {
    const orders = (data?.orders ?? []) as OnboardingWorkOrder[];
    if (filter === "open") return orders.filter((o) => !o.done);
    if (filter === "all") return orders;
    return orders.filter((o) => o.route === filter);
  }, [data, filter]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading work orders…</p>;
  if (error || !data)
    return <p className="text-sm text-muted-foreground">Work orders could not be loaded.</p>;

  const counts = data.counts;
  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: `All (${counts.total})` },
    { id: "open", label: `Still open (${counts.open})` },
    { id: "breezeway", label: `Breezeway (${counts.breezeway})` },
    { id: "vendor", label: `Vendors tracked here (${counts.vendor})` },
  ];

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div>
          <CardTitle className="text-base">Work booked for this home</CardTitle>
          <CardDescription>
            Jobs sent to Breezeway and jobs for vendors we track in Resolve, side by side, so
            nothing is being worked in a place nobody is watching.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={filter === t.id ? "secondary" : "ghost"}
              onClick={() => setFilter(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No work has been booked for this home yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((o) => (
              <li key={`${o.route}-${o.id}`} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{o.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.who ?? "No one assigned yet"}
                    {o.scheduledFor ? ` · ${usDate(o.scheduledFor)}` : ""}
                  </p>
                </div>
                <Chip>{o.routeLabel}</Chip>
                <span className="text-xs text-muted-foreground">{o.statusLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
