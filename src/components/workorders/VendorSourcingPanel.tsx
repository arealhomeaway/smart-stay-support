/**
 * Find a Vendor → scope & dispatch → Breezeway handoff → visits → invoice.
 * Acceptance, authorization, dispatch and completion stay separate facts.
 * Rules live in `src/lib/vendor-sourcing.ts`; the authority ladder is reused unchanged.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Circle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStaffDirectory } from "@/hooks/useTeam";
import { usDate } from "@/lib/dates";
import {
  CANDIDATE_STATUS_LABELS, CONTACT_CHANNELS, CONTACT_CHANNEL_LABELS, CONTACT_RESPONSES, CONTACT_RESPONSE_LABELS,
  HANDOFF_LABELS, TELEGRAM_STATUS_LABELS, VISIT_OUTCOMES, VISIT_OUTCOME_LABELS, authorizationState, breezewayPushEligibility, fourFacts,
  vendorChannels, visitNeedsFollowUp, type ContactChannel, type ContactResponse, type VisitOutcome, type DispatchWorkOrder,
} from "@/lib/vendor-sourcing";
import { pushWorkOrderToBreezeway, reconcileWorkOrderHandoff } from "@/lib/vendor-sourcing.functions";
import { LinkExistingExpense } from "@/components/finance/LinkExistingExpense";
import { consumeFindVendorFocus } from "@/lib/find-vendor-focus";

type VendorOrg = { id: string; display_name: string | null; legal_name: string | null; status: string; emergency_only: boolean | null; dispatch_method: string | null; breezeway_person_id: unknown; telegram_status: string | null };

function Fact({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-foreground" : "text-muted-foreground"}`}>
      {ok ? <Check className="size-3.5 text-primary" /> : <Circle className="size-3.5" />} {label}
    </span>
  );
}

export function VendorSourcingPanel({ workOrderId, readOnly, focusFindVendor = false }: { workOrderId: string; readOnly: boolean; focusFindVendor?: boolean }) {
  const qc = useQueryClient();
  const push = useServerFn(pushWorkOrderToBreezeway);
  const reconcile = useServerFn(reconcileWorkOrderHandoff);
  const findRef = useRef<HTMLDivElement>(null);
  const [focusRequested] = useState(() => focusFindVendor || consumeFindVendorFocus(workOrderId));
  const staff = useStaffDirectory();
  const key = ["vendor-sourcing", workOrderId];

  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [wo, cands, visits, vendors] = await Promise.all([
        supabase.from("work_orders").select("*").eq("id", workOrderId).single(),
        supabase.from("work_order_vendor_candidates").select("*, work_order_contact_attempts(*)").eq("work_order_id", workOrderId).order("created_at"),
        supabase.from("work_order_visits").select("*").eq("work_order_id", workOrderId).order("visit_date"),
        supabase.from("vendor_orgs").select("id, display_name, legal_name, status, emergency_only, dispatch_method, breezeway_person_id, telegram_status").neq("status", "suspended").order("display_name"),
      ]);
      if (wo.error) throw wo.error;
      return { wo: wo.data, cands: cands.data ?? [], visits: visits.data ?? [], vendors: (vendors.data ?? []) as VendorOrg[] };
    },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["expenses"] });
  };
  const run = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });
  const must = async <T,>(p: PromiseLike<{ error: { message: string } | null; data?: T | null }>) => {
    const r = await p;
    if (r.error) throw new Error(r.error.message);
    return r.data as T;
  };

  // Local form state
  const [pick, setPick] = useState("");
  const [choice, setChoice] = useState("primary");
  const [attempt, setAttempt] = useState<Record<string, { channel?: ContactChannel; response?: ContactResponse; note?: string; next?: string }>>({});
  const [scope, setScope] = useState<{ dispatch_reason?: string; guest_impact?: string; scope?: string; quote?: string }>({});
  const [visit, setVisit] = useState<{ outcome?: VisitOutcome; findings?: string; work_done?: string; date?: string; assignee?: string; due?: string }>({});

  const [release, setRelease] = useState("");
  const [recon, setRecon] = useState<{ ref?: string; note?: string }>({});
  const loaded = !!q.data;
  useEffect(() => {
    if (focusRequested && loaded) { findRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); findRef.current?.focus({ preventScroll: true }); }
  }, [focusRequested, loaded]);

  if (q.isLoading || !q.data) return <p className="text-sm text-muted-foreground">Loading vendor sourcing…</p>;
  const { cands, visits, vendors } = q.data;
  const wo = q.data.wo as typeof q.data.wo & DispatchWorkOrder;
  const vendorById = new Map(vendors.map((v) => [v.id, v]));
  const accepted = cands.find((c) => c.status === "accepted") ?? null;
  const acceptedVendor = accepted?.vendor_org_id ? vendorById.get(accepted.vendor_org_id) : null;
  const facts = fourFacts(wo, !!accepted);
  const auth = authorizationState(wo);
  const elig = breezewayPushEligibility({ wo, hasAcceptedVendor: !!accepted, vendorUsesBreezeway: vendorChannels(acceptedVendor).breezeway, handoffStatus: wo.breezeway_handoff_status });
  const name = (v: VendorOrg) => v.display_name ?? v.legal_name ?? "Vendor";

  return (
    <section className="space-y-4" aria-label="Find a Vendor">
      <div className="flex flex-wrap gap-3 rounded-md border border-border p-2">
        <Fact ok={facts.accepted} label="Vendor accepted" />
        <Fact ok={facts.authorized} label="Spending authorized" />
        <Fact ok={facts.dispatched} label="Dispatched" />
        <Fact ok={facts.completed} label="Completed" />
      </div>

      {/* 1. Find a Vendor ------------------------------------------------ */}
      <div className="space-y-2" id="find-a-vendor" ref={findRef} tabIndex={-1}>
        <h3 className="font-display text-sm font-semibold">Find a Vendor</h3>
        <p className="text-xs text-muted-foreground">Contacting a vendor is not acceptance. Record acceptance separately.</p>
        {cands.map((c) => {
          const v = c.vendor_org_id ? vendorById.get(c.vendor_org_id) : undefined;
          const ch = vendorChannels(v);
          const a = attempt[c.id] ?? {};
          const attempts = [...(c.work_order_contact_attempts ?? [])].sort((x, y) => x.attempted_at.localeCompare(y.attempted_at));
          return (
            <div key={c.id} className="space-y-2 rounded-md border border-border p-2 text-sm" data-testid="vendor-candidate">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.vendor_name}</span>
                <Badge variant="outline">{c.choice === "primary" ? "Primary" : c.choice === "backup" ? "Backup" : "Other"}</Badge>
                <Badge variant={c.status === "accepted" ? "default" : "secondary"}>{CANDIDATE_STATUS_LABELS[c.status]}</Badge>
                {ch.breezeway && <Badge variant="outline">Breezeway</Badge>}
                {v && <Badge variant="outline" data-testid="telegram-status">{TELEGRAM_STATUS_LABELS[ch.telegramStatus]}</Badge>}
                {v && !readOnly && ch.telegramStatus === "unknown" && (
                  <span className="inline-flex items-center gap-1 text-xs">
                    Uses Telegram?
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => run.mutate(() => must(supabase.rpc("confirm_vendor_telegram", { _org: v.id, _status: "yes" })))}>Yes</Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => run.mutate(() => must(supabase.rpc("confirm_vendor_telegram", { _org: v.id, _status: "no" })))}>No</Button>
                  </span>
                )}
                {v?.emergency_only && <Badge variant="outline">Emergency Only</Badge>}
                {c.next_follow_up_on && c.status !== "accepted" && <span className="text-xs text-muted-foreground">Follow up {usDate(c.next_follow_up_on)}</span>}
              </div>
              {attempts.length > 0 && (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {attempts.map((t) => (
                    <li key={t.id}>{usDate(t.attempted_at)} · {CONTACT_CHANNEL_LABELS[t.channel as ContactChannel]} · {CONTACT_RESPONSE_LABELS[t.response as ContactResponse]}{t.note ? ` — ${t.note}` : ""}</li>
                  ))}
                </ul>
              )}
              {!readOnly && c.status !== "accepted" && c.status !== "declined" && (
                <div className="grid gap-2 sm:grid-cols-4">
                  <Select value={a.channel ?? ""} onValueChange={(val) => setAttempt({ ...attempt, [c.id]: { ...a, channel: val as ContactChannel } })}>
                    <SelectTrigger aria-label="Contact channel"><SelectValue placeholder="Channel" /></SelectTrigger>
                    <SelectContent>{CONTACT_CHANNELS.map((x) => <SelectItem key={x} value={x}>{CONTACT_CHANNEL_LABELS[x]}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={a.response ?? ""} onValueChange={(val) => setAttempt({ ...attempt, [c.id]: { ...a, response: val as ContactResponse } })}>
                    <SelectTrigger aria-label="Response"><SelectValue placeholder="Response" /></SelectTrigger>
                    <SelectContent>{CONTACT_RESPONSES.map((x) => <SelectItem key={x} value={x}>{CONTACT_RESPONSE_LABELS[x]}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input type="date" aria-label="Next follow-up" value={a.next ?? ""} onChange={(e) => setAttempt({ ...attempt, [c.id]: { ...a, next: e.target.value } })} />
                  <Input placeholder="Note" aria-label="Attempt note" value={a.note ?? ""} onChange={(e) => setAttempt({ ...attempt, [c.id]: { ...a, note: e.target.value } })} />
                  <div className="flex gap-2 sm:col-span-4">
                    <Button size="sm" variant="outline" disabled={!a.channel || !a.response || run.isPending}
                      onClick={() => run.mutate(async () => {
                        await must(supabase.from("work_order_contact_attempts").insert({ candidate_id: c.id, channel: a.channel!, response: a.response!, note: a.note || null, next_follow_up_on: a.next || null }));
                        setAttempt({ ...attempt, [c.id]: {} });
                      })}>Log contact attempt</Button>
                    <Button size="sm" disabled={!!accepted || run.isPending}
                      onClick={() => run.mutate(async () => {
                        // The database moves the Work Order and Ticket to the accepted vendor
                        // and marks any approval given for a different vendor as stale.
                        await must(supabase.from("work_order_vendor_candidates").update({ status: "accepted" }).eq("id", c.id));
                        await must(supabase.from("work_orders").update({ vendor_acknowledged_at: new Date().toISOString() }).eq("id", workOrderId));
                      })}>Vendor accepted the work</Button>
                  </div>
                </div>
              )}
              {!readOnly && c.status === "accepted" && !wo.dispatched_at && (
                <Button size="sm" variant="ghost" onClick={() => run.mutate(() => must(supabase.from("work_order_vendor_candidates").update({ status: "withdrawn" }).eq("id", c.id)))}>Undo acceptance</Button>
              )}
              {!readOnly && c.status === "accepted" && wo.dispatched_at && !wo.vendor_completed_at && (
                <div className="flex flex-wrap gap-2">
                  <Input className="w-72" placeholder="Why replace this vendor? (required)" aria-label="Reason for replacing vendor" value={release} onChange={(e) => setRelease(e.target.value)} />
                  <Button size="sm" variant="outline" disabled={release.trim().length < 5 || run.isPending}
                    onClick={() => run.mutate(async () => {
                      await must(supabase.from("work_order_vendor_candidates").update({ status: "withdrawn", released_reason: release.trim() }).eq("id", c.id));
                      setRelease("");
                    })}>Replace this vendor</Button>
                </div>
              )}
            </div>
          );
        })}
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Select value={pick} onValueChange={setPick}>
              <SelectTrigger className="w-64" aria-label="Candidate vendor"><SelectValue placeholder="Add a candidate vendor" /></SelectTrigger>
              <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{name(v)}{v.emergency_only ? " (Emergency Only)" : ""}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger className="w-32" aria-label="Primary or backup"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="primary">Primary</SelectItem><SelectItem value="backup">Backup</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
            </Select>
            <Button size="sm" variant="outline" disabled={!pick || run.isPending}
              onClick={() => run.mutate(async () => {
                const v = vendorById.get(pick)!;
                await must(supabase.from("work_order_vendor_candidates").insert({ work_order_id: workOrderId, vendor_org_id: v.id, vendor_name: name(v), choice, is_demo: wo.is_demo }));
                setPick("");
              })}>Add candidate</Button>
          </div>
        )}
      </div>
      <Separator />

      {/* 2. Scope & dispatch -------------------------------------------- */}
      <div className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Scope & dispatch</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1"><Label className="text-xs">Dispatch reason</Label>
            <Input disabled={readOnly} value={scope.dispatch_reason ?? wo.dispatch_reason ?? ""} onChange={(e) => setScope({ ...scope, dispatch_reason: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Guest impact</Label>
            <Input disabled={readOnly} value={scope.guest_impact ?? wo.guest_impact ?? ""} onChange={(e) => setScope({ ...scope, guest_impact: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Expected work</Label>
            <Textarea disabled={readOnly} rows={2} value={scope.scope ?? wo.scope ?? ""} onChange={(e) => setScope({ ...scope, scope: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Estimate or quote ($)</Label>
            <Input disabled={readOnly} inputMode="decimal" value={scope.quote ?? (wo.quote_amount != null ? String(wo.quote_amount) : "")} onChange={(e) => setScope({ ...scope, quote: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs">Authorization</Label>
            <p className={`text-sm ${auth.stale ? "text-destructive" : ""}`} data-testid="auth-state">{auth.label}</p>
            {wo.authorized_at && <p className="text-xs text-muted-foreground">Approved for: {wo.authorized_scope ?? "—"} · up to ${wo.authorized_amount ?? "—"}</p>}
          </div>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={run.isPending || Object.keys(scope).length === 0}
              onClick={() => run.mutate(async () => {
                const quote = scope.quote !== undefined ? (scope.quote.trim() === "" ? null : Number(scope.quote)) : undefined;
                if (quote !== undefined && quote !== null && Number.isNaN(quote)) throw new Error("Enter the quote as a number");
                await must(supabase.from("work_orders").update({
                  ...(scope.dispatch_reason !== undefined ? { dispatch_reason: scope.dispatch_reason || null } : {}),
                  ...(scope.guest_impact !== undefined ? { guest_impact: scope.guest_impact || null } : {}),
                  ...(scope.scope !== undefined ? { scope: scope.scope || null } : {}),
                  ...(quote !== undefined ? { quote_amount: quote } : {}),
                }).eq("id", workOrderId));
                setScope({});
              })}>Save scope</Button>
            <Button size="sm" disabled={run.isPending || !!wo.dispatched_at || !accepted || !auth.satisfied}
              onClick={() => run.mutate(() => must(supabase.from("work_orders").update({ dispatched_at: new Date().toISOString(), vendor_contacted_at: wo.vendor_contacted_at ?? new Date().toISOString() }).eq("id", workOrderId)))}>
              {wo.dispatched_at ? `Dispatched ${usDate(wo.dispatched_at)}` : "Mark dispatched"}
            </Button>
          </div>
        )}
      </div>

      {/* 3. Breezeway handoff ------------------------------------------- */}
      <div className="space-y-2 rounded-md border border-border p-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Breezeway</span>
          <Badge variant={wo.breezeway_handoff_status === "failed" || wo.breezeway_handoff_status === "uncertain" ? "destructive" : "outline"} data-testid="handoff-status">
            {HANDOFF_LABELS[wo.breezeway_handoff_status]}
          </Badge>
          {wo.breezeway_task_ref && <span className="text-xs text-muted-foreground">Ref {wo.breezeway_task_ref}</span>}
        </div>
        {wo.breezeway_handoff_error && (
          <p className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3.5" />{wo.breezeway_handoff_error}</p>
        )}
        {!elig.allowed && wo.breezeway_handoff_status === "not_sent" && <p className="text-xs text-muted-foreground">{elig.reasons.join(" ")}</p>}
        {!readOnly && wo.breezeway_handoff_status === "uncertain" && (
          <div className="space-y-2 rounded-md border border-destructive/40 p-2 text-xs" data-testid="handoff-reconcile">
            <p>Breezeway may already have this task. Check Breezeway, then record what you found. Another create is blocked until then.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Breezeway task ID (if found)" aria-label="Breezeway task ID" value={recon.ref ?? ""} onChange={(e) => setRecon({ ...recon, ref: e.target.value })} />
              <Input placeholder="What you checked (required)" aria-label="Reconciliation note" value={recon.note ?? ""} onChange={(e) => setRecon({ ...recon, note: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={run.isPending || (recon.note ?? "").trim().length < 10 || !(recon.ref ?? "").trim()}
                onClick={() => run.mutate(async () => { await reconcile({ data: { workOrderId, outcome: "found", taskRef: recon.ref!.trim(), note: recon.note!.trim() } }); setRecon({}); })}>Task found in Breezeway</Button>
              <Button size="sm" variant="ghost" disabled={run.isPending || (recon.note ?? "").trim().length < 10}
                onClick={() => run.mutate(async () => { await reconcile({ data: { workOrderId, outcome: "not_created", note: recon.note!.trim() } }); setRecon({}); })}>No task exists — allow a new attempt</Button>
            </div>
          </div>
        )}
        {!readOnly && wo.breezeway_handoff_status !== "uncertain" && (
          <Button size="sm" variant="outline" disabled={run.isPending || (!elig.allowed && wo.breezeway_handoff_status !== "failed")}
            onClick={() => run.mutate(async () => { const r = await push({ data: { workOrderId } }); toast.message(r.message); })}>
            {wo.breezeway_handoff_status === "failed" ? "Retry Breezeway handoff" : "Push to Breezeway"}
          </Button>
        )}
      </div>
      <Separator />

      {/* 4. Visits ------------------------------------------------------ */}
      <div className="space-y-2">
        <h3 className="font-display text-sm font-semibold">Visits</h3>
        {visits.length === 0 && <p className="text-xs text-muted-foreground">No visits recorded yet.</p>}
        {visits.map((v, i) => (
          <div key={v.id} className="space-y-1 rounded-md border border-border p-2 text-sm" data-testid="visit">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Visit {i + 1}</span>
              <span className="text-muted-foreground">{usDate(v.visit_date)} · {v.vendor_name}</span>
              <Badge variant="secondary">{VISIT_OUTCOME_LABELS[v.outcome as VisitOutcome]}</Badge>
              {v.follow_up_work_item_id && <Badge variant="outline">Follow-up Task linked</Badge>}
            </div>
            {v.findings && <p className="text-xs">Findings: {v.findings}</p>}
            {v.work_done && <p className="text-xs">Work performed: {v.work_done}</p>}
            {!readOnly && (
              <Button size="sm" variant="ghost" disabled={run.isPending}
                onClick={() => run.mutate(async () => {
                  const exp = await must<{ id: string }>(supabase.from("expenses").insert({
                    expense_type: "vendor_service", property_id: wo.property_id, payee: v.vendor_name,
                    reason: wo.scope ?? wo.title, dispatch_reason: wo.dispatch_reason, visit_outcome: VISIT_OUTCOME_LABELS[v.outcome as VisitOutcome],
                    approval_id: wo.approval_id, authorization_note: wo.authorized_at ? `Covered by Work Order approval: ${wo.authorized_scope ?? ""} up to $${wo.authorized_amount ?? ""}` : null,
                    expense_date: v.visit_date, work_order_visit_id: v.id, is_demo: wo.is_demo,
                  }).select("id").single());
                  const links = [{ expense_id: exp.id, link_type: "work_order", target_id: wo.id }, ...(wo.ticket_id ? [{ expense_id: exp.id, link_type: "ticket", target_id: wo.ticket_id }] : [])];
                  await must(supabase.from("expense_links").insert(links));
                  toast.success("Invoice expense started below — add the amount and upload the invoice.");
                })}>Add invoice for this visit</Button>
            )}
            {!readOnly && (
              <LinkExistingExpense
                propertyId={wo.property_id} isDemo={wo.is_demo} payeeHint={v.vendor_name}
                linkType="work_order" targetId={wo.id} visitId={v.id} extraLinks={wo.ticket_id ? [{ link_type: "ticket", target_id: wo.ticket_id }] : []}
                onLinked={refresh}
              />
            )}
          </div>
        ))}
        {!readOnly && (
          <div className="grid gap-2 rounded-md border border-dashed border-border p-2 sm:grid-cols-2">
            <Select value={visit.outcome ?? ""} onValueChange={(val) => setVisit({ ...visit, outcome: val as VisitOutcome })}>
              <SelectTrigger aria-label="Visit outcome"><SelectValue placeholder="Visit outcome (required)" /></SelectTrigger>
              <SelectContent>{VISIT_OUTCOMES.map((o) => <SelectItem key={o} value={o}>{VISIT_OUTCOME_LABELS[o]}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" aria-label="Visit date" value={visit.date ?? ""} onChange={(e) => setVisit({ ...visit, date: e.target.value })} />
            <Textarea rows={2} placeholder="Findings" aria-label="Findings" value={visit.findings ?? ""} onChange={(e) => setVisit({ ...visit, findings: e.target.value })} />
            <Textarea rows={2} placeholder="Work performed" aria-label="Work performed" value={visit.work_done ?? ""} onChange={(e) => setVisit({ ...visit, work_done: e.target.value })} />
            {visit.outcome && visitNeedsFollowUp(visit.outcome) && (
              <>
                <Select value={visit.assignee ?? ""} onValueChange={(val) => setVisit({ ...visit, assignee: val })}>
                  <SelectTrigger aria-label="Follow-up assignee"><SelectValue placeholder="Follow-up assignee" /></SelectTrigger>
                  <SelectContent>{(staff.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.email ?? "Teammate"}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" aria-label="Follow-up due date" value={visit.due ?? ""} onChange={(e) => setVisit({ ...visit, due: e.target.value })} />
              </>
            )}
            <Button size="sm" className="sm:col-span-2 justify-self-start"
              disabled={run.isPending || !visit.outcome || !accepted || (visitNeedsFollowUp(visit.outcome) && (!visit.assignee || !visit.due))}
              onClick={() => run.mutate(async () => {
                const row = await must<{ id: string }>(supabase.from("work_order_visits").insert({
                  work_order_id: workOrderId, candidate_id: accepted!.id, vendor_name: accepted!.vendor_name,
                  visit_date: visit.date || new Date().toISOString().slice(0, 10), outcome: visit.outcome!,
                  findings: visit.findings || null, work_done: visit.work_done || null, is_demo: wo.is_demo,
                }).select("id").single());
                if (visitNeedsFollowUp(visit.outcome!)) {
                  const wi = await must<{ id: string }>(supabase.from("work_items").insert({
                    department: "operations", source_department: "operations", kind: "task", source: "arha",
                    property_id: wo.property_id, source_table: "work_order_visits", source_id: row.id,
                    title: `Follow up: ${VISIT_OUTCOME_LABELS[visit.outcome!]} — ${wo.title ?? "Work Order"}`,
                    assigned_to: visit.assignee!, due_on: visit.due!, status: "open", is_demo: wo.is_demo,
                  }).select("id").single());
                  await must(supabase.from("work_order_visits").update({ follow_up_work_item_id: wi.id }).eq("id", row.id));
                }
                if (visit.outcome === "resolved" || visit.outcome === "no_issue_found") {
                  await must(supabase.from("work_orders").update({ vendor_completed_at: new Date().toISOString() }).eq("id", workOrderId));
                }
                setVisit({});
              })}>Record visit</Button>
            {!accepted && <p className="text-xs text-muted-foreground sm:col-span-2">Record which vendor accepted before logging a visit.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
