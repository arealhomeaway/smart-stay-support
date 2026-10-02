/**
 * Guided Ticket — "What do you need to do now?"
 *
 * Presentation over the canonical Ticket. Stage and next step come from the
 * pure `ticketGuidance`; this panel only records the few decisions it owns
 * (guest update, resolution path, troubleshooting answers, chosen vendor).
 * Statuses, SLA clocks, closure gates and the Work Order engine are untouched.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { VendorDirectory } from "@/components/vendors/VendorDirectory";
import { NoEligibleVendor } from "@/components/tickets/NoEligibleVendor";
import { useRole } from "@/hooks/useRole";
import { vendorMarketFor } from "@/lib/vendor-market";
import { guideKeyFor } from "@/lib/troubleshooting-match";
import { allowedEmergencyBases, EMERGENCY_BASIS_LABELS, type EmergencyBasis } from "@/lib/emergency-vendor";
import { errorText } from "@/components/vendors/useVendorWorkspace";
import { usDate, usDateTime } from "@/lib/dates";
import {
  GUIDANCE_STAGE_LABELS,
  RESOLUTION_OPTIONS,
  activeGuestStay,
  ticketGuidance,
  type ResolutionPath,
} from "@/lib/ticket-guidance";

export type GuidedTicket = {
  id: string;
  status: string;
  priority?: string | null;
  category: string | null;
  title?: string | null;
  description?: string | null;
  acknowledged_at: string | null;
  guest_in_residence: boolean | null;
  reservation_guest_name: string | null;
  reservation_channel: string | null;
  reservation_confirmation: string | null;
  reservation_arrival: string | null;
  reservation_departure: string | null;
  reservation_guest_count: number | null;
  guest_update_at: string | null;
  guest_update_note: string | null;
  next_guest_update_at: string | null;
  resolution_path: string | null;
  resolution_notes: string | null;
  waiting_on: string | null;
  waiting_reason: string | null;
  next_review_at: string | null;
  selected_vendor_org_id: string | null;
  guest_confirmed: boolean | null;
  /** Active-stay update cadence from src/lib/guest-impact.ts. */
  active_stay?: boolean;
};

const NEXT_UPDATE = [
  { label: "In 1 hour", hours: 1 },
  { label: "In 2 hours", hours: 2 },
  { label: "In 4 hours", hours: 4 },
  { label: "Tomorrow morning", hours: -1 },
  { label: "No further update needed", hours: 0 },
];

function nextUpdateAt(hours: number): string | null {
  if (hours === 0) return null;
  const d = new Date();
  if (hours === -1) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else d.setHours(d.getHours() + hours);
  return d.toISOString();
}

