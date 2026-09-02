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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentUserId } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import { stateChip } from "@/lib/semantic";
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
  type WorkOrderLike,
  type WorkOrderPhase,
} from "@/lib/work-orders";

type TicketContext = {
  id: string;
  title: string;
  description?: string | null;
  property_id?: string | null;
  priority?: string | null;
  work_type?: string | null;
  is_demo?: boolean | null;
};

type WorkOrderRow = WorkOrderLike & {
  id: string;
  title: string;
  service_category: string | null;
  scope: string | null;
  warranty_contact: string | null;
};

const EMERGENCY_OPTIONS = Object.keys(EMERGENCY_REASON_LABELS) as EmergencyReason[];

const CATEGORIES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Appliance",
  "Roof",
  "Structural",
  "Handyman",
  "Furniture",
  "Other",
];

function bucketState(bucket: ReturnType<typeof workOrderBucket>) {
  if (bucket === "closed") return "done" as const;
  if (bucket === "needs_action") return "blocked" as const;
  if (bucket === "permanent_pending" || bucket === "evidence_missing") return "active" as const;
  return "waiting" as const;
}

export function TicketWorkOrderPanel({
  ticket,
  readOnly: forceReadOnly = false,
}: {
  ticket: TicketContext;
  /** Creation lives with the current work — history stays read-only. */
  readOnly?: boolean;
}) {
  const qc = useQueryClient();
  const userId = useCurrentUserId();
  const { can, readOnly: roleReadOnly } = useRole();
  const readOnly = roleReadOnly || forceReadOnly;
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<WorkOrderPhase>("permanent");
  const [category, setCategory] = useState("");
  const [scope, setScope] = useState("");
  const [emergency, setEmergency] = useState<EmergencyReason | "">("");
  const [quote, setQuote] = useState("");

  const orders = useQuery({
    queryKey: ["work-orders-for-ticket", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WorkOrderRow[];
    },
  });

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
          priority: ticket.priority ?? "p3",
          phase,
          emergency_reason: phase === "mitigation" ? emergency || null : null,
          quote_amount: quote ? Number(quote) : null,
          quote_received_at: quote ? new Date().toISOString() : null,
          authority_level: draftVerdict.level,
          approval_status: draftVerdict.ownerApprovalRequired ? "pending" : "not_required",
          approval_requested_at: draftVerdict.ownerApprovalRequired ? new Date().toISOString() : null,
          approval_requested_by: draftVerdict.ownerApprovalRequired ? userId : null,
          warranty_may_apply: draftHint.mayApply,
          warranty_kind: draftHint.kind,
          warranty_contact: draftHint.contact,
          permanent_repair_needed: phase === "mitigation",
          policy_version: MAINTENANCE_POLICY_VERSION,
          assigned_to: userId,
          created_by: userId,
          is_demo: ticket.is_demo ?? false,
        } as never)
        .select("id")
        .single();
      if (error) throw error;

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
    },
    onSuccess: () => {
      setOpen(false);
      setScope("");
      setQuote("");
      setEmergency("");
      qc.invalidateQueries({ queryKey: ["work-orders-for-ticket", ticket.id] });
      toast.success("Work order opened");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!can("claims_work")) return null;

  const existing = orders.data ?? [];
  const blockedByEmergency = phase === "mitigation" && !emergency;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send for repair</CardTitle>
        <CardDescription>
          The execution and cost record for this repair — authority, warranty and vendor commitments in one place.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {existing.map((wo) => {
          const verdict = evaluateAuthority(wo);
          const bucket = workOrderBucket(wo);
          const commitments = commitmentStatus(wo);
          const advice = secondQuoteAdvice(wo);
          const blockers = closureBlockers(wo);
          return (
            <div key={wo.id} className="space-y-2 rounded-md border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Chip className={stateChip(bucketState(bucket))}>{BUCKET_LABELS[bucket]}</Chip>
                <Chip>{PHASE_LABELS[wo.phase === "mitigation" ? "mitigation" : "permanent"]}</Chip>
                <Chip>{STAGE_LABELS[derivedStage(wo)]}</Chip>
                {wo.service_category ? <Chip>{wo.service_category}</Chip> : null}
              </div>

              <p className="font-medium">{nextAction(wo)}</p>
              <p className="text-xs text-muted-foreground">{verdict.reason}</p>

              <p className="text-xs text-muted-foreground">
                Quote {money(wo.quote_amount as number | null)} · approved{" "}
                {money(wo.approved_amount as number | null)} · final {money(wo.final_cost as number | null)}
              </p>

              {wo.warranty_may_apply && !wo.warranty_override_reason ? (
                <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs">
                  Warranty may apply{wo.warranty_contact ? ` — ${wo.warranty_contact}` : ""}. Confirm coverage before
                  committing to a paid repair.
                </p>
              ) : null}

              {commitments.action ? (
                <p className="text-xs text-muted-foreground">{commitments.action}</p>
              ) : null}

              {advice.recommended ? <p className="text-xs text-muted-foreground">{advice.reason}</p> : null}

              {blockers.length && !wo.closed_at ? (
                <p className="text-xs text-muted-foreground">Before closing: {blockers[0]}</p>
              ) : null}
            </div>
          );
        })}

        {readOnly ? null : !open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            {existing.length ? "Open another work order" : "Open a work order"}
          </Button>
        ) : (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Phase</Label>
                <Select value={phase} onValueChange={(v) => setPhase(v as WorkOrderPhase)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">{PHASE_LABELS.permanent}</SelectItem>
                    <SelectItem value="mitigation">{PHASE_LABELS.mitigation}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {phase === "mitigation" ? (
              <div className="space-y-1">
                <Label className="text-xs">What makes this an emergency?</Label>
                <Select value={emergency} onValueChange={(v) => setEmergency(v as EmergencyReason)}>
                  <SelectTrigger><SelectValue placeholder="Choose the risk being contained" /></SelectTrigger>
                  <SelectContent>
                    {EMERGENCY_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>{EMERGENCY_REASON_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label className="text-xs" htmlFor="wo-scope">Scope of work</Label>
              <Textarea
                id="wo-scope"
                rows={2}
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder="Replace the failed water heater expansion tank and test the shutoff."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs" htmlFor="wo-quote">Quote amount (leave blank if not quoted yet)</Label>
              <Input id="wo-quote" type="number" value={quote} onChange={(e) => setQuote(e.target.value)} />
            </div>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-sm font-medium">{draftVerdict.label}</p>
              <p className="text-xs text-muted-foreground">{draftVerdict.reason}</p>
              {draftHint.mayApply ? (
                <p className="mt-1 text-xs text-muted-foreground">Warranty may apply — {draftHint.reason}</p>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button disabled={create.isPending || blockedByEmergency} onClick={() => create.mutate()}>
                Open work order
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
