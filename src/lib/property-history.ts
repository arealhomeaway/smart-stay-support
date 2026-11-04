/**
 * Property history on a Ticket: the default view shows only earlier Tickets
 * with the same issue category at this home, from all dates. Records with no
 * category only appear in the full history.
 */
export type HistoryCategoryKey = { field: "maintenance_category" | "category"; value: string } | null;

export function historyCategoryKey(ticket: {
  maintenance_category?: string | null;
  category?: string | null;
}): HistoryCategoryKey {
  if (ticket.maintenance_category) return { field: "maintenance_category", value: ticket.maintenance_category };
  if (ticket.category) return { field: "category", value: ticket.category };
  return null;
}

export function sameCategoryHistory<T extends { maintenance_category?: string | null; category?: string | null }>(
  rows: T[],
  key: HistoryCategoryKey,
): T[] {
  if (!key) return [];
  return rows.filter((r) => {
    const v = r[key.field];
    return typeof v === "string" && v !== "" && v === key.value;
  });
}
