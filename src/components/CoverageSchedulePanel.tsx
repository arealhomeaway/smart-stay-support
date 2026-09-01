import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, Moon, Pause, Play, Plus, Trash2, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { windowLabel, type CoverageConfig } from "@/lib/coverage";
import { SEAT_LABELS } from "@/lib/coverage-model";
import type { Ownership } from "@/lib/semantic";
import {
  coverageModel,
  deleteOnCall,
  deleteOverride,
  deleteShift,
  saveOnCall,
  saveOverride,
  saveShift,
  setSeatAvailability,
  setSeatHolder,
} from "@/lib/coverage-admin.functions";

/**
 * The one coverage plan: who holds each seat, the recurring hours they are on
 * duty (Central, daylight-saving safe), any temporary override, the approved
 * cross-team triage windows and the overnight on-call roster.
 *
 * This is the same data the routing engine reads, so a change here changes
 * where NEW work goes on the next decision. It never moves work somebody
 * already owns.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clock(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "a.m." : "p.m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`;
}

function toMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function toTimeValue(minutes: number) {
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function chicagoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Role = {
  id: string;
  code: string;
  name: string;
  current_seat_holder: string | null;
  current_seat_name: string | null;
  available?: boolean | null;
  unavailable_note?: string | null;
  sort_order?: number | null;
};
type Shift = { id: string; role_code: string; weekday: number; start_minute: number; end_minute: number };
type Override = {
  id: string;
  role_code: string;
  kind: string;
  user_id: string | null;
  starts_at: string;
  ends_at: string;
  note: string | null;
};
type Triage = { id: string; weekday: number; start_minute: number; end_minute: number; role_code: string; note: string | null };
type Roster = { id: string; user_id: string; starts_on: string; ends_on: string; label: string | null };
type Person = { id: string; full_name: string | null; email: string | null; oncall_eligible?: boolean | null };

export function CoverageSchedulePanel() {
  const qc = useQueryClient();
  const load = useServerFn(coverageModel);

  const { data, isLoading } = useQuery({
    queryKey: ["coverage-model"],
    queryFn: () => load({ data: {} as never }),
  });

  if (isLoading || !data) return <Skeleton className="h-72 w-full" />;

  const canEdit = data.canEdit === true;
  const roles = (data.roles as Role[]).filter((r) => r.code !== "__none__");
  const people = data.people as Person[];
  const refresh = () => qc.invalidateQueries({ queryKey: ["coverage-model"] });

  return (
    <div className="space-y-4">
      {/* Read the week first. Everything below it is the editing surface for
          what the calendar shows. */}
      <WeekCalendar
        roles={roles}
        shifts={data.shifts as Shift[]}
        triage={data.triage as Triage[]}
        overrides={data.overrides as Override[]}
        people={people}
        config={(data.config ?? null) as CoverageConfig | null}
      />

      <details className="group surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
          <span>
            <span className="font-semibold">Manage seats, schedules and on-call</span>
            <span className="block text-sm text-muted-foreground">
              {canEdit
                ? "Change a seat holder, a recurring shift, a temporary override or the overnight roster."
                : "View the seat holders, recurring shifts and the overnight roster."}
            </span>
          </span>
          <span className="text-sm text-primary group-open:hidden">Open</span>
          <span className="hidden text-sm text-primary group-open:inline">Close</span>
        </summary>
        <div className="space-y-4 border-t border-border p-4">
          <SeatsCard
            roles={roles}
            shifts={data.shifts as Shift[]}
            overrides={data.overrides as Override[]}
            people={people}
            canEdit={canEdit}
            onChanged={refresh}
          />
          <TriageCard windows={data.triage as Triage[]} roles={roles} />
          <OnCallCard
            roster={data.roster as Roster[]}
            people={people}
            config={(data.config ?? null) as CoverageConfig | null}
            canEdit={canEdit}
            onChanged={refresh}
          />
        </div>
      </details>
    </div>
  );
}

/** Which colour a seat carries in the calendar: Team A, Team B or leadership. */
function seatOwnership(code: string): Ownership {
  if (code.startsWith("ge_")) return "team_a";
  if (code.startsWith("po_")) return "team_b";
  return "leadership";
}

