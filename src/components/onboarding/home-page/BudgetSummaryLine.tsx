/** Property page Part 3 (3.4): one summary line above the Budget and Invoices sections. */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOnboardingBudget } from "@/lib/onboarding-budget.functions";
import { budgetTotals, lineSpend, money, type BudgetLine } from "@/lib/onboarding-budget";
import { budgetSummaryLine } from "@/lib/home-details";

export function BudgetSummaryLine({ propertyId, invoiceStatus }: { propertyId: string; invoiceStatus: string | null }) {
  const load = useServerFn(getOnboardingBudget);
  const q = useQuery({ queryKey: ["onboarding-budget", propertyId], queryFn: () => load({ data: { propertyId } }) });
  if (!q.data) return null;
  const lines = q.data.lines as BudgetLine[];
  const t = budgetTotals(lines, q.data.budget.approved_amount);
  const spent = lines.reduce((sum, l) => sum + lineSpend(l), 0);
  return (
    <p className="surface numeric px-4 py-3 text-sm font-medium" data-testid="budget-summary">
      {budgetSummaryLine({ approved: t.approved, spent, remaining: t.remaining, over: t.over }, invoiceStatus, money)}
    </p>
  );
}
