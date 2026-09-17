/** Blank means unknown; invalid amounts must never silently become a cleared cost. */
export function parseWorkOrderCost(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(value))
    throw new Error("Enter costs as non-negative amounts with at most two decimal places.");
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount >= 10_000_000_000)
    throw new Error("The cost is outside the supported range.");
  return amount;
}

export function editWorkOrderCostDraft(
  current: Record<string, string>,
  order: {
    updated_at: string;
    quote_amount: number | null;
    second_quote_amount: number | null;
    final_cost: number | null;
    scope: string | null;
  },
  key: string,
  value: string,
) {
  return {
    ...current,
    ...(current["cost_version"]
      ? {}
      : {
          cost_version: order.updated_at,
          quote_amount: String(order.quote_amount ?? ""),
          second_quote_amount: String(order.second_quote_amount ?? ""),
          final_cost: String(order.final_cost ?? ""),
          scope: order.scope ?? "",
        }),
    [key]: value,
  };
}