const CAL_START = 6 * 60; // 6 a.m.
const CAL_END = 24 * 60;
const CAL_SPAN = CAL_END - CAL_START;

const BLOCK_FILL: Record<Ownership, string> = {
  team_a: "bg-team-a/15 border-team-a/45 text-team-a",
  team_b: "bg-team-b/15 border-team-b/45 text-team-b",
  leadership: "bg-leadership/15 border-leadership/45 text-leadership",
  vendor: "bg-module-override/15 border-module-override/45 text-module-override",
  owner: "bg-module-owner/15 border-module-owner/45 text-module-owner",
  unassigned: "bg-muted border-border text-muted-foreground",
};

/**
 * The whole operating week on one screen: who is on duty, when a seat is
 * covered by the other team, and who carries the overnight phone.
 *
 * Purely a view of the same rows the routing engine reads — editing stays in
 * the panels below.
 */
function WeekCalendar({
  roles,
  shifts,
  triage,
  overrides,
  people,
  config,
}: {
  roles: Role[];
  shifts: Shift[];
  triage: Triage[];
  overrides: Override[];
  people: Person[];
  config: CoverageConfig | null;
}) {
  const roleByCode = new Map(roles.map((r) => [r.code, r]));
  const activeOverrides = overrides.filter((o) => new Date(o.ends_at) > new Date());
  const nightStart = config?.after_hours_start_minute ?? 22 * 60;
  const nightEnd = config?.after_hours_end_minute ?? 8 * 60;

  // Only seats that actually carry hours belong on the week grid; the rest are
  // named underneath so nothing disappears.
  const scheduled = roles.filter(
    (r) => shifts.some((s) => s.role_code === r.code) || triage.some((t) => t.role_code === r.code),
  );
  const unscheduled = roles.filter((r) => !scheduled.includes(r));

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <CalendarClock className="size-4" /> The operating week
          </h3>
          <p className="text-sm text-muted-foreground">
            Central time, daylight-saving safe. New work routes to whoever is on duty here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`chip ${BLOCK_FILL["team_a"]}`}>Team A — Guest Experience</span>
          <span className={`chip ${BLOCK_FILL["team_b"]}`}>Team B — Property Operations</span>
          <span className={`chip ${BLOCK_FILL["leadership"]}`}>Supervisor</span>
          <span className="chip triage-block border-dashed border-triage/60 text-triage">
            ⁄⁄ Cross-team triage
          </span>
        </div>
      </div>

      <div className="overflow-x-auto p-4">
        <div className="min-w-[52rem] space-y-1.5">
          <div className="grid grid-cols-[16rem_repeat(7,1fr)] gap-1.5">
            <div className="eyebrow self-end">Seat</div>
            {DAYS.map((d) => (
              <div key={d} className="pb-1 text-center text-xs font-semibold">
                {d.slice(0, 3)}
              </div>
            ))}
          </div>

          {scheduled.map((role) => {
            const kind = seatOwnership(role.code);
            const holder = role.current_seat_name ?? nameFor(people, role.current_seat_holder);
            const pending = Boolean(role.current_seat_name && !role.current_seat_holder);
            const covered = activeOverrides.filter((o) => o.role_code === role.code);
            return (
              <div key={role.code} className="grid grid-cols-[16rem_repeat(7,1fr)] items-stretch gap-1.5">
                <div className="flex flex-col justify-center rounded-md border border-border bg-sunken px-3 py-2">
                  <span className="truncate text-xs font-semibold">
                    {SEAT_LABELS[role.code] ?? role.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {holder ?? <span className="text-danger">Seat unfilled</span>}
                    {pending && <span className="text-warning"> · invite pending</span>}
                    {role.available === false && <span className="text-warning"> · unavailable</span>}
                  </span>
                  {covered.length > 0 && (
                    <span className="truncate text-xs text-module-override">
                      {covered.length} temporary override{covered.length > 1 ? "s" : ""} in force
                    </span>
                  )}
                </div>

                {DAYS.map((day, weekday) => {
                  const rows = shifts
                    .filter((s) => s.role_code === role.code && s.weekday === weekday)
                    .sort((a, b) => a.start_minute - b.start_minute);
                  const cover = triage.filter(
                    (t) => t.role_code === role.code && t.weekday === weekday,
                  );
                  if (rows.length === 0 && cover.length === 0) {
                    return (
                      <div
                        key={day}
                        className="rounded-md border border-dashed border-border/70 bg-sunken/40"
                      />
                    );
                  }
                  return (
                    <div key={day} className="flex flex-col gap-1">
                      {rows.map((s) => (
                        <div
                          key={s.id}
                          className={`rounded-md border px-1.5 py-1.5 text-center text-[0.6875rem] font-medium leading-tight ${BLOCK_FILL[kind]}`}
                        >
                          {clock(s.start_minute)}–{clock(s.end_minute)}
                        </div>
                      ))}
                      {cover.map((t) => (
                        <div
                          key={t.id}
                          title="Approved cross-team triage cover"
                          className="triage-block rounded-md border border-dashed border-triage/60 px-1.5 py-1.5 text-center text-[0.6875rem] font-medium leading-tight text-triage"
                        >
                          Triage {clock(t.start_minute)}–{clock(t.end_minute)}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {unscheduled.length > 0 && (
            <p className="pt-1 text-xs text-muted-foreground">
              No recurring hours, available by exception:{" "}
              {unscheduled.map((r) => SEAT_LABELS[r.code] ?? r.name).join(" · ")}
            </p>
          )}

          {/* Overnight is one continuous band, not seven separate shifts. */}
          <div className="mt-3 flex items-center gap-3 rounded-md border border-module-override/40 bg-module-override/10 px-3 py-2 text-xs text-module-override">
            <Moon className="size-3.5 shrink-0" />
            <span>
              <span className="font-semibold">On-call, every night {clock(nightStart)}–{clock(nightEnd)} Central.</span>{" "}
              The overnight roster takes precedence over every seat schedule above.
            </span>
          </div>
        </div>
      </div>

    </section>
  );
}


function nameFor(people: Person[], id: string | null) {
  if (!id) return null;
  const p = people.find((e) => e.id === id);
  return p?.full_name ?? p?.email ?? "Unknown";
}

function SeatsCard({
  roles,
  shifts,
  overrides,
  people,
  canEdit,
  onChanged,
}: {
  roles: Role[];
  shifts: Shift[];
  overrides: Override[];
  people: Person[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4" /> Seats &amp; coverage windows
        </CardTitle>
        <CardDescription>
          The hours each seat is on duty, in Central time and adjusted automatically for daylight saving. This is
          the same plan the routing engine uses — a change takes effect on the next new ticket and never moves
          work somebody already owns.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {roles.map((role) => {
          const rows = shifts.filter((s) => s.role_code === role.code).sort((a, b) => a.weekday - b.weekday);
          const active = overrides.filter(
            (o) => o.role_code === role.code && new Date(o.ends_at) > new Date(),
          );
          const unavailable = role.available === false;
          return (
            <div key={role.code} className="space-y-2 border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{SEAT_LABELS[role.code] ?? role.name}</p>
                  <p className="text-muted-foreground">
                    {role.current_seat_name ?? <span className="text-danger">Seat unfilled</span>}
                  </p>
                  {role.current_seat_name && !role.current_seat_holder && (
                    <p className="text-warning">
                      Pending — this person has not redeemed their invitation yet, so work cannot route to the
                      seat until their account exists. It is seated automatically the moment they join.
                    </p>
                  )}
                  {unavailable && (
                    <p className="text-warning">
                      Marked unavailable{role.unavailable_note ? ` — ${role.unavailable_note}` : ""}.
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {rows.length === 0 ? (
                    <span className="text-muted-foreground">No schedule — available by exception</span>
                  ) : (
                    rows.map((s) => (
                      <p key={s.id}>
                        <span className="text-muted-foreground">{DAYS[s.weekday]?.slice(0, 3)}</span>{" "}
                        {clock(s.start_minute)}–{clock(s.end_minute)}
                        {canEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="ml-1 size-6"
                            onClick={async () => {
                              try {
                                await deleteShift({ data: { id: s.id } });
                                toast.success("Shift removed.");
                                onChanged();
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </p>
                    ))
                  )}
                </div>
              </div>

              {active.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-border bg-secondary/40 p-2 text-xs">
                  {active.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2">
                      <span>
                        <Badge variant="outline" className="mr-2">
                          {o.kind === "off" ? "Off" : "Temporary cover"}
                        </Badge>
                        {o.kind === "cover" ? nameFor(people, o.user_id) : "Seat off duty"}{" "}
                        <span className="text-muted-foreground">
                          {new Date(o.starts_at).toLocaleString()} → {new Date(o.ends_at).toLocaleString()}
                        </span>
                      </span>
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          onClick={async () => {
                            try {
                              await deleteOverride({ data: { id: o.id } });
                              toast.success("Override removed — the normal schedule is back.");
                              onChanged();
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {canEdit &&
                (open === role.code ? (
                  <SeatEditor role={role} people={people} onDone={onChanged} onClose={() => setOpen(null)} />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setOpen(role.code)}>
                      Manage seat &amp; schedule
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await setSeatAvailability({
                            data: { roleCode: role.code, available: unavailable, note: "Temporarily unavailable" },
                          });
                          toast.success(unavailable ? "Seat is available again." : "Seat marked unavailable.");
                          onChanged();
                        } catch (e) {
                          toast.error((e as Error).message);
                        }
                      }}
                    >
                      {unavailable ? <Play className="mr-1 size-3" /> : <Pause className="mr-1 size-3" />}
                      {unavailable ? "Mark available" : "Mark unavailable"}
                    </Button>
                  </div>
                ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function SeatEditor({
  role,
  people,
  onDone,
  onClose,
}: {
  role: Role;
  people: Person[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [holder, setHolder] = useState(role.current_seat_holder ?? "");
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("17:00");
  const [ovKind, setOvKind] = useState<"cover" | "off">("cover");
  const [ovPerson, setOvPerson] = useState("");
  const [ovStart, setOvStart] = useState("");
  const [ovEnd, setOvEnd] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-3">
      <div className="space-y-1.5">
        <Label>Seat holder</Label>
        <div className="flex gap-2">
          <Select value={holder} onValueChange={setHolder}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an existing Resolve account" />
            </SelectTrigger>
            <SelectContent>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name ?? p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={busy || !holder}
            onClick={() => run(() => setSeatHolder({ data: { roleCode: role.code, userId: holder } }), "Seat updated.")}
          >
            <UserCheck className="mr-1 size-3" /> Seat
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => run(() => setSeatHolder({ data: { roleCode: role.code, userId: null } }), "Seat cleared.")}
          >
            Clear
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Only people with a Resolve account appear here. Invited staff are seated automatically when they redeem
          their invitation — no second account is ever created.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Add a recurring shift</Label>
        <div className="grid gap-2 sm:grid-cols-4">
          <Select value={weekday} onValueChange={setWeekday}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS.map((d, i) => (
                <SelectItem key={d} value={String(i)}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  saveShift({
                    data: {
                      roleCode: role.code,
                      weekday: Number(weekday),
                      startMinute: toMinutes(start),
                      endMinute: toMinutes(end),
                    },
                  }),
                "Shift added.",
              )
            }
          >
            <Plus className="mr-1 size-3" /> Add
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Temporary override for a specific date and time</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={ovKind} onValueChange={(v) => setOvKind(v as "cover" | "off")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cover">Someone covers this seat</SelectItem>
              <SelectItem value="off">Seat is off duty</SelectItem>
            </SelectContent>
          </Select>
          {ovKind === "cover" && (
            <Select value={ovPerson} onValueChange={setOvPerson}>
              <SelectTrigger>
                <SelectValue placeholder="Who is covering?" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input type="datetime-local" value={ovStart} onChange={(e) => setOvStart(e.target.value)} />
          <Input type="datetime-local" value={ovEnd} onChange={(e) => setOvEnd(e.target.value)} />
        </div>
        <Button
          size="sm"
          disabled={busy || !ovStart || !ovEnd}
          onClick={() =>
            run(
              () =>
                saveOverride({
                  data: {
                    roleCode: role.code,
                    kind: ovKind,
                    userId: ovPerson || null,
                    startsAt: new Date(ovStart).toISOString(),
                    endsAt: new Date(ovEnd).toISOString(),
                  },
                }),
              "Override saved — it beats the recurring schedule while it lasts.",
            )
          }
        >
          Save override
        </Button>
      </div>

      <Button size="sm" variant="ghost" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

function TriageCard({ windows, roles }: { windows: Triage[]; roles: Role[] }) {
  const label = (code: string) =>
    SEAT_LABELS[code] ?? roles.find((r) => r.code === code)?.name ?? code;
  const ordered = useMemo(
    () => [...windows].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7) || a.start_minute - b.start_minute),
    [windows],
  );
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Approved cross-team triage windows</CardTitle>
        <CardDescription>
          Hours where Property Operations is off duty on purpose and a Guest Experience seat handles triage. These
          are covered hours, not gaps — new Breezeway work routes to the named seat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {ordered.length === 0 ? (
          <p className="text-muted-foreground">No cross-team windows are configured.</p>
        ) : (
          ordered.map((w) => (
            <p key={w.id}>
              <span className="text-muted-foreground">
                {DAYS[w.weekday]} {clock(w.start_minute)}–{clock(w.end_minute)}
              </span>{" "}
              → {label(w.role_code)}
            </p>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function OnCallCard({
  roster,
  people,
  config,
  canEdit,
  onChanged,
}: {
  roster: Roster[];
  people: Person[];
  config: CoverageConfig | null;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [person, setPerson] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = chicagoToday();
  const eligible = people.filter((p) => p.oncall_eligible !== false);
  const onCallToday = roster.find((r) => r.starts_on <= today && r.ends_on >= today);

  async function submit(id: string | null) {
    if (!startsOn || !endsOn || !person) {
      toast.error("Pick a start date, an end date and one person.");
      return;
    }
    setSaving(true);
    try {
      await saveOnCall({ data: { id, userId: person, startsOn, endsOn, label: "On-call" } });
      setStartsOn("");
      setEndsOn("");
      setPerson("");
      setEditing(null);
      toast.success("On-call schedule updated.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Moon className="size-4" /> After-hours on-call roster
        </CardTitle>
        <CardDescription>
          One named person per date, held in Central time. Inside the after-hours window the rostered person is the
          active escalation owner and takes precedence over normal routing; priority is still judged on impact, so
          overnight is never automatically P1.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">On call today ({today})</p>
            <p className="text-lg font-semibold">
              {onCallToday ? nameFor(people, onCallToday.user_id) : "No one scheduled"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">After-hours window</p>
            <p className="font-medium">{windowLabel(config) ?? "Not configured"}</p>
          </div>
        </div>

        {!onCallToday && (
          <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>No on-call person is scheduled for {today}. Add a dated entry to close the gap.</p>
          </div>
        )}

        {roster.length === 0 ? (
          <p className="text-muted-foreground">No on-call periods have been entered.</p>
        ) : (
          <ul className="space-y-2">
            {roster.map((r) => {
              const current = r.starts_on <= today && r.ends_on >= today;
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-2">
                  <span>
                    <span className="font-medium">{nameFor(people, r.user_id)}</span>{" "}
                    <span className="text-muted-foreground">
                      {r.starts_on} → {r.ends_on}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {current && <Badge variant="outline">On call now</Badge>}
                    {canEdit && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditing(r.id);
                            setPerson(r.user_id);
                            setStartsOn(r.starts_on);
                            setEndsOn(r.ends_on);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              await deleteOnCall({ data: { id: r.id } });
                              toast.success("On-call period removed.");
                              onChanged();
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <p className="font-medium">{editing ? "Edit on-call period" : "Add on-call period"}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Starts</Label>
                <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ends</Label>
                <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>On-call person</Label>
                <Select value={person} onValueChange={setPerson}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligible.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name ?? p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void submit(editing)} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add on-call period"}
              </Button>
              {editing && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(null);
                    setPerson("");
                    setStartsOn("");
                    setEndsOn("");
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A one-night override is just a period with the same start and end date. The routing engine reads this
              exact roster, so there is no second on-call list.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { toTimeValue };
