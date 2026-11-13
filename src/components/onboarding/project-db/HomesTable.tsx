/** 2.3 Table view (default): grouped by phase; phone cards; Columns chooser; Upcoming and OwnerRez rows. */
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Columns3 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/onboarding-board";
import {
  OPTIONAL_COLUMNS,
  groupByPhase,
  optionalCell,
  reasonLine,
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
  columns: OptionalColumn[];
  onColumns: (c: OptionalColumn[]) => void;
  /** 2.5: Under contract and Contract fell through (Director, Admin). */
  upcomingActions: ((row: HomeRow) => ReactNode) | null;
  /** 2.6: the OwnerRez group, shown when its tile is on. */
  ownerRez: { rows: OwnerRezRow[]; error: string | null; loading: boolean; added: Set<string>; actions: (r: OwnerRezRow) => ReactNode } | null;
};

export function HomesTable(p: TableProps) {
  const groups = groupByPhase(p.rows);
  const extra = OPTIONAL_COLUMNS.filter((c) => p.columns.includes(c.key));
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
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  Closing <ArrowRight className="size-3" aria-label="to" /> Handoff
                </span>
              </th>
              <th scope="col" className="px-3 py-2 font-medium">Team</th>
              <th scope="col" className="px-3 py-2 font-medium">Schedule</th>
              {extra.map((c) => (
                <th key={c.key} scope="col" className="px-3 py-2 font-medium">{c.label}</th>
              ))}
              <th scope="col" className="w-10 px-2 py-2"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.phase} className="divide-y divide-border border-t border-border">
              <tr className="bg-primary/5">
                <th colSpan={6 + extra.length} scope="colgroup" className="px-3 py-2 text-left text-sm font-semibold text-primary">
                  {g.label} <span className="numeric font-normal">({g.rows.length})</span>
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.propertyId} className="cursor-pointer align-middle hover:bg-muted/30" onClick={() => p.onRowOpen(r)}>
                  <td className="px-3 py-2">
                    {p.rowLink(r, <HomeCell row={r} viewOnly={p.isViewOnly(r)} />, "block")}
                    {r.lifecycle === "upcoming" && p.upcomingActions ? <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>{p.upcomingActions(r)}</div> : null}
                  </td>
                  <td className="px-3 py-2">
                    <StatusChip status={r.status} />
                    <p className="mt-1 text-xs text-muted-foreground">Invoice: {r.invoiceStatus ?? "Not started"}</p>
                  </td>
                  <td className="px-3 py-2"><Dates row={r} /></td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <TeamCircles row={r} pickers={p.pickers} onAssign={p.onAssign} busy={p.assigning} />
                  </td>
                  <td className="px-3 py-2"><Schedule row={r} reason={reasonLine(r, p.tile, p.today)} /></td>
                  {extra.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-sm">{optionalCell(c.key, r)}</td>
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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-h-11 gap-1">
              <Columns3 className="size-4" aria-hidden="true" /> Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-60 space-y-1">
            {OPTIONAL_COLUMNS.map((c) => (
              <label key={c.key} className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox
                  checked={p.columns.includes(c.key)}
                  onCheckedChange={(v) => p.onColumns(v ? [...p.columns, c.key] : p.columns.filter((x) => x !== c.key))}
                />
                {c.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>
    </div>
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
