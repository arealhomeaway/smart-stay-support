/**
 * Tenant Lead Management — read-time derivation.
 *
 * ARHA's direct / non-OTA booking pipeline. Everything the employee would
 * otherwise have to remember (when the next follow-up is due, which follow-up
 * they are on, whether a lead has gone stale, what to do next) is derived here
 * from two stored facts: the stage and the last contact time. Nothing in this
 * file reads data, decides permissions or writes anything.
 */

export type LeadStage =
  | "new"
  | "first_contact"
  | "follow_up_1"
  | "final_follow_up"
  | "engaged"
  | "booking_pending"
  | "converted"
  | "lost";

export type LeadSource =
  | "insurance"
  | "relocation"
  | "corporate"
  | "direct"
  | "referral"
  | "realtor"
  | "website"
  | "phone"
  | "email"
  | "social"
  | "other";

export type LeadLossReason =
  | "unresponsive"
  | "other_option"
  | "budget_too_low"
  | "no_properties_available"
  | "outside_coverage"
  | "requirements_not_met"
  | "expired"
  | "dates_did_not_work"
  | "other";

export type LeadChannel = "call" | "email" | "text" | "other" | "note" | "stage_change" | "system";

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  first_contact: "First contact sent",
  follow_up_1: "Follow-up 1",
  final_follow_up: "Final follow-up",
  engaged: "Active / engaged",
  booking_pending: "Booking pending",
  converted: "Converted",
  lost: "Lost",
};

/** Pipeline order, left to right. */
export const PIPELINE: LeadStage[] = [
  "new",
  "first_contact",
  "follow_up_1",
  "final_follow_up",
  "engaged",
  "booking_pending",
  "converted",
  "lost",
];

export const OPEN_STAGES: LeadStage[] = [
  "new",
  "first_contact",
  "follow_up_1",
  "final_follow_up",
  "engaged",
  "booking_pending",
];

export function isOpen(stage: LeadStage) {
  return OPEN_STAGES.includes(stage);
}

export const SOURCE_LABELS: Record<LeadSource, string> = {
  insurance: "Insurance",
  relocation: "Relocation company",
  corporate: "Corporate",
  direct: "Direct / organic",
  referral: "Referral",
  realtor: "Realtor / professional referral",
  website: "Website",
  phone: "Phone",
  email: "Email",
  social: "Social",
  other: "Other",
};

export const LOSS_REASON_LABELS: Record<LeadLossReason, string> = {
  unresponsive: "Unresponsive",
  other_option: "Went with another option",
  budget_too_low: "Budget too low",
  no_properties_available: "No properties available",
  outside_coverage: "Outside inventory coverage",
  requirements_not_met: "Requirements could not be met",
  expired: "Expired opportunity",
  dates_did_not_work: "Dates did not work",
  other: "Other",
};

export const CHANNEL_LABELS: Record<LeadChannel, string> = {
  call: "Call",
  email: "Email",
  text: "Text",
  other: "Other contact",
  note: "Note",
  stage_change: "Stage change",
  system: "System",
};

/**
 * How long Resolve waits before the next follow-up is due, measured from the
 * last contact (or from creation while nothing has been sent yet).
 */
export const FOLLOW_UP_DAYS: Record<LeadStage, number | null> = {
  new: 1,
  first_contact: 2,
  follow_up_1: 4,
  final_follow_up: 7,
  engaged: 3,
  booking_pending: 3,
  converted: null,
  lost: null,
};

export type LeadLike = {
  id?: string;
  stage: LeadStage;
  created_at: string;
  last_contact_at: string | null;
  assigned_to?: string | null;
  desired_move_in?: string | null;
  budget_monthly?: number | string | null;
  quote_sent_at?: string | null;
  keep_open_reason?: string | null;
  converted_at?: string | null;
  lost_at?: string | null;
};

const DAY = 24 * 60 * 60 * 1000;

/** When the next follow-up is due. Null once the lead is converted or lost. */
export function nextFollowUpAt(lead: LeadLike): Date | null {
  const days = FOLLOW_UP_DAYS[lead.stage];
  if (days === null) return null;
  const base = new Date(lead.last_contact_at ?? lead.created_at);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() + days * DAY);
}

export type FollowUpBucket = "overdue" | "today" | "upcoming" | "none";

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function followUpBucket(lead: LeadLike, now = new Date()): FollowUpBucket {
  const due = nextFollowUpAt(lead);
  if (!due) return "none";
  if (sameDay(due, now)) return "today";
  return due.getTime() < now.getTime() ? "overdue" : "upcoming";
}

/** Which follow-up attempt the lead is on, in plain numbers. */
export function followUpNumber(stage: LeadStage): number {
  if (stage === "first_contact") return 1;
  if (stage === "follow_up_1") return 2;
  if (stage === "final_follow_up") return 3;
  return 0;
}

