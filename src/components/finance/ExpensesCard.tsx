import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { useDemo } from "@/components/DemoProvider";
import { useRole } from "@/hooks/useRole";
import { LINK_LABEL, estimateTotal, money, totalsByPeriod, type LinkType } from "@/lib/expenses";
import { LinkExistingExpense } from "./LinkExistingExpense";
import { EXPENSE_SELECT, ExpenseList, type ExpenseRow } from "./ExpenseList";
import { ExpenseSheet, NewExpenseSheet } from "./ExpenseSheet";

/**
 * Expenses linked to one piece of work (Ticket, Work Order, Claim, Property
 * Activity) — or every expense on a property when `linkType` is omitted.
 * Linking never copies the amount; it lives on the expense.
 */
export function ExpensesCard({ propertyId, linkType, targetId }: { propertyId: string | null; linkType?: LinkType; targetId?: string }) {
  const role = useRole();
  const { demoMode } = useDemo();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const key = ["expenses", "card", propertyId, linkType ?? "property", targetId ?? "", demoMode];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      let ids: string[] | null = null;
      if (linkType && targetId) {
        const { data } = await supabase.from("expense_links").select("expense_id").eq("link_type", linkType).eq("target_id", targetId);
        ids = (data ?? []).map((r) => r.expense_id);
        if (ids.length === 0) return { rows: [] as ExpenseRow[] };
      }
      let query = supabase.from("expenses").select(EXPENSE_SELECT).eq("is_demo", demoMode).is("archived_at", null).order("expense_date", { ascending: false });
      if (ids) query = query.in("id", ids);
      else if (propertyId) query = query.eq("property_id", propertyId);
      const { data, error } = await query;
      if (error) throw error;
      return { rows: (data ?? []) as unknown as ExpenseRow[] };
    },
  });

  const [creating, setCreating] = useState(false);
  if (!role.isStaff) return null;
  const rows = q.data?.rows ?? [];
  const periods = totalsByPeriod(rows);
  const estimates = estimateTotal(rows);

  return (
    <SectionCard
      title="Expenses"
      description={linkType ? `Invoices and receipts linked to this ${LINK_LABEL[linkType]}.` : "Every expense recorded for this home."}
      actions={!role.readOnly && <Button size="sm" variant="outline" onClick={() => setCreating(true)}>Add expense</Button>}
    >
      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expenses yet.</p>
        ) : (
          <>
            <ExpenseList rows={rows} onOpen={setOpen} showProperty={false} />
            <p className="text-xs text-muted-foreground">
              Invoiced, by proposed statement period: {periods.length ? periods.map((p) => `${p.period} ${money(p.total)}`).join(" · ") : "none yet"}
              {estimates > 0 && <> · Estimates (not counted): {money(estimates)}</>}
            </p>
          </>
        )}
        {linkType && targetId && !role.readOnly && (
          <LinkExistingExpense propertyId={propertyId} isDemo={demoMode} linkType={linkType} targetId={targetId}
            onLinked={() => void qc.invalidateQueries({ queryKey: ["expenses"] })} />
        )}
      </div>
      <NewExpenseSheet
        open={creating}
        spec={{ propertyId, isDemo: demoMode, linkType, targetId }}
        onClose={() => setCreating(false)}
        onCreated={(id) => { setCreating(false); void qc.invalidateQueries({ queryKey: ["expenses"] }); setOpen(id); }}
      />
      <ExpenseSheet expenseId={open} onClose={() => { setOpen(null); void qc.invalidateQueries({ queryKey: key }); }} />
    </SectionCard>
  );
}
