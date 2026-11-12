/** 2.4 Gallery, By status, Gantt (committed tick) and Workload (PMs and stagers as vendors). */
import { cn } from "@/lib/utils";
import { ganttScale, shortDate } from "@/lib/onboarding-board";
import { statusColumns, workloadLists, type HomeRow } from "@/lib/onboarding-home";
import { Photo, type RowLink } from "./HomesTable";

const ScheduleTag = ({ row }: { row: HomeRow }) => (
  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", row.schedule.behind ? "bg-state-blocked/12 text-state-blocked" : "bg-success/15 text-success")}>
    {row.schedule.label}
  </span>
);
const handoff = (r: HomeRow) => (r.handoffOn ? `${shortDate(r.handoffOn)}${r.committedOn ? "" : " (est.)"}` : "No handoff date");

export function GalleryView({ rows, rowLink }: { rows: HomeRow[]; rowLink: RowLink }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Gallery">
      {rows.map((r) => (
        <li key={r.propertyId} className="overflow-hidden rounded-xl border border-border bg-card">
          {rowLink(
            r,
            <>
              <Photo row={r} className="aspect-[16/9] w-full rounded-none" />
              <div className="space-y-1.5 p-3">
                <p className="truncate font-semibold">{r.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {r.status ?? "No status yet"} · PM {r.team.pm?.name ?? "not assigned"}
                </p>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <ScheduleTag row={r} />
                  <span className="numeric text-muted-foreground">Handoff {handoff(r)}</span>
                </div>
              </div>
            </>,
            "block h-full hover:bg-muted/30",
          )}
        </li>
      ))}
    </ul>
  );
}

export function StatusView({ rows, rowLink }: { rows: HomeRow[]; rowLink: RowLink }) {
  const cols = statusColumns(rows);
  return (
    <div className="flex gap-3 overflow-x-auto pb-2" aria-label="By status">
      {cols.map((c) => (
        <section key={c.status} aria-label={c.status} className="w-64 shrink-0 rounded-lg border border-border bg-muted/20 p-2">
          <p className="px-1 pb-2 text-sm font-semibold">
            {c.status} <span className="numeric font-normal text-muted-foreground">({c.rows.length})</span>
          </p>
          <ul className="space-y-2">
            {c.rows.map((r) => (
              <li key={r.propertyId}>
                {rowLink(
                  r,
                  <>
                    <span className="block truncate font-medium">{r.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      PM {r.team.pm?.name ?? "not assigned"} · {handoff(r)}
                    </span>
                    <span className="mt-1 block"><ScheduleTag row={r} /></span>
                  </>,
                  "block min-h-11 rounded-md border border-border bg-card px-2.5 py-2 text-sm hover:bg-muted/40",
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function GanttView({ rows, today, rowLink }: { rows: HomeRow[]; today: string; rowLink: RowLink }) {
  const scale = ganttScale(rows.flatMap((r) => [{ start: r.closingOn, end: r.estimateOn ?? r.committedOn }, { start: r.committedOn, end: r.committedOn }]), today);
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto" aria-label="Gantt">
        <div className="min-w-[760px] pt-5">
          <div className="relative ml-48 h-6 border-b border-border text-xs text-muted-foreground">
            {scale.months.map((m) => (
              <span key={m.label} className="absolute top-0" style={{ left: `${m.left}%` }}>{m.label}</span>
            ))}
          </div>
          <ul className="relative">
            {rows.map((r) => {
              const end = r.estimateOn ?? r.committedOn;
              const start = r.closingOn ? scale.at(r.closingOn) : null;
              const stop = end ? scale.at(end) : null;
              return (
                <li key={r.propertyId} className="flex min-h-11 items-center border-b border-border/60">
                  {rowLink(r, r.name, "w-48 shrink-0 truncate pr-2 text-sm font-medium hover:underline")}
                  <div className="relative h-6 flex-1">
                    <span aria-hidden="true" className="absolute bottom-0 top-0 w-px bg-state-blocked/60" style={{ left: `${scale.today}%` }} />
                    {start != null && stop != null && stop >= start ? (
                      <span
                        className={cn("absolute top-1.5 h-3 rounded-full", r.schedule.behind ? "bg-coral" : "bg-primary/80")}
                        style={{ left: `${start}%`, width: `${Math.max(1, stop - start)}%` }}
                        title={`${shortDate(r.closingOn!)} to ${shortDate(end!)}`}
                      />
                    ) : (
                      <span className="absolute left-1 top-1 text-xs text-muted-foreground">{!r.closingOn ? "No closing date" : "No handoff date"}</span>
                    )}
                    {r.committedOn ? (
                      <span
                        aria-label={`Committed handoff ${shortDate(r.committedOn)}`}
                        title={`Committed handoff ${shortDate(r.committedOn)}`}
                        className="absolute top-0 h-6 w-1 -translate-x-1/2 rounded-sm bg-foreground"
                        style={{ left: `${scale.at(r.committedOn)}%` }}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-full bg-primary/80" />Closing to estimated handoff</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-6 rounded-full bg-coral" />Behind</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-1 rounded-sm bg-foreground" />Committed handoff</span>
        <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-px bg-state-blocked" />Today</span>
      </p>
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: { name: string; homes: number; full: boolean }[] }) {
  const max = Math.max(4, ...rows.map((r) => r.homes));
  return (
    <section aria-label={title} className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None on active homes yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.name} className="flex min-h-11 items-center gap-3 text-sm">
              <span className="w-44 shrink-0 truncate">{r.name}</span>
              <span className="h-4 flex-1 overflow-hidden rounded-full bg-muted">
                <span className={cn("block h-full rounded-full", r.full ? "bg-coral" : "bg-primary")} style={{ width: `${(r.homes / max) * 100}%` }} />
              </span>
              <span className="numeric w-28 shrink-0 text-right text-muted-foreground">
                {r.homes} active home{r.homes === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function WorkloadView({ rows }: { rows: HomeRow[] }) {
  const w = workloadLists(rows);
  return (
    <div className="space-y-5" aria-label="Workload">
      <p className="text-sm text-muted-foreground">Use it before assigning a new home: who has room, and which stager is already booked.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Bars title="Project Managers" rows={w.pms} />
        <Bars title="Stagers" rows={w.stagers} />
      </div>
    </div>
  );
}
