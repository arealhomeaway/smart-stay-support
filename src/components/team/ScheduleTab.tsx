import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock, ChevronLeft, ChevronRight, GripVertical, Moon, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SEAT_LABELS } from "@/lib/coverage-model";
import type { Ownership } from "@/lib/semantic";
import {
  coverageModel,
  deleteOnCall,
  deleteShift,
  saveOnCall,
  saveOverride,
  saveShift,
  setSeatHolder,
} from "@/lib/coverage-admin.functions";
import {
  addDays,
  applyCoverageActions,
  cellBlocks,
  centralToday,
  clock,
  generateRotation,
  moveItem,
  needsOwnerAlert,
  nextMonday,
  nightStatus,
  personName,
  planNewShift,
  planShiftEdit,
  rotationOrderFromRoster,
  rotationRowsToReplace,
  ROTATION_LABEL,
  shortDate,
  SINGLE_NIGHT_LABEL,
  weekDates,
  weekStart,
  whosOut,
  type CellBlock,
  type CoverageAction,
  type SOverride,
  type SPerson,
  type SRole,
  type SRoster,
  type SShift,
} from "@/lib/team-schedule";
import { TimeOffDialog } from "./TimeOffDialog";

const BLOCK_FILL: Record<Ownership, string> = {
  team_a: "bg-team-a/15 border-team-a/45 text-team-a",
  team_b: "bg-team-b/15 border-team-b/45 text-team-b",
  leadership: "bg-leadership/15 border-leadership/45 text-leadership",
  vendor: "bg-module-override/15 border-module-override/45 text-module-override",
  owner: "bg-module-owner/15 border-module-owner/45 text-module-owner",
  unassigned: "bg-muted border-border text-muted-foreground",
};
function seatOwnership(code: string): Ownership {
  if (code.startsWith("ge_")) return "team_a";
  if (code.startsWith("po_")) return "team_b";
  return "leadership";
}
const toTime = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
type Triage = { id: string; weekday: number; start_minute: number; end_minute: number; role_code: string };
type Model = { roles: SRole[]; shifts: SShift[]; overrides: SOverride[]; roster: SRoster[]; people: SPerson[]; triage: Triage[]; canEdit: boolean };

export function useCoverageModel() {
  const load = useServerFn(coverageModel);
  return useQuery({ queryKey: ["coverage-model"], queryFn: () => load({ data: {} as never }) });
}

function useWriters() {
  const so = useServerFn(saveOverride), ss = useServerFn(saveShift), ds = useServerFn(deleteShift), sh = useServerFn(setSeatHolder);
  return {
    saveOverride: (a: Parameters<typeof so>[0]["data"]) => so({ data: a }),
    saveShift: (a: Parameters<typeof ss>[0]["data"]) => ss({ data: a }),
    deleteShift: (a: { id: string }) => ds({ data: a }),
    setSeatHolder: (a: { roleCode: string; userId: string | null }) => sh({ data: a }),
  };
}