export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DAY);
}

export function leadAgeDays(lead: LeadLike, now = new Date()) {
  return daysSince(lead.created_at, now) ?? 0;
}

/** A lead nobody has touched in a week is going quiet. */
export function isStale(lead: LeadLike, now = new Date()) {
  if (!isOpen(lead.stage)) return false;
  const d = daysSince(lead.last_contact_at ?? lead.created_at, now);
  return d !== null && d >= 7;
}

export type NextActionContext = {
  /** At least one candidate property is linked. */
  hasProperty?: boolean;
  now?: Date;
};

/**
 * The single sentence that answers "what am I supposed to do?".
 * Derived from stage, follow-up timing, quote state and property match.
 */
export function nextAction(lead: LeadLike, ctx: NextActionContext = {}): string {
  const now = ctx.now ?? new Date();
  switch (lead.stage) {
    case "converted":
      return "Booking confirmed — nothing further";
    case "lost":
      return "Closed — no action";
    case "new":
      return "Send first response";
    case "first_contact":
    case "follow_up_1": {
      const bucket = followUpBucket(lead, now);
      if (bucket === "overdue")
        return `Follow up now — ${followUpNumber(lead.stage)} sent, response overdue`;
      if (bucket === "today") return "Follow up today";
      if (!ctx.hasProperty) return "Find available properties";
      return "Waiting on prospect";
    }
    case "final_follow_up": {
      const bucket = followUpBucket(lead, now);
      if (bucket === "overdue")
        return lead.keep_open_reason
          ? "Still open by decision — check back with the prospect"
          : "Decide: close as lost or keep open with a reason";
      return "Waiting on prospect after final follow-up";
    }
    case "engaged": {
      if (!ctx.hasProperty) return "Find available properties";
      if (!lead.quote_sent_at) return "Send property options and quote";
      return "Confirm dates and availability";
    }
    case "booking_pending":
      return "Finalise booking";
    default:
      return "Review lead";
  }
}

export type AttentionFlag = {
  key: string;
  label: string;
  tone: "critical" | "attention" | "info";
};

/**
 * Conditions that may need a manager's eyes. Deliberately conservative — a
 * flag is a hint, never an automatic escalation record.
 */
export function attentionFlags(
  lead: LeadLike,
  ctx: { hasProperty?: boolean; highValueFrom?: number; now?: Date } = {},
): AttentionFlag[] {
  const now = ctx.now ?? new Date();
  const flags: AttentionFlag[] = [];
  if (!isOpen(lead.stage)) return flags;

  const due = nextFollowUpAt(lead);
  if (due && now.getTime() - due.getTime() > 2 * DAY) {
    flags.push({ key: "overdue", label: "Follow-up significantly overdue", tone: "critical" });
  }
  if (!lead.assigned_to) flags.push({ key: "unassigned", label: "Unassigned", tone: "critical" });
  if (isStale(lead, now))
    flags.push({ key: "stale", label: "No recent activity", tone: "attention" });

  const moveIn = lead.desired_move_in ? new Date(lead.desired_move_in) : null;
  if (moveIn && !Number.isNaN(moveIn.getTime())) {
    const days = Math.ceil((moveIn.getTime() - now.getTime()) / DAY);
    if (days >= 0 && days <= 7 && !ctx.hasProperty) {
      flags.push({
        key: "move_in",
        label: "Move-in approaching, no property match",
        tone: "critical",
      });
    } else if (days >= 0 && days <= 3) {
      flags.push({ key: "urgent", label: "Urgent move-in", tone: "attention" });
    }
  }

  const budget = Number(lead.budget_monthly ?? 0);
  const threshold = ctx.highValueFrom ?? 6000;
  if (budget >= threshold) {
    flags.push({ key: "high_value", label: "High-value opportunity", tone: "info" });
  }
  if (!ctx.hasProperty && (lead.stage === "engaged" || lead.stage === "booking_pending")) {
    flags.push({ key: "no_match", label: "Needs property match", tone: "attention" });
  }
  return flags;
}

/**
 * After a contact is logged, the stage Resolve proposes. The user always
 * confirms — Resolve never quietly advances or closes an opportunity.
 */
export function proposeStage(current: LeadStage, channel: LeadChannel): LeadStage {
  if (channel === "note" || channel === "system" || channel === "stage_change") return current;
  switch (current) {
    case "new":
      return "first_contact";
    case "first_contact":
      return "follow_up_1";
    case "follow_up_1":
      return "final_follow_up";
    default:
      return current;
  }
}

export type QueueBucket = "overdue" | "today" | "new" | "waiting" | "upcoming";

