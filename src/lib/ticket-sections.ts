/**
 * Which supporting ticket sections are worth showing right now. This only
 * decides what is visible: every section stays reachable through "Show all
 * details", and no business rule (approval thresholds, closure requirements)
 * lives here or changes because a section is hidden.
 */
export type TicketSectionFacts = {
  stage: string | null | undefined;
  entryKind: string | null | undefined;
  estimatedCost: number | null | undefined;
  workOrderCount: number;
  vendorName: string | null | undefined;
  closed: boolean;
};

export type TicketSections = {
  /** Costs and expenses. */
  costs: boolean;
  /** Vendor Work Orders, shown as reference once dispatch is relevant. */
  vendor: boolean;
};

const LATE_STAGES = new Set(["repair", "repair_active", "verify", "closure"]);

export function ticketSections(f: TicketSectionFacts): TicketSections {
  const vendorInPlay = f.workOrderCount > 0 || Boolean(f.vendorName);
  const late = LATE_STAGES.has(f.stage ?? "") || f.closed;
  return {
    costs: vendorInPlay || (f.estimatedCost ?? 0) > 0 || late,
    vendor: vendorInPlay,
  };
}

/** How many sections are hidden, for the "Show all details" label. */
export function hiddenSectionCount(s: TicketSections): number {
  return Object.values(s).filter((v) => !v).length;
}
