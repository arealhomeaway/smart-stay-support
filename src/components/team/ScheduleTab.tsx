import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { X, AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Moon, Plus, Rows3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SEAT_LABELS, teamOf } from "@/lib/coverage-model";
import { useRole } from "@/hooks/useRole";
import type { Ownership } from "@/lib/semantic";
import {
  coverageModel,
  deleteOverride,
  deleteShift,
  saveGridSeats,
  saveOnCallNights,
  saveOnCallPattern,
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
  applyNightChanges,
  effectivePattern,
  patternFromSetting,
  gridRows,
  gridSeatCodes,
  monthCells,
  needsOwnerAlert,
  nightStatus,
  oncallPickerPeople,
  personName,
  planNewShift,
  planRangeAssign,
  planRemoveOverride,
  planShiftEdit,
  planSwap,
  shortDate,
  staffPickerPeople,
  WEEKDAYS,
  weekDates,
  weekStart,
  whosOut,
  undoOutIds,
  backToNormalIds,
  whosOutRemoveIds,
  type CellBlock,
  type CoverageAction,
  type NightChange,
  type OncallPattern,
  type SOverride,
  type StaffPerson,
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
type Model = {
  roles: SRole[]; gridRoles: SRole[]; shifts: SShift[]; overrides: SOverride[]; roster: SRoster[]; people: SPerson[]; triage: Triage[]; canEdit: boolean;
  pattern: OncallPattern | null; prefill: OncallPattern; patternSaved: boolean; shiftPeople: StaffPerson[]; oncallPeople: StaffPerson[]; gridCodes: string[];
};
type Raw = Awaited<ReturnType<typeof coverageModel>>;
const isDefaultRow = (c: string) => { const t = teamOf(c); return !!t && t !== "leadership"; };

/** Build the screen model from the server payload (pure, shared with Users). */
export function buildModel(data: Raw): Model {
  const roles = (data.roles as SRole[]).filter((r) => r.code !== "__none__");
  const roster = data.roster as SRoster[];
  const staff = (data.staff ?? []) as StaffPerson[];
  const testIds = (data.testAccountIds ?? []) as string[];
  const gridCodes = gridSeatCodes(data.gridSeatsSetting, roles, isDefaultRow);
  return {
    roles,
    gridRoles: gridRows(roles, gridCodes),
    gridCodes,
    shifts: data.shifts as SShift[],
    overrides: data.overrides as SOverride[],
    roster,
    people: data.people as SPerson[],
    triage: data.triage as Triage[],
    canEdit: data.canEdit === true,
    // Grid, calendar and routing read only the saved pattern, so they always agree.
    pattern: patternFromSetting(data.patternSetting),
    prefill: effectivePattern(data.patternSetting, roster),
    patternSaved: !!data.patternSetting,
    shiftPeople: staffPickerPeople(staff, roles, testIds),
    oncallPeople: oncallPickerPeople(staff, (data.eligibleIds ?? []) as string[], testIds),
  };
}

/** Save on-call date changes: the grid updates at once, the server write and refresh follow. */
function useNightSaver() {
  const qc = useQueryClient();
  const save = useServerFn(saveOnCallNights);
  return async (changes: NightChange[]) => {
    const key = ["coverage-model"];
    await qc.cancelQueries({ queryKey: key });
    const prev = qc.getQueryData<Raw>(key);
    if (prev) qc.setQueryData<Raw>(key, { ...prev, roster: applyNightChanges(prev.roster as SRoster[], changes) as never });
    try {
      await save({ data: { changes } });
    } catch (e) {
      if (prev) qc.setQueryData(key, prev);
      throw e;
    } finally {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}

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
  const m = buildModel(data);
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
            <GridRowsButton m={m} onChanged={refresh} />
            <Button size="sm" variant="outline" onClick={() => setManageOnCall(true)}><Moon className="size-4" /> Manage on-call</Button>
            <Button size="sm" onClick={() => setTimeOff(true)}><Plus className="size-4" /> Add time off</Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">View only</span>
        )}
      </div>

      {!m.patternSaved && (
        <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          The on-call weekday pattern is not saved yet, so nights after the last listed date have no one on call. Open Manage on-call and save the pattern.
        </p>
      )}
      <WhosOutStrip sunday={sunday} m={m} onChanged={refresh} />
      <WeekGrid sunday={sunday} m={m} onChanged={refresh} />

      {timeOff && (
        <TimeOffDialog open onClose={() => setTimeOff(false)} onSaved={refresh} people={m.shiftPeople} roles={m.roles} roster={m.roster} overrides={m.overrides} pattern={m.pattern} />
      )}
      {manageOnCall && <ManageOnCall m={m} onClose={() => setManageOnCall(false)} />}
    </div>
  );
}

