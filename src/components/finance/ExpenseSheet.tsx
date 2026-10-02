import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { usDate } from "@/lib/dates";
import {
  EXPENSE_TYPE_LABEL,
  FINANCE_REVIEW_LABEL,
  LINK_LABEL,
  QB_REFERENCE_NOTE,
  RESERVATION_LINK_LABEL,
  RESPONSIBILITIES,
  RESPONSIBILITY_LABEL,
  SPLIT_PARTIES,
  authorizationNeed,
  canCreateExpense,
  expenseAgeDays,
  reservationBlocks,
  type AuthorizationContext,
  missingDocumentation,
  money,
  recoverySummary,
  splitReconciles,
  type ExpenseType,
  type LinkType,
  type ReservationLink,
  type Responsibility,
  type SplitLine,
} from "@/lib/expenses";
import { ExpenseChips, type ExpenseRow } from "./ExpenseList";
import { useFinanceAccess } from "./useFinanceAccess";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const todayChicago = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

function errText(e: unknown) {
  return e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Something went wrong.";
}

export type NewExpenseSpec = { propertyId: string | null; isDemo: boolean; linkType?: LinkType | undefined; targetId?: string | undefined };

/** Draft form: nothing is saved until "Save expense" with minimum meaningful information. */
export function NewExpenseSheet({ open, spec, onClose, onCreated }: { open: boolean; spec: NewExpenseSpec; onClose: () => void; onCreated: (id: string) => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New expense</SheetTitle>
          <SheetDescription>Nothing is saved until you press Save expense. You can save an incomplete record and finish it later.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">{open && <NewExpenseForm spec={spec} onCreated={onCreated} onCancel={onClose} />}</div>
      </SheetContent>
    </Sheet>
  );
}

