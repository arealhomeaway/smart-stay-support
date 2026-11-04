import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CATEGORIES, STATUSES } from "@/lib/tickets";
import { relativeTime } from "@/lib/dates";
import { sameCategoryHistory, type HistoryCategoryKey } from "@/lib/property-history";

export type PropertyHistoryRow = {
  id: string;
  title: string;
  status: string;
  reported_at: string;
  category: string | null;
  maintenance_category?: string | null;
};

const labelFor = (list: readonly { value: string; label: string }[], v: string | null | undefined) =>
  list.find((x) => x.value === v)?.label ?? v ?? "No category";

export function PropertyHistoryList({
  history,
  categoryKey,
  categoryLabel,
}: {
  history: PropertyHistoryRow[];
  categoryKey: HistoryCategoryKey;
  categoryLabel: string;
}) {
  const [showAll, setShowAll] = useState(categoryKey === null);
  const rows = showAll ? history : sameCategoryHistory(history, categoryKey);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/50 px-3 py-2">
        <p className="text-sm">
          {showAll
            ? "Showing the full history for this home, all categories and all dates."
            : `Showing only ${categoryLabel} history at this home, all dates. Other issues and older records with no category are in the full history.`}
        </p>
        {categoryKey && (
          <Button size="sm" variant="outline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Show only ${categoryLabel}` : "Show full property history"}
          </Button>
        )}
      </div>
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {showAll
            ? "No other tickets at this home."
            : `No earlier ${categoryLabel} tickets at this home. Check the full history for other issues.`}
        </p>
      )}
      {rows.map((h) => (
        <Link
          key={h.id}
          to="/tickets/$ticketId"
          params={{ ticketId: h.id }}
          className="block rounded-md border border-border p-2 text-sm transition-colors hover:bg-secondary"
        >
          <p className="font-medium">{h.title}</p>
          <p className="text-xs text-muted-foreground">
            {labelFor(CATEGORIES, h.category)} · {labelFor(STATUSES, h.status)} · {relativeTime(h.reported_at)}
          </p>
        </Link>
      ))}
    </div>
  );
}
