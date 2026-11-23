/**
 * 2.3 Table view (default): grouped by phase; phone cards; Columns chooser; Upcoming and OwnerRez rows.
 * Nov 23: each person drags, shows and hides every column but Home, saved for them; the Stager /
 * on-site team column shows the home's Stager.
 */
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, ChevronRight, Columns3, GripVertical } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/onboarding-board";
import {
  HOME_COLUMNS,
  columnChooserList,
  groupByPhase,
  moveColumn,
  optionalCell,
  reasonLine,
  stagerCell,
  toggleColumn,
  type HomeColumn,
  type HomeRow,
  type OptionalColumn,
  type OwnerRezRow,
  type Person,
  type TeamRole,
  type TileKey,
} from "@/lib/onboarding-home";
import { TeamCircles, TeamLegend, type AssignChoice } from "./TeamCircles";

export type RowLink = (row: HomeRow, children: ReactNode, className?: string) => ReactNode;

export function Photo({ row, className }: { row: Pick<HomeRow, "photo" | "lifecycle">; className?: string }) {
  if (row.lifecycle === "upcoming" || !row.photo)
    return (
      <span
        aria-hidden="true"
        className={cn(
          "block shrink-0 rounded-md",
          row.lifecycle === "upcoming"
            ? "stripe-placeholder"
            : "bg-warm",
          className,
        )}
      />
    );
  return <img src={row.photo} alt="" loading="lazy" className={cn("shrink-0 rounded-md object-cover", className)} />;
}

export function StatusChip({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">No status yet</span>;
  const tone =
    status === "Property Handed Off" ? "bg-success/15 text-success" : status === "Contract Fell Through" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary";
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", tone)}>{status}</span>;
}

export function Schedule({ row, reason }: { row: HomeRow; reason: string | null }) {
  return (
    <div className="space-y-0.5">
      <span className={cn("text-sm font-medium", row.schedule.behind ? "text-state-blocked" : "text-success")}>{row.schedule.label}</span>
      {reason ? <p className="text-xs text-state-blocked">{reason}</p> : null}
    </div>
  );
}

function Dates({ row }: { row: HomeRow }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="numeric">{row.closingOn ? `${row.closed ? "Closed" : "Closes"} ${shortDate(row.closingOn)}` : "No closing date"}</p>
      <p className="numeric">
        {row.handoffOn ? `Handoff ${shortDate(row.handoffOn)}` : "No handoff date"}
        {row.handoffOn && !row.committedOn ? <span className="text-warning-ink"> (est.)</span> : null}
      </p>
      <span className="block h-1 w-28 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className={cn("block h-full rounded-full", row.schedule.behind ? "bg-coral" : "bg-primary")} style={{ width: `${(row.stage / 6) * 100}%` }} />
      </span>
    </div>
  );
}