function NewExpenseForm({ spec, onCreated, onCancel }: { spec: NewExpenseSpec; onCreated: (id: string) => void; onCancel: () => void }) {
  const access = useFinanceAccess();
  const [type, setType] = useState<ExpenseType>("vendor_service");
  const [propertyId, setPropertyId] = useState<string | null>(spec.propertyId);
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [saving, setSaving] = useState(false);
  const amt = amount === "" ? null : Number(amount);
  const ok = canCreateExpense({ payee, property_id: propertyId, amount: amt, reason });
  async function save() {
    setSaving(true);
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        expense_type: type, property_id: propertyId, payee: payee.trim() || null, amount: amt,
        expense_date: date || null, reason: reason.trim() || null, vendor_invoice_ref: invoiceRef.trim() || null,
        is_demo: spec.isDemo, created_by: access.userId,
      })
      .select("id")
      .single();
    if (error) { setSaving(false); toast.error(errText(error)); return; }
    if (spec.linkType && spec.targetId) {
      const l = await supabase.from("expense_links").insert({ expense_id: data.id, link_type: spec.linkType, target_id: spec.targetId });
      if (l.error) toast.error(errText(l.error));
    }
    toast.success("Expense saved.");
    onCreated(data.id);
  }
  return (
    <div className="space-y-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Type</Label>
          <select className={sel} value={type} onChange={(x) => setType(x.target.value as ExpenseType)}>
            {(Object.keys(EXPENSE_TYPE_LABEL) as ExpenseType[]).map((t) => <option key={t} value={t}>{EXPENSE_TYPE_LABEL[t]}</option>)}
          </select>
        </div>
        <PropertyPicker isDemo={spec.isDemo} value={propertyId} onChange={setPropertyId} />
        <div><Label htmlFor="new-payee">Payee</Label><Input id="new-payee" value={payee} onChange={(x) => setPayee(x.target.value)} /></div>
        <div><Label htmlFor="new-amount">Amount</Label><Input id="new-amount" type="number" step="0.01" value={amount} onChange={(x) => setAmount(x.target.value)} /></div>
        <div><Label htmlFor="new-date">Expense / service date</Label><Input id="new-date" type="date" value={date} onChange={(x) => setDate(x.target.value)} /></div>
        <div><Label htmlFor="new-ref">Vendor invoice number</Label><Input id="new-ref" value={invoiceRef} onChange={(x) => setInvoiceRef(x.target.value)} /></div>
      </div>
      <div><Label htmlFor="new-reason">Reason</Label><Textarea id="new-reason" rows={2} value={reason} onChange={(x) => setReason(x.target.value)} /></div>
      <p className="text-xs text-muted-foreground">To save, enter a payee or a home, and an amount or a reason. Files, links and the remaining details can be added after saving.</p>
      <div className="flex gap-2">
        <Button size="sm" disabled={!ok || saving} onClick={() => void save()}>Save expense</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export function ExpenseSheet({ expenseId, onClose }: { expenseId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!expenseId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Expense</SheetTitle>
          <SheetDescription>
            Facts and documents from Operations, Finance review and history. QuickBooks stays the accounting record and OwnerRez the statement record.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">{expenseId && <ExpensePanel expenseId={expenseId} />}</div>
      </SheetContent>
    </Sheet>
  );
}

type Full = ExpenseRow & Record<string, unknown> & {
  vendor_invoice_ref: string | null;
  owner_notified_at: string | null;
  owner_notification_note: string | null;
  ownerrez_booking_id: string | null;
  recommended_responsibility: Responsibility | null;
  ops_recommendation_note: string | null;
  split_allocations: SplitLine[];
  finance_treatment_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  qb_reference_manual: string | null;
  leadership_required: boolean;
  leadership_reason: string | null;
  leadership_assignee: string | null;
  leadership_decision: string | null;
  leadership_decided_by: string | null;
  leadership_decided_at: string | null;
  is_demo: boolean;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
  created_by: string | null;
};

export function ExpensePanel({ expenseId }: { expenseId: string }) {
  const qc = useQueryClient();
  const access = useFinanceAccess();
  const q = useQuery({
    queryKey: ["expense", expenseId],
    queryFn: async () => {
      const [e, links, recs, events, clar, docs, staff, dirSeat] = await Promise.all([
        supabase.from("expenses").select("*, properties(name)").eq("id", expenseId).maybeSingle(),
        supabase.from("expense_links").select("id, link_type, target_id").eq("expense_id", expenseId),
        supabase.from("expense_recoveries").select("*").eq("expense_id", expenseId).order("created_at"),
        supabase.from("expense_events").select("*").eq("expense_id", expenseId).order("created_at", { ascending: false }),
        supabase.from("work_items").select("id, title, status, assigned_to, due_on, created_at").eq("source_table", "expenses").eq("source_id", expenseId).order("created_at"),
        supabase.from("documents").select("id, title, kind, upload_status").eq("entity_type", "expense").eq("entity_id", expenseId).is("deleted_at", null).is("archived_at", null),
        supabase.from("user_roles").select("user_id, role, profiles:user_id(full_name)").in("role", ["admin", "manager", "tech"]),
        supabase.from("functional_roles").select("current_seat_holder").eq("code", "director_ops").maybeSingle(),
      ]);
      // Leadership who can record a decision: administrators and the Director of Operations seat (mirrors is_director).
      const leaders = new Set<string>();
      for (const r of (staff.data ?? []) as unknown as { user_id: string; role: string }[]) if (r.role === "admin") leaders.add(r.user_id);
      if (dirSeat.data?.current_seat_holder) leaders.add(dirSeat.data.current_seat_holder);
      const woIds = (links.data ?? []).filter((l) => l.link_type === "work_order").map((l) => l.target_id);
      let wo: AuthorizationContext = null;
      if (woIds.length) {
        const { data: w } = await supabase.from("work_orders").select("phase, emergency_reason, contractual_exception, approval_status, supervisor_approval_status").in("id", woIds).limit(1);
        wo = ((w ?? [])[0] as AuthorizationContext) ?? null;
      }
      if (e.error) throw e.error;
      const people = new Map<string, string>();
      for (const r of (staff.data ?? []) as unknown as { user_id: string; profiles: { full_name: string | null } | null }[])
        if (r.profiles?.full_name) people.set(r.user_id, r.profiles.full_name);
      return {
        e: e.data as unknown as Full | null,
        links: links.data ?? [],
        recs: recs.data ?? [],
        events: events.data ?? [],
        clar: clar.data ?? [],
        docs: docs.data ?? [],
        people,
        leaders,
        wo,
      };
    },
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["expense", expenseId] });
    void qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  const e = q.data?.e;
  const [draft, setDraft] = useState<Partial<Full>>({});
  const [reason, setReason] = useState("");
  useEffect(() => setDraft({}), [expenseId, e?.id]);
  const v = useMemo(() => ({ ...(e ?? {}), ...draft }) as Full, [e, draft]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!e) return <p className="text-sm text-muted-foreground">This expense could not be found.</p>;
  const data = q.data!;
  const name = (id: string | null | undefined) => (id ? (data.people.get(id) ?? "Team member") : "—");
  const reviewed = e.finance_review === "reviewed";
  const missing = missingDocumentation(v, data.wo);
  const auth = authorizationNeed(v, data.wo);
  const archived = !!e.archived_at;
  const dirty = Object.keys(draft).length > 0;

  async function update(patch: Record<string, unknown>, msg: string) {
    const { error } = await supabase.from("expenses").update(patch as never).eq("id", expenseId);
    if (error) { toast.error(errText(error)); return; }
    toast.success(msg);
    setDraft({});
    setReason("");
    refresh();
  }
  const set = <K extends keyof Full>(k: K, val: Full[K]) => setDraft((d) => ({ ...d, [k]: val }));
  const txt = (k: keyof Full) => (v[k] as string | null) ?? "";

  const saveFacts = () => {
    const patch: Record<string, unknown> = { ...draft };
    if (reviewed) patch["change_reason"] = reason;
    return update(patch, reviewed ? "Saved. Finance review was reopened for re-review." : "Saved.");
  };

  const toggleDoc = (field: "invoice_document_ids" | "photo_document_ids", id: string, on: boolean) => {
    const cur = new Set((v[field] as string[]) ?? []);
    if (on) cur.add(id);
    else cur.delete(id);
    set(field, [...cur] as never);
  };

  const recovery = recoverySummary(e.amount, data.recs as { expected_amount: number; received_amount: number }[]);

  return (
    <div className="space-y-6 text-sm">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-base font-semibold">{e.payee || "No payee yet"} · {money(e.amount)}</p>
          <p className="text-xs text-muted-foreground">
            Received {usDate(e.received_on)} · {expenseAgeDays(e.received_on, todayChicago())} days old
          </p>
        </div>
        <ExpenseChips e={e} />
        {e.is_demo && <Badge variant="outline">Demo record</Badge>}
      </div>

      {archived && (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="font-medium">Archived — read only</p>
          <p className="text-muted-foreground">{e.archive_reason} · {name(e.archived_by)} · {new Date(e.archived_at!).toLocaleString("en-US", { timeZone: "America/Chicago" })}</p>
          <p className="text-xs text-muted-foreground">Excluded from Finance queues and totals. History is kept.</p>
        </div>
      )}
      <fieldset disabled={archived} className="space-y-6 disabled:opacity-70">

      {/* Facts — Operations */}
      <section className="space-y-3">
        <h3 className="font-semibold">Facts (Operations)</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Type</Label>
            <select className={sel} value={v.expense_type} onChange={(x) => set("expense_type", x.target.value as ExpenseType)}>
              {(Object.keys(EXPENSE_TYPE_LABEL) as ExpenseType[]).map((t) => <option key={t} value={t}>{EXPENSE_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <PropertyPicker isDemo={e.is_demo} value={v.property_id} onChange={(id) => set("property_id", id)} />
          <div><Label>Payee</Label><Input value={txt("payee")} onChange={(x) => set("payee", x.target.value)} /></div>
          <div><Label>Amount</Label><Input type="number" step="0.01" value={v.amount ?? ""} onChange={(x) => set("amount", x.target.value === "" ? null : Number(x.target.value))} /></div>
          <div><Label>Expense / service date</Label><Input type="date" value={txt("expense_date")} onChange={(x) => set("expense_date", x.target.value || null)} /></div>
          <div><Label>Vendor invoice number</Label><Input value={txt("vendor_invoice_ref")} onChange={(x) => set("vendor_invoice_ref", x.target.value)} /></div>
          <div>
            <Label>Proposed statement period (optional)</Label>
            <Input type="month" value={(v.proposed_statement_period ?? "").slice(0, 7)} onChange={(x) => set("proposed_statement_period", x.target.value ? `${x.target.value}-01` : null)} />
            <p className="mt-1 text-xs text-muted-foreground">A proposal only — not statement treatment.</p>
          </div>
        </div>
        <div><Label>Reason</Label><Textarea rows={2} value={txt("reason")} onChange={(x) => set("reason", x.target.value)} /></div>
        {v.expense_type === "vendor_service" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Dispatch reason</Label><Textarea rows={2} value={txt("dispatch_reason")} onChange={(x) => set("dispatch_reason", x.target.value)} /></div>
            <div><Label>Outcome of this visit</Label><Textarea rows={2} placeholder="e.g. Diagnosed — repair still pending" value={txt("visit_outcome")} onChange={(x) => set("visit_outcome", x.target.value)} /></div>
          </div>
        )}
        {v.expense_type === "purchase" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>What was purchased</Label><Input value={txt("purchased_what")} onChange={(x) => set("purchased_what", x.target.value)} /></div>
            <div><Label>Purpose</Label><Input value={txt("purchase_purpose")} onChange={(x) => set("purchase_purpose", x.target.value)} /></div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Reservation link</Label>
            <select className={sel} value={v.reservation_link_state} onChange={(x) => set("reservation_link_state", x.target.value as ReservationLink)}>
              {(Object.keys(RESERVATION_LINK_LABEL) as ReservationLink[]).map((t) => <option key={t} value={t}>{RESERVATION_LINK_LABEL[t]}</option>)}
            </select>
          </div>
          {v.reservation_link_state === "linked" && (
            <div><Label>OwnerRez reservation ID</Label><Input value={txt("ownerrez_booking_id")} onChange={(x) => set("ownerrez_booking_id", x.target.value)} /></div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2"><Switch checked={v.ops_completion === "done"} onCheckedChange={(on) => set("ops_completion", on ? "done" : "open")} />Operational work done</label>
          <label className="flex items-center gap-2"><Switch checked={v.photos_required} onCheckedChange={(on) => set("photos_required", on)} />Photos required by this workflow (e.g. damage evidence)</label>
        </div>
        {reviewed && dirty && (
          <div>
            <Label>Reason for change (required — this expense was Finance reviewed)</Label>
            <Input value={reason} onChange={(x) => setReason(x.target.value)} />
          </div>
        )}
        {access.isStaff && (
          <Button size="sm" disabled={!dirty || (reviewed && !reason.trim())} onClick={() => void saveFacts()}>Save</Button>
        )}
      </section>

      {/* Documentation readiness */}
      <section className="space-y-2">
        <h3 className="font-semibold">Documentation readiness</h3>
        {missing.length === 0 ? (
          <p className="text-muted-foreground">Documentation ready. This does not mean approved, payable or statement ready.</p>
        ) : (
          <ul className="list-disc pl-5 text-muted-foreground">{missing.map((m) => <li key={m}>Missing: {m}</li>)}</ul>
        )}
        <AttachmentsPanel entityType="expense" entityId={expenseId} title="Invoices, receipts and photos" description="Finance files stay internal and are never shared with homeowners." />
        {data.docs.length > 0 && (
          <ul className="space-y-1">
            {data.docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 truncate">{d.title}</span>
                <label className="flex items-center gap-1 text-xs"><Switch checked={(v.invoice_document_ids ?? []).includes(d.id)} onCheckedChange={(on) => toggleDoc("invoice_document_ids", d.id, on)} />Invoice / receipt</label>
                <label className="flex items-center gap-1 text-xs"><Switch checked={(v.photo_document_ids ?? []).includes(d.id)} onCheckedChange={(on) => toggleDoc("photo_document_ids", d.id, on)} />Photo evidence</label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Owner rows — three separate facts */}
      <section className="space-y-3">
        <h3 className="font-semibold">Owner notification, authorization and cost responsibility</h3>
        <div className="rounded-md border border-border p-3 space-y-2">
          <p className="font-medium">Owner notification</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input type="datetime-local" value={(v.owner_notified_at ?? "").slice(0, 16)} onChange={(x) => set("owner_notified_at", x.target.value ? new Date(x.target.value).toISOString() : null)} />
            <Input placeholder="How the owner was told" value={txt("owner_notification_note")} onChange={(x) => set("owner_notification_note", x.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">Recorded only — Resolve sends nothing from here.</p>
        </div>
        <div className="rounded-md border border-border p-3 space-y-2">
          <p className="font-medium">Owner authorization</p>
          <p className="text-muted-foreground">
            {auth.required ? auth.reason : "Not required by the existing Maintenance Authority Policy."}
            {e.approval_id ? " An approval is linked." : ""}
            {auth.satisfiedByWorkOrder ? " The linked Work Order already records this approval." : ""}
          </p>
          {auth.required && !e.approval_id && !auth.satisfiedByWorkOrder && (
            <Input placeholder="Authorization evidence (e.g. where approval is recorded)" value={txt("authorization_note")} onChange={(x) => set("authorization_note", x.target.value)} />
          )}
        </div>
        <div className="rounded-md border border-border p-3 space-y-2">
          <p className="font-medium">Cost responsibility</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Operations recommendation</Label>
              <select className={sel} value={v.recommended_responsibility ?? ""} onChange={(x) => set("recommended_responsibility", (x.target.value || null) as Responsibility | null)}>
                <option value="">No recommendation</option>
                {RESPONSIBILITIES.map((r) => <option key={r} value={r}>{RESPONSIBILITY_LABEL[r]}</option>)}
              </select>
            </div>
            <div><Label>Recommendation note</Label><Input value={txt("ops_recommendation_note")} onChange={(x) => set("ops_recommendation_note", x.target.value)} /></div>
          </div>
          <p>Final (Finance): <strong>{RESPONSIBILITY_LABEL[e.cost_responsibility]}</strong></p>
        </div>
      </section>

      <LinksSection expenseId={expenseId} propertyId={e.property_id} links={data.links} isDemo={e.is_demo} onChanged={refresh} canEdit={access.isStaff} />

      <FinanceSection e={e} access={access} people={data.people} onDone={refresh} />

      <ClarificationSection expenseId={expenseId} items={data.clar} events={data.events} people={data.people} access={access} reviewed={reviewed} onDone={refresh} />

      <LeadershipSection e={e} access={access} people={data.people} leaders={data.leaders} onDone={refresh} name={name} />

      <section className="space-y-2">
        <h3 className="font-semibold">Expected and received recovery</h3>
        <p className="text-muted-foreground">
          Expense {money(recovery.expense)} stays as recorded. Expected {money(recovery.expected)} · Received {money(recovery.received)} · Outstanding {money(recovery.outstanding)}
        </p>
        <RecoveryForm expenseId={expenseId} rows={data.recs as RecoveryRowFull[]} canReceive={access.isAccounting} onDone={refresh} />
      </section>

      </fieldset>

      {!archived && (access.isLead || access.isDirector || (e.created_by === access.userId && (e.finance_review === "not_started" || e.finance_review === "in_review"))) && (
        <ArchiveSection expenseId={expenseId} onDone={refresh} />
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">History</h3>
        <ul className="space-y-1.5">
          {data.events.map((ev) => (
            <li key={ev.id} className="rounded border border-border p-2 text-xs">
              <span className="font-medium">{ev.kind.replace(/_/g, " ")}</span> · {name(ev.actor_id)} · {new Date(ev.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" })}
              {ev.reason && <div>Reason: {ev.reason}</div>}
              {ev.after_value && <div className="text-muted-foreground break-all">{summarize(ev.before_value, ev.after_value)}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function summarize(before: unknown, after: unknown) {
  const a = (after ?? {}) as Record<string, unknown>;
  const b = (before ?? {}) as Record<string, unknown>;
  return Object.keys(a)
    .filter((k) => !k.endsWith("_document_ids"))
    .slice(0, 6)
    .map((k) => (k in b ? `${k}: ${JSON.stringify(b[k])} → ${JSON.stringify(a[k])}` : `${k}: ${JSON.stringify(a[k])}`))
    .join(" · ");
}

function LinksSection({ expenseId, propertyId, links, isDemo, onChanged, canEdit }: {
  expenseId: string; propertyId: string | null; links: { id: string; link_type: string; target_id: string }[]; isDemo: boolean; onChanged: () => void; canEdit: boolean;
}) {
  const [type, setType] = useState<LinkType>("ticket");
  const [target, setTarget] = useState("");
  const options = useQuery({
    queryKey: ["expense-link-options", propertyId, type, isDemo],
    enabled: !!propertyId && canEdit,
    queryFn: async (): Promise<{ id: string; label: string }[]> => {
      if (type === "ticket") {
        const { data } = await supabase.from("tickets").select("id, ref, title").eq("property_id", propertyId!).eq("is_demo", isDemo).order("created_at", { ascending: false }).limit(50);
        return (data ?? []).map((t) => ({ id: t.id, label: `#${t.ref} ${t.title}` }));
      }
      if (type === "work_order") {
        const { data } = await supabase.from("work_orders").select("id, title").eq("property_id", propertyId!).eq("is_demo", isDemo).order("created_at", { ascending: false }).limit(50);
        return (data ?? []).map((t) => ({ id: t.id, label: `Work Order: ${t.title ?? "Untitled"}` }));
      }
      if (type === "claim") {
        const { data } = await supabase.from("claims").select("id, title, created_at").eq("property_id", propertyId!).eq("is_demo", isDemo).order("created_at", { ascending: false }).limit(50);
        return ((data ?? []) as { id: string; title: string | null; created_at: string }[]).map((t) => ({ id: t.id, label: t.title ?? `Claim ${usDate(t.created_at)}` }));
      }
      const { data } = await supabase.from("property_activity_log").select("id, what_happened, occurred_at").eq("property_id", propertyId!).eq("is_demo", isDemo).order("occurred_at", { ascending: false }).limit(50);
      return (data ?? []).map((t) => ({ id: t.id, label: `${usDate(t.occurred_at)} ${t.what_happened.slice(0, 60)}` }));
    },
  });
  const labels = useQuery({
    queryKey: ["expense-link-labels", links.map((l) => l.id).join(",")],
    queryFn: async () => {
      const m = new Map<string, string>();
      const ids = (t: string) => links.filter((l) => l.link_type === t).map((l) => l.target_id);
      const [t, w, c, a] = await Promise.all([
        ids("ticket").length ? supabase.from("tickets").select("id, ref, title").in("id", ids("ticket")) : null,
        ids("work_order").length ? supabase.from("work_orders").select("id, title").in("id", ids("work_order")) : null,
        ids("claim").length ? supabase.from("claims").select("id, title").in("id", ids("claim")) : null,
        ids("property_activity").length ? supabase.from("property_activity_log").select("id, what_happened").in("id", ids("property_activity")) : null,
      ]);
      for (const r of (t?.data ?? []) as { id: string; ref: number; title: string }[]) m.set(r.id, `#${r.ref} ${r.title}`);
      for (const r of (w?.data ?? []) as { id: string; title: string | null }[]) m.set(r.id, `Work Order: ${r.title ?? "Untitled"}`);
      for (const r of (c?.data ?? []) as { id: string; title: string | null }[]) m.set(r.id, r.title ?? "Claim");
      for (const r of (a?.data ?? []) as { id: string; what_happened: string }[]) m.set(r.id, r.what_happened.slice(0, 60));
      return m;
    },
  });
  async function add() {
    if (!target) return;
    const { error } = await supabase.from("expense_links").insert({ expense_id: expenseId, link_type: type, target_id: target });
    if (error) { toast.error(errText(error)); return; }
    setTarget("");
    onChanged();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("expense_links").delete().eq("id", id);
    if (error) { toast.error(errText(error)); return; }
    onChanged();
  }
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">Linked work</h3>
      {links.length === 0 ? (
        <p className="text-muted-foreground">Unmatched — no linked Ticket, Work Order, Claim or Property Activity yet.</p>
      ) : (
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span><Badge variant="outline">{LINK_LABEL[l.link_type as LinkType]}</Badge> {labels.data?.get(l.target_id) ?? "…"}</span>
              {canEdit && <Button size="sm" variant="ghost" onClick={() => void remove(l.id)}>Unlink</Button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && propertyId && (
        <div className="flex flex-wrap gap-2">
          <select className={sel + " w-40"} value={type} onChange={(x) => { setType(x.target.value as LinkType); setTarget(""); }}>
            {(Object.keys(LINK_LABEL) as LinkType[]).map((t) => <option key={t} value={t}>{LINK_LABEL[t]}</option>)}
          </select>
          <select className={sel + " min-w-0 flex-1"} value={target} onChange={(x) => setTarget(x.target.value)} aria-label="Record to link">
            <option value="">Choose…</option>
            {(options.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={!target} onClick={() => void add()}>Link</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">The amount lives only on this expense; links never copy it. A Property Activity stays history only.</p>
    </section>
  );
}

function FinanceSection({ e, access, people, onDone }: { e: Full; access: ReturnType<typeof useFinanceAccess>; people: Map<string, string>; onDone: () => void }) {
  const [resp, setResp] = useState<Responsibility>(e.cost_responsibility);
  const [split, setSplit] = useState<SplitLine[]>(e.split_allocations?.length ? e.split_allocations : [{ party: "owner", amount: 0 }, { party: "guest", amount: 0 }]);
  const [note, setNote] = useState(e.finance_treatment_note ?? "");
  const [qb, setQb] = useState(e.qb_reference_manual ?? "");
  const [reason, setReason] = useState("");
  useEffect(() => {
    setResp(e.cost_responsibility);
    setNote(e.finance_treatment_note ?? "");
    setQb(e.qb_reference_manual ?? "");
  }, [e.cost_responsibility, e.finance_treatment_note, e.qb_reference_manual]);
  const reviewed = e.finance_review === "reviewed";
  async function go(patch: Record<string, unknown>, msg: string) {
    const { error } = await supabase.from("expenses").update(patch as never).eq("id", e.id);
    if (error) { toast.error(errText(error)); return; }
    toast.success(msg);
    setReason("");
    onDone();
  }
  const splitOk = resp !== "split" || splitReconciles(split, e.amount);
  const treatmentDirty = resp !== e.cost_responsibility || note !== (e.finance_treatment_note ?? "") || (resp === "split" && JSON.stringify(split) !== JSON.stringify(e.split_allocations));

  return (
    <section className="space-y-3">
      <h3 className="font-semibold">Finance review</h3>
      <p>
        {FINANCE_REVIEW_LABEL[e.finance_review]}
        {e.reviewed_at && ` · ${people.get(e.reviewed_by ?? "") ?? "Finance"} on ${new Date(e.reviewed_at).toLocaleDateString("en-US", { timeZone: "America/Chicago" })}`}
      </p>
      {e.finance_treatment_note && <p className="text-muted-foreground">Treatment: {e.finance_treatment_note}</p>}
      <p className="text-xs text-muted-foreground">QuickBooks reference: {e.qb_reference_manual || "none"} — {QB_REFERENCE_NOTE}</p>

      {access.isAccounting && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1"><Label>QuickBooks reference (manual)</Label><Input value={qb} onChange={(x) => setQb(x.target.value)} /></div>
          <Button size="sm" variant="outline" disabled={qb === (e.qb_reference_manual ?? "")} onClick={() => void go({ qb_reference_manual: qb || null }, "QuickBooks reference saved (manual).")}>Save reference</Button>
          {(e.finance_review === "not_started" || e.finance_review === "reopened") && (
            <Button size="sm" variant="outline" onClick={() => void go({ finance_review: "in_review" }, "Moved into Finance review.")}>Start Finance review</Button>
          )}
        </div>
      )}

      {access.isLead && !reviewed && (
        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Final cost responsibility</Label>
              <select className={sel} value={resp} onChange={(x) => setResp(x.target.value as Responsibility)}>
                {RESPONSIBILITIES.map((r) => <option key={r} value={r}>{RESPONSIBILITY_LABEL[r]}</option>)}
              </select>
            </div>
            <div><Label>Financial treatment note</Label><Input value={note} onChange={(x) => setNote(x.target.value)} /></div>
          </div>
          {resp === "split" && (
            <div className="space-y-1">
              {split.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <select className={sel + " w-36"} value={line.party} onChange={(x) => setSplit(split.map((l, j) => (j === i ? { ...l, party: x.target.value as SplitLine["party"] } : l)))}>
                    {SPLIT_PARTIES.map((p) => <option key={p} value={p}>{RESPONSIBILITY_LABEL[p]}</option>)}
                  </select>
                  <Input type="number" step="0.01" value={line.amount} onChange={(x) => setSplit(split.map((l, j) => (j === i ? { ...l, amount: Number(x.target.value) } : l)))} />
                  <Button size="sm" variant="ghost" onClick={() => setSplit(split.filter((_, j) => j !== i))}>Remove</Button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setSplit([...split, { party: "arha", amount: 0 }])}>Add line</Button>
              <p className={splitOk ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                Allocated {money(split.reduce((s, l) => s + (l.amount || 0), 0))} of {money(e.amount)} {splitOk ? "— reconciles" : "— must equal the expense total"}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={!treatmentDirty || !splitOk} onClick={() => void go({ cost_responsibility: resp, finance_treatment_note: note || null, split_allocations: resp === "split" ? split : [] }, "Treatment saved.")}>Save treatment</Button>
            <Button size="sm" disabled={treatmentDirty} onClick={() => void go({ finance_review: "reviewed" }, "Finance review complete.")}>Mark Finance reviewed</Button>
          </div>
          {reservationBlocks(e.reservation_link_state, e.ownerrez_booking_id) && <p className="text-xs text-destructive">A reservation is required but not yet established — resolve it before Finance review.</p>}
        </div>
      )}

      {reviewed && (access.isLead || access.isAdmin) && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1"><Label>Reason to reopen</Label><Input value={reason} onChange={(x) => setReason(x.target.value)} /></div>
          <Button size="sm" variant="outline" disabled={!reason.trim()} onClick={() => void go({ finance_review: "reopened", change_reason: reason }, "Reopened. A new Finance review is required.")}>Reopen</Button>
        </div>
      )}
    </section>
  );
}

function ClarificationSection({ expenseId, items, events, people, access, reviewed, onDone }: {
  expenseId: string; items: { id: string; title: string; status: string; assigned_to: string | null; due_on: string | null }[];
  events: { kind: string; after_value: unknown }[]; people: Map<string, string>; access: ReturnType<typeof useFinanceAccess>; reviewed: boolean; onDone: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [assignee, setAssignee] = useState("");
  const [due, setDue] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const qa = new Map<string, { question?: string; answer?: string }>();
  for (const ev of events) {
    const a = (ev.after_value ?? {}) as { work_item_id?: string; question?: string; answer?: string };
    if (!a.work_item_id) continue;
    const cur = qa.get(a.work_item_id) ?? {};
    if (ev.kind === "clarification_requested" && a.question) cur.question = a.question;
    if (ev.kind === "clarification_answered" && a.answer) cur.answer = a.answer;
    qa.set(a.work_item_id, cur);
  }
  async function ask() {
    const { error } = await supabase.rpc("request_expense_clarification", { _expense: expenseId, _question: question, _assignee: (assignee || null) as string, _due: (due || null) as string });
    if (error) { toast.error(errText(error)); return; }
    toast.success("Clarification requested. It appears as a follow-up for the assignee.");
    setQuestion(""); setAssignee(""); setDue("");
    onDone();
  }
  async function answer(id: string) {
    const { error } = await supabase.rpc("answer_expense_clarification", { _work_item: id, _answer: answers[id] ?? "" });
    if (error) { toast.error(errText(error)); return; }
    toast.success("Answer recorded.");
    onDone();
  }
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">Clarification requests</h3>
      {items.length === 0 && <p className="text-muted-foreground">None.</p>}
      {items.map((w) => {
        const open = w.status === "open" || w.status === "in_progress";
        const t = qa.get(w.id) ?? {};
        return (
          <div key={w.id} className="rounded-md border border-border p-2 space-y-1">
            <p><strong>Q:</strong> {t.question ?? w.title}</p>
            <p className="text-xs text-muted-foreground">
              For {w.assigned_to ? (people.get(w.assigned_to) ?? "Team member") : "Operations"}{w.due_on ? ` · due ${usDate(w.due_on)}` : ""} · {open ? "Open" : "Answered"}
            </p>
            {t.answer && <p><strong>A:</strong> {t.answer}</p>}
            {open && access.isStaff && (
              <div className="flex gap-2">
                <Input placeholder="Answer" value={answers[w.id] ?? ""} onChange={(x) => setAnswers({ ...answers, [w.id]: x.target.value })} />
                <Button size="sm" disabled={!(answers[w.id] ?? "").trim()} onClick={() => void answer(w.id)}>Answer</Button>
              </div>
            )}
          </div>
        );
      })}
      {access.isAccounting && !reviewed && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-2">
          <Textarea rows={2} placeholder="Question for Operations" value={question} onChange={(x) => setQuestion(x.target.value)} />
          <div className="flex flex-wrap gap-2">
            <select className={sel + " w-56"} value={assignee} onChange={(x) => setAssignee(x.target.value)} aria-label="Assignee">
              <option value="">Assign to…</option>
              {[...people.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <Input type="date" className="w-44" value={due} onChange={(x) => setDue(x.target.value)} aria-label="Due date (optional)" />
            <Button size="sm" disabled={!question.trim()} onClick={() => void ask()}>Request clarification</Button>
          </div>
          <p className="text-xs text-muted-foreground">Due dates are set by hand. No automatic deadline applies.</p>
        </div>
      )}
    </section>
  );
}

function LeadershipSection({ e, access, people, leaders, onDone, name }: { e: Full; access: ReturnType<typeof useFinanceAccess>; people: Map<string, string>; leaders: Set<string>; onDone: () => void; name: (id: string | null) => string }) {
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState("");
  const [decision, setDecision] = useState("");
  async function go(patch: Record<string, unknown>, msg: string) {
    const { error } = await supabase.from("expenses").update(patch as never).eq("id", e.id);
    if (error) { toast.error(errText(error)); return; }
    toast.success(msg);
    onDone();
  }
  const canDecide = access.isDirector || access.userId === e.leadership_assignee;
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">Leadership decision</h3>
      <p className="text-xs text-muted-foreground">Manual route only. Spending authorization stays with the existing Maintenance Authority Policy and is separate from Finance review.</p>
      {!e.leadership_required ? (
        access.isStaff && (
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-0 flex-1" placeholder="Why leadership needs to decide" value={reason} onChange={(x) => setReason(x.target.value)} />
            <select className={sel + " w-56"} value={assignee} onChange={(x) => setAssignee(x.target.value)} aria-label="Decision-maker">
              <option value="">Decision-maker…</option>
              {[...people.entries()].filter(([id]) => leaders.has(id)).sort((a, b) => a[1].localeCompare(b[1])).map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={!reason.trim() || !assignee} onClick={() => void go({ leadership_required: true, leadership_reason: reason, leadership_assignee: assignee }, "Leadership decision requested.")}>Leadership decision required</Button>
          </div>
        )
      ) : (
        <div className="rounded-md border border-border p-2 space-y-1">
          <p>Reason: {e.leadership_reason} · Decision-maker: {name(e.leadership_assignee)}</p>
          {e.leadership_decision ? (
            <p><strong>Decision:</strong> {e.leadership_decision} — {name(e.leadership_decided_by)}, {e.leadership_decided_at ? new Date(e.leadership_decided_at).toLocaleString("en-US", { timeZone: "America/Chicago" }) : ""}</p>
          ) : canDecide ? (
            <div className="flex gap-2">
              <Input placeholder="Recorded decision" value={decision} onChange={(x) => setDecision(x.target.value)} />
              <Button size="sm" disabled={!decision.trim()} onClick={() => void go({ leadership_decision: decision }, "Decision recorded.")}>Record decision</Button>
            </div>
          ) : (
            <p className="text-muted-foreground">Waiting for {people.get(e.leadership_assignee ?? "") ?? "leadership"}.</p>
          )}
        </div>
      )}
    </section>
  );
}

function ArchiveSection({ expenseId, onDone }: { expenseId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  async function go() {
    const { error } = await supabase.rpc("archive_expense", { _expense: expenseId, _reason: reason });
    if (error) { toast.error(errText(error)); return; }
    toast.success("Expense archived. History is kept.");
    setReason("");
    onDone();
  }
  return (
    <section className="space-y-2 rounded-md border border-dashed border-border p-3">
      <h3 className="font-semibold">Archive accidental record</h3>
      <p className="text-xs text-muted-foreground">For records entered by mistake. Archived expenses leave Finance queues and totals; nothing is deleted.</p>
      <div className="flex flex-wrap gap-2">
        <Input className="min-w-0 flex-1" placeholder="Reason (required)" aria-label="Archive reason" value={reason} onChange={(x) => setReason(x.target.value)} />
        <Button size="sm" variant="outline" disabled={!reason.trim()} onClick={() => void go()}>Archive</Button>
      </div>
    </section>
  );
}

type RecoveryRowFull = { id: string; party: string; expected_amount: number; received_amount: number; received_on: string | null; note: string | null };
function RecoveryForm({ expenseId, rows, canReceive, onDone }: { expenseId: string; rows: RecoveryRowFull[]; canReceive: boolean; onDone: () => void }) {
  const [party, setParty] = useState("guest");
  const [expected, setExpected] = useState("");
  const [received, setReceived] = useState<Record<string, string>>({});
  async function add() {
    const { error } = await supabase.from("expense_recoveries").insert({ expense_id: expenseId, party, expected_amount: Number(expected) });
    if (error) { toast.error(errText(error)); return; }
    setExpected("");
    onDone();
  }
  async function receive(id: string) {
    const { error } = await supabase.from("expense_recoveries").update({ received_amount: Number(received[id]), received_on: todayChicago() }).eq("id", id);
    if (error) { toast.error(errText(error)); return; }
    onDone();
  }
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2">
          <span className="flex-1">{RESPONSIBILITY_LABEL[r.party as Responsibility] ?? r.party}: expected {money(Number(r.expected_amount))}, received {money(Number(r.received_amount))}{r.received_on ? ` on ${usDate(r.received_on)}` : ""}</span>
          {canReceive && (
            <>
              <Input className="w-28" type="number" step="0.01" placeholder="Received" value={received[r.id] ?? ""} onChange={(x) => setReceived({ ...received, [r.id]: x.target.value })} />
              <Button size="sm" variant="outline" disabled={!received[r.id]} onClick={() => void receive(r.id)}>Record received</Button>
            </>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <select className={sel + " w-36"} value={party} onChange={(x) => setParty(x.target.value)}>
          {["guest", "vendor", "insurance", "owner", "other"].map((p) => <option key={p} value={p}>{RESPONSIBILITY_LABEL[p as Responsibility] ?? "Other"}</option>)}
        </select>
        <Input className="w-32" type="number" step="0.01" placeholder="Expected" value={expected} onChange={(x) => setExpected(x.target.value)} />
        <Button size="sm" variant="outline" disabled={!expected} onClick={() => void add()}>Add expected recovery</Button>
      </div>
    </div>
  );
}

function PropertyPicker({ isDemo, value, onChange }: { isDemo: boolean; value: string | null; onChange: (id: string | null) => void }) {
  const q = useQuery({
    queryKey: ["expense-properties", isDemo],
    queryFn: async () => (await supabase.from("properties").select("id, name").eq("is_demo", isDemo).is("archived_at", null).order("name")).data ?? [],
  });
  return (
    <div>
      <Label>Property</Label>
      <select className={sel} value={value ?? ""} onChange={(x) => onChange(x.target.value || null)}>
        <option value="">Not identified yet</option>
        {(q.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </div>
  );
}
