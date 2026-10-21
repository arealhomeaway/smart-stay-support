/**
 * The Work Order on the ticket where the maintenance is being run.
 *
 * The ticket says what broke. The Work Order says what it costs, who may
 * authorise it, whether a warranty might cover it, and what the vendor still
 * owes us. Resolve applies the policy rather than reciting it: the authority
 * verdict, the warranty hint, the second-quote advice and the closure gates
 * are all derived from what has actually been recorded.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { StatusBadge, type StatusTone } from "@/components/ui/status";
import { usDate } from "@/lib/dates";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUserId, useStaffDirectory } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import { stateChip } from "@/lib/semantic";
import { WorkOrderDrawer } from "@/components/workorders/WorkOrderDrawer";
import {
  EMERGENCY_REASON_LABELS,
  MAINTENANCE_POLICY_VERSION,
  money,
  type EmergencyReason,
} from "@/lib/maintenance-policy";
import {
  BUCKET_LABELS,
  PHASE_LABELS,
  STAGE_LABELS,
  closureBlockers,
  commitmentStatus,
  derivedStage,
  evaluateAuthority,
  nextAction,
  secondQuoteAdvice,
  warrantyHint,
  workOrderBucket,
  type PropertyWarranty,
  type WorkOrderPhase,
} from "@/lib/work-orders";
import { ticketWorkOrdersQueryKey, type WorkOrderRow } from "@/lib/work-order-types";
import { FieldHint } from "@/components/FieldHint";
import { TRADES, categoryForTrade, categoryLabel, normalizeTrade, tradeLabel } from "@/lib/taxonomy";

type TicketContext = {
  id: string;
  title: string;
  description?: string | null;
  property_id?: string | null;
  priority?: string | null;
  work_type?: string | null;
  is_demo?: boolean | null;
  /** Vendor chosen on the Ticket from the Vendor Directory; recorded on the new Work Order (no dispatch). */
  /** Chosen in the guided Ticket; its trades pre-fill the form so nothing known is asked again. */
  selected_vendor?: { id: string; name: string; categories?: string[] } | null;
};

/**
 * The one query for a ticket's Work Orders, shared by this panel and the
 * ticket workspace's own stage derivation — a second, differently-shaped
 * query here previously left the ticket page reading a cache the Work
 * Order drawer's close/complete mutation never invalidated, so "Waiting on
 * the repair" could sit stale until a manual refresh.
 */
export function useTicketWorkOrders(ticketId: string) {
  return useQuery({
    queryKey: ticketWorkOrdersQueryKey(ticketId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderRow[];
    },
  });
}

const EMERGENCY_OPTIONS = Object.keys(EMERGENCY_REASON_LABELS) as EmergencyReason[];

// Trades come from the shared catalog so a Work Order, a ticket and a vendor
// all read the same way. See src/lib/taxonomy.ts.
const CATEGORIES = TRADES;

function bucketState(bucket: ReturnType<typeof workOrderBucket>) {
  if (bucket === "closed") return "done" as const;
  if (bucket === "needs_action") return "blocked" as const;
  if (bucket === "permanent_pending" || bucket === "evidence_missing") return "active" as const;
  return "waiting" as const;
}

function bucketTone(bucket: ReturnType<typeof workOrderBucket>): StatusTone {
  if (bucket === "closed") return "resolved";
  if (bucket === "needs_action") return "escalated";
  if (bucket === "permanent_pending" || bucket === "evidence_missing") return "progress";
  return "waiting";
}

