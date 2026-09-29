/**
 * STR Property Participation & Work Activity Report — browser-safe model,
 * labels and CSV. The rows and summary are built once in the database
 * (private.str_report_build); this file only presents them.
 */

export type TimeClass = "recorded" | "attributed" | "manual" | "activity_only" | "unresolved";

export type ReportRow = {
  date: string;
  person: string;
  personKind: "owner" | "individual" | "company";
  workType: string;
  description: string;
  source: string;
  reference: string;
  timeClass: TimeClass;
  minutes: number | null;
  status: "final" | "provisional";
  correction: boolean;
  internal?: Record<string, string | number | boolean | null>;
};

export type SummaryRow = {
  person: string;
  personKind: ReportRow["personKind"];
  workType: string;
  source: string;
  timeClass: TimeClass;
  activities: number;
  underReview: number;
  minutes: number | null;
};

export type StrReport = {
  property: { name: string; address: string | null };
  owner: { name: string };
  program: { startedOn: string | null; endsOn: string | null; status: string | null };
  period: { from: string; to: string };
  include: { owner: boolean; nonOwner: boolean };
  rows: ReportRow[];
  summary: SummaryRow[];
  totals: {
    /** Property-specific owner participation only. */
    ownerMinutes: number;
    ownerProgramLevelMinutes?: number;
    ownerProgramTotalMinutes?: number;
    ownerEntries: number;
    nonOwnerSupportedMinutes: number;
    underReview: number;
  };
  programLevelNote?: string;
  disclaimer: string;
  underReviewNote?: string;
  version?: number;
  draft?: boolean;
  generatedAt?: string;
};

export const PROGRAM_LEVEL_NOTE =
  "Program-Level Participation is owner participation not linked to a specific property. It is not automatically assigned to any property and is shown separately to avoid double-counting.";

/** The three owner-participation lines shown on every property report. */
export function ownerBreakdown(r: Pick<StrReport, "totals">): [string, string][] {
  const f = (m: number | undefined) => `${(hrs(m ?? 0) ?? 0).toFixed(2)} hrs`;
  return [
    ["Property-Specific Owner Participation", f(r.totals.ownerMinutes)],
    ["Program-Level / Shared Participation", f(r.totals.ownerProgramLevelMinutes)],
    ["Total Active Owner Participation", f(r.totals.ownerProgramTotalMinutes ?? r.totals.ownerMinutes)],
  ];
}

export const REPORT_DISCLAIMER =
  "This report summarizes operational participation and work activity recorded in Resolve and connected systems. Attributed time may be based on operational estimates where individual clock-in/clock-out data is unavailable. This report is provided for recordkeeping and operational support only and does not constitute tax, legal, or accounting advice or a determination of tax eligibility.";

export const DRAFT_LABEL = "DRAFT — PROGRAM STILL ACTIVE";
export const OWNER_WAITING_COPY =
  "Your final STR Participation & Work Activity Report will be available after your program period is complete.";

export const TIME_CLASS_LABEL: Record<TimeClass, string> = {
  recorded: "Recorded Time",
  attributed: "Attributed Time",
  manual: "Manual Time",
  activity_only: "Activity Only",
  unresolved: "Unresolved Individual Attribution",
};

/** Cleaning time from the safeguard ledger always reads "Attributed Cleaner Time". */
export function timeLabel(r: { timeClass: TimeClass; workType: string }) {
  if (r.timeClass === "attributed" && r.workType === "Cleaning") return "Attributed Cleaner Time";
  return TIME_CLASS_LABEL[r.timeClass];
}

export const hrs = (m: number | null | undefined) =>
  m == null ? null : Math.round((Number(m) / 60) * 100) / 100;

export function totalText(s: { timeClass: TimeClass; minutes: number | null }) {
  if (s.timeClass === "unresolved") return "Individual worker not identified";
  if (s.timeClass === "activity_only" || s.minutes == null) return "No supported duration";
  return `${hrs(s.minutes)!.toFixed(2)} hrs`;
}

/** Summary totals must equal the sum of final appendix rows in each group. */
export function reconciles(r: Pick<StrReport, "rows" | "summary">) {
  return r.summary.every((s) => {
    const group = r.rows.filter(
      (x) =>
        x.person === s.person &&
        x.personKind === s.personKind &&
        x.workType === s.workType &&
        x.timeClass === s.timeClass,
    );
    const finals = group.filter((x) => x.status === "final");
    const mins = finals.reduce((a, x) => a + Number(x.minutes ?? 0), 0);
    return (
      finals.length === s.activities &&
      (s.minutes == null ? true : Math.abs(mins - Number(s.minutes)) < 0.001)
    );
  });
}

export function reportFileBase(r: StrReport) {
  const v = r.draft ? "draft" : `v${r.version ?? 1}`;
  return `str-participation-${r.property.name}-${r.period.from}-${v}`
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function strReportCsv(r: StrReport) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const version = r.draft ? DRAFT_LABEL : `Version ${r.version ?? 1}`;
  const programPeriod = `${r.program.startedOn ?? "n/a"} to ${r.program.endsOn ?? "n/a"}`;
  const meta = [
    `# A Real Home Away — STR Property Participation & Work Activity Report`,
    `# Property,${esc(r.property.name)}`,
    `# Owner,${esc(r.owner.name)}`,
    `# Program period,${programPeriod}`,
    `# Reporting period,${r.period.from} to ${r.period.to}`,
    `# Report version,${version}`,
    ...(r.include.owner ? ownerBreakdown(r).map(([k, v]) => `# ${k},${v}`) : []),
    ...(r.include.owner ? [`# ${(r.programLevelNote ?? PROGRAM_LEVEL_NOTE).replace(/,/g, ";")}`] : []),
    ...(r.underReviewNote ? [`# ${r.underReviewNote}`] : []),
    `# ${r.disclaimer.replace(/,/g, ";")}`,
  ];
  const head = [
    "property",
    "owner",
    "program_period",
    "report_version",
    "person",
    "role_work_type",
    "source_system",
    "source_reference",
    "activity_date",
    "activity_description",
    "time_classification",
    "duration_minutes",
    "duration_hours",
    "status",
    "correction",
  ];
  const lines = r.rows.map((x) =>
    [
      r.property.name,
      r.owner.name,
      programPeriod,
      version,
      x.person,
      x.workType,
      x.source,
      x.reference,
      x.date,
      x.description,
      timeLabel(x),
      x.minutes ?? "",
      hrs(x.minutes) ?? "",
      x.status === "provisional"
        ? "Under review — not in finalized totals"
        : r.draft
          ? "Draft"
          : "Finalized",
      x.correction ? "Corrected" : "",
    ]
      .map(esc)
      .join(","),
  );
  return [...meta, head.join(","), ...lines].join("\n");
}
