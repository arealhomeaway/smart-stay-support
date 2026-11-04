/**
 * Team & coverage schedule rules (pure, browser safe).
 *
 * The screen is person-centered, but storage stays the routing model:
 * functional_roles seats, coverage_shifts (recurring), coverage_overrides
 * (dated cover or off) and oncall_roster (overnight). Every edit on the week
 * grid is translated here into the exact writes the existing audited server
 * functions perform, so the screen and the router can never disagree.
 */

export const TZ = "America/Chicago";

export type SRole = {
  code: string;
  name: string;
  current_seat_holder: string | null;
  current_seat_name: string | null;
  available?: boolean | null;
};
export type SShift = { id: string; role_code: string; weekday: number; start_minute: number; end_minute: number; active?: boolean | null };
export type SOverride = { id: string; role_code: string; kind: string; user_id: string | null; starts_at: string; ends_at: string; note: string | null; created_at?: string | null };
export type SRoster = { id: string; user_id: string; starts_on: string; ends_on: string; label: string | null; created_at?: string | null };
export type SPerson = { id: string; full_name: string | null; email: string | null };

// ---------- dates (Central, daylight-saving safe) ----------

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, d! + n));
  return t.toISOString().slice(0, 10);
}
export function weekdayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}
/** Sunday that starts the week containing `date`. */
export function weekStart(date: string) {
  return addDays(date, -weekdayOf(date));
}
export function weekDates(sunday: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
}
function parts(at: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "00";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, minute: Number(g("hour")) * 60 + Number(g("minute")) };
}
export function centralDate(at: Date | string) {
  return parts(typeof at === "string" ? new Date(at) : at).date;
}
export function centralToday(now = new Date()) {
  return parts(now).date;
}
/** The UTC instant for a Central wall-clock date + minute (1440 = next midnight). */
export function centralInstant(date: string, minute: number) {
  const day = addDays(date, Math.floor(minute / 1440));
  const min = ((minute % 1440) + 1440) % 1440;
  const [y, m, d] = day.split("-").map(Number);
  const wanted = Date.UTC(y!, m! - 1, d!, Math.floor(min / 60), min % 60);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(guess));
    const [py, pm, pd] = p.date.split("-").map(Number);
    const seen = Date.UTC(py!, pm! - 1, pd!, Math.floor(p.minute / 60), p.minute % 60);
    guess += wanted - seen;
  }
  return new Date(guess).toISOString();
}
const overlaps = (o: { starts_at: string; ends_at: string }, from: string, to: string) =>
  new Date(o.starts_at) < new Date(to) && new Date(o.ends_at) > new Date(from);

export function clock(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "a.m." : "p.m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`;
}
export function shortDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
}

export function personName(people: SPerson[], id: string | null | undefined) {
  if (!id) return null;
  const p = people.find((e) => e.id === id);
  return p?.full_name ?? p?.email ?? "Unknown";
}

// ---------- the week grid ----------

export type CellBlock = {
  key: string;
  shift: SShift | null;
  start: number;
  end: number;
  out: boolean;
  coverUserId: string | null;
  overrideIds: string[];
};

/** What one seat shows on one date: recurring shifts with that week's cover/off laid over them. */
export function cellBlocks(roleCode: string, date: string, shifts: SShift[], overrides: SOverride[]): CellBlock[] {
  const wd = weekdayOf(date);
  const dayFrom = centralInstant(date, 0);
  const dayTo = centralInstant(date, 1440);
  const mine = overrides.filter((o) => o.role_code === roleCode && overlaps(o, dayFrom, dayTo));
  const used = new Set<string>();
  const blocks: CellBlock[] = shifts
    .filter((s) => s.role_code === roleCode && s.weekday === wd && s.active !== false)
    .sort((a, b) => a.start_minute - b.start_minute)
    .map((s) => {
      const from = centralInstant(date, s.start_minute);
      const to = centralInstant(date, s.end_minute);
      const hit = mine.filter((o) => overlaps(o, from, to)).sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
      hit.forEach((o) => used.add(o.id));
      const cover = hit.find((o) => o.kind === "cover");
      return {
        key: s.id,
        shift: s,
        start: s.start_minute,
        end: s.end_minute,
        out: hit.some((o) => o.kind === "off"),
        coverUserId: cover?.user_id ?? null,
        overrideIds: hit.map((o) => o.id),
      };
    });
  // Cover added on a day with no recurring shift ("this week only" extra shift).
  for (const o of mine) {
    if (used.has(o.id) || o.kind !== "cover") continue;
    if (centralDate(o.starts_at) !== date) continue;
    const start = parts(new Date(o.starts_at)).minute;
    const endDate = centralDate(o.ends_at);
    const end = endDate === date ? parts(new Date(o.ends_at)).minute : 1440;
    blocks.push({ key: o.id, shift: null, start, end, out: false, coverUserId: o.user_id, overrideIds: [o.id] });
  }
  return blocks.sort((a, b) => a.start - b.start);
}

