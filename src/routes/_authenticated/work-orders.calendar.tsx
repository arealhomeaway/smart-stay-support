/**
 * The dedicated Work Order calendar.
 *
 * Month view answers "what is committed this month"; the timeline answers
 * "what is coming next". Conflicts — the same vendor or the same home booked
 * twice on one day — are derived from the schedule itself and shown where the
 * booking is, and every entry opens the Work Order it belongs to.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  LoadingRows,
  PageHeader,
  SectionCard,
  SegmentedControl,
  StatTile,
} from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { usDate, usTime } from "@/lib/dates";
import {
  useWorkOrderPropertyNames,
  useWorkOrderPropertyPhotos,
  useWorkOrders,
} from "@/components/workorders/WorkOrderList";
import { WorkOrderDrawer } from "@/components/workorders/WorkOrderDrawer";
import { useAmbientOrigin } from "@/components/nav/NavContext";
import { useStaffDirectory } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import {
  CONFLICT_LABELS,
  calendarDay,
  calendarMonth,
  conflictCount,
  monthGrid,
  monthLabel,
  scheduleEntries,
  shiftMonth,
  timelineDays,
  unscheduled,
  type ScheduledWorkOrder,
} from "@/lib/work-order-calendar";
import type { WorkOrderRow } from "@/lib/work-order-types";

export const Route = createFileRoute("/_authenticated/work-orders/calendar")({
  validateSearch: (raw: Record<string, unknown>) => ({
    view: raw["view"] === "timeline" ? ("timeline" as const) : undefined,
    month: typeof raw["month"] === "string" ? raw["month"] : undefined,
    open: typeof raw["open"] === "string" ? raw["open"] : undefined,
  }),
  component: WorkOrderCalendar,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WorkOrderCalendar() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const view = search.view === "timeline" ? "timeline" : "month";
  const month = calendarMonth(search.month);

  const workOrders = useWorkOrders();
  const propertyNames = useWorkOrderPropertyNames();
  const propertyPhotos = useWorkOrderPropertyPhotos().data ?? new Map<string, string | null>();
  const people = useStaffDirectory().data ?? [];
  const originToken = useAmbientOrigin("Work order calendar");
  const { readOnly } = useRole();

  const rows = useMemo(() => workOrders.data ?? [], [workOrders.data]);
  const entries = useMemo(() => scheduleEntries(rows), [rows]);
  const grid = useMemo(() => monthGrid(month, entries), [month, entries]);
  const today = calendarDay(new Date().toISOString()) ?? "";
  const timeline = useMemo(() => timelineDays(entries, today), [entries, today]);
  const waiting = useMemo(() => unscheduled(rows), [rows]);

  const [openId, setOpenId] = useState<string | null>(search.open ?? null);
  const lastOpen = useRef<WorkOrderRow | null>(null);
  const fromAll = rows.find((w) => w.id === openId) ?? null;
  if (fromAll) lastOpen.current = fromAll;
  const openWorkOrder = openId ? (fromAll ?? lastOpen.current) : null;
  useEffect(() => {
    if (!openId) lastOpen.current = null;
  }, [openId]);

  const nameOf = (row: WorkOrderRow) =>
    propertyNames.data?.get(row.property_id ?? "") ?? "Property unlinked";

  const goMonth = (offset: number) =>
    void navigate({ search: { ...search, month: shiftMonth(month, offset) }, replace: true });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Work order calendar"
        description="Everything committed to a date — planned schedules and confirmed vendor arrivals — with double bookings flagged where they happen."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          ariaLabel="Calendar view"
          value={view}
          onChange={(value) =>
            void navigate({
              search: { ...search, view: value === "timeline" ? "timeline" : undefined },
              replace: true,
            })
          }
          options={[
            { value: "month", label: "Month" },
            { value: "timeline", label: "Timeline" },
          ]}
        />
        {view === "month" ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => goMonth(-1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="min-w-[10rem] text-center text-sm font-semibold">
              {monthLabel(month)}
            </span>
            <Button variant="outline" size="icon" aria-label="Next month" onClick={() => goMonth(1)}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label="Scheduled, all dates" value={entries.length} />
        <StatTile
          label="Scheduling conflicts"
          value={conflictCount(entries)}
          tone={conflictCount(entries) > 0 ? "critical" : "neutral"}
        />
        <StatTile label="Open with no date" value={waiting.length} />
      </div>

      {workOrders.isError ? (
        <EmptyState
          title="The calendar could not be loaded"
          hint="Try again before relying on this schedule."
          action={<Button onClick={() => void workOrders.refetch()}>Try again</Button>}
        />
      ) : workOrders.isLoading ? (
        <LoadingRows />
      ) : view === "month" ? (
        <SectionCard title={monthLabel(month)} bodyClassName="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell) => (
              <div
                key={cell.day}
                className={[
                  "min-h-[6.5rem] rounded-md border p-1.5",
                  cell.inMonth ? "border-border/60" : "border-transparent opacity-45",
                  cell.isToday ? "ring-1 ring-primary" : "",
                ].join(" ")}
              >
                <div className="mb-1 text-[0.6875rem] font-semibold text-muted-foreground">
                  {Number(cell.day.slice(8, 10))}
                </div>
                <div className="space-y-1">
                  {cell.entries.slice(0, 3).map((entry) => (
                    <DayEntry
                      key={entry.workOrder.id}
                      entry={entry}
                      propertyName={nameOf(entry.workOrder)}
                      onOpen={() => setOpenId(entry.workOrder.id)}
                    />
                  ))}
                  {cell.entries.length > 3 ? (
                    <p className="text-[0.6875rem] text-muted-foreground">
                      +{cell.entries.length - 3} more
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : timeline.length === 0 ? (
        <EmptyState
          title="Nothing scheduled from today onward"
          hint="Set a schedule or a vendor arrival time on an open Work Order to see it here."
        />
      ) : (
        timeline.map(({ day, entries: dayEntries }) => (
          <SectionCard
            key={day}
            title={usDate(day)}
            description={`${dayEntries.length} Work Order${dayEntries.length === 1 ? "" : "s"}`}
          >
            <div className="space-y-2">
              {dayEntries.map((entry) => (
                <TimelineRow
                  key={entry.workOrder.id}
                  entry={entry}
                  propertyName={nameOf(entry.workOrder)}
                  onOpen={() => setOpenId(entry.workOrder.id)}
                />
              ))}
            </div>
          </SectionCard>
        ))
      )}

      {waiting.length > 0 ? (
        <SectionCard
          title="Waiting for a date"
          description="Open Work Orders with neither a planned schedule nor a confirmed vendor arrival."
        >
          <div className="space-y-1">
            {waiting.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setOpenId(row.id)}
                className="resolve-press flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/40"
              >
                <span className="min-w-0 truncate">
                  <span className="font-medium">{nameOf(row)}</span> · {row.title}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {row.vendor_name ?? "No vendor yet"}
                </span>
              </button>
            ))}
          </div>
        </SectionCard>
      ) : null}

      <WorkOrderDrawer
        key={openWorkOrder?.id ?? "none"}
        workOrder={openWorkOrder}
        people={people}
        canEdit={!readOnly}
        propertyName={openWorkOrder ? nameOf(openWorkOrder) : ""}
        propertyPhotoUrl={
          openWorkOrder ? (propertyPhotos.get(openWorkOrder.property_id ?? "") ?? null) : null
        }
        originToken={originToken}
        onClose={() => setOpenId(null)}
      />

    </div>
  );
}

function DayEntry({
  entry,
  propertyName,
  onOpen,
}: {
  entry: ScheduledWorkOrder;
  propertyName: string;
  onOpen: () => void;
}) {
  const conflicted = entry.conflicts.length > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${propertyName} — ${entry.workOrder.title}`}
      className={[
        "resolve-press block w-full truncate rounded px-1.5 py-1 text-left text-[0.6875rem]",
        conflicted
          ? "bg-danger/15 text-danger hover:bg-danger/25"
          : "bg-muted text-foreground hover:bg-muted/70",
      ].join(" ")}
    >
      {conflicted ? <AlertTriangle className="mr-1 inline h-3 w-3" aria-hidden="true" /> : null}
      {entry.fromVendorEta ? `${usTime(entry.at)} ` : ""}
      {propertyName}
    </button>
  );
}

function TimelineRow({
  entry,
  propertyName,
  onOpen,
}: {
  entry: ScheduledWorkOrder;
  propertyName: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="resolve-press flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/40"
    >
      <span className="w-20 shrink-0 pt-0.5 text-xs text-muted-foreground">
        {entry.fromVendorEta ? usTime(entry.at) : "All day"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{propertyName}</span>
          {entry.fromVendorEta ? (
            <StatusBadge tone="progress">Vendor arrival confirmed</StatusBadge>
          ) : (
            <StatusBadge tone="waiting">Planned date</StatusBadge>
          )}
          {entry.conflicts.map((conflict) => (
            <StatusBadge key={conflict} tone="escalated">
              {CONFLICT_LABELS[conflict]}
            </StatusBadge>
          ))}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {entry.workOrder.title} · {entry.workOrder.vendor_name ?? "No vendor yet"}
        </span>
      </span>
    </button>
  );
}
