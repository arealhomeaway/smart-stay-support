/**
 * Bonus: browser-safe words, labels and small helpers (Build 13; Emily, Nov 10; register BN5,
 * BN6, BN11; values and scoring rules in docs/specs/bonus-guide-values.md). Every number, level
 * and dollar amount is worked out once, in the database (private.bonus_compute); this file only
 * shows what the database returned. Nothing here decides who sees what.
 */

export type BonusLevel = "below" | "goal_met" | "strong" | "exceeds";
export type BonusGoalStatus =
  | "counted"
  | "no_data"
  | "not_enough"
  | "not_tracked"
  | "waiting_entry"
  | "nothing_to_measure"
  | "inactive"
  | "not_started";
export type BonusUnit = "percent" | "rating" | "points";

export type BonusFact = { key: string; label: string; at: string | null; met: boolean | null; score: number | null; excused: boolean };

export type BonusGoal = {
  goal_id: string;
  code: string;
  name: string;
  how_measured: string | null;
  share: number;
  effective_share: number | null;
  unit: BonusUnit;
  source: "automatic" | "reviewer";
  active: boolean;
  threshold_met: number;
  threshold_strong: number;
  threshold_exceeds: number;
  status: BonusGoalStatus;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  level: BonusLevel | null;
  system_problem: boolean;
  note: string | null;
  evidence_url: string | null;
  dollars: number | null;
  facts: BonusFact[];
  fact_count: number;
};

export type BonusAdjustment = {
  id: string;
  goal_id: string;
  kind: "excused" | "system_problem";
  fact_key: string | null;
  reason: string;
  decision: "approved" | "declined" | null;
  decision_note: string | null;
  requested_at: string;
  decided_at: string | null;
};

export type BonusCard = {
  plan: string;
  plan_name: string;
  user_id: string;
  person_name: string | null;
  reviewer_name: string;
  period_start: string;
  period_end: string;
  label: string;
  counting_from: string;
  closed: boolean;
  amount_goal_met: number | null;
  amount_strong: number | null;
  amount_exceeds: number | null;
  goals: BonusGoal[];
  counted_goals: number;
  fewer_than_three: boolean;
  total: number | null;
  data_as_of: string;
  status: "in_progress" | "ready" | "verified";
  verified_at: string | null;
  verified_by_name: string | null;
  version: number;
  question_window_closes: string | null;
  can_raise_question: boolean;
  can_verify: boolean;
  can_enter: boolean;
  can_reopen: boolean;
  can_decide: boolean;
  adjustments: BonusAdjustment[];
  questions: { id: string; question: string; raised_at: string; answer: string | null; answered_at: string | null }[];
  history: { action: "verified" | "reopened"; version: number; reason: string | null; total: number | null; done_at: string }[];
};

export type BonusPlanRef = {
  plan: string;
  plan_name: string;
  counting_start: string;
  current_start: string | null;
  periods: { period_start: string; label: string; status: "ready" | "verified" }[];
};

export type BonusPerson = BonusPlanRef & {
  user_id: string;
  name: string;
  active: boolean;
  eligible_from: string;
  is_reviewer: boolean;
  periods: { period_start: string; label: string; status: "ready" | "verified"; total: number | null }[];
};

export type BonusPayoutRow = {
  id: string;
  plan: string;
  plan_name: string;
  user_id: string;
  person: string;
  period_start: string;
  period_end: string;
  label: string;
  status: "ready" | "verified";
  total: number | null;
  verified_at: string | null;
  verified_by: string | null;
  goals: { name: string; value: number | null; unit: BonusUnit; status: BonusGoalStatus; level: BonusLevel | null; dollars: number | null }[];
};

export const LEVEL_LABEL: Record<BonusLevel, string> = {
  below: "Below goal",
  goal_met: "Goal met",
  strong: "Strong",
  exceeds: "Exceeds",
};

export const GOAL_STATUS_LABEL: Record<Exclude<BonusGoalStatus, "counted">, string> = {
  no_data: "Not enough data yet",
  not_enough: "Not enough data yet",
  not_tracked: "Not tracked in Resolve yet",
  waiting_entry: "Waiting for the reviewer",
  nothing_to_measure: "Nothing to measure",
  inactive: "Not counted",
  not_started: "Counting has not started",
};

