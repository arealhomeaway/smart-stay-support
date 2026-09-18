import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { calendarDays, shiftCalendarMonth } from "@/lib/collection-calendar";

export function CollectionCalendar<T extends { id: string; date: string }>({ label, month, items, onMonthChange, renderItem }: {
  label: string; month: string; items: T[]; onMonthChange: (month: string) => void; renderItem: (item: T) => ReactNode;
}) {
  const byDay = new Map<string, T[]>();
  for (const item of items) byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);
  return <section aria-label={`${label} calendar`} className="space-y-3 rounded-lg border bg-card p-3">
    <div className="flex items-center justify-between gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => onMonthChange(shiftCalendarMonth(month, -1))}>Previous</Button>
      <h3 className="text-sm font-semibold">{new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" })}</h3>
      <Button type="button" size="sm" variant="outline" onClick={() => onMonthChange(shiftCalendarMonth(month, 1))}>Next</Button>
    </div>
    <div className="overflow-x-auto"><div className="grid min-w-[630px] grid-cols-7 gap-px bg-border">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="bg-muted p-2 text-center text-xs font-semibold">{day}</div>)}
      {calendarDays(month).map((day) => <div key={day} className={`min-h-24 space-y-1 bg-card p-2 ${day.slice(0, 7) === month ? "" : "opacity-45"}`}>
        <p className="text-xs font-semibold">{Number(day.slice(-2))}</p>
        {(byDay.get(day) ?? []).map((item) => <div key={item.id} className="rounded border border-primary/30 bg-primary/10 p-1 text-xs">{renderItem(item)}</div>)}
      </div>)}
    </div></div>
  </section>;
}
