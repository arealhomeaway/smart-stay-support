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
export type SPerson = { id: string; full_name: string | null; email: string | null; removed_at?: string | null };

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
  const n = p?.full_name ?? p?.email ?? "Unknown";
  return p?.removed_at ? `${n} (former)` : n;
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
  if (seats.length === 0) throw new Error("This person is not on the schedule yet, so time off cannot be saved for them.");
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

/**
 * On call is a weekday pattern (one person per weekday, no end date) plus
 * dated entries in oncall_roster. A dated entry always wins over the pattern.
 * The pattern lives in app_settings key `oncall_weekday_pattern` as
 * {"0": userId, ... "6": userId} (0 = Sunday). Mirrors pending SQL
 * team-coverage-pass-a2/01 (public.oncall_user_for_night).
 */
export const PATTERN_KEY = "oncall_weekday_pattern";
export const DATE_CHANGE_LABEL = "On-call date change";
export type OncallPattern = (string | null)[]; // index 0 = Sunday
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function patternFromSetting(value: unknown): OncallPattern | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const out = WEEKDAYS.map((_, i) => (typeof v[String(i)] === "string" && v[String(i)] ? (v[String(i)] as string) : null));
  return out.some(Boolean) ? out : null;
}
export function patternToSetting(p: OncallPattern) {
  return Object.fromEntries(p.map((u, i) => [String(i), u ?? ""]));
}

/** Pre-fill: the latest single night on the roster for each weekday. Never writes. */
export function patternFromRoster(roster: SRoster[]): OncallPattern {
  const out: OncallPattern = [null, null, null, null, null, null, null];
  const seen: (string | null)[] = [null, null, null, null, null, null, null];
  for (const r of roster) {
    if (r.starts_on !== r.ends_on) continue;
    const wd = weekdayOf(r.starts_on);
    if (seen[wd] === null || r.starts_on > seen[wd]!) { seen[wd] = r.starts_on; out[wd] = r.user_id; }
  }
  return out;
}

/** The pattern to use: the saved one, else the one read from the roster. */
export function effectivePattern(setting: unknown, roster: SRoster[]): OncallPattern {
  return patternFromSetting(setting) ?? patternFromRoster(roster);
}

/** Dated entry for a night: shortest entry wins, then the newest. */
export function rosterEntryForNight(roster: SRoster[], date: string): SRoster | null {
  const span = (r: SRoster) => (Date.parse(r.ends_on) - Date.parse(r.starts_on)) / 86400000;
  return (
    roster
      .filter((r) => r.starts_on <= date && date <= r.ends_on)
      .sort((a, b) => span(a) - span(b) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null
  );
}

export type NightOwner = { userId: string | null; source: "date" | "pattern" | "none"; entry: SRoster | null };

/** Who is on call for the night that starts on `date` (10 p.m. that day to 8 a.m. the next). */
export function oncallForNight(roster: SRoster[], date: string, pattern: OncallPattern | null = null): NightOwner {
  const entry = rosterEntryForNight(roster, date);
  if (entry) return { userId: entry.user_id, source: "date", entry };
  const p = pattern?.[weekdayOf(date)] ?? null;
  return p ? { userId: p, source: "pattern", entry: null } : { userId: null, source: "none", entry: null };
}

export type NightStatus = { date: string; userId: string | null; entryId: string | null; isOverride: boolean; needsCover: boolean; empty: boolean; note: string | null };

export function nightStatus(
  date: string,
  roster: SRoster[],
  roles: SRole[],
  overrides: SOverride[],
  pattern: OncallPattern | null = null,
  window: { start: number; end: number } = { start: 22 * 60, end: 8 * 60 },
): NightStatus {
  const o = oncallForNight(roster, date, pattern);
  if (!o.userId) return { date, userId: null, entryId: null, isOverride: false, needsCover: false, empty: true, note: null };
  const from = centralInstant(date, window.start);
  const to = centralInstant(date, window.end <= window.start ? 1440 + window.end : window.end);
  // A dated row that just repeats the pattern is not shown as a change.
  const isOverride = o.source === "date" && o.userId !== (pattern?.[weekdayOf(date)] ?? null);
  const label = o.entry?.label ?? null;
  return {
    date,
    userId: o.userId,
    entryId: o.entry?.id ?? null,
    isOverride,
    needsCover: personOutDuring(o.userId, from, to, roles, overrides),
    empty: false,
    note: label && label.startsWith(DATE_CHANGE_LABEL + ": ") ? label.slice(DATE_CHANGE_LABEL.length + 2) : null,
  };
}

export type NightChange = { date: string; userId: string | null; note: string };

export function datesBetween(from: string, to: string) {
  if (to < from) throw new Error("The end date cannot be before the start date.");
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    out.push(d);
    if (out.length > 370) throw new Error("Pick a range of one year or less.");
  }
  return out;
}
/** One person for every night in a range (vacation, days off). */
export function planRangeAssign(from: string, to: string, userId: string, note = ""): NightChange[] {
  return datesBetween(from, to).map((date) => ({ date, userId, note }));
}
/** Trade the people on two nights in one step. */
export function planSwap(a: string, b: string, roster: SRoster[], pattern: OncallPattern | null, note = ""): NightChange[] {
  if (a === b) throw new Error("Pick two different nights.");
  const ua = oncallForNight(roster, a, pattern).userId;
  const ub = oncallForNight(roster, b, pattern).userId;
  if (!ua || !ub) throw new Error("Both nights need someone on call before they can be swapped.");
  return [{ date: a, userId: ub, note }, { date: b, userId: ua, note }];
}
/** Remove a date change so the night falls back to the pattern. */
export function planRemoveOverride(date: string): NightChange[] {
  return [{ date, userId: null, note: "" }];
}
/** Roster label stored for a date change (holds the optional note). */
export function dateChangeLabel(note: string) {
  const n = note.trim();
  return (n ? `${DATE_CHANGE_LABEL}: ${n}` : DATE_CHANGE_LABEL).slice(0, 200);
}

