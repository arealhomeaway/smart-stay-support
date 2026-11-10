/** One next dispatch step for an open Work Order, shown in the Ticket's Fix it step. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserId } from "@/hooks/useTeam";
import { authorizationState, type DispatchWorkOrder } from "@/lib/vendor-sourcing";
import { pushWorkOrderToBreezeway } from "@/lib/vendor-sourcing.functions";
import { prepareVendorWorkOrderEmail } from "@/lib/vendor-email.functions";
import { dispatchNextStep } from "@/lib/dispatch-next-step";
import { VendorEmailButton } from "@/components/workorders/VendorEmailButton";
import { useFeatureFlags } from "@/lib/feature-flags";

export function DispatchNextStep({ workOrderId, readOnly, onOpenWorkOrder }: { workOrderId: string; readOnly: boolean; onOpenWorkOrder: () => void }) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const push = useServerFn(pushWorkOrderToBreezeway);
  const flags = useFeatureFlags();
  const prepare = useServerFn(prepareVendorWorkOrderEmail);
  const [when, setWhen] = useState("");
  const key = ["dispatch-next-step", workOrderId];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [wo, cands] = await Promise.all([
        supabase.from("work_orders").select("*").eq("id", workOrderId).single(),
        supabase.from("work_order_vendor_candidates").select("id, vendor_name, status, choice, created_at").eq("work_order_id", workOrderId).order("created_at"),
      ]);
      if (wo.error) throw wo.error;
      return { wo: wo.data as typeof wo.data & DispatchWorkOrder, cands: cands.data ?? [] };
    },
  });
  const accepted = q.data?.cands.find((c) => c.status === "accepted") ?? null;
  const email = useQuery({
    queryKey: ["vendor-wo-email", workOrderId],
    enabled: Boolean(accepted),
    queryFn: () => prepare({ data: { workOrderId } }),
  });
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: key }),
      qc.invalidateQueries({ queryKey: ["vendor-sourcing", workOrderId] }),
      qc.invalidateQueries({ queryKey: ["vendor-wo-email", workOrderId] }),
      qc.invalidateQueries({ queryKey: ["work-orders"] }),
      qc.invalidateQueries({ predicate: (x) => String(x.queryKey[0]).includes("ticket") }),
    ]);
  };
  const run = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  if (!q.data) return null;
  const { wo, cands } = q.data;
  const candidate = cands.find((c) => c.status !== "declined" && c.status !== "withdrawn") ?? null;
  const step = dispatchNextStep({
    closed: Boolean(wo.closed_at),
    dispatched: Boolean(wo.dispatched_at),
    handoffStatus: wo.breezeway_handoff_status,
    accepted: accepted ? { name: accepted.vendor_name } : null,
    candidate: candidate ? { id: candidate.id, name: candidate.vendor_name } : null,
    auth: authorizationState(wo),
    hasAppointment: Boolean(wo.scheduled_for),
    sendBy: !accepted || !email.data ? null : email.data.offered ? "email" : "breezeway",
  });
  if (!step) return null;
  const must = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const r = await p;
    if (r.error) throw new Error(r.error.message);
  };

  return (
    <div className="space-y-2 rounded-lg border border-primary/40 bg-card p-3" aria-label="Next dispatch step" data-testid="dispatch-next-step">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next step</p>
      <p className="font-semibold">{step.title}</p>
      <p className="text-sm text-muted-foreground">{step.body}</p>
      {readOnly ? null : step.kind === "accept" ? (
        <Button size="sm" disabled={run.isPending}
          onClick={() => run.mutate(async () => {
            // Same writes as "Vendor accepted the work" on the Work Order.
            await must(supabase.from("work_order_vendor_candidates").update({ status: "accepted" }).eq("id", step.candidateId));
            await must(supabase.from("work_orders").update({ vendor_acknowledged_at: new Date().toISOString() }).eq("id", workOrderId));
          })}>{step.button}</Button>
      ) : step.kind === "appointment" ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="datetime-local" className="w-56" aria-label="Appointment date and time" value={when} onChange={(e) => setWhen(e.target.value)} />
          <Button size="sm" disabled={!when || run.isPending}
            onClick={() => run.mutate(async () => {
              const iso = new Date(when).toISOString();
              await must(supabase.from("work_orders").update({ vendor_eta_at: iso, scheduled_for: iso }).eq("id", workOrderId));
              await must(supabase.from("work_order_events").insert({ work_order_id: workOrderId, author_id: userId, event_type: "vendor_scheduled", body: "Appointment and ETA recorded", is_demo: wo.is_demo } as never));
              setWhen("");
            })}>{step.button}</Button>
        </div>
      ) : step.kind === "send_breezeway" ? (
        // Hidden while Resolve work orders are off (register C4): nothing is sent to Breezeway.
        !flags.enabled("internal_work_orders") ? null : <Button size="sm" disabled={run.isPending}
          onClick={() => run.mutate(async () => { const r = await push({ data: { workOrderId } }); toast.message(r.message); })}>{step.button}</Button>
      ) : step.kind === "send_email" ? (
        <VendorEmailButton workOrderId={workOrderId} />
      ) : step.kind === "checking" ? null : (
        <Button size="sm" variant="outline" onClick={onOpenWorkOrder}>Open the Work Order</Button>
      )}
    </div>
  );
}