export const QUEUE_LABELS: Record<QueueBucket, string> = {
  overdue: "Overdue follow-ups",
  today: "Due today",
  new: "New leads",
  waiting: "Waiting on me",
  upcoming: "Upcoming",
};

/** Which section of the action-first queue a lead belongs in. */
export function queueBucket(lead: LeadLike, now = new Date()): QueueBucket | null {
  if (!isOpen(lead.stage)) return null;
  const bucket = followUpBucket(lead, now);
  if (bucket === "overdue") return "overdue";
  if (bucket === "today") return "today";
  if (lead.stage === "new") return "new";
  if (lead.stage === "engaged" || lead.stage === "booking_pending") return "waiting";
  return "upcoming";
}

export const QUEUE_ORDER: QueueBucket[] = ["overdue", "today", "new", "waiting", "upcoming"];

/** Soonest follow-up first; leads with no clock fall to the end. */
export function leadSort(a: LeadLike, b: LeadLike) {
  const da = nextFollowUpAt(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const db = nextFollowUpAt(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return da - db;
}

export function formatMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (!value || Number.isNaN(n) || n === 0) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function relativeDays(iso: string | null | undefined, now = new Date()) {
  const d = daysSince(iso, now);
  if (d === null) return "never";
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  return `${d} days ago`;
}

export type LeadAnalytics = {
  received: number;
  open: number;
  converted: number;
  lost: number;
  conversionRate: number | null;
  bySource: { key: string; label: string; count: number; converted: number }[];
  byMarket: { key: string; count: number; converted: number }[];
  lossReasons: { key: string; label: string; count: number }[];
  avgHoursToFirstContact: number | null;
  avgDaysToConversion: number | null;
  followUpCompliance: number | null;
  convertedRevenue: number | null;
};

type AnalyticsLead = LeadLike & {
  source: LeadSource;
  market: string | null;
  lost_reason: LeadLossReason | null;
  quote_amount?: number | string | null;
  first_contact_at?: string | null;
};

/**
 * Analytics computed from what actually happened. Revenue is reported only
 * where a real quoted amount exists — nothing is estimated or fabricated.
 */
export function leadAnalytics(leads: AnalyticsLead[], now = new Date()): LeadAnalytics {
  const received = leads.length;
  const converted = leads.filter((l) => l.stage === "converted");
  const lost = leads.filter((l) => l.stage === "lost");
  const open = leads.filter((l) => isOpen(l.stage));

  const group = (key: (l: AnalyticsLead) => string | null) => {
    const map = new Map<string, { count: number; converted: number }>();
    for (const l of leads) {
      const k = key(l) ?? "Unspecified";
      const row = map.get(k) ?? { count: 0, converted: 0 };
      row.count += 1;
      if (l.stage === "converted") row.converted += 1;
      map.set(k, row);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  };

  const firstContactHours = leads
    .map((l) => {
      if (!l.first_contact_at) return null;
      const h =
        (new Date(l.first_contact_at).getTime() - new Date(l.created_at).getTime()) / 3_600_000;
      return Number.isFinite(h) && h >= 0 ? h : null;
    })
    .filter((v): v is number => v !== null);

  const conversionDays = converted
    .map((l) => {
      if (!l.converted_at) return null;
      const d = (new Date(l.converted_at).getTime() - new Date(l.created_at).getTime()) / DAY;
      return Number.isFinite(d) && d >= 0 ? d : null;
    })
    .filter((v): v is number => v !== null);

  const onTime = open.filter((l) => followUpBucket(l, now) !== "overdue").length;

  const revenues = converted
    .map((l) => Number(l.quote_amount ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  return {
    received,
    open: open.length,
    converted: converted.length,
    lost: lost.length,
    conversionRate: received ? converted.length / received : null,
    bySource: group((l) => SOURCE_LABELS[l.source] ?? "Other").map(([label, v]) => ({
      key: label,
      label,
      count: v.count,
      converted: v.converted,
    })),
    byMarket: group((l) => l.market).map(([key, v]) => ({
      key,
      count: v.count,
      converted: v.converted,
    })),
    lossReasons: [
      ...lost.reduce((m, l) => {
        const k = l.lost_reason ?? "other";
        m.set(k, (m.get(k) ?? 0) + 1);
        return m;
      }, new Map<string, number>()),
    ]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: LOSS_REASON_LABELS[key as LeadLossReason] ?? key,
        count,
      })),
    avgHoursToFirstContact: avg(firstContactHours),
    avgDaysToConversion: avg(conversionDays),
    followUpCompliance: open.length ? onTime / open.length : null,
    convertedRevenue: revenues.length ? revenues.reduce((a, b) => a + b, 0) : null,
  };
}