export const BONUS_COPY = {
  title: "My bonus",
  hint: "Your goals for this period, where you stand and the estimated payout.",
  estimated: "Estimated total",
  verifiedTotal: "Verified total",
  notSet: "Not set",
  dataAsOf: "Data as of",
  period: "Period",
  countingStarts: "Counting starts",
  fewerThanThree: "Fewer than 3 goals can be measured, so the full Goal met amount is paid for this period.",
  movedShare: "A goal with nothing to measure is skipped and its share moves to the other goals.",
  notCountedYet: "Counting has not started for this period yet.",
  status: { in_progress: "In progress", ready: "Waiting for verification", verified: "Verified" } as const,
  verifiedBy: "Verified by",
  raiseQuestion: "Raise a question",
  questionPlaceholder: "What would you like checked?",
  questionSent: "Your question is sent.",
  questionWindow: "You can raise a question until",
  questionClosed: "The time to raise a question has passed.",
  sendQuestion: "Send question",
  noPlan: "You are not on a bonus plan.",
  loadError: "Your bonus could not be loaded. Try again in a minute.",
  levels: "Goal met, Strong, Exceeds",
  dollars: "Estimated payout",
  share: "Share",
  facts: "Records behind this number",
  excused: "Excused",
  met: "On time",
  missed: "Not on time",
  systemProblem: "System problem approved: counts at Goal met or better",
  history: "History",
  questions: "Questions",
  answered: "Answer",
} as const;

export const VERIFY_COPY = {
  title: "Bonus verify",
  hint: "Check each person's numbers, add what Resolve cannot count, then verify.",
  none: "Nobody's bonus is waiting for you.",
  person: "Person",
  choose: "Choose a person and a period",
  verify: "Verify",
  verified: "Verified. The numbers are locked and sent to Finance.",
  reopen: "Change a verified period",
  reopenReason: "Why it is changing",
  reopened: "Reopened. Make the change, then verify again.",
  enter: "Enter the measure",
  enterValue: "Measure",
  enterNote: "Where this number comes from",
  enterEvidence: "Link to the evidence (optional)",
  nothingToMeasure: "Nothing to measure this period",
  saveEntry: "Save the measure",
  entrySaved: "Saved.",
  excuse: "Excuse",
  excuseReason: "Reason (approved leave, work outside the shift, an outage)",
  askCoo: "Send to the COO",
  sentToCoo: "Sent to the COO for approval.",
  systemProblem: "Flag a system problem",
  systemReason: "What went wrong with the tracking",
  waitingCoo: "Waiting for the COO",
  approve: "Approve",
  decline: "Decline",
  approved: "Approved",
  declined: "Declined",
  answer: "Answer",
  answerSaved: "Answer sent.",
  rulesNote: "Excused records and system problems count only once the COO approves them. Deadlines never move.",
  readyItem: "is ready to verify for",
} as const;

export const SETTINGS_COPY = {
  title: "Bonus settings",
  hint: "Plans, amounts, goals and targets for the bonus. Only the COO, the CEO and Admin see this page.",
  notice: "Changes to goals, targets or amounts need 30 days' written notice and apply only going forward.",
  saved: "Saved. The change is in the history.",
  plans: "Plans",
  periodAmounts: "Amounts for a single period",
  goals: "Goals",
  addGoal: "Add a goal",
  targetsByPeriod: "Targets that change by period",
  people: "People on a plan",
  priorities: "Quarterly priorities",
  prioritiesHint: "The COO sets 100 points of priorities with the Director of Operations before each period. A priority counts once it is accepted, used for 30 days and has an agreed result.",
  history: "History of changes",
  reason: "Why (optional)",
  total100: "Active shares add up to",
  mustReach100: "Priorities add up to",
} as const;

export const PAYOUTS_COPY = {
  waiting: "Waiting for verification",
  verified: "Verified",
  exportCsv: "Export CSV",
  none: "No bonus periods have closed yet.",
  filters: { period: "Period", person: "Person", plan: "Plan", status: "Status" },
  all: "All",
} as const;

export const PRIORITY_STATUS_LABEL = {
  proposed: "Proposed",
  accepted: "Accepted",
  in_use: "In use (30 days)",
  result_agreed: "Result agreed",
} as const;

export const SOURCE_LABEL = { automatic: "Automatic from Resolve data", reviewer: "Entered by the reviewer with a note" } as const;
export const UNIT_LABEL: Record<BonusUnit, string> = { percent: "percent", rating: "rating out of 5", points: "points" };

