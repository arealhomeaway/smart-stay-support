/** Shared types for the Executive Command Center (browser-safe). */

export type KpiStatus = "green" | "yellow" | "red" | "unknown";

export type Kpi = {
  key: string;
  label: string;
  /** Null means the metric could not be computed from real records. */
  value: number | null;
  display: string;
  unit: "percent" | "count" | "minutes" | "days" | "score" | "hours";
  target: string | null;
  status: KpiStatus;
  denominator: string | null;
  /** Same metric for the immediately preceding window of equal length. */
  previous: number | null;
  trend: "up" | "down" | "flat" | null;
  /** Where to go to see the underlying records. */
  drill: { to: string; label: string } | null;
  unavailable: string | null;
  note: string | null;
};

export type KpiSection = {
  key: "operations" | "vendors" | "homeowners" | "onboarding" | "data_quality";
  label: string;
  blurb: string;
  kpis: Kpi[];
};

export type CommandCenter = {
  generatedAt: string;
  windowDays: number;
  filters: {
    markets: string[];
    properties: { id: string; name: string }[];
    vendors: { id: string; name: string }[];
    teams: string[];
  };
  sections: KpiSection[];
  coverage: { market: string; properties: number; vendors: number; risk: KpiStatus }[];
};

export const STATUS_TONE: Record<KpiStatus, string> = {
  green: "bg-emerald-100 text-emerald-900 border-emerald-200",
  yellow: "bg-amber-100 text-amber-900 border-amber-200",
  red: "bg-destructive/10 text-destructive border-destructive/20",
  unknown: "bg-muted text-muted-foreground border-border",
};
