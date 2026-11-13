/** 2.2 Filter bar: My homes / All homes, the tile chip, Search, filters, Clear, Save this view, Download CSV, views. */
import { useState } from "react";
import { ChevronDown, Download, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  FILTER_LABELS,
  HOME_VIEWS,
  MORE_FILTERS,
  filterOptions,
  type FilterKey,
  type Filters,
  type HomeRow,
  type HomeView,
  type SavedView,
  type Scope,
  type TileKey,
} from "@/lib/onboarding-home";

const MAIN_FILTERS: FilterKey[] = ["owner", "sched", "pm", "status", "market", "invoice"];

function FilterMenu(p: { k: FilterKey; rows: HomeRow[]; value: string | undefined; onChange: (v: string | undefined) => void }) {
  const opts = filterOptions(p.k, p.rows);
  const chosen = opts.find((o) => o.value === p.value)?.label;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={p.value ? "secondary" : "outline"} className="min-h-11 gap-1">
          {FILTER_LABELS[p.k]}
          {chosen ? `: ${chosen}` : ""}
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup value={p.value ?? ""} onValueChange={(v) => p.onChange(v || undefined)}>
          <DropdownMenuRadioItem value="" className="min-h-11">Any</DropdownMenuRadioItem>
          {opts.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} className="min-h-11">
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FilterBar(p: {
  tab: "active" | "all";
  scope: Scope;
  counts: { my: number; all: number };
  onScope: (s: Scope) => void;
  tile: { key: TileKey; label: string } | null;
  onClearTile: () => void;
  q: string;
  onQ: (q: string) => void;
  rows: HomeRow[];
  filters: Filters;
  onFilter: (k: FilterKey, v: string | undefined) => void;
  anyOn: boolean;
  onClear: () => void;
  savedViews: SavedView[] | null;
  onSaveView: (name: string) => void;
  onOpenView: (v: SavedView) => void;
  onRemoveView: (v: SavedView) => void;
  saving: boolean;
  onCsv: () => void;
  view: HomeView;
  onView: (v: HomeView) => void;
}) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const moreOn = MORE_FILTERS.filter((k) => p.filters[k]).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {p.tab === "active" ? (
          <div role="group" aria-label="Which homes" className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            {(["my", "all"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={p.scope === s}
                onClick={() => p.onScope(s)}
                className={cn(
                  "numeric min-h-11 rounded-md px-3 text-sm font-medium",
                  p.scope === s ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s === "my" ? `My homes (${p.counts.my})` : `All homes (${p.counts.all})`}
              </button>
            ))}
          </div>
        ) : null}
        {p.tile ? (
          <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-foreground pl-3 pr-1 text-sm font-medium text-background">
            Showing: {p.tile.label}
            <button type="button" aria-label="Clear the tile" onClick={p.onClearTile} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-background/20">
              <X className="size-4" />
            </button>
          </span>
        ) : null}
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Search address, owner or PM" placeholder="Search address, owner or PM" value={p.q} onChange={(e) => p.onQ(e.target.value)} className="min-h-11 pl-9" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {MAIN_FILTERS.map((k) => (
          <FilterMenu key={k} k={k} rows={p.rows} value={p.filters[k]} onChange={(v) => p.onFilter(k, v)} />
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={moreOn ? "secondary" : "outline"} className="min-h-11 gap-1">
              More filters{moreOn ? ` (${moreOn})` : ""}
              <ChevronDown className="size-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(22rem,90vw)] space-y-2">
            {MORE_FILTERS.map((k) => {
              const opts = filterOptions(k, p.rows);
              return (
                <div key={k} className="flex items-center justify-between gap-2">
                  <Label htmlFor={`more-${k}`} className="text-sm">{FILTER_LABELS[k]}</Label>
                  <select
                    id={`more-${k}`}
                    value={p.filters[k] ?? ""}
                    onChange={(e) => p.onFilter(k, e.target.value || undefined)}
                    className="min-h-11 w-44 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="">Any</option>
                    {opts.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </PopoverContent>
        </Popover>
        {p.anyOn ? (
          <Button variant="ghost" className="min-h-11" onClick={p.onClear}>
            Clear filters
          </Button>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-h-11 gap-1">
                Views <ChevronDown className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem className="min-h-11" disabled={p.savedViews === null} onSelect={() => setNaming(true)}>
                Save this view
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Your saved views</DropdownMenuLabel>
              {p.savedViews === null ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">Saved views are not available yet.</p>
              ) : p.savedViews.length === 0 ? (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">None yet.</p>
              ) : (
                p.savedViews.map((v) => (
                  <div key={v.id} className="flex items-center gap-1">
                    <DropdownMenuItem className="min-h-11 flex-1" onSelect={() => p.onOpenView(v)}>
                      {v.name}
                    </DropdownMenuItem>
                    <button type="button" aria-label={`Remove ${v.name}`} onClick={() => p.onRemoveView(v)} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted">
                      <X className="size-4" />
                    </button>
                  </div>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="min-h-11 gap-1" onClick={p.onCsv}>
            <Download className="size-4" aria-hidden="true" /> Download CSV
          </Button>
          {p.tab === "active" ? (
            <div role="tablist" aria-label="View" className="inline-flex flex-wrap rounded-lg border border-border bg-muted/40 p-0.5">
              {HOME_VIEWS.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  role="tab"
                  aria-selected={p.view === v.value}
                  onClick={() => p.onView(v.value)}
                  className={cn("min-h-11 rounded-md px-3 text-sm font-medium", p.view === v.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {v.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <Dialog open={naming} onOpenChange={setNaming}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save this view</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              p.onSaveView(name.trim());
              setNaming(false);
              setName("");
            }}
          >
            <Label htmlFor="view-name">Name</Label>
            <Input id="view-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="min-h-11" autoFocus />
            <DialogFooter>
              <Button type="submit" className="min-h-11" disabled={!name.trim() || p.saving}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
