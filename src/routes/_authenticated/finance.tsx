import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadingRows, PageHeader, SectionCard, SegmentedControl } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { EXPENSE_SELECT, ExpenseList, type ExpenseRow } from "@/components/finance/ExpenseList";
import { ExpenseSheet, NewExpenseSheet } from "@/components/finance/ExpenseSheet";
import { docReadiness, financeQueue, money, totalsByPeriod, type FinanceQueue } from "@/lib/expenses";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Resolve" },
      { name: "description", content: "Property expense review: unmatched invoices, clarifications, reservation links and Finance review." },
      { property: "og:title", content: "Finance — Resolve" },
      { property: "og:description", content: "Internal property expense review for ARHA Finance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="finance_workspace" title="Only Finance, leadership and administrators can open Finance">
      <FinancePage />
    </RequireCapability>
  ),
});

type Tab = FinanceQueue | "period";
const TABS: { value: Tab; label: string }[] = [
  { value: "review", label: "Review queue" },
  { value: "needs_clarification", label: "Needs clarification" },
  { value: "unmatched", label: "Unmatched" },
  { value: "reservation_unresolved", label: "Reservation unresolved" },
  { value: "in_progress", label: "Still with Operations" },
  { value: "reviewed", label: "Reviewed" },
  { value: "period", label: "By statement period" },
];

function FinancePage() {
  const { demoMode } = useDemo();
  const role = useRole();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("review");
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["expenses", "finance", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select(EXPENSE_SELECT).eq("is_demo", demoMode).is("archived_at", null).order("received_on");
      if (error) throw error;
      return (data ?? []) as unknown as ExpenseRow[];
    },
  });
  const grouped = useMemo(() => {
    const m = new Map<Tab, ExpenseRow[]>();
    for (const e of q.data ?? []) {
      const k = financeQueue({ links: (e.expense_links ?? []).length, reservation_link_state: e.reservation_link_state, ownerrez_booking_id: e.ownerrez_booking_id, finance_review: e.finance_review, ops_completion: e.ops_completion, ready: docReadiness(e) === "ready" });
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [q.data]);

  const [creating, setCreating] = useState(false);

  const rows = tab === "period" ? (q.data ?? []) : (grouped.get(tab) ?? []);
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Property expenses"
        description="Operations records facts and documents; Finance reviews and sets treatment. QuickBooks stays the accounting record and OwnerRez the statement record. No cutoff or review deadline is applied."
        actions={!role.readOnly && <Button onClick={() => setCreating(true)}>Enter invoice</Button>}
      />
      <SegmentedControl ariaLabel="Finance queues" value={tab} onChange={setTab} options={TABS.map((t) => (t.value === "period" ? t : { ...t, count: grouped.get(t.value)?.length ?? 0 }))} />
      <SectionCard>
        {q.isLoading ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing here" hint="Expenses appear here as Operations and Finance record them." />
        ) : tab === "period" ? (
          <div className="space-y-4">
            {totalsByPeriod(rows).map((p) => (
              <div key={p.period} className="space-y-2">
                <p className="font-medium">{p.period} — {money(p.total)} <span className="text-xs text-muted-foreground">(proposed period; not reconciled)</span></p>
                <ExpenseList rows={rows.filter((r) => (r.proposed_statement_period ? r.proposed_statement_period.slice(0, 7) : "Not assigned") === p.period)} onOpen={setOpen} />
              </div>
            ))}
          </div>
        ) : (
          <ExpenseList rows={rows} onOpen={setOpen} />
        )}
      </SectionCard>
      <NewExpenseSheet
        open={creating}
        spec={{ propertyId: null, isDemo: demoMode }}
        onClose={() => setCreating(false)}
        onCreated={(id) => { setCreating(false); void qc.invalidateQueries({ queryKey: ["expenses"] }); setOpen(id); }}
      />
      <ExpenseSheet expenseId={open} onClose={() => setOpen(null)} />
    </div>
  );
}