export type CoverageAction =
  | { type: "override"; roleCode: string; kind: "cover" | "off"; userId: string | null; startsAt: string; endsAt: string; note: string }
  | { type: "shift"; id: string | null; roleCode: string; weekday: number; startMinute: number; endMinute: number }
  | { type: "deleteShift"; id: string }
  | { type: "seatHolder"; roleCode: string; userId: string | null };

export type ShiftEdit = {
  scope: "week" | "every";
  roleCode: string;
  date: string;
  shift: SShift;
  seatHolder: string | null;
  start: number;
  end: number;
  personId: string | null;
  markOut: boolean;
  note?: string;
};

/** Translate one shift popover save into storage writes. */
export function planShiftEdit(e: ShiftEdit): CoverageAction[] {
  const note = e.note ?? "";
  const hoursChanged = e.start !== e.shift.start_minute || e.end !== e.shift.end_minute;
  const personChanged = (e.personId ?? null) !== (e.seatHolder ?? null);
  if (e.end <= e.start) throw new Error("The shift needs an end after its start.");
  if (e.scope === "every") {
    if (e.markOut) return [{ type: "deleteShift", id: e.shift.id }];
    const out: CoverageAction[] = [];
    if (hoursChanged)
      out.push({ type: "shift", id: e.shift.id, roleCode: e.roleCode, weekday: e.shift.weekday, startMinute: e.start, endMinute: e.end });
    if (personChanged) out.push({ type: "seatHolder", roleCode: e.roleCode, userId: e.personId });
    return out;
  }
  const origFrom = centralInstant(e.date, e.shift.start_minute);
  const origTo = centralInstant(e.date, e.shift.end_minute);
  if (e.markOut) return [{ type: "override", roleCode: e.roleCode, kind: "off", userId: null, startsAt: origFrom, endsAt: origTo, note }];
  if (!hoursChanged && !personChanged) return [];
  const out: CoverageAction[] = [];
  if (hoursChanged) out.push({ type: "override", roleCode: e.roleCode, kind: "off", userId: null, startsAt: origFrom, endsAt: origTo, note });
  const who = e.personId ?? e.seatHolder;
  if (!who) throw new Error("Choose who is working this shift.");
  out.push({
    type: "override", roleCode: e.roleCode, kind: "cover", userId: who,
    startsAt: centralInstant(e.date, e.start), endsAt: centralInstant(e.date, e.end), note,
  });
  return out;
}

/** Add a shift in an empty cell. */
export function planNewShift(e: { scope: "week" | "every"; roleCode: string; date: string; start: number; end: number; personId: string | null; seatHolder: string | null; note?: string }): CoverageAction[] {
  if (e.end <= e.start) throw new Error("The shift needs an end after its start.");
  if (e.scope === "every") {
    const out: CoverageAction[] = [{ type: "shift", id: null, roleCode: e.roleCode, weekday: weekdayOf(e.date), startMinute: e.start, endMinute: e.end }];
    if (e.personId && e.personId !== e.seatHolder) out.push({ type: "seatHolder", roleCode: e.roleCode, userId: e.personId });
    return out;
  }
  const who = e.personId ?? e.seatHolder;
  if (!who) throw new Error("Choose who is working this shift.");
  return [{ type: "override", roleCode: e.roleCode, kind: "cover", userId: who, startsAt: centralInstant(e.date, e.start), endsAt: centralInstant(e.date, e.end), note: e.note ?? "" }];
}

