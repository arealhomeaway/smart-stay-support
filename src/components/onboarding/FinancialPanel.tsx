import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, EmptyState } from "@/components/ui/page";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUTHORITY_TIER_LABELS, authorityLadder, authorityTier } from "@/lib/maintenance-policy";
import {
  FINANCIAL_KINDS,
  FINANCIAL_STATUS_LABELS,
  financialNextAction,
  financialStatus,
  financialTotals,
  tierFor,
  varianceLabel,
  varianceNeedsNote,
  type FinancialRequest,
} from "@/lib/onboarding-finance";
import {
  createFinancialRequestFn,
  decideFinancialRequestFn,
  getOnboardingFinance,
  recordInvoiceFn,
  sendFinancialForApprovalFn,
  sendToAccountingFn,
  setAccountingRecipientFn,
  settleFinancialRequestFn,
} from "@/lib/onboarding-finance.functions";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function FinancialPanel({
  propertyId,
  canEdit,
  isAdmin,
}: {
  propertyId: string;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const load = useServerFn(getOnboardingFinance);
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-finance", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["onboarding-finance", propertyId] });
  const run = <T,>(fn: (input: T) => Promise<unknown>, ok: string) =>
    ({
      mutationFn: (input: T) => fn(input),
      onSuccess: () => {
        toast.success(ok);
        invalidate();
      },
      onError: (e: Error) => toast.error(e.message),
    }) as const;

  const create = useMutation(run(useServerFn(createFinancialRequestFn), "Cost request created."));
  const send = useMutation(run(useServerFn(sendFinancialForApprovalFn), "Sent for approval."));
  const decide = useMutation(run(useServerFn(decideFinancialRequestFn), "Decision recorded."));
  const invoice = useMutation(run(useServerFn(recordInvoiceFn), "Invoice recorded."));
  const accounting = useMutation(run(useServerFn(sendToAccountingFn), "Sent to accounting."));
  const settle = useMutation(run(useServerFn(settleFinancialRequestFn), "Marked settled."));
  const recipient = useMutation(run(useServerFn(setAccountingRecipientFn), "Accounting recipient saved."));

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kind: "repair",
    title: "",
    vendor: "",
    description: "",
    estimateAmount: "",
    emergency: false,
    emergencyReason: "",
  });
  const [recipientEmail, setRecipientEmail] = useState("");

  if (isLoading || !data) return <p className="text-muted-foreground">Loading costs…</p>;

  const requests = (data.requests ?? []) as unknown as FinancialRequest[];
  const totals = financialTotals(requests);
  const amount = Number(form.estimateAmount || 0);
  const tier = authorityTier(amount, { emergency: form.emergency });

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Spend authority</CardTitle>
          {canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">New cost request</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>New cost request</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Kind</Label>
                      <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FINANCIAL_KINDS.map((k) => (
                            <SelectItem key={k.value} value={k.value}>
                              {k.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Estimate ($)</Label>
                      <Input
                        inputMode="decimal"
                        value={form.estimateAmount}
                        onChange={(e) => setForm({ ...form, estimateAmount: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>What is it for</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vendor (optional)</Label>
                    <Input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Detail (optional)</Label>
                    <Textarea
                      rows={3}
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.emergency}
                      onCheckedChange={(v) => setForm({ ...form, emergency: Boolean(v) })}
                    />
                    Emergency — mitigate now under a documented exception
                  </label>
                  {form.emergency ? (
                    <div className="space-y-1.5">
                      <Label>Emergency reason</Label>
                      <Input
                        value={form.emergencyReason}
                        onChange={(e) => setForm({ ...form, emergencyReason: e.target.value })}
                      />
                    </div>
                  ) : null}
                  <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    {AUTHORITY_TIER_LABELS[tier]} — {money(amount)}
                  </p>
                  <Button
                    className="w-full"
                    disabled={create.isPending || form.title.trim().length < 3 || !(amount >= 0)}
                    onClick={() =>
                      create.mutate(
                        {
                          data: {
                            propertyId,
                            kind: form.kind,
                            title: form.title.trim(),
                            vendor: form.vendor.trim() || null,
                            description: form.description.trim() || null,
                            estimateAmount: amount,
                            emergency: form.emergency,
                            emergencyReason: form.emergencyReason.trim() || null,
                          },
                        } as never,
                        { onSuccess: () => setOpen(false) },
                      )
                    }
                  >
                    Create request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-1 text-sm text-muted-foreground">
            {authorityLadder().map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-4 pt-2 text-sm">
            <span>Estimated {money(totals.estimate)}</span>
            <span>Approved {money(totals.approved)}</span>
            <span>Invoiced {money(totals.invoiced)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Accounting handoff</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {data.accountingRecipient
              ? `Settled costs are sent to ${data.accountingRecipient}.`
              : "No accounting recipient is configured yet, so costs cannot be sent on."}
          </p>
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-xs"
                placeholder="accounting@example.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={recipient.isPending || !recipientEmail.includes("@")}
                onClick={() => recipient.mutate({ data: { email: recipientEmail.trim() } } as never)}
              >
                Save recipient
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {requests.length === 0 ? (
        <EmptyState title="No costs yet" description="Cost requests for this home will show here." />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              canEdit={canEdit}
              onSend={() => send.mutate({ data: { requestId: r.id } } as never)}
              onDecide={(approved, note, approvedAmount) =>
                decide.mutate({ data: { requestId: r.id, approved, note, approvedAmount } } as never)
              }
              onInvoice={(invoiceAmount, invoiceRef, varianceNote) =>
                invoice.mutate({ data: { requestId: r.id, invoiceAmount, invoiceRef, varianceNote } } as never)
              }
              onAccounting={() => accounting.mutate({ data: { requestId: r.id } } as never)}
              onSettle={(note) => settle.mutate({ data: { requestId: r.id, note } } as never)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request,
  canEdit,
  onSend,
  onDecide,
  onInvoice,
  onAccounting,
  onSettle,
}: {
  request: FinancialRequest;
  canEdit: boolean;
  onSend: () => void;
  onDecide: (approved: boolean, note: string, approvedAmount: number | null) => void;
  onInvoice: (amount: number, ref: string | null, note: string | null) => void;
  onAccounting: () => void;
  onSettle: (note: string) => void;
}) {
  const status = financialStatus(request);
  const tier = tierFor(request);
  const [note, setNote] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");

  return (
    <Card>
      <CardHeader className="gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">{request.title}</CardTitle>
          <Chip>{FINANCIAL_STATUS_LABELS[status]}</Chip>
          <Chip>{AUTHORITY_TIER_LABELS[tier]}</Chip>
        </div>
        <p className="text-sm text-muted-foreground">{financialNextAction(request)}</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          <span>Estimate {money(request.estimate_amount)}</span>
          <span>Approved {money(request.approved_amount)}</span>
          <span>Invoice {money(request.invoice_amount)}</span>
          {request.vendor ? <span>Vendor {request.vendor}</span> : null}
          <span>{varianceLabel(request)}</span>
        </div>

        {canEdit && status === "estimate" ? (
          <Button size="sm" onClick={onSend}>
            {tier === "owner" ? "Send to homeowner" : tier === "supervisor" ? "Send to supervisor" : "Record and continue"}
          </Button>
        ) : null}

        {canEdit && status === "awaiting_approval" ? (
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder="Decision note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" disabled={note.trim().length < 3} onClick={() => onDecide(true, note.trim(), null)}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={note.trim().length < 3}
                onClick={() => onDecide(false, note.trim(), null)}
              >
                Decline
              </Button>
            </div>
          </div>
        ) : null}

        {canEdit && (status === "approved" || (status === "estimate" && tier === "proceed")) ? (
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-[8rem]"
              inputMode="decimal"
              placeholder="Invoice $"
              value={invoiceAmount}
              onChange={(e) => setInvoiceAmount(e.target.value)}
            />
            <Input
              className="max-w-[10rem]"
              placeholder="Invoice ref"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!invoiceAmount}
              onClick={() => onInvoice(Number(invoiceAmount), invoiceRef.trim() || null, null)}
            >
              Record invoice
            </Button>
          </div>
        ) : null}

        {canEdit && status === "invoiced" ? (
          <div className="space-y-2">
            {varianceNeedsNote(request) && !request.variance_note ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-sm"
                  placeholder="Why the invoice differs from the approved amount"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={note.trim().length < 3}
                  onClick={() =>
                    onInvoice(Number(request.invoice_amount ?? 0), request.invoice_ref ?? null, note.trim())
                  }
                >
                  Save variance note
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={onAccounting}>
                Send to accounting
              </Button>
            )}
          </div>
        ) : null}

        {canEdit && status === "sent_to_accounting" ? (
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-sm"
              placeholder="Settlement note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button size="sm" disabled={note.trim().length < 3} onClick={() => onSettle(note.trim())}>
              Mark settled
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
