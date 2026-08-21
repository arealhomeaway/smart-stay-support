/**
 * Company health score (browser-safe, transparent, no new data source).
 *
 * The score is derived from the KPIs the Command Center already computes from
 * live records. Nothing here invents a target or a threshold: a KPI only
 * contributes when the underlying metric could be computed and carries a
 * status. Missing data is reported as missing — never scored as healthy.
 */

import type { CommandCenter, Kpi, KpiSection, KpiStatus } from "./command-center";

/** Status → 0-100. Deliberately coarse: the thresholds live with each KPI. */
export const STATUS_SCORE: Record<Exclude<KpiStatus, "unknown">, number> = {
  green: 100,
  yellow: 65,
  red: 25,
};

export const DEPARTMENT_LABELS: Record<KpiSection["key"], string> = {
  operations: "Operations",
  vendors: "Vendor Performance",
  homeowners: "Property Owner Experience",
  onboarding: "Onboarding",
  data_quality: "Data Quality",
};

/** Department owner is a configuration field. Until an executive sets one we say so. */
export type DepartmentHealth = {
  key: KpiSection["key"];
  label: string;
  blurb: string;
  /** Null when no KPI in the department could be computed. */
  score: number | null;
  status: KpiStatus;
  /** Equal weight until approved weights are configured. */
  weight: number;
  scored: Kpi[];
  missing: Kpi[];
  /** Worst contributing KPI — the department's biggest risk right now. */
  topRisk: Kpi | null;
  attentionCount: number;
  coverage: number;
};

export type CompanyHealth = {
  score: number | null;
  status: KpiStatus;
  /** Plain-language reading of the score for people who do not live in the data. */
  reading: string;
  /** True while no approved weighting exists — the score is labelled Provisional. */
  provisional: boolean;
  /** Share of KPIs that could be computed, 0-1. */
  coverage: number;
  scoredCount: number;
  totalCount: number;
  missingCount: number;
  criticalBreaches: Kpi[];
  departments: DepartmentHealth[];
  generatedAt: string;
  windowDays: number;
};

function statusFor(score: number | null): KpiStatus {
  if (score === null) return "unknown";
  if (score >= 85) return "green";
  if (score >= 60) return "yellow";
  return "red";
}

function readingFor(score: number | null, criticals: number): string {
  if (score === null) return "Not enough live data to score the company yet.";
  if (criticals > 0) {
    return "A critical threshold has been breached. Treat the exceptions below as the priority regardless of the average.";
  }
  if (score >= 85) return "Healthy. Standards are being met across the departments we can measure.";
  if (score >= 70) return "Steady, with soft spots. A few measures are off target and worth a look this week.";
  if (score >= 60) return "Strained. Several measures are off target at the same time.";
  return "Off standard. Multiple departments are below their thresholds right now.";
}

function scoreKpi(kpi: Kpi): number | null {
  if (kpi.unavailable) return null;
  if (kpi.status === "unknown") return null;
  return STATUS_SCORE[kpi.status];
}

export function buildCompanyHealth(data: CommandCenter): CompanyHealth {
  const weight = data.sections.length > 0 ? 1 / data.sections.length : 0;

  const departments: DepartmentHealth[] = data.sections.map((section) => {
    const scored = section.kpis.filter((k) => scoreKpi(k) !== null);
    const missing = section.kpis.filter((k) => scoreKpi(k) === null);
    const total = scored.reduce((sum, k) => sum + (scoreKpi(k) ?? 0), 0);
    const score = scored.length > 0 ? Math.round(total / scored.length) : null;
    const ranked = [...scored].sort((a, b) => (scoreKpi(a) ?? 100) - (scoreKpi(b) ?? 100));
    const worst = ranked[0] ?? null;

    return {
      key: section.key,
      label: DEPARTMENT_LABELS[section.key] ?? section.label,
      blurb: section.blurb,
      score,
      status: statusFor(score),
      weight,
      scored,
      missing,
      topRisk: worst && worst.status !== "green" ? worst : null,
      attentionCount: section.kpis.filter((k) => k.status === "red" || k.status === "yellow").length,
      coverage: section.kpis.length > 0 ? scored.length / section.kpis.length : 0,
    };
  });

  const scoredDepartments = departments.filter((d) => d.score !== null);
  const score =
    scoredDepartments.length > 0
      ? Math.round(
          scoredDepartments.reduce((sum, d) => sum + (d.score ?? 0), 0) / scoredDepartments.length,
        )
      : null;

  const allKpis = data.sections.flatMap((s) => s.kpis);
  const scoredCount = allKpis.filter((k) => scoreKpi(k) !== null).length;
  const criticalBreaches = allKpis.filter((k) => k.status === "red");

  return {
    score,
    status: criticalBreaches.length > 0 && statusFor(score) === "green" ? "yellow" : statusFor(score),
    reading: readingFor(score, criticalBreaches.length),
    // No approved weighting table exists yet, so every department counts equally.
    provisional: true,
    coverage: allKpis.length > 0 ? scoredCount / allKpis.length : 0,
    scoredCount,
    totalCount: allKpis.length,
    missingCount: allKpis.length - scoredCount,
    criticalBreaches,
    departments,
    generatedAt: data.generatedAt,
    windowDays: data.windowDays,
  };
}
