/**
 * Guided claim workflow: submission proof, decision, payer & deadlines,
 * waivers and the Finance recovery ledger. Every gate is also enforced in the
 * database; this panel only explains and collects.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/page";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { stateChip } from "@/lib/semantic";
import { useRole } from "@/hooks/useRole";
import { displayName, type TeamMember } from "@/hooks/useTeam";
import {
  DISPOSITION_LABELS,
  GUIDED_STEPS,
  GUIDED_STEP_LABELS,
  awaitingReceipt,
  deadlineVerification,
  financiallySettled,
  formatDate,
  formatMoney,
  guidedStep,
  type ClaimDisposition,
} from "@/lib/claims";
import type { ClaimRow } from "@/lib/claim-types";

const today = () => new Date().toISOString().slice(0, 10);
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[$,]/g, "")));

export function ClaimWorkflowPanel({
  claim,
  canEdit,
  people,
  onChanged,
}: {
  claim: ClaimRow;
  canEdit: boolean;
  people: TeamMember[];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const { isSupervisor, seats, userId } = useRole();
  const isFinance = seats.finance;
  const step = guidedStep(claim);

  const docs = useQuery({
    queryKey: ["claim-docs", claim.id],
    queryFn: async () => {
      const ors = [`and(entity_type.eq.property,entity_id.eq.${claim.property_id})`];
      if (claim.ticket_id) ors.push(`and(entity_type.eq.ticket,entity_id.eq.${claim.ticket_id})`);
      const { data, error } = await supabase
        .from("documents")
        .select("id,title,original_filename,entity_type,created_at")
        .or(ors.join(","))
        .is("deleted_at", null)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!claim.property_id,
  });

  const ledger = useQuery({
    queryKey: ["claim-ledger", claim.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_recoveries")
        .select("*")
        .eq("claim_id", claim.id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const linkedExpenses = useQuery({
    queryKey: ["claim-expenses", claim.id],
    queryFn: async () => {
      const { data: links } = await supabase
        .from("expense_links")
        .select("expense_id")
        .eq("link_type", "claim")
        .eq("target_id", claim.id);
      const ids = (links ?? []).map((l) => l.expense_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("expenses").select("id,amount,payee").in("id", ids);
      return data ?? [];
    },
  });

  const waivers = useQuery({
    queryKey: ["claim-waivers", claim.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claim_waivers")
        .select("*")
        .eq("claim_id", claim.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refreshAll = () => {
    onChanged();
    for (const k of ["claim-ledger", "claim-waivers", "claim-expenses"]) qc.invalidateQueries({ queryKey: [k, claim.id] });
  };

  const save = useMutation({
    mutationFn: async ({ patch, body }: { patch: Record<string, unknown>; body: string }) => {
      const { error } = await supabase.from("claims").update(patch as never).eq("id", claim.id);
      if (error) throw error;
      await supabase.from("claim_activity").insert({
        claim_id: claim.id,
        author_id: userId,
        event_type: "workflow",
        body,
        detail: patch as never,
        is_demo: claim.is_demo,
      });
    },
    onSuccess: () => {
      refreshAll();
      toast.success("Claim updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- submission ---
  const [subDocs, setSubDocs] = useState<string[]>(claim.submission_document_ids ?? []);
  const [subDate, setSubDate] = useState(claim.submitted_on ?? today());
  const [subRef, setSubRef] = useState(claim.external_reference ?? "");
  const [subAmt, setSubAmt] = useState(claim.submitted_amount?.toString() ?? "");
  // --- decision ---
  const [disp, setDisp] = useState<ClaimDisposition | "">(claim.disposition ?? "");
  const [apprAmt, setApprAmt] = useState(claim.approved_amount?.toString() ?? "");
  const [dispReason, setDispReason] = useState(claim.disposition_reason ?? "");
  const [decDocs, setDecDocs] = useState<string[]>(claim.decision_document_ids ?? []);
  // --- closure ---
  const [nonrec, setNonrec] = useState(claim.nonrecovery_reason ?? "");
  const [finPending, setFinPending] = useState(claim.finance_decision_pending ?? "");
  // --- waiver ---
  const [wReason, setWReason] = useState("");
  const [wContext, setWContext] = useState("");
  const [wNotes, setWNotes] = useState<Record<string, string>>({});
  // --- receipt ---
  const [rAmt, setRAmt] = useState("");
  const [rDate, setRDate] = useState(today());
  const [rRef, setRRef] = useState("");
  const [rExpense, setRExpense] = useState("none");
  const [rNote, setRNote] = useState("");
  const [rCorrects, setRCorrects] = useState("none");

  const requestWaiver = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_claim_waiver", {
        _claim_id: claim.id,
        _reason: wReason,
        _context: wContext || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setWReason("");
      setWContext("");
      refreshAll();
      toast.success("Waiver sent to the Operations Supervisor");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideWaiver = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc("decide_claim_waiver", {
        _waiver_id: id,
        _approve: approve,
        _notes: wNotes[id] ?? "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refreshAll();
      toast.success("Decision returned to the coordinator");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordReceipt = useMutation({
    mutationFn: async () => {
      const amount = num(rAmt);
      if (amount === null || !Number.isFinite(amount)) throw new Error("Enter an amount");
      const correcting = rCorrects !== "none";
      const { error } = await supabase.from("expense_recoveries").insert({
        claim_id: claim.id,
        expense_id: rExpense === "none" ? null : rExpense,
        party: claim.claim_type,
        expected_amount: claim.approved_amount ?? amount,
        received_amount: correcting ? -Math.abs(amount) : amount,
        received_on: rDate,
        accounting_reference: rRef || null,
        note: rNote || null,
        corrects_id: correcting ? rCorrects : null,
        is_demo: claim.is_demo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setRAmt("");
      setRRef("");
      setRNote("");
      setRCorrects("none");
      refreshAll();
      toast.success("Recovery recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const docPicker = (selected: string[], set: (v: string[]) => void, disabled: boolean) => (
    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
      {(docs.data ?? []).map((d) => (
        <li key={d.id} className="flex items-center gap-2 text-xs">
          <Checkbox
            id={`doc-${d.id}`}
            disabled={disabled}
            checked={selected.includes(d.id)}
            onCheckedChange={(v) => set(v ? [...selected, d.id] : selected.filter((x) => x !== d.id))}
          />
          <label htmlFor={`doc-${d.id}`} className="truncate">
            {d.title || d.original_filename} · {d.entity_type} · {formatDate(d.created_at)}
          </label>
        </li>
      ))}
      {(docs.data ?? []).length === 0 ? (
        <li className="text-xs text-muted-foreground">
          No files yet — upload the screenshot or email on the ticket or home first.
        </li>
      ) : null}
    </ul>
  );

  const deadlineState = deadlineVerification(claim.deadline_on, claim.deadline_verified);
  const releaseState = deadlineVerification(claim.deposit_release_on, claim.deposit_release_verified);
  const pendingWaiver = (waivers.data ?? []).find((w) => w.status === "pending");
  const settled = financiallySettled(claim);
  const owed = awaitingReceipt(claim);
  const postSubmit = !["evidence", "ready"].includes(step);

  return (
    <section className="space-y-4">
      {/* Guided steps */}
      <ol className="flex flex-wrap gap-1">
        {GUIDED_STEPS.map((s) => (
          <li key={s}>
            <Chip className={s === step ? stateChip("active") : stateChip("info")}>{GUIDED_STEP_LABELS[s]}</Chip>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 text-xs">
        <Chip className={settled ? stateChip("done") : stateChip("waiting")}>
          {settled ? "Financially settled" : "Not financially settled"}
        </Chip>
        {owed > 0 ? <Chip className={stateChip("waiting")}>Approved, not yet received {formatMoney(owed)}</Chip> : null}
        {claim.finance_decision_pending ? (
          <Chip className={stateChip("waiting")}>Finance decision pending</Chip>
        ) : null}
      </div>

      {/* Payer & deadlines */}
      <div className="space-y-2 rounded-md border p-3">
        <h4 className="text-sm font-semibold">Payer and deadlines</h4>
        <p className="text-xs text-muted-foreground">
          Guest {claim.guest_name ?? "—"} · the deposit payer is recorded separately, never assumed.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["booking_source", "Booking source"],
              ["contracting_party", "Contracting party"],
              ["deposit_payer", "Deposit payer"],
              ["deadline_source", "Submission deadline source"],
              ["deposit_release_source", "Deposit release source"],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs" htmlFor={`cw-${k}`}>{label}</Label>
              <Input
                id={`cw-${k}`}
                disabled={!canEdit}
                defaultValue={(claim[k] as string | null) ?? ""}
                onBlur={(e) => {
                  const v = e.target.value.trim() || null;
                  if (v !== claim[k]) save.mutate({ patch: { [k]: v }, body: `${label}: ${v ?? "cleared"}` });
                }}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="cw-release">Deposit release by</Label>
            <Input
              id="cw-release"
              type="date"
              disabled={!canEdit}
              defaultValue={claim.deposit_release_on ?? ""}
              onChange={(e) =>
                save.mutate({
                  patch: { deposit_release_on: e.target.value || null, deposit_release_verified: false },
                  body: `Deposit release date ${e.target.value || "cleared"} (unverified)`,
                })
              }
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>
            Submission deadline {formatDate(claim.deadline_on)} ({claim.deadline_timezone}):
          </span>
          <Chip className={deadlineState === "verified" ? stateChip("done") : stateChip("waiting")}>
            {deadlineState === "verified" ? "Verified" : "Deadline needs verification"}
          </Chip>
          {canEdit && claim.deadline_on ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                save.mutate({
                  patch: { deadline_verified: !claim.deadline_verified },
                  body: claim.deadline_verified ? "Deadline marked unverified" : "Deadline verified against source",
                })
              }
            >
              {claim.deadline_verified ? "Mark unverified" : "Mark verified"}
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Deposit release {formatDate(claim.deposit_release_on)}:</span>
          <Chip className={releaseState === "verified" ? stateChip("done") : stateChip("waiting")}>
            {releaseState === "verified" ? "Verified" : "Deadline needs verification"}
          </Chip>
          {canEdit && claim.deposit_release_on ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                save.mutate({
                  patch: { deposit_release_verified: !claim.deposit_release_verified },
                  body: "Deposit release verification changed",
                })
              }
            >
              {claim.deposit_release_verified ? "Mark unverified" : "Mark verified"}
            </Button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Resolve never releases deposits, charges guests or issues refunds — record those as a pending Finance decision.
        </p>
      </div>

      {/* Submission */}
      {canEdit ? (
        <div className="space-y-2 rounded-md border p-3">
          <h4 className="text-sm font-semibold">Record submission</h4>
          <p className="text-xs text-muted-foreground">
            Resolve does not submit claims. Record it after you submit on the platform, with proof attached.
          </p>
          {docPicker(subDocs, setSubDocs, postSubmit)}
          <div className="grid grid-cols-3 gap-2">
            <Input aria-label="Submitted on" type="date" value={subDate} disabled={postSubmit} onChange={(e) => setSubDate(e.target.value)} />
            <Input aria-label="Submission reference" placeholder="Case / reference" value={subRef} disabled={postSubmit} onChange={(e) => setSubRef(e.target.value)} />
            <Input aria-label="Amount requested" placeholder="Requested $" inputMode="decimal" value={subAmt} disabled={postSubmit} onChange={(e) => setSubAmt(e.target.value)} />
          </div>
          {postSubmit ? (
            <p className="text-xs">Submitted {formatDate(claim.submitted_on)} · ref {claim.external_reference} · {claim.submission_document_ids.length} proof file(s)</p>
          ) : (
            <Button
              size="sm"
              disabled={!subDocs.length || !subRef.trim() || save.isPending}
              onClick={() =>
                save.mutate({
                  patch: {
                    stage: "submitted",
                    submitted_on: subDate,
                    external_reference: subRef.trim(),
                    submitted_amount: num(subAmt),
                    submission_document_ids: subDocs,
                  },
                  body: `Recorded submitted · ref ${subRef.trim()} · requested ${formatMoney(num(subAmt))}`,
                })
              }
            >
              Record submitted
            </Button>
          )}
          {claim.stage === "submitted" ? (
            <Button size="sm" variant="outline" onClick={() => save.mutate({ patch: { stage: "waiting_external" }, body: "Awaiting decision" })}>
              Mark awaiting decision
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Decision */}
      {canEdit && postSubmit ? (
        <div className="space-y-2 rounded-md border p-3">
          <h4 className="text-sm font-semibold">Decision received</h4>
          <Select value={disp} onValueChange={(v) => setDisp(v as ClaimDisposition)}>
            <SelectTrigger aria-label="Decision"><SelectValue placeholder="Outcome" /></SelectTrigger>
            <SelectContent>
              {(["approved", "partial", "denied", "withdrawn", "written_off"] as ClaimDisposition[]).map((d) => (
                <SelectItem key={d} value={d}>{DISPOSITION_LABELS[d]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {disp === "approved" || disp === "partial" ? (
            <Input aria-label="Amount approved" placeholder="Approved $" inputMode="decimal" value={apprAmt} onChange={(e) => setApprAmt(e.target.value)} />
          ) : null}
          <Textarea rows={2} placeholder="Reason / what they said" value={dispReason} onChange={(e) => setDispReason(e.target.value)} />
          <p className="text-xs text-muted-foreground">Decision evidence</p>
          {docPicker(decDocs, setDecDocs, false)}
          <Button
            size="sm"
            disabled={!disp || !decDocs.length || save.isPending}
            onClick={() =>
              save.mutate({
                patch: {
                  stage: "decided",
                  disposition: disp,
                  approved_amount: disp === "approved" || disp === "partial" ? num(apprAmt) : null,
                  disposition_reason: dispReason.trim() || null,
                  decision_document_ids: decDocs,
                  decided_on: claim.decided_on ?? today(),
                },
                body: `Decision: ${disp ? DISPOSITION_LABELS[disp] : ""}${num(apprAmt) ? ` · approved ${formatMoney(num(apprAmt))}` : ""}`,
              })
            }
          >
            Record decision
          </Button>
        </div>
      ) : null}

      {/* Waivers */}
      <div className="space-y-2 rounded-md border p-3">
        <h4 className="text-sm font-semibold">Waiver</h4>
        <p className="text-[11px] text-muted-foreground">
          A waiver decision never assigns the cost to the owner or ARHA — Finance treatment stays separate.
        </p>
        {(waivers.data ?? []).map((w) => (
          <div key={w.id} className="rounded border px-2 py-1 text-xs">
            <p>
              <Chip className={w.status === "pending" ? stateChip("waiting") : w.status === "approved" ? stateChip("done") : stateChip("blocked")}>
                {w.status}
              </Chip>{" "}
              {w.reason} — {displayName(people.find((p) => p.id === w.requested_by))}
            </p>
            {w.context ? <p className="text-muted-foreground">{w.context}</p> : null}
            {w.decision_notes ? <p>Supervisor: {w.decision_notes}</p> : null}
            {w.status === "pending" && isSupervisor && w.requested_by !== userId ? (
              <div className="mt-1 space-y-1">
                <Textarea rows={2} placeholder="Decision notes (required)" value={wNotes[w.id] ?? ""} onChange={(e) => setWNotes((n) => ({ ...n, [w.id]: e.target.value }))} />
                <div className="flex gap-2">
                  <Button size="sm" disabled={!wNotes[w.id]?.trim()} onClick={() => decideWaiver.mutate({ id: w.id, approve: true })}>Approve waiver</Button>
                  <Button size="sm" variant="outline" disabled={!wNotes[w.id]?.trim()} onClick={() => decideWaiver.mutate({ id: w.id, approve: false })}>Deny waiver</Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {canEdit && !pendingWaiver ? (
          <div className="space-y-1">
            <Input aria-label="Waiver reason" placeholder="Why should this be waived?" value={wReason} onChange={(e) => setWReason(e.target.value)} />
            <Textarea rows={2} placeholder="Supporting context" value={wContext} onChange={(e) => setWContext(e.target.value)} />
            <Button size="sm" variant="outline" disabled={!wReason.trim() || requestWaiver.isPending} onClick={() => requestWaiver.mutate()}>
              Request waiver
            </Button>
          </div>
        ) : null}
      </div>

      {/* Finance ledger */}
      <div className="space-y-2 rounded-md border p-3">
        <h4 className="text-sm font-semibold">Recoveries received (Finance)</h4>
        <p className="text-xs">
          Requested {formatMoney(claim.submitted_amount)} · Approved {formatMoney(claim.approved_amount)} · Received {formatMoney(claim.recovered_amount)}
        </p>
        <ul className="space-y-1 text-xs">
          {(ledger.data ?? []).map((r) => (
            <li key={r.id} className="rounded border px-2 py-1">
              {formatMoney(Number(r.received_amount))} on {formatDate(r.received_on)}
              {r.accounting_reference ? ` · ref ${r.accounting_reference}` : ""}
              {r.expense_id ? ` · allocated to expense` : ""}
              {r.corrects_id ? " · correction" : ""}
              {r.note ? ` · ${r.note}` : ""}
            </li>
          ))}
          {(ledger.data ?? []).length === 0 ? <li className="text-muted-foreground">Nothing received yet.</li> : null}
        </ul>
        {isFinance ? (
          <div className="grid grid-cols-2 gap-2">
            <Input aria-label="Received amount" placeholder="Received $" inputMode="decimal" value={rAmt} onChange={(e) => setRAmt(e.target.value)} />
            <Input aria-label="Received on" type="date" value={rDate} onChange={(e) => setRDate(e.target.value)} />
            <Input aria-label="Accounting reference" placeholder="QuickBooks reference" value={rRef} onChange={(e) => setRRef(e.target.value)} />
            <Select value={rExpense} onValueChange={setRExpense}>
              <SelectTrigger aria-label="Allocate to expense"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No expense allocation</SelectItem>
                {(linkedExpenses.data ?? []).map((x) => (
                  <SelectItem key={x.id} value={x.id}>{x.payee ?? "Expense"} · {formatMoney(Number(x.amount))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rCorrects} onValueChange={setRCorrects}>
              <SelectTrigger aria-label="Correction of"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">New receipt</SelectItem>
                {(ledger.data ?? []).filter((r) => !r.corrects_id).map((r) => (
                  <SelectItem key={r.id} value={r.id}>Correct {formatMoney(Number(r.received_amount))} on {formatDate(r.received_on)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input aria-label="Recovery note" placeholder={rCorrects === "none" ? "Note" : "Correction reason (required)"} value={rNote} onChange={(e) => setRNote(e.target.value)} />
            <Button size="sm" className="col-span-2" disabled={!rAmt || recordReceipt.isPending} onClick={() => recordReceipt.mutate()}>
              {rCorrects === "none" ? "Record receipt" : "Record correction"}
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Only Finance records money received.</p>
        )}
      </div>

      {/* Closure */}
      {canEdit ? (
        <div className="space-y-2 rounded-md border p-3">
          <h4 className="text-sm font-semibold">Unrecovered amount and closure</h4>
          <Textarea rows={2} placeholder="Why any amount will not be recovered (denied, withdrawn, waived, unrecoverable)" value={nonrec} onChange={(e) => setNonrec(e.target.value)} />
          <Input aria-label="Pending Finance decision" placeholder="Pending Finance decision (e.g. retain deposit?)" value={finPending} onChange={(e) => setFinPending(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                save.mutate({
                  patch: { nonrecovery_reason: nonrec.trim() || null, finance_decision_pending: finPending.trim() || null },
                  body: "Nonrecovery / Finance decision notes updated",
                })
              }
            >
              Save notes
            </Button>
            <Button
              size="sm"
              disabled={claim.stage === "closed" || save.isPending}
              onClick={() =>
                save.mutate({
                  patch: {
                    stage: "closed",
                    closed_at: new Date().toISOString(),
                    nonrecovery_reason: nonrec.trim() || null,
                    finance_decision_pending: finPending.trim() || null,
                  },
                  body: "Closed with recorded outcome",
                })
              }
            >
              Close claim
            </Button>
          </div>
        </div>
      ) : null}
      <Separator />
    </section>
  );
}
