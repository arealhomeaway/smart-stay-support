/**
 * The dedicated Work Order calendar.
 *
 * Month view answers "what is committed this month"; the timeline answers
 * "what is coming next". Conflicts — the same vendor or the same home booked
 * twice on one day — are derived from the schedule itself and shown where the
 * booking is, and every entry opens the Work Order it belongs to.
 */
import { Link, createFileRoute } from "@tanstack/react-router";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DEFAULT_FILTERS,
  SOURCE_LABELS,
  WORK_TYPE_LABELS,
  activeFilterCount,
  breezewayCalendarItems,
  matchesCalendarFilters,
  type BreezewayCalendarRow,
  type CalendarFilters,
  type CalendarItem,
  type CalendarSource,
  type WorkType,
} from "@/lib/work-order-calendar-sources";

function resolveItem(entry: ScheduledWorkOrder): CalendarItem {
  const w = entry.workOrder;
  return {
    key: `wo:${w.id}`,
    source: "resolve",
    id: w.id,
    day: entry.day,
    title: w.title,
    propertyId: w.property_id,
    workType: "maintenance",
    assignees: w.vendor_name ? [w.vendor_name] : [],
  };
}

/** Breezeway work orders already synced into Resolve, for the visible window. */
function useBreezewayCalendar(from: string, to: string) {
  return useQuery({
    queryKey: ["work-order-calendar-breezeway", from, to],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const [rows, synced] = await Promise.all([
        supabase
          .from("breezeway_work_orders")
          .select("id, breezeway_task_id, name, department, status, scheduled_date, property_id, assignees, linked_ticket_id")
          .gte("scheduled_date", from)
          .lte("scheduled_date", to)
          .neq("status", "Deleted")
          .order("scheduled_date", { ascending: true })
          .limit(3000),
        supabase
          .from("breezeway_work_orders")
          .select("last_synced_at")
          .order("last_synced_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (rows.error) throw rows.error;
      return {
        rows: (rows.data ?? []) as Array<BreezewayCalendarRow & { linked_ticket_id: string | null }>,
        lastSyncedAt: (synced.data?.last_synced_at as string | null | undefined) ?? null,
      };
    },
  });
}

function isoShift(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + days);
  return calendarDay(d.toISOString()) ?? day;
}

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
  const { readOnly: previewOnly, can } = useRole();
  // The Director of Onboarding and Project Managers see Work Orders read only.
  const readOnly = previewOnly || !can("work_orders_internal");

  const rows = useMemo(() => workOrders.data ?? [], [workOrders.data]);
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);
  const [openBz, setOpenBz] = useState<string | null>(null);
  const allEntries = useMemo(() => scheduleEntries(rows), [rows]);
  const entries = useMemo(
    () => allEntries.filter((e) => matchesCalendarFilters(resolveItem(e), filters)),
    [allEntries, filters],
  );
  const grid = useMemo(() => monthGrid(month, entries), [month, entries]);
  const today = calendarDay(new Date().toISOString()) ?? "";
  const timeline = useMemo(() => timelineDays(entries, today), [entries, today]);
  const monthStart = `${month}-01`;
  const windowFrom = isoShift(monthStart < today ? monthStart : today, -7);
  const windowTo = isoShift(isoShift(monthStart, 31) > isoShift(today, 30) ? isoShift(monthStart, 31) : isoShift(today, 30), 7);
  const breezeway = useBreezewayCalendar(windowFrom, windowTo);
  const linkedRefs = useMemo(
    () => new Set(rows.map((w) => w.breezeway_task_ref).filter((v): v is string => Boolean(v))),
    [rows],
  );
  const bzAll = useMemo(
    () => breezewayCalendarItems(breezeway.data?.rows ?? [], linkedRefs),
    [breezeway.data, linkedRefs],
  );
  const bzItems = useMemo(() => bzAll.filter((i) => matchesCalendarFilters(i, filters)), [bzAll, filters]);
  const bzByDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const i of bzItems) m.set(i.day, [...(m.get(i.day) ?? []), i]);
    return m;
  }, [bzItems]);
  const timelineAll = useMemo(() => {
    const days = new Set<string>(timeline.map((t) => t.day));
    const horizon = isoShift(today, 30);
    for (const d of bzByDay.keys()) if (d >= today && d <= horizon) days.add(d);
    return [...days].sort().map((day) => ({
      day,
      entries: timeline.find((t) => t.day === day)?.entries ?? [],
      bz: bzByDay.get(day) ?? [],
    }));
  }, [timeline, bzByDay, today]);
  const propertyOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const e of allEntries) if (e.workOrder.property_id) ids.add(e.workOrder.property_id);
    for (const i of bzAll) if (i.propertyId) ids.add(i.propertyId);
    return [...ids]
      .map((id) => ({ id, name: propertyNames.data?.get(id) ?? "Unnamed home" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allEntries, bzAll, propertyNames.data]);
  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const e of allEntries) for (const a of resolveItem(e).assignees) names.add(a);
    for (const i of bzAll) for (const a of i.assignees) names.add(a);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [allEntries, bzAll]);
  const openBzRow = openBz ? (breezeway.data?.rows ?? []).find((r) => r.id === openBz) ?? null : null;
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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
        <FilterSelect
          label="Source"
          value={filters.source}
          onChange={(v) => setFilters((f) => ({ ...f, source: v as CalendarSource }))}
          options={(Object.keys(SOURCE_LABELS) as CalendarSource[]).map((k) => ({ value: k, label: SOURCE_LABELS[k] }))}
        />
        <FilterSelect
          label="Work type"
          value={filters.workType}
          onChange={(v) => setFilters((f) => ({ ...f, workType: v as WorkType | "all" }))}
          options={[
            { value: "all", label: "All work types" },
            ...(Object.keys(WORK_TYPE_LABELS) as WorkType[]).map((k) => ({ value: k, label: WORK_TYPE_LABELS[k] })),
          ]}
        />
        <FilterSelect
          label="Home"
          value={filters.propertyId}
          onChange={(v) => setFilters((f) => ({ ...f, propertyId: v }))}
          options={[{ value: "all", label: "All homes" }, ...propertyOptions.map((p) => ({ value: p.id, label: p.name }))]}
        />
        <FilterSelect
          label="Assigned to"
          value={filters.assignee}
          onChange={(v) => setFilters((f) => ({ ...f, assignee: v }))}
          options={[{ value: "all", label: "Anyone" }, ...assigneeOptions.map((a) => ({ value: a, label: a }))]}
        />
        {activeFilterCount(filters) > 0 ? (
          <Button variant="ghost" className="h-9" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Reset filters ({activeFilterCount(filters)})
          </Button>
        ) : null}
        <p className="ml-auto text-xs text-muted-foreground">
          {breezeway.isError
            ? "Breezeway work orders could not be loaded."
            : breezeway.data?.lastSyncedAt
              ? `Breezeway data last synced ${usDate(breezeway.data.lastSyncedAt)} at ${usTime(breezeway.data.lastSyncedAt)}`
              : "Breezeway data has not synced yet."}
        </p>
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
                  {(bzByDay.get(cell.day) ?? []).slice(0, Math.max(0, 3 - cell.entries.length)).map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setOpenBz(item.id)}
                      title={`Breezeway: ${item.title}`}
                      className="resolve-press block w-full truncate rounded border border-dashed border-border px-1.5 py-1 text-left text-[0.6875rem] hover:bg-muted/70"
                    >
                      {propertyNames.data?.get(item.propertyId ?? "") ?? item.title}
                    </button>
                  ))}
                  {cell.entries.length + (bzByDay.get(cell.day)?.length ?? 0) > 3 ? (
                    <p className="text-[0.6875rem] text-muted-foreground">
                      +{cell.entries.length + (bzByDay.get(cell.day)?.length ?? 0) - 3} more
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : timelineAll.length === 0 ? (
        <EmptyState
          title="Nothing scheduled from today onward"
          hint="Set a schedule or a vendor arrival time on an open Work Order to see it here."
        />
      ) : (
        timelineAll.map(({ day, entries: dayEntries, bz }) => (
          <SectionCard
            key={day}
            title={usDate(day)}
            description={`${dayEntries.length + bz.length} Work Order${dayEntries.length + bz.length === 1 ? "" : "s"}`}
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
              {bz.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setOpenBz(item.id)}
                  className="resolve-press flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/40"
                >
                  <span className="w-20 shrink-0 pt-0.5 text-xs text-muted-foreground">All day</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {propertyNames.data?.get(item.propertyId ?? "") ?? "Home not linked"}
                      </span>
                      <StatusBadge tone="waiting">Breezeway</StatusBadge>
                      <span className="text-xs text-muted-foreground">{WORK_TYPE_LABELS[item.workType]}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.title} · {item.assignees.join(", ") || "Not assigned"}
                    </span>
                  </span>
                </button>
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

      <Dialog open={Boolean(openBzRow)} onOpenChange={(v) => !v && setOpenBz(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openBzRow?.name ?? "Breezeway work order"}</DialogTitle>
          </DialogHeader>
          {openBzRow ? (
            <div className="space-y-1.5 text-sm">
              <p>{propertyNames.data?.get(openBzRow.property_id ?? "") ?? "Home not linked"}</p>
              <p className="text-muted-foreground">
                Breezeway status: {openBzRow.status ?? "Unknown"}
                {openBzRow.scheduled_date ? ` · ${usDate(openBzRow.scheduled_date)}` : ""}
              </p>
              <p className="text-muted-foreground">
                Assigned to: {bzAll.find((i) => i.id === openBzRow.id)?.assignees.join(", ") || "Not assigned"}
              </p>
              <p className="text-xs text-muted-foreground">
                This is a copy of the Breezeway work order. Changes are made in Breezeway.
              </p>
              {openBzRow.linked_ticket_id ? (
                <Link
                  to="/tickets/$ticketId"
                  params={{ ticketId: openBzRow.linked_ticket_id }}
                  className="font-medium text-primary hover:underline"
                >
                  Open the linked ticket
                </Link>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 max-w-[14rem] rounded-md border border-input bg-background px-2 text-sm text-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