export function ScheduleTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useCoverageModel();
  const [sunday, setSunday] = useState(() => weekStart(centralToday()));
  const [timeOff, setTimeOff] = useState(false);
  const [manageOnCall, setManageOnCall] = useState(false);
  const needsOwner = useQuery({
    queryKey: ["tickets-need-owner"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .is("assigned_to", null)
        .not("assignment_note", "is", null)
        .not("status", "in", "(resolved,closed,cancelled)")
        .is("archived_at", null)
        .eq("is_demo", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (isLoading || !data) return <Skeleton className="h-72 w-full" />;
  const m: Model = {
    roles: (data.roles as SRole[]).filter((r) => r.code !== "__none__"),
    shifts: data.shifts as SShift[],
    overrides: data.overrides as SOverride[],
    roster: data.roster as SRoster[],
    people: data.people as SPerson[],
    triage: data.triage as Triage[],
    canEdit: data.canEdit === true,
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ["coverage-model"] });
  const alert = needsOwnerAlert(needsOwner.data ?? 0);
  const thisWeek = weekStart(centralToday());

  return (
    <div className="space-y-4">
      {alert && (
        <Link
          to="/team-queue"
          search={{ flags: "unassigned" } as never}
          className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm font-medium text-warning hover:underline"
        >
          <AlertTriangle className="size-4" /> {alert}
        </Link>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" aria-label="Previous week" onClick={() => setSunday(addDays(sunday, -7))}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant={sunday === thisWeek ? "secondary" : "outline"} onClick={() => setSunday(thisWeek)}>This week</Button>
          <Button size="sm" variant="outline" aria-label="Next week" onClick={() => setSunday(addDays(sunday, 7))}><ChevronRight className="size-4" /></Button>
          <span className="ml-2 text-sm font-medium">Week of {shortDate(sunday)}</span>
        </div>
        {m.canEdit ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setManageOnCall(true)}><Moon className="size-4" /> Manage on-call</Button>
            <Button size="sm" onClick={() => setTimeOff(true)}><Plus className="size-4" /> Add time off</Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">View only</span>
        )}
      </div>

      <WhosOutStrip sunday={sunday} m={m} />
      <WeekGrid sunday={sunday} m={m} onChanged={refresh} />

      {timeOff && (
        <TimeOffDialog open onClose={() => setTimeOff(false)} onSaved={refresh} people={m.people} roles={m.roles} roster={m.roster} overrides={m.overrides} />
      )}
      {manageOnCall && <ManageOnCall m={m} onClose={() => setManageOnCall(false)} onChanged={refresh} />}
    </div>
  );
}

function WhosOutStrip({ sunday, m }: { sunday: string; m: Model }) {
  const out = whosOut(sunday, m.roles, m.overrides);
  const fmt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <section aria-label="Who's out this week" className="surface p-3 text-sm">
      <h3 className="mb-1 font-semibold">Who's out this week</h3>
      {out.length === 0 ? (
        <p className="text-muted-foreground">No one is out this week.</p>
      ) : (
        <ul className="space-y-1">
          {out.map((o) => (
            <li key={o.id}>
              <span className="font-medium">{personName(m.people, o.personId) ?? SEAT_LABELS[o.roleCode] ?? "Open seat"}</span>{" "}
              <span className="text-muted-foreground">{fmt(o.startsAt)} to {fmt(o.endsAt)}</span>
              {" · "}
              {o.coverUserId ? <>Covered by {personName(m.people, o.coverUserId)}</> : <span className="text-warning">Backup seat covers</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WeekGrid({ sunday, m, onChanged }: { sunday: string; m: Model; onChanged: () => void }) {
  const dates = weekDates(sunday);
  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><CalendarClock className="size-4" /> The operating week</h3>
          <p className="text-sm text-muted-foreground">Central time.{m.canEdit ? " Click a shift to change it, or an empty day to add one." : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`chip ${BLOCK_FILL.team_a}`}>Team A, Guest Experience</span>
          <span className={`chip ${BLOCK_FILL.team_b}`}>Team B, Property Operations</span>
          <span className={`chip ${BLOCK_FILL.leadership}`}>Supervisor</span>
          <span className="chip triage-block border-dashed border-triage/60 text-triage">Cross-team triage</span>
          <span className="chip border-border bg-muted text-muted-foreground">Out</span>
        </div>
      </div>
      <div className="overflow-x-auto p-4">
        <div className="min-w-[52rem] space-y-1.5">
          <div className="grid grid-cols-[16rem_repeat(7,1fr)] gap-1.5">
            <div className="eyebrow self-end">Person</div>
            {dates.map((d) => <div key={d} className="pb-1 text-center text-xs font-semibold">{shortDate(d)}</div>)}
          </div>
          {m.roles.map((role) => {
            const kind = seatOwnership(role.code);
            const holder = personName(m.people, role.current_seat_holder) ?? role.current_seat_name;
            return (
              <div key={role.code} className="grid grid-cols-[16rem_repeat(7,1fr)] items-stretch gap-1.5" data-testid={`row-${role.code}`}>
                <div className="flex flex-col justify-center rounded-md border border-border bg-sunken px-3 py-2">
                  <span className="truncate text-xs font-semibold">{holder ?? <span className="text-danger">No one assigned</span>}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {SEAT_LABELS[role.code] ?? role.name}
                    {role.current_seat_name && !role.current_seat_holder && <span className="text-warning"> · invite pending</span>}
                    {role.available === false && <span className="text-warning"> · unavailable</span>}
                  </span>
                </div>
                {dates.map((date) => {
                  const blocks = cellBlocks(role.code, date, m.shifts, m.overrides);
                  const triage = m.triage.filter((t) => t.role_code === role.code && t.weekday === new Date(date + "T12:00:00Z").getUTCDay());
                  if (blocks.length === 0 && triage.length === 0) {
                    return m.canEdit ? (
                      <NewShiftPopover key={date} role={role} date={date} m={m} onChanged={onChanged} />
                    ) : (
                      <div key={date} className="rounded-md border border-dashed border-border/70 bg-sunken/40" />
                    );
                  }
                  return (
                    <div key={date} className="flex flex-col gap-1">
                      {blocks.map((b) => (
                        <ShiftBlock key={b.key} block={b} role={role} date={date} m={m} fill={BLOCK_FILL[kind]} onChanged={onChanged} />
                      ))}
                      {triage.map((t) => (
                        <div key={t.id} className="triage-block rounded-md border border-dashed border-triage/60 px-1.5 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-triage">
                          Triage {clock(t.start_minute)} to {clock(t.end_minute)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <OnCallRow dates={dates} m={m} onChanged={onChanged} />
        </div>
      </div>
    </section>
  );
}

function blockText(b: CellBlock, m: Model) {
  const hours = `${clock(b.start)} to ${clock(b.end)}`;
  if (b.out && !b.coverUserId) return `Out · ${hours}`;
  if (b.coverUserId) return `${personName(m.people, b.coverUserId)} · ${hours}`;
  return hours;
}

function ShiftBlock({ block, role, date, m, fill, onChanged }: { block: CellBlock; role: SRole; date: string; m: Model; fill: string; onChanged: () => void }) {
  const cls = `w-full rounded-md border px-1.5 py-1.5 text-center text-[0.6875rem] font-medium leading-tight ${
    block.out && !block.coverUserId ? "border-border bg-muted text-muted-foreground" : fill
  }`;
  if (!m.canEdit || !block.shift) return <div className={cls}>{blockText(block, m)}</div>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cls}>{blockText(block, m)}</button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <ShiftForm
          title={`${SEAT_LABELS[role.code] ?? role.name}, ${shortDate(date)}`}
          start={block.shift.start_minute}
          end={block.shift.end_minute}
          personId={role.current_seat_holder}
          people={m.people}
          allowOut
          onSave={async (v) => planShiftEdit({ ...v, roleCode: role.code, date, shift: block.shift!, seatHolder: role.current_seat_holder })}
          onDone={onChanged}
        />
      </PopoverContent>
    </Popover>
  );
}

function NewShiftPopover({ role, date, m, onChanged }: { role: SRole; date: string; m: Model; onChanged: () => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Add a shift for ${SEAT_LABELS[role.code] ?? role.name} on ${shortDate(date)}`}
          className="min-h-8 rounded-md border border-dashed border-border/70 bg-sunken/40 text-xs text-muted-foreground opacity-60 hover:opacity-100">
          +
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <ShiftForm
          title={`Add a shift, ${shortDate(date)}`}
          start={8 * 60}
          end={17 * 60}
          personId={role.current_seat_holder}
          people={m.people}
          onSave={async (v) => planNewShift({ ...v, roleCode: role.code, date, seatHolder: role.current_seat_holder })}
          onDone={onChanged}
        />
      </PopoverContent>
    </Popover>
  );
}

function ShiftForm({
  title, start, end, personId, people, allowOut, onSave, onDone,
}: {
  title: string; start: number; end: number; personId: string | null; people: SPerson[]; allowOut?: boolean;
  onSave: (v: { scope: "week" | "every"; start: number; end: number; personId: string | null; markOut: boolean }) => Promise<CoverageAction[]>;
  onDone: () => void;
}) {
  const writers = useWriters();
  const [s, setS] = useState(toTime(start));
  const [e, setE] = useState(toTime(end === 1440 ? 1439 : end));
  const [who, setWho] = useState(personId ?? "");
  const [out, setOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (scope: "week" | "every") => {
    setBusy(true);
    try {
      const endMin = toMin(e) === 1439 && end === 1440 ? 1440 : toMin(e);
      const actions = await onSave({ scope, start: toMin(s), end: endMin, personId: who || null, markOut: out });
      if (actions.length === 0) { toast("Nothing changed."); return; }
      await applyCoverageActions(actions, writers);
      toast.success(scope === "week" ? "Saved for this week only." : "Saved for every week.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The change could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold">{title}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="sf-s">Start</Label><Input id="sf-s" type="time" value={s} onChange={(x) => setS(x.target.value)} disabled={out} /></div>
        <div className="space-y-1"><Label htmlFor="sf-e">End</Label><Input id="sf-e" type="time" value={e} onChange={(x) => setE(x.target.value)} disabled={out} /></div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="sf-p">Person</Label>
        <select id="sf-p" className="h-9 w-full rounded-md border border-input bg-background px-2" value={who} onChange={(x) => setWho(x.target.value)} disabled={out}>
          <option value="">No one</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
        </select>
      </div>
      {allowOut && (
        <label className="flex items-center gap-2"><input type="checkbox" checked={out} onChange={(x) => setOut(x.target.checked)} /> Mark out</label>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" disabled={busy} onClick={() => run("week")}>This week only</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("every")}>Every week</Button>
      </div>
      {out && <p className="text-xs text-muted-foreground">Every week removes this recurring shift.</p>}
    </div>
  );
}

function OnCallRow({ dates, m, onChanged }: { dates: string[]; m: Model; onChanged: () => void }) {
  return (
    <div className="mt-3 grid grid-cols-[16rem_repeat(7,1fr)] items-stretch gap-1.5" data-testid="oncall-row">
      <div className="flex items-center gap-2 rounded-md border border-module-override/40 bg-module-override/10 px-3 py-2 text-xs font-semibold text-module-override">
        <Moon className="size-3.5" /> On call (10 p.m. to 8 a.m.)
      </div>
      {dates.map((d) => {
        const n = nightStatus(d, m.roster, m.roles, m.overrides);
        const bad = n.empty || n.needsCover;
        const cls = `w-full rounded-md border px-1.5 py-1.5 text-center text-[0.6875rem] font-medium leading-tight ${
          bad ? "border-danger/50 bg-danger/10 text-danger" : "border-module-override/40 bg-module-override/10 text-module-override"
        }`;
        const label = n.empty ? "No one on call" : `${personName(m.people, n.userId)}${n.needsCover ? " · Needs cover" : ""}`;
        if (!m.canEdit) return <div key={d} className={cls}>{label}</div>;
        return (
          <Popover key={d}>
            <PopoverTrigger asChild><button type="button" className={cls}>{label}</button></PopoverTrigger>
            <PopoverContent className="w-72"><NightForm date={d} night={n} m={m} onChanged={onChanged} /></PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

function NightForm({ date, night, m, onChanged }: { date: string; night: ReturnType<typeof nightStatus>; m: Model; onChanged: () => void }) {
  const save = useServerFn(saveOnCall);
  const del = useServerFn(deleteOnCall);
  const [who, setWho] = useState(night.userId ?? "");
  const [busy, setBusy] = useState(false);
  const go = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); toast.success(msg); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "The on-call change could not be saved."); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold">On call, night of {shortDate(date)}</p>
      <select aria-label="On-call person" className="h-9 w-full rounded-md border border-input bg-background px-2" value={who} onChange={(e) => setWho(e.target.value)}>
        <option value="">Choose a person</option>
        {m.people.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
      </select>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !who} onClick={() => go(() => save({ data: { id: night.singleNight ? night.entryId : null, userId: who, startsOn: date, endsOn: date, label: SINGLE_NIGHT_LABEL } }), "On-call night saved.")}>
          Save this night
        </Button>
        {night.singleNight && night.entryId && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => go(() => del({ data: { id: night.entryId! } }), "Single night removed.")}>
            Remove this night
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">A single night always wins over the weekly rotation.</p>
    </div>
  );
}

function ManageOnCall({ m, onClose, onChanged }: { m: Model; onClose: () => void; onChanged: () => void }) {
  const today = centralToday();
  const [order, setOrder] = useState<string[]>(() => rotationOrderFromRoster(m.roster, today));
  const [adding, setAdding] = useState("");
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(saveOnCall);
  const del = useServerFn(deleteOnCall);
  const first = nextMonday(today);

  const generate = async () => {
    setBusy(true);
    try {
      const rows = generateRotation(order, first, 8);
      for (const r of rotationRowsToReplace(m.roster, first, 8)) await del({ data: { id: r.id } });
      for (const r of rows) await save({ data: { id: null, userId: r.userId, startsOn: r.startsOn, endsOn: r.endsOn, label: ROTATION_LABEL } });
      toast.success("On-call rotation saved for the next 8 weeks.");
      onChanged();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The rotation could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="space-y-4 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage on-call</SheetTitle>
          <SheetDescription>Weekly rotation, Monday to Sunday. Drag to change the order.</SheetDescription>
        </SheetHeader>
        <ol className="space-y-1">
          {order.map((id, i) => (
            <li key={id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (drag !== null) setOrder(moveItem(order, drag, i)); setDrag(null); }}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-sm">
              <GripVertical className="size-4 cursor-grab text-muted-foreground" />
              <span className="w-5 text-muted-foreground">{i + 1}.</span>
              <span className="flex-1">{personName(m.people, id)}</span>
              <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => setOrder(moveItem(order, i, i - 1))}><ArrowUp className="size-3.5" /></Button>
              <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === order.length - 1} onClick={() => setOrder(moveItem(order, i, i + 1))}><ArrowDown className="size-3.5" /></Button>
              <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setOrder(order.filter((x) => x !== id))}><X className="size-3.5" /></Button>
            </li>
          ))}
          {order.length === 0 && <li className="text-sm text-muted-foreground">No one in the rotation yet.</li>}
        </ol>
        <div className="flex gap-2">
          <select aria-label="Add a person" className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm" value={adding} onChange={(e) => setAdding(e.target.value)}>
            <option value="">Add a person</option>
            {m.people.filter((p) => !order.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={!adding} onClick={() => { setOrder([...order, adding]); setAdding(""); }}>Add</Button>
        </div>
        <Button className="w-full" disabled={busy || order.length === 0} onClick={generate}>
          Save rotation for 8 weeks from {shortDate(first)}
        </Button>
        <p className="text-xs text-muted-foreground">Single nights you set on the grid stay in place and win over the rotation.</p>
      </SheetContent>
    </Sheet>
  );
}