export function GuidedTicketPanel({
  ticket,
  closed,
  market,
  openWorkOrders,
  completeWorkOrders,
  requiredOpenSteps,
  missingEvidence,
  readOnly,
  log,
  onChanged,
  workOrderPanel,
  children,
  onLeadChange,
  vendorFollowUp = null,
  openWorkOrderPanel,
  onVendorChosenForWorkOrder,
}: {
  ticket: GuidedTicket;
  closed: boolean;
  market: string | null;
  openWorkOrders: number;
  completeWorkOrders: number;
  requiredOpenSteps: number;
  missingEvidence: boolean;
  readOnly: boolean;
  log: (kind: string, body: string, eventType?: string) => Promise<void>;
  onChanged: () => void | Promise<void>;
  /** Existing Work Order create panel, pre-filled with the chosen vendor. */
  workOrderPanel: (vendor: { id: string; name: string; categories?: string[] }) => ReactNode;
  /** The existing Current Action card — shown when no guided step leads. */
  children?: ReactNode;
  /** Tells the page when a guided step leads, so older stage blocks step aside. */
  onLeadChange?: (leads: boolean) => void;
  /** A genuine vendor commitment miss from the Work Order rules, if any. */
  vendorFollowUp?: string | null;
  /** The existing Work Order list, shown inside the one Waiting on Vendor state. */
  openWorkOrderPanel?: ReactNode;
  /**
   * When an open Work Order exists, a different vendor is only a candidate:
   * it is added to the Work Order's Find a Vendor, where it must explicitly accept
   * and authorization is re-checked. Never a direct swap.
   */
  onVendorChosenForWorkOrder?: ((vendor: { id: string; name: string }) => Promise<void>) | undefined;
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [nextHours, setNextHours] = useState(2);
  const [changingVendor, setChangingVendor] = useState(false);

  const guideKey = guideKeyFor(`${ticket.title ?? ""} ${ticket.description ?? ""}`, ticket.category);
  const guide = useQuery({
    queryKey: ["ticket-troubleshooting", ticket.id, guideKey],
    enabled: ticket.resolution_path === "guest",
    queryFn: async () => {
      const g = await supabase
        .from("troubleshooting_guides")
        .select("id, title")
        .eq("category", guideKey ?? "__none")
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (g.error) throw g.error;
      if (!g.data) return { guide: null, steps: [], answers: [] };
      const [steps, answers] = await Promise.all([
        supabase.from("troubleshooting_guide_steps").select("id, position, prompt, help").eq("guide_id", g.data.id).order("position"),
        supabase.from("ticket_troubleshooting_answers").select("step_id, outcome, answered_at").eq("ticket_id", ticket.id).order("answered_at"),
      ]);
      if (steps.error) throw steps.error;
      if (answers.error) throw answers.error;
      return { guide: g.data, steps: steps.data ?? [], answers: answers.data ?? [] };
    },
  });

  const vendor = useQuery({
    queryKey: ["ticket-selected-vendor", ticket.selected_vendor_org_id],
    enabled: Boolean(ticket.selected_vendor_org_id),
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_orgs")
        .select("id, display_name, service_categories")
        .eq("id", ticket.selected_vendor_org_id!)
        .maybeSingle();
      return data ? { id: data.id, name: data.display_name, categories: (data.service_categories ?? []) as string[] } : null;
    },
  });

  const ts = guide.data;
  const answered = new Set((ts?.answers ?? []).map((a) => a.step_id));
  const troubleshooting = ts
    ? {
        total: ts.steps.length,
        answered: ts.steps.filter((s) => answered.has(s.id)).length,
        fixed: ts.answers.some((a) => a.outcome === "fixed"),
        notFixed: false,
      }
    : null;

  const g = ticketGuidance({
    ...ticket,
    closed,
    troubleshooting,
    openWorkOrders,
    completeWorkOrders,
    requiredOpenSteps,
    missingEvidence,
  });
  const stay = activeGuestStay(ticket);
  const hasReservation = Boolean(ticket.reservation_arrival || ticket.reservation_guest_name);

  const { isSupervisor } = useRole();
  const [emergencyPick, setEmergencyPick] = useState<{ id: string; name: string } | null>(null);
  const [emergencyBasis, setEmergencyBasis] = useState<EmergencyBasis | null>(null);
  const [emergencyReason, setEmergencyReason] = useState("");
  const save = useMutation({
    mutationFn: async ({ patch, history, guestUpdate }: { patch: Record<string, unknown>; history: string; guestUpdate?: boolean }) => {
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("tickets").update(patch as never).eq("id", ticket.id);
        if (error) throw error;
      }
      if (guestUpdate) await log("communication", history, "guest_update");
      else await log("note", history);
    },
    onSuccess: async () => {
      setNote("");
      setChangingVendor(false);
      await onChanged();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const hasOpenWorkOrder = openWorkOrders > 0 && !!onVendorChosenForWorkOrder;
  const chooseVendor = (patch: Record<string, unknown>, history: string, v: { id: string; name: string }) =>
    save.mutate(
      {
        // With an open Work Order the Ticket keeps its current vendor until the new one accepts
        // (the database then moves both). Emergency Only basis is still recorded on the Ticket.
        patch: hasOpenWorkOrder && !("emergency_vendor_reason" in patch) ? {} : patch,
        history: hasOpenWorkOrder ? `${history} Added to the open Work Order as a candidate — it must accept before it replaces the current vendor.` : history },
      { onSuccess: () => { if (hasOpenWorkOrder) void onVendorChosenForWorkOrder!(v).catch((e) => toast.error(errorText(e))); } },
    );

  const answer = useMutation({
    mutationFn: async ({ stepId, outcome, prompt }: { stepId: string; outcome: "fixed" | "not_fixed" | "skipped"; prompt: string }) => {
      const { error } = await supabase.from("ticket_troubleshooting_answers").insert({ ticket_id: ticket.id, step_id: stepId, outcome });
      if (error) throw error;
      await log("note", `Troubleshooting — "${prompt}": ${outcome === "fixed" ? "fixed it" : outcome === "not_fixed" ? "not fixed" : "skipped"}.`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ticket-troubleshooting", ticket.id] });
      await onChanged();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const choosePath = (path: ResolutionPath) => {
    const label = RESOLUTION_OPTIONS.find((o) => o.value === path)?.label ?? path;
    const patch: Record<string, unknown> = { resolution_path: path, resolution_path_at: new Date().toISOString() };
    if (path === "escalate") {
      patch["waiting_on"] = "internal_team";
      patch["waiting_reason"] = "Escalated to a supervisor for a decision.";
    }
    save.mutate({ patch, history: `Resolution path: ${label}.` });
  };

  const sendSomeone = () =>
    save.mutate({
      patch: { resolution_path: "field", resolution_path_at: new Date().toISOString() },
      history: "Still not fixed after troubleshooting — sending someone to the property.",
    });

  // Field path, vendor chosen, no Work Order yet: the one next step is to open it.
  const needsWorkOrder =
    !closed &&
    ticket.resolution_path === "field" &&
    Boolean(ticket.selected_vendor_org_id) &&
    openWorkOrders + completeWorkOrders === 0 &&
    !ticket.waiting_on &&
    !changingVendor;

  const guidedStep = changingVendor ? "choose_vendor" : g.step;
  const nextStep = ts?.steps.find((s) => !answered.has(s.id)) ?? null;
  const waitingOnVendor = !closed && !guidedStep && !needsWorkOrder && openWorkOrders > 0 && !ticket.waiting_on;
  const leads = (!closed && !readOnly && Boolean(guidedStep || needsWorkOrder)) || waitingOnVendor;
  useEffect(() => onLeadChange?.(leads), [leads, onLeadChange]);

  return (
    <div className="space-y-3">
      {!closed && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Once the page's own closure list is in charge, its count is the one shown. */}
          {g.stage !== "ready_to_close" && (
            <StatusBadge tone={waitingOnVendor && vendorFollowUp ? "escalated" : g.stage === "waiting" ? "waiting" : "progress"}>
              {waitingOnVendor
                ? vendorFollowUp
                  ? "Follow up with vendor"
                  : "Waiting on Vendor"
                : g.step === "guest_update"
                  ? "Guest Update Due"
                  : GUIDANCE_STAGE_LABELS[g.stage]}
            </StatusBadge>
          )}
          {/* Guest details live once, in the Current guest / reservation card. */}
          {hasReservation && stay && <StatusBadge tone="escalated">Affects active stay</StatusBadge>}
          {ticket.guest_update_at && (
            <span className="text-xs text-muted-foreground">
              Guest last updated {usDateTime(ticket.guest_update_at)}
              {ticket.next_guest_update_at ? ` · next update due ${usDateTime(ticket.next_guest_update_at)}` : ""}
            </span>
          )}
        </div>
      )}

      {!closed && !readOnly && (guidedStep || needsWorkOrder) ? (
        <section className="rounded-xl border-2 border-primary/40 bg-card p-4" aria-label="Next action">
          <p className="eyebrow text-muted-foreground">Next action</p>

          {needsWorkOrder && vendor.data && (
            <div className="mt-1 space-y-3">
              <h3 className="text-lg font-semibold">Open the Work Order for {vendor.data.name}</h3>
              <p className="text-sm text-muted-foreground">
                The vendor is recorded on the Work Order. Nothing is sent to them automatically — contact them as you do today.
              </p>
              {workOrderPanel(vendor.data)}
              <Button variant="ghost" size="sm" onClick={() => setChangingVendor(true)}>Choose a different vendor</Button>
            </div>
          )}

          {!needsWorkOrder && guidedStep === "guest_update" && (
            <div className="mt-1 space-y-3">
              <h3 className="text-lg font-semibold">{g.title}</h3>
              <p className="text-sm text-muted-foreground">{g.body}</p>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you tell the guest?" aria-label="What did you tell the guest?" />
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Next guest update">
                {NEXT_UPDATE.map((o) => (
                  <button key={o.label} type="button" onClick={() => setNextHours(o.hours)}>
                    <Chip className={nextHours === o.hours ? "border-primary" : undefined}>{o.label}</Chip>
                  </button>
                ))}
              </div>
              <Button
                disabled={note.trim().length < 5 || save.isPending}
                onClick={() =>
                  save.mutate({
                    patch: { guest_update_at: new Date().toISOString(), guest_update_note: note.trim(), next_guest_update_at: nextUpdateAt(nextHours) },
                    history: `Guest updated — ${note.trim()}`,
                    guestUpdate: true,
                  })
                }
              >
                Save Guest Update & Continue
              </Button>
            </div>
          )}

          {!needsWorkOrder && guidedStep === "decide" && (
            <div className="mt-1 space-y-3">
              <h3 className="text-lg font-semibold">{g.title}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {RESOLUTION_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    disabled={save.isPending}
                    onClick={() => choosePath(o.value)}
                    className="rounded-lg border border-border p-3 text-left transition-colors hover:border-primary"
                  >
                    <span className="block font-medium">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.help}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!needsWorkOrder && guidedStep === "troubleshoot" && (
            <div className="mt-1 space-y-3">
              <h3 className="text-lg font-semibold">{g.title}</h3>
              {!ts?.guide ? (
                <p className="text-sm text-muted-foreground">
                  No guided troubleshooting is available for this issue yet.
                </p>
              ) : nextStep ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Step {ts.steps.indexOf(nextStep) + 1} of {ts.steps.length} · {ts.guide.title}
                  </p>
                  <p className="font-medium">{nextStep.prompt}</p>
                  {nextStep.help && <p className="text-sm text-muted-foreground">{nextStep.help}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" disabled={answer.isPending} onClick={() => answer.mutate({ stepId: nextStep.id, outcome: "fixed", prompt: nextStep.prompt })}>That fixed it</Button>
                    <Button size="sm" variant="outline" disabled={answer.isPending} onClick={() => answer.mutate({ stepId: nextStep.id, outcome: "not_fixed", prompt: nextStep.prompt })}>Not fixed — next step</Button>
                    <Button size="sm" variant="ghost" disabled={answer.isPending} onClick={() => answer.mutate({ stepId: nextStep.id, outcome: "skipped", prompt: nextStep.prompt })}>Skip</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">All troubleshooting steps are done. If it is still not working, send someone.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={sendSomeone} disabled={save.isPending}>
                  {ts?.guide ? "Still not fixed — send someone" : "Send someone"}
                </Button>
                {!ts?.guide && (
                  <Button variant="outline" onClick={() => choosePath("escalate")} disabled={save.isPending}>Escalate</Button>
                )}
                {ts?.guide && !nextStep && (
                  <Button variant="ghost" onClick={() => choosePath("already_resolved")} disabled={save.isPending}>It's fixed</Button>
                )}
              </div>
            </div>
          )}

          {!needsWorkOrder && guidedStep === "choose_vendor" && (
            <div className="mt-1 space-y-3">
              <h3 className="text-lg font-semibold">Choose who should handle this</h3>
              <p className="text-sm text-muted-foreground">
                Showing vendors for this property's market. Only vendors who can take new work can be chosen.
              </p>
              <VendorDirectory
                initialMarket={vendorMarketFor(market)}
                initialCategory={ticket.category === "access" ? "Locksmith / Access" : null}
                selectedId={ticket.selected_vendor_org_id}
                noEligible={(ctx) => (
                  <NoEligibleVendor
                    ticketId={ticket.id}
                    market={ctx.market}
                    category={ctx.category}
                    onEscalate={() => choosePath("escalate")}
                    escalating={save.isPending}
                  />
                )}
                ticketPriority={ticket.priority ?? null}
                canOverrideEmergency={isSupervisor}
                onSelect={(v) => {
                  if (v.emergency_only && ticket.priority !== "p1") {
                    setEmergencyPick({ id: v.id, name: v.display_name });
                    setEmergencyBasis(allowedEmergencyBases(ticket.priority, isSupervisor)[0] ?? null);
                    setEmergencyReason("");
                    return;
                  }
                  chooseVendor(
                    { selected_vendor_org_id: v.id },
                    v.emergency_only
                      ? `Emergency Only vendor chosen on a P1 Ticket: ${v.display_name}.`
                      : `Vendor chosen from the Directory: ${v.display_name}.`,
                    { id: v.id, name: v.display_name },
                  );
                }}
              />
              {emergencyPick && (
                <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                  <p className="font-semibold">Use Emergency Only vendor {emergencyPick.name}?</p>
                  {allowedEmergencyBases(ticket.priority, isSupervisor).length === 0 ? (
                    <p className="text-muted-foreground">A Supervisor override is required to use an Emergency Only vendor on this Ticket.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {allowedEmergencyBases(ticket.priority, isSupervisor).map((b) => (
                          <Button key={b} size="sm" variant={emergencyBasis === b ? "default" : "outline"} onClick={() => setEmergencyBasis(b)}>
                            {EMERGENCY_BASIS_LABELS[b]}
                          </Button>
                        ))}
                      </div>
                      <Textarea value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} placeholder="Why is an Emergency Only vendor needed? (at least 10 characters)" aria-label="Reason for Emergency Only vendor" />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!emergencyBasis || emergencyReason.trim().length < 10 || save.isPending}
                          onClick={() => {
                            chooseVendor(
                              { selected_vendor_org_id: emergencyPick.id, emergency_vendor_basis: emergencyBasis, emergency_vendor_reason: emergencyReason.trim() },
                              `Emergency Only vendor chosen: ${emergencyPick.name}. Basis: ${EMERGENCY_BASIS_LABELS[emergencyBasis!]}. Reason: ${emergencyReason.trim()}`,
                              { id: emergencyPick.id, name: emergencyPick.name },
                            );
                            setEmergencyPick(null);
                          }}
                        >
                          Use this vendor
                        </Button>
                      </div>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEmergencyPick(null)}>Cancel</Button>
                </div>
              )}
              {changingVendor && <Button variant="ghost" size="sm" onClick={() => setChangingVendor(false)}>Keep the current vendor</Button>}
            </div>
          )}
        </section>
      ) : waitingOnVendor ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Waiting on Vendor">
          <h3 className="text-lg font-semibold">Waiting on Vendor</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">What we are waiting for</dt>
              <dd>{vendor.data?.name ?? "The vendor"} to finish the repair on the open Work Order.</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Next expected action</dt>
              <dd>{vendorFollowUp ?? "When the vendor reports it done, confirm the fix with the guest."}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Next guest update due</dt>
              <dd>
                {!stay
                  ? "No active-stay updates on this Ticket"
                  : ticket.next_guest_update_at
                    ? usDateTime(ticket.next_guest_update_at)
                    : "Not scheduled"}
              </dd>
            </div>
          </dl>
          {openWorkOrderPanel}
          {!readOnly && onVendorChosenForWorkOrder && (
            <Button variant="ghost" size="sm" onClick={() => setChangingVendor(true)}>Choose a different vendor</Button>
          )}
        </section>
      ) : (
        children
      )}

      {/* Waiting and closing are shown once, by the page's own Current Action and
          "Before this ticket can close" list — never repeated here with different counts. */}
      {!closed && g.waiting?.guestUpdateDue && !ticket.guest_update_at && (
        <p className="text-sm text-muted-foreground">Next guest update due {usDateTime(g.waiting.guestUpdateDue)}</p>
      )}
    </div>
  );
}