function HomeCell({ row, viewOnly }: { row: HomeRow; viewOnly: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Photo row={row} className="h-[42px] w-14" />
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-medium">
          <span className="truncate">{row.name}</span>
          {viewOnly ? <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">View only</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {row.place || "No city yet"} · {row.activeOwner ? <span className="text-warning-ink">Active Owner</span> : "Standard"}
        </p>
      </div>
    </div>
  );
}

export type TableProps = {
  rows: HomeRow[];
  total: number;
  tile: TileKey | null;
  today: string;
  isViewOnly: (row: HomeRow) => boolean;
  rowLink: RowLink;
  onRowOpen: (row: HomeRow) => void;
  pickers: Record<TeamRole, Person[]> | null;
  onAssign: (row: HomeRow, choice: AssignChoice) => void;
  assigning: boolean;
  /** The shown columns after Home, in order. */
  columns: HomeColumn[];
  onColumns: (c: HomeColumn[]) => void;
  /** 2.5: Under contract and Contract fell through (Director, Admin). */
  upcomingActions: ((row: HomeRow) => ReactNode) | null;
  /** 2.6: the OwnerRez group, shown when its tile is on. */
  ownerRez: { rows: OwnerRezRow[]; error: string | null; loading: boolean; added: Set<string>; actions: (r: OwnerRezRow) => ReactNode } | null;
};

const COLUMN_LABEL = new Map(HOME_COLUMNS.map((c) => [c.key, c.label] as const));

function ColumnHead({ k }: { k: HomeColumn }) {
  if (k === "dates")
    return (
      <span className="inline-flex items-center gap-1">
        Closing <ArrowRight className="size-3" aria-label="to" /> Handoff
      </span>
    );
  return <>{COLUMN_LABEL.get(k) ?? k}</>;
}

function cellFor(k: HomeColumn, r: HomeRow, p: TableProps): ReactNode {
  switch (k) {
    case "status":
      return (
        <>
          <StatusChip status={r.status} />
          <p className="mt-1 text-xs text-muted-foreground">Invoice: {r.invoiceStatus ?? "Not started"}</p>
        </>
      );
    case "dates":
      return <Dates row={r} />;
    case "team":
      return <TeamCircles row={r} pickers={p.pickers} onAssign={p.onAssign} busy={p.assigning} />;
    case "schedule":
      return <Schedule row={r} reason={reasonLine(r, p.tile, p.today)} />;
    case "stager": {
      const name = stagerCell(r);
      return name ? <span className="text-sm">{name}</span> : <span className="text-xs text-muted-foreground">Not set</span>;
    }
    default:
      return <span className="text-sm">{optionalCell(k as OptionalColumn, r)}</span>;
  }
}

export function HomesTable(p: TableProps) {
  const groups = groupByPhase(p.rows);
  const shown = p.columns;
  const [dragging, setDragging] = useState<HomeColumn | null>(null);
  const dropOn = (target: HomeColumn) => (e: DragEvent) => {
    e.preventDefault();
    if (dragging) p.onColumns(moveColumn(shown, dragging, target));
    setDragging(null);
  };
  return (
    <div className="space-y-4">
      {p.ownerRez ? <OwnerRezGroup {...p.ownerRez} /> : null}
      {groups.length === 0 && !p.ownerRez ? <p className="text-sm text-muted-foreground">No homes match.</p> : null}
      {/* Desktop and tablet: the table. */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full min-w-[880px] text-sm" aria-label="Homes">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Home</th>
              {shown.map((k) => (
                <th
                  key={k}
                  scope="col"
                  draggable
                  onDragStart={(e) => {
                    setDragging(k);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={dropOn(k)}
                  onDragEnd={() => setDragging(null)}
                  className={cn("cursor-grab select-none px-3 py-2 font-medium", dragging === k && "opacity-50")}
                  title="Drag to move"
                >
                  <ColumnHead k={k} />
                </th>
              ))}
              <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.phase} className="divide-y divide-border border-t border-border">
              <tr className="bg-primary/5">
                <th colSpan={2 + shown.length} scope="colgroup" className="px-3 py-2 text-left text-sm font-semibold text-primary">
                  {g.label} <span className="numeric font-normal">({g.rows.length})</span>
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.propertyId} className="cursor-pointer align-middle hover:bg-muted/30" onClick={() => p.onRowOpen(r)}>
                  <td className="px-3 py-2">
                    {p.rowLink(r, <HomeCell row={r} viewOnly={p.isViewOnly(r)} />, "block")}
                    {r.lifecycle === "upcoming" && p.upcomingActions ? <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>{p.upcomingActions(r)}</div> : null}
                  </td>
                  {shown.map((k) => (
                    <td key={k} className="px-3 py-2" onClick={k === "team" ? (e) => e.stopPropagation() : undefined}>
                      {cellFor(k, r, p)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-muted-foreground"><ChevronRight className="size-4" aria-hidden="true" /></td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {/* Phone: each row becomes a card. */}
      <div className="space-y-4 md:hidden">
        {groups.map((g) => (
          <section key={g.phase} aria-label={g.label} className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">
              {g.label} <span className="numeric font-normal">({g.rows.length})</span>
            </h3>
            <ul className="space-y-2">
              {g.rows.map((r) => (
                <li key={r.propertyId} className="rounded-xl border border-border bg-card p-3">
                  {p.rowLink(
                    r,
                    <div className="space-y-2">
                      <HomeCell row={r} viewOnly={p.isViewOnly(r)} />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StatusChip status={r.status} />
                        <span className="numeric text-xs">
                          {r.handoffOn ? `Handoff ${shortDate(r.handoffOn)}` : "No handoff date"}
                          {r.handoffOn && !r.committedOn ? <span className="text-warning-ink"> (est.)</span> : null}
                        </span>
                      </div>
                      <Schedule row={r} reason={reasonLine(r, p.tile, p.today)} />
                    </div>,
                    "block",
                  )}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <TeamCircles row={r} pickers={p.pickers} onAssign={p.onAssign} busy={p.assigning} />
                    {r.lifecycle === "upcoming" && p.upcomingActions ? <div className="flex flex-wrap gap-2">{p.upcomingActions(r)}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="numeric text-sm text-muted-foreground">
          {p.rows.length} of {p.total} homes
        </p>
        <TeamLegend />
        <ColumnChooser columns={shown} onColumns={p.onColumns} />
      </div>
    </div>
  );
}

/** Columns: tick to show or hide, drag (or the arrows) to move. Home always stays first. */
function ColumnChooser(p: { columns: HomeColumn[]; onColumns: (c: HomeColumn[]) => void }) {
  const list = columnChooserList(p.columns);
  const [dragging, setDragging] = useState<HomeColumn | null>(null);
  const step = (k: HomeColumn, by: -1 | 1) => {
    const i = p.columns.indexOf(k);
    const target = p.columns[i + by];
    if (target) p.onColumns(moveColumn(p.columns, k, target));
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-h-11 gap-1">
          <Columns3 className="size-4" aria-hidden="true" /> Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-1">
        <p className="px-1 pb-1 text-xs text-muted-foreground">Home stays first. Drag to change the order.</p>
        {list.map((c, i) => (
          <div
            key={c.key}
            draggable={c.shown}
            onDragStart={() => setDragging(c.key)}
            onDragOver={(e) => c.shown && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging && c.shown) p.onColumns(moveColumn(p.columns, dragging, c.key));
              setDragging(null);
            }}
            onDragEnd={() => setDragging(null)}
            className={cn("flex min-h-11 items-center gap-1 rounded-md", c.shown && "cursor-grab", dragging === c.key && "opacity-50")}
          >
            <GripVertical className={cn("size-4 shrink-0", c.shown ? "text-muted-foreground" : "text-transparent")} aria-hidden="true" />
            <label className="flex min-h-11 flex-1 items-center gap-2 text-sm">
              <Checkbox checked={c.shown} onCheckedChange={() => p.onColumns(toggleColumn(p.columns, c.key))} />
              {c.label}
            </label>
            {c.shown ? (
              <>
                <button type="button" aria-label={`Move ${c.label} left`} disabled={i === 0} onClick={() => step(c.key, -1)} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30">
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
                <button type="button" aria-label={`Move ${c.label} right`} disabled={i === p.columns.length - 1} onClick={() => step(c.key, 1)} className="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30">
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function OwnerRezGroup(p: NonNullable<TableProps["ownerRez"]>) {
  return (
    <section aria-label="In OwnerRez, not in Resolve yet" className="space-y-2 rounded-xl border border-border p-3">
      <h3 className="text-sm font-semibold text-primary">
        In OwnerRez, not in Resolve yet <span className="numeric font-normal">({p.rows.length})</span>
      </h3>
      {p.loading ? (
        <p className="text-sm text-muted-foreground">Checking OwnerRez…</p>
      ) : p.error ? (
        <p role="alert" className="text-sm text-destructive">{p.error}</p>
      ) : p.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Every OwnerRez home is here.</p>
      ) : (
        <ul className="divide-y divide-border">
          {p.rows.map((r) => (
            <li key={r.listingId} className="flex flex-wrap items-center gap-3 py-2">
              <Photo row={{ photo: null, lifecycle: "upcoming" }} className="h-[42px] w-14" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  OwnerRez {r.listingId}
                  {r.addedOn ? ` · added to OwnerRez ${shortDate(r.addedOn)}` : ""} · no onboarding project
                </p>
              </div>
              {p.added.has(r.listingId) ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">Added</span> : p.actions(r)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 2.1 All projects, including past: read only; rows open the home in Properties. */
export function PastProjects({ rows }: { rows: HomeRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No past projects match.</p>;
  return (
    <ul className="divide-y divide-border rounded-xl border border-border" aria-label="Past projects">
      {rows.map((r) => (
        <li key={r.propertyId}>
          <Link to="/property/$propertyId" params={{ propertyId: r.propertyId }} className="flex min-h-14 flex-wrap items-center gap-3 px-3 py-2 hover:bg-muted/30">
            <Photo row={r} className="h-[42px] w-14" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[r.handoffOn ? `Handoff ${shortDate(r.handoffOn)}` : null, r.team.pm ? `PM ${r.team.pm.name}` : null, r.note].filter(Boolean).join(" · ")}
              </p>
            </div>
            <StatusChip status={r.lifecycle === "fell_through" ? "Contract Fell Through" : "Property Handed Off"} />
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
