/**
 * After-hours coverage window.
 *
 * The window itself is business configuration stored in `coverage_config`
 * (start/end minute of the local day plus the timezone). Nothing here invents
 * hours: if the config row has no start/end, coverage is "not configured" and
 * after-hours routing and the overnight handoff view stay off.
 *
 * All arithmetic runs on wall-clock parts read through Intl in the configured
 * timezone, so daylight saving is handled by the platform rather than by an
 * offset we would have to maintain.
 */

export type CoverageConfig = {
  after_hours_start_minute: number | null;
  after_hours_end_minute: number | null;
  timezone: string;
};

export function localParts(at: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const hour = Number(parts['hour'] === "24" ? "0" : parts['hour']);
  return {
    date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    minutes: hour * 60 + Number(parts['minute']),
  };
}

export function shiftDate(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isConfigured(cfg: CoverageConfig | null | undefined): cfg is CoverageConfig & {
  after_hours_start_minute: number;
  after_hours_end_minute: number;
} {
  return Boolean(
    cfg && cfg.after_hours_start_minute !== null && cfg.after_hours_end_minute !== null,
  );
}

export function clockLabel(minutes: number) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "a.m." : "p.m.";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`;
}

export function windowLabel(cfg: CoverageConfig | null | undefined) {
  if (!isConfigured(cfg)) return null;
  return `${clockLabel(cfg.after_hours_start_minute)}–${clockLabel(cfg.after_hours_end_minute)} Central`;
}

/**
 * Where we are relative to the configured window right now.
 *
 * `rosterDate` is the calendar date the current (or most recent) after-hours
 * window started on — that is the date the on-call roster is keyed to, so an
 * issue at 2 a.m. belongs to the person rostered for the previous evening.
 */
export function coverageNow(cfg: CoverageConfig | null | undefined, now: Date = new Date()) {
  if (!isConfigured(cfg)) {
    return { configured: false as const, afterHours: false, today: null, rosterDate: null };
  }
  const { date, minutes } = localParts(now, cfg.timezone);
  const wraps = cfg.after_hours_start_minute > cfg.after_hours_end_minute;
  const afterHours = wraps
    ? minutes >= cfg.after_hours_start_minute || minutes < cfg.after_hours_end_minute
    : minutes >= cfg.after_hours_start_minute && minutes < cfg.after_hours_end_minute;

  // Before the window ends we are still inside the shift that began yesterday.
  const beforeEnd = minutes < cfg.after_hours_end_minute;
  const rosterDate = wraps && beforeEnd ? shiftDate(date, -1) : date;

  return { configured: true as const, afterHours, today: date, rosterDate };
}

/**
 * The most recently completed after-hours window, as an instant range, for the
 * morning handoff view. During the window itself this returns the window in
 * progress so supervisors can see overnight work as it accumulates.
 */
export function lastAfterHoursWindow(
  cfg: CoverageConfig | null | undefined,
  now: Date = new Date(),
): { startsAt: Date; endsAt: Date; rosterDate: string } | null {
  if (!isConfigured(cfg)) return null;
  const { rosterDate } = coverageNow(cfg, now);
  if (!rosterDate) return null;

  const startsAt = instantFor(rosterDate, cfg.after_hours_start_minute, cfg.timezone);
  const wraps = cfg.after_hours_start_minute > cfg.after_hours_end_minute;
  const endDate = wraps ? shiftDate(rosterDate, 1) : rosterDate;
  const endsAt = instantFor(endDate, cfg.after_hours_end_minute, cfg.timezone);

  if (startsAt.getTime() > now.getTime()) {
    // Daytime before tonight's window opens: report on last night.
    const prev = shiftDate(rosterDate, -1);
    return {
      startsAt: instantFor(prev, cfg.after_hours_start_minute, cfg.timezone),
      endsAt: instantFor(wraps ? rosterDate : prev, cfg.after_hours_end_minute, cfg.timezone),
      rosterDate: prev,
    };
  }
  return { startsAt, endsAt, rosterDate };
}

/** UTC instant for a local wall-clock time in a timezone, DST-safe. */
export function instantFor(isoDate: string, minutes: number, timeZone: string) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  const naive = Date.parse(`${isoDate}T${h}:${m}:00Z`);
  // Two passes converge even across a DST boundary.
  let guess = naive;
  for (let i = 0; i < 2; i++) {
    const offset = tzOffsetMs(new Date(guess), timeZone);
    guess = naive - offset;
  }
  return new Date(guess);
}

function tzOffsetMs(at: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  const hour = p['hour'] === "24" ? "00" : p['hour'];
  const asUtc = Date.parse(`${p['year']}-${p['month']}-${p['day']}T${hour}:${p['minute']}:${p['second']}Z`);
  return asUtc - at.getTime();
}