/** Apply night changes to a roster copy (optimistic screen update; mirrors saveOnCallNights). */
export function applyNightChanges(roster: SRoster[], changes: NightChange[], now = new Date().toISOString()): SRoster[] {
  const dates = new Set(changes.map((c) => c.date));
  const kept = roster.filter((r) => !(r.starts_on === r.ends_on && dates.has(r.starts_on)));
  const added = changes
    .filter((c) => c.userId)
    .map((c, i) => ({ id: `pending-${c.date}-${i}`, user_id: c.userId!, starts_on: c.date, ends_on: c.date, label: dateChangeLabel(c.note), created_at: now }));
  return [...kept, ...added];
}

/** The days of a month calendar, Sunday first, padded with nulls. */
export function monthCells(year: number, month0: number): (string | null)[] {
  const first = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
  const days = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: weekdayOf(first) }, () => null);
  for (let d = 0; d < days; d++) cells.push(addDays(first, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

// ---------- who appears where ----------

export const STAFF_ROLES = ["admin", "manager", "onboarding", "tech"] as const;
export const TEST_ACCOUNTS_KEY = "test_account_ids";
export const GRID_SEATS_KEY = "schedule_grid_seats";

/** Test and demo accounts: flagged list, test email domains, or names starting "QA ". */
export function isTestAccount(p: { id: string; full_name: string | null; email: string | null; is_demo?: boolean | null }, flagged: string[] = []) {
  if (p.is_demo || flagged.includes(p.id)) return true;
  const e = (p.email ?? "").toLowerCase();
  if (/@(.+\.)?(example\.com|example\.invalid|resolve-test\.invalid)$/.test(e) || e.endsWith(".test")) return true;
  const n = (p.full_name ?? "").trim();
  return /^QA /.test(n) || /\(demo\)/i.test(n);
}

export type StaffPerson = SPerson & { roles: string[]; active: boolean };

export function isStaff(p: { roles: string[] }) {
  return p.roles.some((r) => (STAFF_ROLES as readonly string[]).includes(r));
}

/** Shift and time-off pickers: active internal staff holding a seat, never test accounts. */
export function staffPickerPeople(people: StaffPerson[], roles: SRole[], flagged: string[]): StaffPerson[] {
  const holders = new Set(roles.map((r) => r.current_seat_holder).filter(Boolean));
  return people.filter((p) => p.active && isStaff(p) && holders.has(p.id) && !isTestAccount(p, flagged));
}
/** On-call pickers: only the Admin-kept eligible list, never test accounts. */
export function oncallPickerPeople(people: StaffPerson[], eligibleIds: string[], flagged: string[]): StaffPerson[] {
  return people.filter((p) => eligibleIds.includes(p.id) && p.active && isStaff(p) && !isTestAccount(p, flagged));
}

/** Seats shown as grid rows. Display only: hidden seats keep routing exactly as before. */
export function gridSeatCodes(setting: unknown, roles: SRole[], isDefaultRow: (code: string) => boolean): string[] {
  if (Array.isArray(setting) && setting.every((x) => typeof x === "string")) return setting as string[];
  return roles.filter((r) => isDefaultRow(r.code)).map((r) => r.code);
}
export function gridRows(roles: SRole[], codes: string[]) {
  return roles.filter((r) => codes.includes(r.code));
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

/**
 * The rows approve_time_off saves in one transaction (Build 9 C2): the same time off and
 * cover rows planTimeOff plans, so approving a request is all or nothing.
 */
export function timeOffApprovalRows(actions: CoverageAction[]) {
  return actions.map((a) => {
    if (a.type !== "override") throw new Error("Time off saves only time off and cover rows.");
    return { role_code: a.roleCode, kind: a.kind, user_id: a.userId, starts_at: a.startsAt, ends_at: a.endsAt, note: a.note };
  });
}

export type CoverageWriters = {
  saveOverride: (a: { roleCode: string; kind: "cover" | "off"; userId: string | null; startsAt: string; endsAt: string; note: string }) => Promise<unknown>;
  saveShift: (a: { id: string | null; roleCode: string; weekday: number; startMinute: number; endMinute: number }) => Promise<unknown>;
  deleteShift: (a: { id: string }) => Promise<unknown>;
  setSeatHolder: (a: { roleCode: string; userId: string | null }) => Promise<unknown>;
};

/** Run planned writes in order through the existing audited server functions. */
export async function applyCoverageActions(actions: CoverageAction[], w: CoverageWriters) {
  for (const a of actions) {
    if (a.type === "override") await w.saveOverride({ roleCode: a.roleCode, kind: a.kind, userId: a.userId, startsAt: a.startsAt, endsAt: a.endsAt, note: a.note });
    else if (a.type === "shift") await w.saveShift({ id: a.id, roleCode: a.roleCode, weekday: a.weekday, startMinute: a.startMinute, endMinute: a.endMinute });
    else if (a.type === "deleteShift") await w.deleteShift({ id: a.id });
    else await w.setSeatHolder({ roleCode: a.roleCode, userId: a.userId });
  }
  return actions.length;
}

// ---------- undoing "this week only" changes ----------

/** "Undo out": the off overrides on this block, plus a cover saved with the same window. */
export function undoOutIds(block: CellBlock, overrides: SOverride[]): string[] {
  const offs = overrides.filter((o) => block.overrideIds.includes(o.id) && o.kind === "off");
  return removeWithPairedCover(offs, overrides);
}

/** "Back to normal shift": the cover overrides on this block. */
export function backToNormalIds(block: CellBlock, overrides: SOverride[]): string[] {
  return overrides.filter((o) => block.overrideIds.includes(o.id) && o.kind === "cover").map((o) => o.id);
}

/** Remove (x) on a Who's out entry: that off override and its paired cover. */
export function whosOutRemoveIds(offId: string, overrides: SOverride[]): string[] {
  return removeWithPairedCover(overrides.filter((o) => o.id === offId && o.kind === "off"), overrides);
}

function removeWithPairedCover(offs: SOverride[], overrides: SOverride[]): string[] {
  const ids = new Set(offs.map((o) => o.id));
  for (const off of offs) {
    for (const c of overrides) {
      if (c.kind === "cover" && c.role_code === off.role_code && c.starts_at === off.starts_at && c.ends_at === off.ends_at) ids.add(c.id);
    }
  }
  return [...ids];
}

/**
 * Register S4 (Build 9 C4): a coordinator opens Team and Coverage read only and never gets the
 * full user list. Only the people the schedule itself names come back: role holders, cover and
 * time off rows, the on call roster and weekly pattern, and the person themselves; name only.
 */
export function scheduleOnlyPeople<P extends { id: string; full_name?: string | null; oncall_eligible?: boolean | null }>(
  people: P[],
  refs: { roles: { current_seat_holder?: string | null }[]; overrides: { user_id?: string | null }[]; roster: { user_id?: string | null }[]; pattern: unknown; self: string },
) {
  const ids = new Set<string>([refs.self]);
  for (const r of refs.roles) if (r.current_seat_holder) ids.add(r.current_seat_holder);
  for (const o of refs.overrides) if (o.user_id) ids.add(o.user_id);
  for (const r of refs.roster) if (r.user_id) ids.add(r.user_id);
  for (const m of JSON.stringify(refs.pattern ?? null).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi) ?? []) ids.add(m.toLowerCase());
  return people
    .filter((p) => ids.has(p.id))
    .map((p) => ({ id: p.id, full_name: p.full_name ?? null, email: null, oncall_eligible: p.oncall_eligible ?? null }));
}