// ---------- time off ----------

export function seatsHeldBy(roles: SRole[], userId: string) {
  return roles.filter((r) => r.current_seat_holder === userId).map((r) => r.code);
}

/** Time off for a person = an off override on every seat they hold (plus cover rows when chosen). */
export function planTimeOff(input: { roles: SRole[]; userId: string; startsAt: string; endsAt: string; note: string; coverUserId: string | null }): CoverageAction[] {
  if (new Date(input.endsAt) <= new Date(input.startsAt)) throw new Error("The time off needs an end after its start.");
  const seats = seatsHeldBy(input.roles, input.userId);
  if (seats.length === 0) throw new Error("This person does not hold a seat yet, so time off cannot be saved for them.");
  if (input.coverUserId === input.userId) throw new Error("Choose someone else to cover.");
  const out: CoverageAction[] = [];
  // Off first, then cover: the newest override wins, so the cover person takes the work.
  for (const roleCode of seats)
    out.push({ type: "override", roleCode, kind: "off", userId: null, startsAt: input.startsAt, endsAt: input.endsAt, note: input.note });
  if (input.coverUserId)
    for (const roleCode of seats)
      out.push({ type: "override", roleCode, kind: "cover", userId: input.coverUserId, startsAt: input.startsAt, endsAt: input.endsAt, note: input.note });
  return out;
}

export type OutEntry = { id: string; personId: string | null; roleCode: string; startsAt: string; endsAt: string; coverUserId: string | null; note: string | null };

/** Every off override touching the viewed week, with who is covering. */
export function whosOut(sunday: string, roles: SRole[], overrides: SOverride[]): OutEntry[] {
  const from = centralInstant(sunday, 0);
  const to = centralInstant(addDays(sunday, 7), 0);
  return overrides
    .filter((o) => o.kind === "off" && overlaps(o, from, to))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((o) => {
      const cover = overrides.find((c) => c.kind === "cover" && c.role_code === o.role_code && overlaps(c, o.starts_at, o.ends_at));
      return {
        id: o.id,
        personId: roles.find((r) => r.code === o.role_code)?.current_seat_holder ?? null,
        roleCode: o.role_code,
        startsAt: o.starts_at,
        endsAt: o.ends_at,
        coverUserId: cover?.user_id ?? null,
        note: o.note,
      };
    });
}

/** Is this person out (off override on a seat they hold) at any point in [from, to)? */
export function personOutDuring(userId: string, from: string, to: string, roles: SRole[], overrides: SOverride[]) {
  const seats = new Set(seatsHeldBy(roles, userId));
  return overrides.some((o) => o.kind === "off" && seats.has(o.role_code) && overlaps(o, from, to));
}

// ---------- on call ----------

export const ROTATION_LABEL = "Weekly on-call rotation";
export const SINGLE_NIGHT_LABEL = "Single night on-call";

/**
 * Who is on call for the night that starts on `date` (10 p.m. that day to
 * 8 a.m. the next). Shortest entry wins, then the newest, so a single-night
 * entry always beats a weekly rotation. Mirrors pending SQL 01.
 */