/** "$1,125.00", or Not set when there is no amount. */
export function dollars(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return BONUS_COPY.notSet;
  const v = Number(n);
  if (!Number.isFinite(v)) return BONUS_COPY.notSet;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** A measure in its unit: 96.5%, 4.83, 80 points. */
export function measureText(value: number | string | null | undefined, unit: BonusUnit): string {
  if (value === null || value === undefined || value === "") return "";
  const v = Number(value);
  if (!Number.isFinite(v)) return "";
  if (unit === "percent") return `${trim(v)}%`;
  if (unit === "rating") return v.toFixed(2);
  return `${trim(v)} points`;
}

function trim(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

/** What the goal row says where the level would be. */
export function goalLine(g: Pick<BonusGoal, "status" | "level" | "denominator" | "code">): string {
  if (g.status === "counted") return g.level ? LEVEL_LABEL[g.level] : "";
  if (g.status === "not_enough" && g.code === "guest_rating") {
    return `${GOAL_STATUS_LABEL.not_enough} (${g.denominator ?? 0} of 30 rated stays)`;
  }
  return GOAL_STATUS_LABEL[g.status];
}

/**
 * Where the bar and the three target marks sit, as percents of the bar's width. The bar runs
 * from a little under Goal met to the top of the scale for the unit.
 */
export function barGeometry(g: Pick<BonusGoal, "unit" | "value" | "threshold_met" | "threshold_strong" | "threshold_exceeds">) {
  const top = g.unit === "rating" ? 5 : Math.max(100, Number(g.threshold_exceeds));
  const span = Number(g.threshold_exceeds) - Number(g.threshold_met);
  const bottom = Math.max(0, Number(g.threshold_met) - Math.max(span * 2, g.unit === "rating" ? 0.2 : 10));
  const at = (v: number) => Math.min(100, Math.max(0, ((v - bottom) / (top - bottom)) * 100));
  return {
    fill: g.value === null || g.value === undefined ? 0 : at(Number(g.value)),
    marks: [
      { level: "goal_met" as const, at: at(Number(g.threshold_met)) },
      { level: "strong" as const, at: at(Number(g.threshold_strong)) },
      { level: "exceeds" as const, at: at(Number(g.threshold_exceeds)) },
    ],
  };
}

/** "Mon Nov 16, 2026" from a YYYY-MM-DD date, without moving the day. */
export function dayText(date: string | null | undefined): string {
  if (!date) return "";
  const d = new Date(`${date.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function rangeText(start: string, end: string): string {
  return `${dayText(start)} to ${dayText(end)}`;
}

/** Central date and time, for "Data as of" and verify stamps. */
export function centralStamp(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** The reviewer's item title on Home and in the email (register BN6). */
export function verifyItemTitle(label: string, planName: string): string {
  return `${label} ${VERIFY_COPY.readyItem} ${planName}`;
}

/* Finance list --------------------------------------------------------------------------- */

export type PayoutFilter = { period?: string | null; person?: string | null; plan?: string | null; status?: "ready" | "verified" | null };

export function filterPayouts(rows: BonusPayoutRow[], f: PayoutFilter): BonusPayoutRow[] {
  return rows.filter(
    (r) =>
      (!f.period || r.label === f.period) &&
      (!f.person || r.user_id === f.person) &&
      (!f.plan || r.plan === f.plan) &&
      (!f.status || r.status === f.status),
  );
}

/** Unverified rows never carry an amount, whatever the database sent. */
export function payoutAmount(r: Pick<BonusPayoutRow, "status" | "total">): string {
  return r.status === "verified" ? dollars(r.total) : PAYOUTS_COPY.waiting;
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** The payroll file: verified rows only, one line per person per period. */
export function payoutsCsv(rows: BonusPayoutRow[]): string {
  const verified = rows.filter((r) => r.status === "verified");
  const goalNames: string[] = [];
  for (const r of verified) for (const g of r.goals) if (!goalNames.includes(g.name)) goalNames.push(g.name);
  const head = ["Person", "Plan", "Period", "First day", "Last day", "Verified total", "Verified by", "Verified at"];
  for (const n of goalNames) head.push(`${n} measure`, `${n} level`, `${n} dollars`);
  const lines = [head.map(csvCell).join(",")];
  for (const r of verified) {
    const cells = [
      r.person,
      r.plan_name,
      r.label,
      r.period_start,
      r.period_end,
      r.total === null ? "" : Number(r.total).toFixed(2),
      r.verified_by ?? "",
      r.verified_at ? centralStamp(r.verified_at) : "",
    ];
    for (const n of goalNames) {
      const g = r.goals.find((x) => x.name === n);
      cells.push(
        g ? measureText(g.value, g.unit) : "",
        g ? goalLine({ status: g.status, level: g.level, denominator: null, code: "" }) : "",
        g && g.dollars !== null && g.dollars !== undefined ? Number(g.dollars).toFixed(2) : "",
      );
    }
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}

/** Shares of the active goals, for the settings warning. */
export function activeShareTotal(goals: { share: number | string; active: boolean }[]): number {
  return Math.round(goals.filter((g) => g.active).reduce((s, g) => s + Number(g.share), 0) * 100) / 100;
}
