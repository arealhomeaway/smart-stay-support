type CostRecord = { id: string; final_cost?: number | null; quote_amount?: number | null };
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
function cents(value: number | null | undefined): number | null {
  if (value == null || typeof value !== "number" || !Number.isFinite(value) || value < 0)
    return null;
  const amount = Math.round(value * 100);
  return Number.isSafeInteger(amount) ? amount : null;
}

/** Work Order final_cost is actual spending. Never substitute a quote or approved amount. */
export function ownerTicketCosts(records: CostRecord[]) {
  const unique = new Map<string, CostRecord>();
  let invalid = false;
  for (const record of records) {
    const previous = unique.get(record.id);
    if (previous && previous.final_cost !== record.final_cost) invalid = true;
    unique.set(record.id, record);
  }
  let recorded = 0;
  let subtotal = 0;
  let exceedsQuote = false;
  for (const record of unique.values()) {
    if (record.final_cost == null) continue;
    const amount = cents(record.final_cost);
    if (amount === null) {
      invalid = true;
      continue;
    }
    recorded++;
    subtotal += amount;
    const quote = cents(record.quote_amount);
    if (quote !== null && amount > quote) exceedsQuote = true;
  }
  if (!Number.isSafeInteger(subtotal)) invalid = true;
  const complete = !invalid && unique.size > 0 && recorded === unique.size;
  const recordedAmount = invalid || recorded === 0 ? null : subtotal / 100;
  const summary = invalid
    ? "Recorded actual costs need staff review."
    : recordedAmount === null
      ? "Actual cost has not been recorded for the linked Work Orders."
      : complete
        ? `Recorded Work Order actual cost: ${money.format(recordedAmount)}.`
        : `Recorded actual cost so far: ${money.format(recordedAmount)} across ${recorded} of ${unique.size} Work Orders. This is not the complete cost.`;
  return {
    recordedAmount,
    complete,
    recordedCount: recorded,
    workOrderCount: unique.size,
    needsReview: invalid || exceedsQuote,
    summary:
      summary +
      (exceedsQuote
        ? " Actual cost exceeds the recorded quote. Staff must review the difference; the recorded authority explanation does not authorize the overrun."
        : ""),
  };
}
