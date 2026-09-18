import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export type CollectionViewOption<T extends string> = { value: T; label: string; disabled?: boolean };
/** The same small control vocabulary for work collections; callers supply only applicable views. */
export function CollectionViewControls<T extends string>({ label, view, views, onViewChange, sort, sortOptions, onSortChange,
  filters, onClear, activeFilters = 0 }: {
  label: string; view: T; views: CollectionViewOption<T>[]; onViewChange: (view: T) => void;
  sort?: string; sortOptions?: CollectionViewOption<string>[]; onSortChange?: (sort: string) => void;
  filters?: ReactNode; onClear?: () => void; activeFilters?: number;
}) {
  return <nav aria-label={`${label} views and filters`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
    {views.length > 1 && <span className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">View</span>}
    {views.length > 1 && views.map((option) => <Button key={option.value} type="button" size="sm" variant={view === option.value ? "default" : "ghost"}
      aria-current={view === option.value ? "page" : undefined} disabled={option.disabled} onClick={() => onViewChange(option.value)}>{option.label}</Button>)}
    {filters && <div className="flex flex-wrap items-center gap-2"><span className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter</span>{filters}</div>}
    {activeFilters > 0 && onClear && <Button type="button" size="sm" variant="outline" onClick={onClear}>Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}</Button>}
    {sort && sortOptions && onSortChange && <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">Sort
      <select className="min-h-9 rounded border border-input bg-background px-2 text-foreground" value={sort} onChange={(event) => onSortChange(event.target.value)}>
        {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>}
  </nav>;
}
