/** 1.2 Tiles chosen by who is signed in. A click filters the list below in place. */
import { AlarmClock, CalendarClock, CalendarDays, CircleCheck, KeyRound, MessageSquareReply, Search, Truck, UserX } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { TileKey, TileTone, TileValue } from "@/lib/onboarding-home";

const ICON: Record<TileKey, ComponentType<{ className?: string }>> = {
  late_mine: AlarmClock,
  owners_waiting: MessageSquareReply,
  due_week: CalendarDays,
  next_handoff: KeyRound,
  behind: AlarmClock,
  missing_setup: UserX,
  not_in_resolve: Search,
  closing_no_pm: CalendarClock,
  handoffs_14: Truck,
};

export const TONE: Record<TileTone | "green", { soft: string; text: string; ring: string; chip: string }> = {
  red: { soft: "bg-state-blocked/12", text: "text-state-blocked", ring: "ring-state-blocked", chip: "bg-state-blocked" },
  amber: { soft: "bg-amber/15", text: "text-warning-ink", ring: "ring-amber", chip: "bg-warning-ink" },
  blue: { soft: "bg-info/15", text: "text-info", ring: "ring-info", chip: "bg-info" },
  teal: { soft: "bg-primary/12", text: "text-primary", ring: "ring-primary", chip: "bg-primary" },
  green: { soft: "bg-success/15", text: "text-success", ring: "ring-success", chip: "bg-success" },
};

export function HomeTiles(p: {
  tiles: { key: TileKey; label: string; tone: TileTone; value: TileValue }[];
  active: TileKey | null;
  onClick: (key: TileKey) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5" aria-label="Tiles">
      {p.tiles.map((t) => {
        const tone = TONE[t.value.clear ? "green" : t.tone];
        const Icon = t.value.clear ? CircleCheck : ICON[t.key];
        const on = p.active === t.key;
        return (
          <li key={t.key}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => p.onClick(t.key)}
              className={cn(
                "flex h-full min-h-[8.5rem] w-full flex-col gap-2 rounded-xl border bg-card p-3 text-left transition hover:bg-muted/40",
                t.value.clear ? "border-success/40 bg-success/5" : "border-border",
                on && cn("ring-2 ring-offset-1", tone.ring),
              )}
            >
              <span className={cn("inline-flex size-9 items-center justify-center rounded-lg", tone.soft)}>
                <Icon className={cn("size-5", tone.text)} />
              </span>
              <span className="text-sm font-medium leading-tight">{t.label}</span>
              <span className={cn("numeric text-2xl font-semibold leading-none", t.value.clear && tone.text)}>{t.value.value}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{t.value.line}</span>
              <span className="mt-auto text-xs font-medium text-primary">Open ›</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