function WhosOutStrip({ sunday, m, onChanged }: { sunday: string; m: Model; onChanged: () => void }) {
  const remove = useOverrideRemover(onChanged);
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
              <span className="font-medium">{personName(m.people, o.personId) ?? SEAT_LABELS[o.roleCode] ?? "Open role"}</span>{" "}
              <span className="text-muted-foreground">{fmt(o.startsAt)} to {fmt(o.endsAt)}</span>
              {" · "}
              {o.coverUserId ? <>Covered by {personName(m.people, o.coverUserId)}</> : <span className="text-warning">Backup role covers</span>}
              {m.canEdit && (
                <button type="button" aria-label={`Remove time off for ${personName(m.people, o.personId) ?? "this role"}`} className="ml-2 inline-flex align-middle text-muted-foreground hover:text-danger"
                  onClick={() => remove(whosOutRemoveIds(o.id, m.overrides), "Time off removed. Back to the normal shift.")}>
                  <X className="size-3.5" />
                </button>
              )}
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
          {m.gridRoles.map((role) => {
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
          <OnCallRow dates={dates} m={m} />
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
  const remove = useOverrideRemover(onChanged);
  if (!m.canEdit) return <div className={cls}>{blockText(block, m)}</div>;
  const outIds = undoOutIds(block, m.overrides);
  const coverIds = backToNormalIds(block, m.overrides);
  const undo = (outIds.length > 0 || coverIds.length > 0) && (
    <div className="mb-3 space-y-1 border-b border-border pb-3">
      {outIds.length > 0 && (
        <Button size="sm" variant="outline" className="w-full" onClick={() => remove(outIds, "Out removed. Back to the normal shift.")}>Undo out</Button>
      )}
      {outIds.length === 0 && coverIds.length > 0 && (
        <Button size="sm" variant="outline" className="w-full" onClick={() => remove(coverIds, "Back to the normal shift.")}>Back to normal shift</Button>
      )}
    </div>
  );
  if (!block.shift) {
    return (
      <Popover>
        <PopoverTrigger asChild><button type="button" className={cls}>{blockText(block, m)}</button></PopoverTrigger>
        <PopoverContent className="w-72">
          <p className="mb-2 text-sm font-semibold">{SEAT_LABELS[role.code] ?? role.name}, {shortDate(date)}</p>
          {undo || <p className="text-sm text-muted-foreground">This is a one-week shift.</p>}
        </PopoverContent>
      </Popover>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={cls}>{blockText(block, m)}</button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        {undo}
        <ShiftForm
          title={`${SEAT_LABELS[role.code] ?? role.name}, ${shortDate(date)}`}
          start={block.shift.start_minute}
          end={block.shift.end_minute}
          personId={role.current_seat_holder}
          people={m.shiftPeople}
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
          people={m.shiftPeople}
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

function OnCallRow({ dates, m }: { dates: string[]; m: Model }) {
  return (
    <div className="mt-3 grid grid-cols-[16rem_repeat(7,1fr)] items-stretch gap-1.5" data-testid="oncall-row">
      <div className="flex items-center gap-2 rounded-md border border-module-override/40 bg-module-override/10 px-3 py-2 text-xs font-semibold text-module-override">
        <Moon className="size-3.5" /> On call (10 p.m. to 8 a.m.)
      </div>
      {dates.map((d) => {
        const n = nightStatus(d, m.roster, m.roles, m.overrides, m.pattern);
        const label = nightLabel(n, m);
        const cls = nightClass(n);
        if (!m.canEdit) return <div key={d} className={cls}>{label}</div>;
        return (
          <Popover key={d}>
            <PopoverTrigger asChild><button type="button" className={cls}>{label}</button></PopoverTrigger>
            <PopoverContent className="w-72"><NightForm dates={[d]} mode="night" m={m} /></PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}

function nightLabel(n: ReturnType<typeof nightStatus>, m: Model) {
  if (n.empty) return "No one on call";
  return `${personName(m.people, n.userId)}${n.needsCover ? " · Needs cover" : ""}`;
}
function nightClass(n: ReturnType<typeof nightStatus>) {
  const bad = n.empty || n.needsCover;
  return `w-full rounded-md border px-1.5 py-1.5 text-center text-[0.6875rem] font-medium leading-tight ${
    bad ? "border-danger/50 bg-danger/10 text-danger" : n.isOverride ? "border-module-override/70 bg-module-override/25 text-module-override" : "border-module-override/40 bg-module-override/10 text-module-override"
  }`;
}

type NightMode = "night" | "range" | "swap";

/** One form for a single night, a date range or a swap. Only on-call list people can be picked. */
function NightForm({ dates, mode, m, onDone }: { dates: string[]; mode: NightMode; m: Model; onDone?: () => void }) {
  const saveNights = useNightSaver();
  const first = nightStatus(dates[0]!, m.roster, m.roles, m.overrides, m.pattern);
  const [who, setWho] = useState(mode === "night" ? first.userId ?? "" : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async (changes: NightChange[], msg: string) => {
    setBusy(true);
    try { await saveNights(changes); toast.success(msg); onDone?.(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "The on-call change could not be saved."); }
    finally { setBusy(false); }
  };
  const title =
    mode === "swap" ? `Swap ${shortDate(dates[0]!)} and ${shortDate(dates[1]!)}` :
    mode === "range" ? `On call, ${shortDate(dates[0]!)} to ${shortDate(dates[dates.length - 1]!)}` :
    `On call, night of ${shortDate(dates[0]!)}`;
  return (
    <div className="space-y-2 text-sm">
      <p className="font-semibold">{title}</p>
      {mode === "swap" ? (
        <p className="text-muted-foreground">
          {personName(m.people, first.userId) ?? "No one"} and {personName(m.people, nightStatus(dates[1]!, m.roster, m.roles, m.overrides, m.pattern).userId) ?? "No one"} trade nights.
        </p>
      ) : (
        <select aria-label="On-call person" className="h-9 w-full rounded-md border border-input bg-background px-2" value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">Choose a person</option>
          {m.oncallPeople.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
        </select>
      )}
      <Input aria-label="Note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {mode === "swap" ? (
          <Button size="sm" disabled={busy} onClick={() => { try { void go(planSwap(dates[0]!, dates[1]!, m.roster, m.pattern, note), "Nights swapped."); } catch (e) { toast.error((e as Error).message); } }}>Swap nights</Button>
        ) : (
          <Button size="sm" disabled={busy || !who} onClick={() => go(planRangeAssign(dates[0]!, dates[dates.length - 1]!, who, note), mode === "range" ? "Dates saved." : "Night saved.")}>
            {mode === "range" ? "Save these dates" : "Save this night"}
          </Button>
        )}
        {mode === "night" && first.entryId && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => go(planRemoveOverride(dates[0]!), "Back to the weekday pattern.")}>
            Use the weekday pattern
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">A date change always wins over the weekday pattern.</p>
    </div>
  );
}

function ManageOnCall({ m, onClose }: { m: Model; onClose: () => void }) {
  const qc = useQueryClient();
  const savePattern = useServerFn(saveOnCallPattern);
  const [pattern, setPattern] = useState<OncallPattern>(m.prefill);
  const [busy, setBusy] = useState(false);
  const today = centralToday();
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [mode, setMode] = useState<NightMode>("night");
  const [picked, setPicked] = useState<string[]>([]);

  const save = async () => {
    setBusy(true);
    try {
      await savePattern({ data: { pattern } });
      const key = ["coverage-model"];
      const prev = qc.getQueryData<Raw>(key);
      if (prev) qc.setQueryData<Raw>(key, { ...prev, patternSetting: Object.fromEntries(pattern.map((u, i) => [String(i), u ?? ""])) as never });
      void qc.invalidateQueries({ queryKey: key });
      toast.success("Weekday pattern saved for all future weeks. Date changes stay as they are.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The pattern could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const pick = (d: string) => {
    if (mode === "night") return setPicked([d]);
    if (picked.length >= 2 || picked.length === 0) return setPicked([d]);
    setPicked([picked[0]!, d].sort());
  };
  const ready = mode === "night" ? picked.length === 1 : picked.length === 2;
  const formDates = !ready ? [] : mode === "range" ? (() => { const out: string[] = []; for (let d = picked[0]!; d <= picked[1]!; d = addDays(d, 1)) out.push(d); return out; })() : picked;
  const inRange = (d: string) => mode === "range" && picked.length === 2 ? d >= picked[0]! && d <= picked[1]! : picked.includes(d);
  const monthName = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
  const shiftMonth = (n: number) => { const t = new Date(Date.UTC(ym.y, ym.m + n, 1)); setYm({ y: t.getUTCFullYear(), m: t.getUTCMonth() }); setPicked([]); };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full space-y-5 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Manage on-call</SheetTitle>
          <SheetDescription>Each weekday has a usual person. Change any single date on the calendar.</SheetDescription>
        </SheetHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Weekday pattern</h3>
          {!m.patternSaved && <p className="text-xs text-muted-foreground">Filled in from the current on-call nights. Nothing is saved until you press Save.</p>}
          {WEEKDAYS.map((day, i) => (
            <div key={day} className="flex items-center gap-2 text-sm">
              <span className="w-28">{day}</span>
              <select aria-label={`${day} on call`} className="h-9 flex-1 rounded-md border border-input bg-background px-2" value={pattern[i] ?? ""}
                onChange={(e) => setPattern(pattern.map((u, j) => (j === i ? e.target.value || null : u)))}>
                <option value="">Choose a person</option>
                {m.oncallPeople.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>)}
                {pattern[i] && !m.oncallPeople.some((p) => p.id === pattern[i]) && <option value={pattern[i]!}>{personName(m.people, pattern[i])} (not on the on-call list)</option>}
              </select>
            </div>
          ))}
          <Button className="w-full" disabled={busy || pattern.some((u) => !u)} onClick={save}>Save for all future weeks</Button>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Calendar</h3>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" aria-label="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft className="size-4" /></Button>
              <span className="w-32 text-center text-sm">{monthName}</span>
              <Button size="sm" variant="outline" aria-label="Next month" onClick={() => shiftMonth(1)}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
          <div className="flex gap-1" role="group" aria-label="What to change">
            {([["night", "One night"], ["range", "Date range"], ["swap", "Swap two nights"]] as const).map(([k, l]) => (
              <Button key={k} size="sm" variant={mode === k ? "secondary" : "outline"} onClick={() => { setMode(k); setPicked([]); }}>{l}</Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {mode === "night" ? "Click a night to change it." : mode === "range" ? "Click the first night, then the last night." : "Click the two nights to trade."}
          </p>
          <div className="grid grid-cols-7 gap-1 text-center text-[0.6875rem]">
            {WEEKDAYS.map((d) => <div key={d} className="font-semibold">{d.slice(0, 3)}</div>)}
            {monthCells(ym.y, ym.m).map((d, i) => {
              if (!d) return <div key={`x${i}`} />;
              const n = nightStatus(d, m.roster, m.roles, m.overrides, m.pattern);
              return (
                <button key={d} type="button" onClick={() => pick(d)} aria-pressed={inRange(d)} title={n.note ?? undefined}
                  className={`${nightClass(n)} min-h-12 ${inRange(d) ? "ring-2 ring-primary" : ""}`}>
                  <div className="font-semibold">{Number(d.slice(8))}{n.isOverride ? " ·" : ""}</div>
                  <div className="truncate">{n.empty ? "No one" : (personName(m.people, n.userId) ?? "").split(" ")[0]}</div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">A dot marks a date change. Red means no one is on call or the person has time off.</p>
          {ready && (
            <div className="rounded-md border border-border p-3">
              <NightForm key={formDates.join(",") + mode} dates={formDates} mode={mode} m={m} onDone={() => setPicked([])} />
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}

function GridRowsButton({ m, onChanged }: { m: Model; onChanged: () => void }) {
  const { isAdmin } = useRole();
  const save = useServerFn(saveGridSeats);
  const [codes, setCodes] = useState<string[]>(m.gridCodes);
  const [busy, setBusy] = useState(false);
  if (!isAdmin) return null;
  return (
    <Popover>
      <PopoverTrigger asChild><Button size="sm" variant="outline"><Rows3 className="size-4" /> Rows shown</Button></PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 text-sm">
        <p className="font-semibold">Rows on the schedule</p>
        <p className="text-xs text-muted-foreground">Display only. Hidden seats still get work exactly as before.</p>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {m.roles.map((r) => (
            <label key={r.code} className="flex items-center gap-2">
              <input type="checkbox" checked={codes.includes(r.code)} onChange={(e) => setCodes(e.target.checked ? [...codes, r.code] : codes.filter((c) => c !== r.code))} />
              {SEAT_LABELS[r.code] ?? r.name}
            </label>
          ))}
        </div>
        <Button size="sm" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await save({ data: { codes: m.roles.map((r) => r.code).filter((c) => codes.includes(c)) } }); toast.success("Rows saved."); onChanged(); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Rows could not be saved."); }
          finally { setBusy(false); }
        }}>Save rows</Button>
      </PopoverContent>
    </Popover>
  );
}

/** Removes "this week only" overrides through the audited server function. Admin and Supervisor only (checked on the server). */
function useOverrideRemover(onChanged: () => void) {
  const del = useServerFn(deleteOverride);
  return async (ids: string[], msg: string) => {
    if (ids.length === 0) return;
    try {
      for (const id of ids) await del({ data: { id } });
      toast.success(msg);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The change could not be removed.");
    }
  };
}
