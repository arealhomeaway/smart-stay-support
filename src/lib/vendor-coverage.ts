/**
 * Staging & trade coverage lookup — browser-safe shaping only.
 *
 * Read-only reference for a PM standing on an onboarding home: who can do this
 * work here, are they cleared, what do they cost, and who is the backup. No
 * dispatch, no scheduling, no write path.
 */

export type CoverageVendor = {
  orgId: string;
  name: string;
  status: string;
  vendorClass: string;
  markets: string[];
  serviceCategories: string[];
  tier: string | null;
  pricingNote: string | null;
  approvalLimit: number | null;
  emergencyAvailable: boolean;
  responseTimeNote: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  lastVerifiedAt: string | null;
  /** "property" = assigned to this exact home, "territory" = covers its ZIP. */
  source: "property" | "territory";
  coveragePriority: string;
  excluded: boolean;
  exclusionReason: string | null;
  travelNote: string | null;
};

export const COVERAGE_PRIORITY_ORDER: Record<string, number> = {
  primary: 0,
  secondary: 1,
  backup: 2,
  overflow: 3,
};

export function priorityRank(priority: string): number {
  return COVERAGE_PRIORITY_ORDER[priority] ?? 9;
}

export const PRIORITY_LABEL: Record<string, string> = {
  primary: "First call",
  secondary: "Second call",
  backup: "Backup",
  overflow: "Overflow",
};

/** Cleared vendors first, then first-call before backup, then by name. */
export function sortCoverage(rows: CoverageVendor[]): CoverageVendor[] {
  return [...rows].sort((a, b) => {
    if (a.excluded !== b.excluded) return a.excluded ? 1 : -1;
    const cleared = (v: CoverageVendor) => (v.status === "approved" ? 0 : 1);
    if (cleared(a) !== cleared(b)) return cleared(a) - cleared(b);
    if (a.source !== b.source) return a.source === "property" ? -1 : 1;
    const p = priorityRank(a.coveragePriority) - priorityRank(b.coveragePriority);
    if (p !== 0) return p;
    return a.name.localeCompare(b.name);
  });
}

/** Group the coverage by trade so a PM sees "staging: three, plumbing: none". */
export function coverageByCategory(rows: CoverageVendor[], categories: string[]) {
  return categories
    .map((category) => ({
      category,
      vendors: sortCoverage(rows.filter((r) => r.serviceCategories.includes(category))),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

/** Trades with nobody cleared at this home — the staging bottleneck warning. */
export function uncoveredCategories(rows: CoverageVendor[], categories: string[]): string[] {
  return categories.filter(
    (category) =>
      !rows.some(
        (r) => !r.excluded && r.status === "approved" && r.serviceCategories.includes(category),
      ),
  );
}

export function matchesCoverageSearch(row: CoverageVendor, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return [row.name, row.tier ?? "", ...row.markets, ...row.serviceCategories]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
