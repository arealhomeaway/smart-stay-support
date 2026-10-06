/**
 * Statement Readiness — one property and statement period at a time.
 * Finance records dispositions and the Finance Lead confirms the expense review.
 * Nothing here posts to OwnerRez or QuickBooks.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Chip } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stateChip } from "@/lib/semantic";
import { useRole } from "@/hooks/useRole";
import { FINANCE_REVIEW_LABEL, QB_REFERENCE_NOTE, RESPONSIBILITY_LABEL, docReadiness, missingDocumentation, money, type ServerAuthorization, type FinanceReview, type Responsibility } from "@/lib/expenses";
import {
  DISPOSITION_LABEL,
  PERIOD_READINESS_LABEL,
  itemBlockers,
  monthLabel,
  monthStart,
  needsRecoveryTreatment,
  periodReadiness,
  type Disposition,
  type StatementItem,
} from "@/lib/statement-readiness";

const fmt = (d: string | null | undefined) => (d ? new Date(d.length === 10 ? d + "T12:00:00Z" : d).toLocaleDateString("en-US") : "not recorded");
const CLOSED_TASK = ["done", "closed", "completed", "archived", "cancelled"];

export function StatementReadiness({ demoMode, onOpenExpense }: { demoMode: boolean; onOpenExpense: (id: string) => void }) {
  const qc = useQueryClient();
  const { access } = useRole();
  const isFinance = access.seats.finance === true;
  const [propertyId, setPropertyId] = useState<string>("");
  const [ym, setYm] = useState(new Date().toISOString().slice(0, 7));
  const period = monthStart(ym);

  const lead = useQuery({
    queryKey: ["is-finance-lead"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("is_finance_lead", { _user_id: u.user.id });
      return data === true;
    },
  });

  const properties = useQuery({
    queryKey: ["sr-properties", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id,name").eq("is_demo", demoMode).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const data = useQuery({
    queryKey: ["statement-readiness", propertyId, period],
    enabled: !!propertyId,
    queryFn: async () => {
      const [exp, disp, rec] = await Promise.all([
        supabase.from("expenses").select("*, expense_links(id,link_type,target_id)").eq("property_id", propertyId).is("archived_at", null),
        supabase.from("statement_dispositions").select("*").eq("property_id", propertyId).order("decided_at", { ascending: false }),
        supabase.from("statement_reconciliations").select("*").eq("property_id", propertyId).eq("period", period).order("reviewed_at", { ascending: false }),
      ]);
      if (exp.error) throw exp.error;
      if (disp.error) throw disp.error;
      if (rec.error) throw rec.error;
      const dispositions = disp.data ?? [];
      const currentAt = new Set(dispositions.filter((d) => !d.superseded_at && d.period === period).map((d) => d.expense_id));
      const deferredOut = dispositions.filter((d) => d.disposition === "defer" && d.period === period);
      const rows = (exp.data ?? []).filter(
        (e) => (e.proposed_statement_period ?? "").slice(0, 7) === ym || currentAt.has(e.id),
      );
      const ids = rows.map((e) => e.id);
      const claimIds = rows.flatMap((e) => (e.expense_links ?? []).filter((l) => l.link_type === "claim").map((l) => l.target_id));
      const [recov, tasks, claims] = await Promise.all([
        ids.length ? supabase.from("expense_recoveries").select("expense_id,expected_amount,received_amount,corrects_id").in("expense_id", ids) : Promise.resolve({ data: [] as never[] }),
        ids.length ? supabase.from("work_items").select("id,source_id,status").eq("source_table", "expenses").in("source_id", ids) : Promise.resolve({ data: [] as never[] }),
        claimIds.length ? supabase.from("claims").select("id,title,stage").in("id", claimIds) : Promise.resolve({ data: [] as never[] }),
      ]);
      const items: (StatementItem & { raw: (typeof rows)[number] })[] = rows.map((e) => {
        const r = (recov.data ?? []).filter((x) => x.expense_id === e.id);
        const myClaims = (claims.data ?? []).filter(
          (c) => c.stage !== "closed" && (e.expense_links ?? []).some((l) => l.link_type === "claim" && l.target_id === c.id),
        );
        return {
          ...e,
          invoice_document_ids: e.invoice_document_ids ?? [],
          photo_document_ids: e.photo_document_ids ?? [],
          links: (e.expense_links ?? []).length,
          openClarifications: (tasks.data ?? []).filter((t) => t.source_id === e.id && !CLOSED_TASK.includes(t.status)).length,
          openClaims: myClaims.map((c) => ({ id: c.id, title: c.title })),
          // expected is capped at this expense; a claim-level figure is never repeated per receipt
          expected: Math.min(Number(e.amount ?? 0), Math.max(0, ...r.filter((x) => !x.corrects_id).map((x) => Number(x.expected_amount)))),
          received: r.reduce((s, x) => s + Number(x.received_amount), 0),
          raw: e,
        } as never;
      });
      return { items, dispositions, deferredOut, signoffs: rec.data ?? [] };
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["statement-readiness"] });
    void qc.invalidateQueries({ queryKey: ["expenses"] });
  };
  const readiness = periodReadiness(data.data?.signoffs ?? []);
  const items = data.data?.items ?? [];
  const actualTotal = useMemo(
    () => items.filter((i) => !i.is_estimate).reduce((s, i) => s + Math.round((i.amount ?? 0) * 100), 0) / 100,
    [items],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="sr-prop">Property</Label>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger id="sr-prop" aria-label="Property" className="w-72"><SelectValue placeholder="Choose a property" /></SelectTrigger>
            <SelectContent>
              {(properties.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="sr-month">Statement period</Label>
          <Input id="sr-month" aria-label="Statement period" type="month" value={ym} onChange={(e) => setYm(e.target.value)} className="w-44" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Finance decides the statement period. This tracks expense review only — not reservation revenue, management fees, taxes, payouts or the full owner statement — and posts nothing to OwnerRez or QuickBooks.
      </p>

      {!propertyId ? null : data.isLoading ? <p className="text-sm">Loading…</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{monthLabel(period)}</h3>
            <Chip className={readiness === "expense_review_ready" ? stateChip("done") : stateChip("waiting")}>{PERIOD_READINESS_LABEL[readiness]}</Chip>
            <span className="text-xs text-muted-foreground">Actual invoices {money(actualTotal)} · estimates and archived expenses excluded</span>
          </div>

          {items.length === 0 ? <p className="text-sm text-muted-foreground">No expenses found for this property and period.</p> : null}
          <ul className="space-y-3">
            {items.map((i) => (
              <ItemCard key={i.id} item={i} period={period} current={data.data!.dispositions.find((d) => d.expense_id === i.id && !d.superseded_at) ?? null}
                canDecide={isFinance} onOpen={() => onOpenExpense(i.id)} onDone={refresh} />
            ))}
          </ul>

          {data.data!.deferredOut.length ? (
            <div className="rounded-md border p-3 text-xs">
              <p className="font-medium">Deferred out of this period</p>
              {data.data!.deferredOut.map((d) => (
                <p key={d.id}>Expense deferred to {monthLabel(d.defer_to_period!)} on {fmt(d.decided_at)} — counted only in the later period.</p>
              ))}
            </div>
          ) : null}

          <SignOff propertyId={propertyId} period={period} canSign={lead.data === true} signoffs={data.data!.signoffs} onDone={refresh} />
        </>
      )}
    </div>
  );
}

type Current = { disposition: string; period: string; defer_to_period: string | null; owner_description: string | null; internal_note: string | null; exclusion_treatment: string | null; recovery_treatment: string | null; decided_at: string } | null;

function ItemCard({ item, period, current, canDecide, onOpen, onDone }: {
  item: StatementItem & { raw: Record<string, unknown> }; period: string; current: Current; canDecide: boolean; onOpen: () => void; onDone: () => void;
}) {
  const raw = item.raw as unknown as {
    invoice_date: string | null; received_on: string | null; proposed_statement_period: string | null;
    finance_treatment_note: string | null; owner_notified_at: string | null; authorization_note: string | null;
    approval_id: string | null; qb_reference_manual: string | null;
  };
  const blockers = itemBlockers(item);
  const needsTreatment = needsRecoveryTreatment(item);
  const [disp, setDisp] = useState<Disposition>("include");
  // The backend authorization verdict is authoritative (linked Work Order approval, seats, exceptions).
  const authQ = useQuery({
    queryKey: ["expense-authorization", item.id],
    queryFn: async () => ((await supabase.rpc("expense_authorization_status", { _expense: item.id })).data ?? null) as ServerAuthorization | null,
  });
  const docMissing = missingDocumentation(item, null, authQ.data ?? { required: false, ok: true, reason: "" });
  const docReady = docMissing.length === 0;
  const [ownerDesc, setOwnerDesc] = useState("");
  const [note, setNote] = useState("");
  const [deferTo, setDeferTo] = useState("");
  const [excl, setExcl] = useState("");
  const [recTreat, setRecTreat] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("record_statement_disposition", {
        _expense: item.id, _period: period, _disposition: disp,
        ...(ownerDesc ? { _owner_description: ownerDesc } : {}), ...(note ? { _internal_note: note } : {}),
        ...(deferTo ? { _defer_to: monthStart(deferTo) } : {}), ...(excl ? { _exclusion_treatment: excl } : {}),
        ...(recTreat ? { _recovery_treatment: recTreat } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Disposition recorded — not posted to OwnerRez"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const current_here = current && current.period === period;
  return (
    <li className="space-y-2 rounded-md border p-3 text-sm" data-testid="sr-item">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={onOpen}>{item.payee ?? "Expense"} · {money(item.amount)}</button>
        {item.is_estimate ? <Chip className={stateChip("waiting")}>Estimate</Chip> : null}
        <Chip className={docReady ? stateChip("done") : stateChip("waiting")}>{docReady ? "Documentation ready" : "Documentation missing"}</Chip>
        <Chip className={item.finance_review === "reviewed" ? stateChip("done") : stateChip("waiting")}>{FINANCE_REVIEW_LABEL[item.finance_review as FinanceReview] ?? item.finance_review}</Chip>
        {current_here ? <Chip className={stateChip("active")}>{DISPOSITION_LABEL[current!.disposition as Disposition]}</Chip> : <Chip className={stateChip("info")}>No disposition yet</Chip>}
      </div>
      <p className="text-xs text-muted-foreground">
        Service date {fmt(item.expense_date)} · Invoice date {fmt(raw.invoice_date)} · Received {fmt(raw.received_on)} · Proposed period {raw.proposed_statement_period ? monthLabel(raw.proposed_statement_period) : "not set"}
      </p>
      <p className="text-xs">
        Allocation: {RESPONSIBILITY_LABEL[(item.cost_responsibility ?? "pending") as Responsibility] ?? item.cost_responsibility}
        {raw.finance_treatment_note ? ` — ${raw.finance_treatment_note}` : ""} · Owner notified {raw.owner_notified_at ? fmt(raw.owner_notified_at) : "not recorded"}
        {raw.authorization_note || raw.approval_id ? " · Authorization evidence on file" : ""}
      </p>
      <p className="text-xs">
        Recoveries: received {money(item.received)} · expected {money(item.expected)} (expected is not received)
        {raw.qb_reference_manual ? ` · QuickBooks ref ${raw.qb_reference_manual} (manual — ${QB_REFERENCE_NOTE})` : ""}
      </p>
      {item.openClaims.map((c) => (
        <p key={c.id} className="text-xs">Open claim: <Link to="/claims" className="underline">{c.title ?? "Claim"}</Link> — may affect treatment; does not block a documented expense.</p>
      ))}
      {blockers.length ? (
        <ul className="list-disc pl-5 text-xs text-destructive">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
      ) : null}
      {current_here ? (
        <p className="text-xs text-muted-foreground">
          {current!.owner_description ? `Owner-facing: ${current!.owner_description} · ` : ""}
          {current!.internal_note ? `Internal: ${current!.internal_note} · ` : ""}
          {current!.recovery_treatment ? `Recovery treatment: ${current!.recovery_treatment} · ` : ""}
          {current!.exclusion_treatment ? `Exclusion treatment: ${current!.exclusion_treatment} · ` : ""}
          Recorded {fmt(current!.decided_at)}. A disposition is not proof of posting to OwnerRez.
        </p>
      ) : null}
      {canDecide ? (
        <div className="grid gap-2 rounded-md bg-muted/40 p-2 sm:grid-cols-2">
          <Select value={disp} onValueChange={(v) => setDisp(v as Disposition)}>
            <SelectTrigger aria-label="Disposition"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(DISPOSITION_LABEL) as Disposition[]).map((d) => <SelectItem key={d} value={d}>{DISPOSITION_LABEL[d]}</SelectItem>)}</SelectContent>
          </Select>
          {disp === "defer" ? <Input aria-label="Defer to period" type="month" value={deferTo} onChange={(e) => setDeferTo(e.target.value)} /> : <span />}
          {disp === "include" ? <Input aria-label="Owner-safe description" placeholder="Owner-safe description (shown to owners)" value={ownerDesc} onChange={(e) => setOwnerDesc(e.target.value)} /> : null}
          <Input aria-label="Internal note" placeholder={disp === "hold" ? "What the hold is waiting on (internal)" : disp === "exclude" ? "Reason for exclusion (internal)" : "Internal note"} value={note} onChange={(e) => setNote(e.target.value)} />
          {disp === "exclude" ? <Input aria-label="Exclusion treatment" placeholder="Recorded financial treatment" value={excl} onChange={(e) => setExcl(e.target.value)} /> : null}
          {disp === "include" && needsTreatment ? <Input aria-label="Recovery treatment" placeholder="Finance treatment of the outstanding recovery / open claim" value={recTreat} onChange={(e) => setRecTreat(e.target.value)} /> : null}
          {disp === "include" && !docReady ? (
            <p className="text-xs text-destructive sm:col-span-2" role="status">Include is unavailable: documentation is incomplete — missing {docMissing.join(", ")}. Hold it until Operations supplies the missing facts.</p>
          ) : null}
          <Button size="sm" className="sm:col-span-2" disabled={save.isPending || (disp === "include" && (!docReady || authQ.isLoading))} onClick={() => save.mutate()}>Record disposition</Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Only Finance records statement treatment. Operations supplies facts through clarification Tasks.</p>
      )}
    </li>
  );
}

function SignOff({ propertyId, period, canSign, signoffs, onDone }: {
  propertyId: string; period: string; canSign: boolean; onDone: () => void;
  signoffs: { id: string; status: string; reviewed_at: string; reviewed_by: string; source_reference: string; exception_resolution: string | null; invalidated_at: string | null; invalidated_reason: string | null }[];
}) {
  const [src, setSrc] = useState("");
  const [exc, setExc] = useState("");
  const confirm = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("confirm_statement_reconciliation", { _property: propertyId, _period: period, _source_reference: src, ...(exc ? { _exception_resolution: exc } : {}) });
      if (error) throw error;
    },
    onSuccess: () => { setSrc(""); setExc(""); toast.success("Expense review confirmed"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-2 rounded-md border p-3">
      <h4 className="text-sm font-semibold">Finance Lead confirmation</h4>
      <ul className="space-y-1 text-xs">
        {signoffs.map((s) => (
          <li key={s.id}>
            <Chip className={s.status === "confirmed" ? stateChip("done") : stateChip("blocked")}>{s.status === "confirmed" ? "Confirmed" : "Superseded / needs re-review"}</Chip>{" "}
            {fmt(s.reviewed_at)} · source (manual): {s.source_reference}{s.exception_resolution ? ` · exceptions: ${s.exception_resolution}` : ""}
            {s.invalidated_reason ? ` · ${s.invalidated_reason} on ${fmt(s.invalidated_at)}` : ""}
          </li>
        ))}
        {signoffs.length === 0 ? <li className="text-muted-foreground">No confirmation recorded for this period.</li> : null}
      </ul>
      {canSign ? (
        <div className="space-y-1">
          <Input aria-label="Source reference" placeholder="Source records reviewed (manual reference — not verified by Resolve)" value={src} onChange={(e) => setSrc(e.target.value)} />
          <Textarea rows={2} aria-label="Exception resolution" placeholder="How each held, deferred or excluded item is resolved" value={exc} onChange={(e) => setExc(e.target.value)} />
          <Button size="sm" disabled={!src.trim() || confirm.isPending} onClick={() => confirm.mutate()}>Confirm expense review</Button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Only the Finance Lead confirms the expense review.</p>
      )}
    </div>
  );
}
