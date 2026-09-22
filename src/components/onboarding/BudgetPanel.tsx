import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { usDateTime } from "@/lib/dates";
import {
  BUDGET_CATEGORIES,
  BUDGET_LINE_STATUSES,
  CATEGORY_LABEL,
  LINE_STATUS_LABEL,
  budgetHeadline,
  budgetTotals,
  money,
  type BudgetLine,
} from "@/lib/onboarding-budget";
import {
  getOnboardingBudget,
  saveBudgetLineFn,
  setApprovedBudgetFn,
} from "@/lib/onboarding-budget.functions";

const EMPTY_LINE = {
  lineId: null as string | null,
  category: "staging",
  label: "",
  vendor: "",
  estimatedAmount: "",
  committedAmount: "",
  actualAmount: "",
  status: "planned",
  note: "",
  reason: "",
};

/** Budget & Expenses for one onboarding home: what was approved, and where it went. */
export function BudgetPanel({ propertyId, canEdit }: { propertyId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(getOnboardingBudget);
  const saveLine = useServerFn(saveBudgetLineFn);
  const setApproved = useServerFn(setApprovedBudgetFn);

  const { data, isLoading, error } = useQuery({
    queryKey: ["onboarding-budget", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });

  const [lineOpen, setLineOpen] = useState(false);
  const [line, setLine] = useState(EMPTY_LINE);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState("");
  const [basis, setBasis] = useState("");
  const [budgetReason, setBudgetReason] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["onboarding-budget", propertyId] });

  const lineMutation = useMutation({
    mutationFn: (input: Parameters<typeof saveBudgetLineFn>[0]["data"]) => saveLine({ data: input }),
    onSuccess: () => {
      toast.success("Budget line saved.");
      setLineOpen(false);
      setLine(EMPTY_LINE);
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const budgetMutation = useMutation({
    mutationFn: (input: Parameters<typeof setApprovedBudgetFn>[0]["data"]) =>
      setApproved({ data: input }),
    onSuccess: () => {
      toast.success("Approved budget updated.");
      setBudgetOpen(false);
      setBudgetReason("");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading the budget…</p>;
  if (error || !data)
    return <p className="text-sm text-muted-foreground">The budget could not be loaded.</p>;

  const lines = data.lines as BudgetLine[];
  const totals = budgetTotals(lines, data.budget.approved_amount);

  const startEdit = (row: BudgetLine) => {
    setLine({
      lineId: row.id,
      category: row.category,
      label: row.label,
      vendor: row.vendor ?? "",
      estimatedAmount: row.estimated_amount == null ? "" : String(row.estimated_amount),
      committedAmount: row.committed_amount == null ? "" : String(row.committed_amount),
      actualAmount: row.actual_amount == null ? "" : String(row.actual_amount),
      status: row.status,
      note: row.note ?? "",
      reason: "",
    });
    setLineOpen(true);
  };

  const numberOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Budget &amp; expenses</CardTitle>
            <CardDescription>{budgetHeadline(totals)}</CardDescription>
          </div>
          {canEdit && (
            <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setApprovedAmount(
                      data.budget.approved_amount == null ? "" : String(data.budget.approved_amount),
                    );
                    setBasis(data.budget.approved_basis ?? "");
                  }}
                >
                  Set approved budget
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approved budget</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="budget-amount">Approved amount</Label>
                    <Input
                      id="budget-amount"
                      inputMode="decimal"
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="budget-basis">How it was set</Label>
                    <Input
                      id="budget-basis"
                      placeholder="Owner approval, 9/18 walkthrough"
                      value={basis}
                      onChange={(e) => setBasis(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="budget-reason">Reason for this change</Label>
                    <Textarea
                      id="budget-reason"
                      value={budgetReason}
                      onChange={(e) => setBudgetReason(e.target.value)}
                    />
                  </div>
                  <Button
                    disabled={budgetReason.trim().length < 3 || budgetMutation.isPending}
                    onClick={() =>
                      budgetMutation.mutate({
                        propertyId,
                        amount: approvedAmount.trim() === "" ? null : Number(approvedAmount),
                        basis: basis.trim() || null,
                        reason: budgetReason.trim(),
                      })
                    }
                  >
                    Save budget
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Figure label="Approved" value={money(totals.approved)} />
            <Figure label="Estimated" value={money(totals.estimated)} />
            <Figure label="Committed" value={money(totals.committed)} />
            <Figure label="Actual" value={money(totals.actual)} />
            <Figure
              label={totals.over ? "Over by" : "Remaining"}
              value={
                totals.remaining == null
                  ? "—"
                  : money(Math.abs(totals.remaining))
              }
              tone={totals.over ? "warn" : "plain"}
            />
          </div>

          {totals.byCategory.length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="eyebrow">By category</p>
              {totals.byCategory.map((c) => (
                <p key={c.category} className="text-muted-foreground">
                  {c.label}: estimated {money(c.estimated)} · committed {money(c.committed)} ·
                  actual {money(c.actual)}
                </p>
              ))}
            </div>
          )}

          {data.budget.approved_basis && (
            <p className="text-xs text-muted-foreground">
              Budget basis: {data.budget.approved_basis}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Lines</CardTitle>
          {canEdit && (
            <Dialog
              open={lineOpen}
              onOpenChange={(open) => {
                setLineOpen(open);
                if (!open) setLine(EMPTY_LINE);
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">Add a line</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{line.lineId ? "Edit line" : "Add a line"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="line-label">What is it</Label>
                    <Input
                      id="line-label"
                      value={line.label}
                      onChange={(e) => setLine({ ...line, label: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Select
                        value={line.category}
                        onValueChange={(v) => setLine({ ...line, category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUDGET_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Status</Label>
                      <Select
                        value={line.status}
                        onValueChange={(v) => setLine({ ...line, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUDGET_LINE_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="line-vendor">Vendor</Label>
                    <Input
                      id="line-vendor"
                      value={line.vendor}
                      onChange={(e) => setLine({ ...line, vendor: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="line-est">Estimated</Label>
                      <Input
                        id="line-est"
                        inputMode="decimal"
                        value={line.estimatedAmount}
                        onChange={(e) => setLine({ ...line, estimatedAmount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="line-committed">Committed</Label>
                      <Input
                        id="line-committed"
                        inputMode="decimal"
                        value={line.committedAmount}
                        onChange={(e) => setLine({ ...line, committedAmount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="line-actual">Actual</Label>
                      <Input
                        id="line-actual"
                        inputMode="decimal"
                        value={line.actualAmount}
                        onChange={(e) => setLine({ ...line, actualAmount: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="line-note">Note</Label>
                    <Textarea
                      id="line-note"
                      value={line.note}
                      onChange={(e) => setLine({ ...line, note: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="line-reason">Reason for this change</Label>
                    <Textarea
                      id="line-reason"
                      value={line.reason}
                      onChange={(e) => setLine({ ...line, reason: e.target.value })}
                    />
                  </div>
                  <Button
                    disabled={
                      line.label.trim().length < 2 ||
                      line.reason.trim().length < 3 ||
                      lineMutation.isPending
                    }
                    onClick={() =>
                      lineMutation.mutate({
                        propertyId,
                        lineId: line.lineId,
                        category: line.category as "staging",
                        label: line.label.trim(),
                        vendor: line.vendor.trim() || null,
                        estimatedAmount: Number(line.estimatedAmount || 0),
                        committedAmount: numberOrNull(line.committedAmount),
                        actualAmount: numberOrNull(line.actualAmount),
                        status: line.status as "planned",
                        note: line.note.trim() || null,
                        reason: line.reason.trim(),
                      })
                    }
                  >
                    Save line
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {lines.length === 0 ? (
            <EmptyState
              title="No budget lines yet"
              description="Add staging, furniture and contractor costs as they are quoted."
            />
          ) : (
            lines.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3 text-sm"
              >
                <div className="min-w-[14rem]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.label}</span>
                    <Chip>{CATEGORY_LABEL[row.category] ?? row.category}</Chip>
                    <Chip>{LINE_STATUS_LABEL[row.status] ?? row.status}</Chip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.vendor ? `${row.vendor} · ` : ""}
                    estimated {money(row.estimated_amount)} · committed{" "}
                    {money(row.committed_amount)} · actual {money(row.actual_amount)}
                  </p>
                  {row.note && <p className="text-xs text-muted-foreground">{row.note}</p>}
                </div>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change history</CardTitle>
          <CardDescription>Every budget change, who made it and why.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {data.history.length === 0 ? (
            <p className="text-muted-foreground">No changes recorded yet.</p>
          ) : (
            data.history.map((h) => (
              <div key={h.id} className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">{usDateTime(h.changed_at)}</p>
                <p>{h.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {h.field}: {h.old_value ?? "—"} → {h.new_value ?? "—"}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Figure({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "warn";
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="eyebrow">{label}</p>
      <p className={`text-lg font-semibold ${tone === "warn" ? "text-destructive" : ""}`}>
        {value}
      </p>
    </div>
  );
}
