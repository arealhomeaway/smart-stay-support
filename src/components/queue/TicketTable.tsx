/**
 * One ticket table for Team Queue and Operations oversight, so both pages look the same.
 * Pure layout: callers pass the rows, the groups, how each cell reads and where a row goes.
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type TicketTableColumn<T> = {
  key: string;
  header: string;
  /** CSS grid track, for example "88px" or "minmax(220px,1.6fr)". */
  track: string;
  cell: (row: T) => ReactNode;
};

export type TicketTableGroup<T> = {
  key: string;
  /** What sits after the chevron in the group header row. */
  header: ReactNode;
  /** Accessible name for the group button. */
  label: string;
  rows: T[];
  /** Shown instead of a header when the group has no rows (Oversight "all clear"). Left out when absent. */
  empty?: ReactNode;
  /** A full width line after the rows, for example "+3 more". */
  footer?: ReactNode;
};

export function TicketTable<T>({
  columns,
  groups,
  rowKey,
  renderRow,
  lead,
  minWidth = 1240,
  open,
  onToggle,
  label,
  testId,
}: {
  columns: TicketTableColumn<T>[];
  groups: TicketTableGroup<T>[];
  rowKey: (row: T, groupKey: string) => string;
  /** Wraps one row's cells in the row's link or button. Spread `rowProps` (class and grid) on that element and render `children` inside it. */
  renderRow: (row: T, rowProps: { className: string; style: CSSProperties }, children: ReactNode) => ReactNode;
  /** Optional first cell outside the row link (the pick box). */
  lead?: { header: string; track: string; cell: (row: T) => ReactNode };
  minWidth?: number;
  /** Controlled open state; when absent each group opens by default and remembers its own state on this page. */
  open?: Record<string, boolean>;
  onToggle?: (key: string, next: boolean) => void;
  label: string;
  testId?: string;
}) {
  const [local, setLocal] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => (open ? open[key] ?? true : local[key] ?? true);
  const toggle = (key: string) => {
    const next = !isOpen(key);
    if (onToggle) onToggle(key, next);
    else setLocal((prev) => ({ ...prev, [key]: next }));
  };
  const template = columns.map((c) => c.track).join(" ");
  const rowGrid = { gridTemplateColumns: template } as const;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card" data-testid={testId}>
      {/* Width 0 with min width 100% keeps the wide table from stretching the page; it scrolls in its card. */}
      <div className="overflow-x-auto" style={{ width: 0, minWidth: "100%" }} role="region" aria-label={label} tabIndex={0}>
        <div style={{ minWidth }}>
          <div className="flex border-b border-border bg-muted/60 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {lead ? <div className="shrink-0 px-2 py-2.5" style={{ width: lead.track }}><span className="sr-only">{lead.header}</span></div> : null}
            <div className="grid flex-1 items-center gap-3 px-3 py-2.5" style={rowGrid}>
              {columns.map((c) => <div key={c.key}>{c.header}</div>)}
            </div>
          </div>
          {groups.map((g) => {
            if (g.rows.length === 0) {
              if (!g.empty) return null;
              return (
                <div key={g.key} className="border-b border-border px-4 py-2.5 text-sm text-muted-foreground last:border-b-0">
                  {g.empty}
                </div>
              );
            }
            const expanded = isOpen(g.key);
            return (
              <div key={g.key} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-label={`${g.label}, ${expanded ? "hide" : "show"} rows`}
                  onClick={() => toggle(g.key)}
                  className="flex min-h-11 w-full items-center gap-2.5 bg-muted/25 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                >
                  {expanded ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  {g.header}
                </button>
                {expanded ? (
                  <div className="divide-y divide-border border-t border-border">
                    {g.rows.map((row) => (
                      <div key={rowKey(row, g.key)} className="flex items-stretch">
                        {lead ? <div className="flex shrink-0 items-center justify-center" style={{ width: lead.track }}>{lead.cell(row)}</div> : null}
                        {renderRow(
                          row,
                          {
                            className: "grid min-h-14 flex-1 items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                            style: rowGrid,
                          },
                          <>
                            {columns.map((c) => (
                              <div key={c.key} className="min-w-0">{c.cell(row)}</div>
                            ))}
                          </>,
                        )}
                      </div>
                    ))}
                    {g.footer ? <div className="px-4 py-2 text-xs text-muted-foreground">{g.footer}</div> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Two stacked lines: a strong first line and a small grey second line. */
export function TwoLine({ top, sub, topClassName, subClassName }: { top: ReactNode; sub?: ReactNode; topClassName?: string; subClassName?: string }) {
  return (
    <div className="min-w-0">
      <div className={cn("truncate", topClassName)}>{top}</div>
      {sub ? <div className={cn("truncate text-xs text-muted-foreground", subClassName)}>{sub}</div> : null}
    </div>
  );
}

/** A small rounded pill used for priority, status, Unassigned and group labels. */
export function TablePill({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-xs font-semibold", className)}>
      {children}
    </span>
  );
}
