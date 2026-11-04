/**
 * Finished Breezeway maintenance waiting for the team's own review. Rows come
 * from work orders already synced into Resolve. Opening one creates (or
 * reopens) exactly one Maintenance Review routine for that work order.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, SectionCard } from "@/components/ui/page";
import { formatPropertyLabel } from "@/lib/property-label";
import { usDate } from "@/lib/dates";
import { maintenanceReviewKey, needsMaintenanceReview } from "@/lib/routine-controls";
import type { RoutineRow } from "@/components/routines/RoutineDrawer";

export function MaintenanceReviewQueue({
  demoMode,
  onOpen,
}: {
  demoMode: boolean;
  onOpen: (row: RoutineRow) => void;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["routine-controls", "maintenance-queue", demoMode],
    queryFn: async () => {
      const [wos, done] = await Promise.all([
        supabase
          .from("breezeway_work_orders")
          .select("id, name, department, status, finished_at, scheduled_date, property_id, properties(name, nickname, address_line1, unit, city, state, postal_code, is_demo)")
          .eq("department", "maintenance")
          .eq("status", "Finished")
          .order("finished_at", { ascending: false, nullsFirst: false })
          .limit(400),
        supabase
          .from("routine_controls")
          .select("event_key")
          .eq("kind", "maintenance_review")
          .eq("status", "completed")
          .limit(2000),
      ]);
      if (wos.error) throw wos.error;
      const approved = new Set(
        (done.data ?? []).map((r) => (r.event_key ?? "").replace("bz_maint:", "")),
      );
      return (wos.data ?? []).filter(
        (w) =>
          Boolean(w.properties?.is_demo) === demoMode && needsMaintenanceReview(w, approved),
      );
    },
  });

  const open = useMutation({
    mutationFn: async (wo: NonNullable<typeof data>[number]) => {
      const key = maintenanceReviewKey(wo.id);
      const { error } = await supabase.from("routine_controls").upsert(
        {
          kind: "maintenance_review",
          event_key: key,
          property_id: wo.property_id,
          title: wo.name ?? "Maintenance review",
          status: "due",
          team: "property_operations",
          is_demo: demoMode,
        },
        { onConflict: "kind,event_key", ignoreDuplicates: true },
      );
      if (error) throw error;
      const { data: row, error: readError } = await supabase
        .from("routine_controls")
        .select("*, properties(name, nickname, address_line1, unit, city, state, postal_code, ownerrez_property_id)")
        .eq("kind", "maintenance_review")
        .eq("event_key", key)
        .single();
      if (readError) throw readError;
      return row as unknown as RoutineRow;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["routine-controls"] });
      onOpen(row);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="Maintenance review"
      description="Breezeway maintenance a vendor marked Finished that the team has not approved yet. Finished by the vendor does not count as our review."
      bodyClassName="space-y-1.5"
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.length ? (
        <EmptyState title="No finished maintenance is waiting for review." />
      ) : (
        data.slice(0, 60).map((w) => {
          const label = formatPropertyLabel(w.properties).primary;
          return (
            <button
              key={w.id}
              disabled={open.isPending}
              onClick={() => open.mutate(w)}
              className="surface-row flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{w.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {label || "No home linked"}
                  {w.finished_at ? ` · Finished ${usDate(w.finished_at)}` : ""}
                </span>
              </span>
            </button>
          );
        })
      )}
      {data && data.length > 60 && (
        <p className="text-xs text-muted-foreground">Showing the 60 most recent of {data.length}.</p>
      )}
    </SectionCard>
  );
}