export function oncallForNight(roster: SRoster[], date: string): SRoster | null {
  const span = (r: SRoster) => (Date.parse(r.ends_on) - Date.parse(r.starts_on)) / 86400000;
  return (
    roster
      .filter((r) => r.starts_on <= date && date <= r.ends_on)
      .sort((a, b) => span(a) - span(b) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null
  );
}

export type NightStatus = { date: string; userId: string | null; entryId: string | null; singleNight: boolean; needsCover: boolean; empty: boolean };

export function nightStatus(
  date: string,
  roster: SRoster[],
  roles: SRole[],
  overrides: SOverride[],
  window: { start: number; end: number } = { start: 22 * 60, end: 8 * 60 },
): NightStatus {
  const entry = oncallForNight(roster, date);
  if (!entry) return { date, userId: null, entryId: null, singleNight: false, needsCover: false, empty: true };
  const from = centralInstant(date, window.start);
  const to = centralInstant(date, window.end <= window.start ? 1440 + window.end : window.end);
  return {
    date,
    userId: entry.user_id,
    entryId: entry.id,
    singleNight: entry.starts_on === entry.ends_on,
    needsCover: personOutDuring(entry.user_id, from, to, roles, overrides),
    empty: false,
  };
}

/** Next Monday on or after `today` (rotation weeks run Monday to Sunday). */
export function nextMonday(today: string) {
  const wd = weekdayOf(today);
  return addDays(today, wd === 1 ? 0 : (8 - wd) % 7);
}

export type RotationRow = { userId: string; startsOn: string; endsOn: string };

/** Weekly rows, Monday to Sunday, cycling through the ordered list. */
export function generateRotation(order: string[], firstMonday: string, weeks = 8): RotationRow[] {
  if (order.length === 0) throw new Error("Add at least one person to the rotation.");
  if (weekdayOf(firstMonday) !== 1) throw new Error("Rotation weeks start on a Monday.");
  return Array.from({ length: weeks }, (_, i) => ({
    userId: order[i % order.length]!,
    startsOn: addDays(firstMonday, i * 7),
    endsOn: addDays(firstMonday, i * 7 + 6),
  }));
}

/** Existing rotation rows the generator replaces (only its own weekly rows in range). */
export function rotationRowsToReplace(roster: SRoster[], firstMonday: string, weeks = 8) {
  const last = addDays(firstMonday, weeks * 7 - 1);
  return roster.filter((r) => r.label === ROTATION_LABEL && r.starts_on >= firstMonday && r.starts_on <= last);
}

/** The rotation order as last saved: people in weekly rows from this week on, first appearance order. */
export function rotationOrderFromRoster(roster: SRoster[], today: string) {
  const seen: string[] = [];
  roster
    .filter((r) => r.label === ROTATION_LABEL && r.ends_on >= today)
    .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
    .forEach((r) => { if (!seen.includes(r.user_id)) seen.push(r.user_id); });
  return seen;
}

export function moveItem<T>(list: T[], from: number, to: number) {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item!);
  return next;
}

// ---------- users ----------

export type AccessPerson = { id: string; full_name: string | null; email: string | null; roles: string[]; state: "invited" | "redeemed" | "active" | "disabled"; lastSignIn?: string | null };
export type UserStatus = "Active" | "Invite pending" | "Off";
export type UserRow = { id: string; name: string; email: string; role: string; seat: string; team: string; status: UserStatus; lastSignIn: string | null };

export function userStatus(state: AccessPerson["state"]): UserStatus {
  if (state === "disabled") return "Off";
  if (state === "invited" || state === "redeemed") return "Invite pending";
  return "Active";
}

export function userRows(
  people: AccessPerson[],
  roles: SRole[],
  roleLabel: (roles: string[]) => string,
  teamOfSeat: (code: string) => string | null,
  seatLabel: (code: string) => string,
): UserRow[] {
  return people.map((p) => {
    const seats = seatsHeldBy(roles, p.id);
    const teams = [...new Set(seats.map((c) => teamOfSeat(c)).filter(Boolean))] as string[];
    return {
      id: p.id,
      name: p.full_name ?? p.email ?? "Unnamed",
      email: p.email ?? "",
      role: roleLabel(p.roles),
      seat: seats.length ? seats.map(seatLabel).join(", ") : "None",
      team: teams.length ? teams.join(", ") : "None",
      status: userStatus(p.state),
      lastSignIn: p.lastSignIn ?? null,
    };
  });
}

export function filterUsers(rows: UserRow[], f: { q: string; role: string; status: string }) {
  const q = f.q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)) &&
      (f.role === "all" || r.role === f.role) &&
      (f.status === "all" || r.status === f.status),
  );
}

/** Message for the Schedule tab alert; null hides it. */
export function needsOwnerAlert(n: number) {
  if (n <= 0) return null;
  return `${n} ${n === 1 ? "ticket needs" : "tickets need"} an owner`;
}