export function TicketWorkOrderPanel({
  ticket,
  propertyName = "Property",
  readOnly: forceReadOnly = false,
  openWorkOrderId,
  onOpenWorkOrderIdChange,
}: {
  ticket: TicketContext;
  /** For the Work Order drawer header, opened from a card below. */
  propertyName?: string;
  /** Creation lives with the current work — history stays read-only. */
  readOnly?: boolean;
  /**
   * Which Work Order the drawer shows, owned by the Ticket page rather than
   * this panel: the Ticket renders a different `TicketWorkOrderPanel`
   * instance per stage (repair / repair_active / verify / reference), and
   * creating a Work Order changes the ticket's derived stage immediately —
   * unmounting the instance that just created it. State kept here would be
   * destroyed in the same tick it was set, before the drawer ever painted.
   */
  openWorkOrderId: string | null;
  onOpenWorkOrderIdChange: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const { can, readOnly: roleReadOnly } = useRole();
  const readOnly = roleReadOnly || forceReadOnly;
  const canEdit = !readOnly;
  // From the guided Ticket the form opens straight away, with the trade filled in
  // when the chosen vendor has exactly one, and the ticket description as scope.
  const vendorTrades = [
    ...new Set((ticket.selected_vendor?.categories ?? []).map((c) => normalizeTrade(c)?.value).filter(Boolean) as string[]),
  ];
  const [open, setOpen] = useState(Boolean(ticket.selected_vendor));
  const [phase, setPhase] = useState<WorkOrderPhase>("permanent");
  const [category, setCategory] = useState(vendorTrades.length === 1 ? vendorTrades[0]! : "");
  const [scope, setScope] = useState(ticket.selected_vendor ? (ticket.description ?? "") : "");
  const [emergency, setEmergency] = useState<EmergencyReason | "">("");
  const [quote, setQuote] = useState("");
  const people = useStaffDirectory().data ?? [];

  const orders = useTicketWorkOrders(ticket.id);

  const property = useQuery({
    queryKey: ["work-order-property-warranty", ticket.property_id],
    enabled: Boolean(ticket.property_id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("warranty")
        .eq("id", ticket.property_id as string)
        .maybeSingle();
      if (error) throw error;
      return (data?.warranty ?? null) as PropertyWarranty;
    },
  });

  const draftHint = warrantyHint(property.data ?? null, category || ticket.work_type || null);
  const draftVerdict = evaluateAuthority({
    phase,
    emergency_reason: emergency || null,
    quote_amount: quote || null,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .insert({
          ticket_id: ticket.id,
          property_id: ticket.property_id ?? null,
          title: ticket.title,
          scope: scope || ticket.description || null,
          service_category: category || null,
          category: categoryForTrade(category) ?? "other",
          priority: ticket.priority ?? "p3",
          phase,
          emergency_reason: phase === "mitigation" ? emergency || null : null,
          quote_amount: quote ? Number(quote) : null,
          quote_received_at: quote ? new Date().toISOString() : null,
          authority_level: draftVerdict.level,
          approval_status: draftVerdict.ownerApprovalRequired ? "pending" : "not_required",
          approval_requested_at: draftVerdict.ownerApprovalRequired
            ? new Date().toISOString()
            : null,
          approval_requested_by: draftVerdict.ownerApprovalRequired ? userId : null,
          warranty_may_apply: draftHint.mayApply,
          warranty_kind: draftHint.kind,
          warranty_contact: draftHint.contact,
          permanent_repair_needed: phase === "mitigation",
          policy_version: MAINTENANCE_POLICY_VERSION,
          vendor_org_id: ticket.selected_vendor?.id ?? null,
          vendor_name: ticket.selected_vendor?.name ?? null,
          assigned_to: userId,
          created_by: userId,
          is_demo: ticket.is_demo ?? false,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

      // The chosen vendor starts as a candidate on Find a Vendor — choosing is not acceptance.
      if (ticket.selected_vendor) {
        await supabase.from("work_order_vendor_candidates").insert({
          work_order_id: (data as { id: string }).id, vendor_org_id: ticket.selected_vendor.id,
          vendor_name: ticket.selected_vendor.name, choice: "primary", is_demo: ticket.is_demo ?? false,
        });
      }

      await supabase.from("work_order_events").insert({
        work_order_id: (data as { id: string }).id,
        author_id: userId,
        event_type: "created",
        body: `${PHASE_LABELS[phase]} opened from the ticket — ${draftVerdict.label}`,
        detail: {
          authority: draftVerdict.level,
          reason: draftVerdict.reason,
          warranty_may_apply: draftHint.mayApply,
          policy_version: MAINTENANCE_POLICY_VERSION,
        },
        is_demo: ticket.is_demo ?? false,
      } as never);

      // A fresh Work Order supersedes any earlier "still needs repair"
      // verdict — clear it so the next completion gets its own verify step
      // instead of the stage machine skipping straight back to repair.
      await supabase
        .from("tickets")
        .update({ repair_reported_incomplete_at: null } as never)
        .eq("id", ticket.id);

      return (data as { id: string }).id;
    },
    onSuccess: async (newWorkOrderId) => {
      setOpen(false);
      setScope("");
      setQuote("");
      setEmergency("");
      // Awaited so the drawer below opens against the query that already
      // has the new Work Order in it, not a cache that hasn't refetched yet.
      await qc.invalidateQueries({ queryKey: ticketWorkOrdersQueryKey(ticket.id) });
      qc.invalidateQueries({ queryKey: ["ticket", ticket.id] });
      // Stay on this Ticket route — open the new Work Order in the same
      // drawer "Open Work Order" already uses, rather than sending anyone
      // to the Work Orders index to find it.
      onOpenWorkOrderIdChange(newWorkOrderId);
      toast.success("Work order opened");
    },
    onError: (e: Error) => {
      // One open Work Order per ticket (work_orders_one_open_per_ticket) —
      // this fires only if two attempts raced, since the button below is
      // already hidden whenever an open one exists.
      if (e.message.includes("work_orders_one_open_per_ticket")) {
        toast.error(
          "This ticket already has an open Work Order — close it before opening another.",
        );
        qc.invalidateQueries({ queryKey: ticketWorkOrdersQueryKey(ticket.id) });
        return;
      }
      toast.error(e.message);
    },
  });

  if (!can("claims_work")) return null;

  const existing = orders.data ?? [];
  const hasOpenOrder = existing.some((wo) => !wo.closed_at);
  const blockedByEmergency = phase === "mitigation" && !emergency;

  return (
    <Card data-ticket-work-orders="">
      <CardHeader>
        <CardTitle>Work order</CardTitle>
        <CardDescription>Cost, approval and vendor tracking for this repair.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {existing.map((wo) => {
          const verdict = evaluateAuthority(wo);
          const bucket = workOrderBucket(wo);
          const commitments = commitmentStatus(wo);
          const advice = secondQuoteAdvice(wo);
          const blockers = closureBlockers(wo);
          return (
            <div key={wo.id} className="space-y-2 rounded-lg bg-sunken px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={bucketTone(bucket)}>{BUCKET_LABELS[bucket]}</StatusBadge>
                <Chip>{PHASE_LABELS[wo.phase === "mitigation" ? "mitigation" : "permanent"]}</Chip>
                <Chip>{STAGE_LABELS[derivedStage(wo)]}</Chip>
                {wo.service_category ? <Chip>{tradeLabel(wo.service_category)}</Chip> : null}
                {wo.service_category ? (
                  <Chip>{categoryLabel(categoryForTrade(wo.service_category))}</Chip>
                ) : null}
                {wo.created_at ? (
                  <span className="text-[0.6875rem] text-muted-foreground">
                    Opened {usDate(wo.created_at as string)}
                  </span>
                ) : null}
              </div>

              <p className="font-medium">{nextAction(wo)}</p>
              <p className="text-xs text-muted-foreground">{verdict.reason}</p>

              <p className="numeric text-xs text-muted-foreground">
                Quote {money(wo.quote_amount as number | null)} · approved{" "}
                {money(wo.approved_amount as number | null)} · final{" "}
                {money(wo.final_cost as number | null)}
              </p>

              {wo.warranty_may_apply && !wo.warranty_override_reason ? (
                <p className="rounded-md border border-amber/25 bg-amber/10 px-2 py-1 text-xs">
                  Warranty may apply{wo.warranty_contact ? ` — ${wo.warranty_contact}` : ""}.
                  Confirm coverage first.
                </p>
              ) : null}

              {commitments.action ? (
                <p className="text-xs text-muted-foreground">{commitments.action}</p>
              ) : null}

              {advice.recommended ? (
                <p className="text-xs text-muted-foreground">{advice.reason}</p>
              ) : null}

              {blockers.length && !wo.closed_at ? (
                <p className="text-xs text-muted-foreground">Before closing: {blockers[0]}</p>
              ) : null}

              <Button size="sm" variant="outline" onClick={() => onOpenWorkOrderIdChange(wo.id)}>
                Open Work Order
              </Button>
            </div>
          );
        })}

        {readOnly || hasOpenOrder ? null : !open ? (
          <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
            {existing.length ? "Open another Work Order" : "Open a Work Order"}
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Phase</Label>
                <Select value={phase} onValueChange={(v) => setPhase(v as WorkOrderPhase)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">{PHASE_LABELS.permanent}</SelectItem>
                    <SelectItem value="mitigation">{PHASE_LABELS.mitigation}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Trade</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint guide="workOrder.trade" />
                {category ? (
                  <p className="text-[11px] text-muted-foreground">
                    Category: {categoryLabel(categoryForTrade(category))}
                  </p>
                ) : null}
              </div>
            </div>

            {phase === "mitigation" ? (
              <div className="space-y-1">
                <Label className="text-xs">What makes this an emergency?</Label>
                <Select value={emergency} onValueChange={(v) => setEmergency(v as EmergencyReason)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose the risk being contained" />
                  </SelectTrigger>
                  <SelectContent>
                    {EMERGENCY_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {EMERGENCY_REASON_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label className="text-xs" htmlFor="wo-scope">
                Scope of work
              </Label>
              <Textarea
                id="wo-scope"
                rows={2}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Replace the failed water heater expansion tank and test the shutoff."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs" htmlFor="wo-quote">
                Quote amount (leave blank if not quoted yet)
              </Label>
              <Input
                id="wo-quote"
                type="number"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
              />
            </div>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-sm font-medium">{draftVerdict.label}</p>
              <p className="text-xs text-muted-foreground">{draftVerdict.reason}</p>
              {draftHint.mayApply ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Warranty may apply — {draftHint.reason}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button
                disabled={create.isPending || blockedByEmergency}
                onClick={() => create.mutate()}
              >
                Open Work Order
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      <WorkOrderDrawer
        key={openWorkOrderId ?? "none"}
        workOrder={existing.find((wo) => wo.id === openWorkOrderId) ?? null}
        people={people}
        canEdit={canEdit}
        propertyName={propertyName}
        onClose={() => onOpenWorkOrderIdChange(null)}
      />
    </Card>
  );
}
