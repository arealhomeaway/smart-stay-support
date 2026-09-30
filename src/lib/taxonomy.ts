/**
 * Operational taxonomy — one shared category list.
 *
 * Tickets, Work Orders, Claims and Vendors all used to keep their own list of
 * "categories": the ticket list was coded (`maintenance`), the work order list
 * was free text (`Handyman`), the vendor list was a third set of labels. That
 * drift is why the same job read differently on three screens.
 *
 * This module is the single catalog:
 *   - CATEGORY_CODES  — what kind of work this is (shared by all three records)
 *   - TRADES          — the skill a Work Order needs, each mapped to a category
 *   - FIELD_GUIDANCE  — the one-line helper text shown under every such field
 *
 * Pure data and pure functions: nothing here reads the database, writes
 * anything or decides permissions.
 */

export type CategoryCode =
  | "maintenance"
  | "safety"
  | "cleaning"
  | "access"
  | "guest"
  | "owner"
  | "vendor"
  | "claims"
  | "quality"
  | "admin"
  | "other";

export type CategoryDef = {
  value: CategoryCode;
  label: string;
  /** One line, plain language: when a person should pick this. */
  hint: string;
  /** Older or free-text spellings that must resolve to this code. */
  aliases?: string[];
};

export const OPERATIONAL_CATEGORIES: CategoryDef[] = [
  {
    value: "maintenance",
    label: "Maintenance",
    hint: "Something in the home is broken, worn or not working.",
    aliases: ["repair", "repairs", "handyman", "general", "structural", "furniture", "appliance"],
  },
  {
    value: "safety",
    label: "Safety devices",
    hint: "Smoke, carbon monoxide, alarms, security — anything that protects people.",
    aliases: ["smoke", "co", "security", "alarm"],
  },
  {
    value: "cleaning",
    label: "Cleaning",
    hint: "Turnovers, condition of the home, laundry, trash.",
    aliases: ["housekeeping", "turnover", "laundry", "trash"],
  },
  {
    value: "access",
    label: "Access and lockout",
    hint: "Codes, keys, locks, gates, garages — getting into the home.",
    aliases: ["lockout", "keys", "locks", "codes", "gate"],
  },
  {
    value: "guest",
    label: "Guest experience",
    hint: "A guest request, question or complaint about their stay.",
    aliases: ["guest experience", "guest services", "reservations"],
  },
  {
    value: "owner",
    label: "Homeowner",
    hint: "A homeowner request, decision or approval.",
    aliases: ["homeowner", "owner relations"],
  },
  {
    value: "vendor",
    label: "Vendor coordination",
    hint: "Scheduling, chasing or managing an outside vendor.",
    aliases: ["vendor management", "contractor"],
  },
  {
    value: "claims",
    label: "Claims and reimbursement",
    hint: "Recovering money for damage, loss or a chargeback.",
    aliases: ["claim", "reimbursement", "damage recovery"],
  },
  {
    value: "quality",
    label: "Quality and reviews",
    hint: "Inspections, reviews, ratings and standards follow-up.",
    aliases: ["inspection", "review", "reviews"],
  },
  {
    value: "admin",
    label: "Administrative",
    hint: "Paperwork, records, billing and internal work with no home visit.",
    aliases: ["administrative", "office", "billing"],
  },
  {
    value: "other",
    label: "Other",
    hint: "Nothing above fits — say what it is in the description.",
    aliases: ["uncategorized", "misc", "general work"],
  },
];

export const CATEGORY_CODES = OPERATIONAL_CATEGORIES.map((c) => c.value);

const CATEGORY_BY_CODE = new Map<string, CategoryDef>(
  OPERATIONAL_CATEGORIES.map((c) => [c.value, c]),
);

const CATEGORY_BY_ALIAS = new Map<string, CategoryCode>();
for (const c of OPERATIONAL_CATEGORIES) {
  CATEGORY_BY_ALIAS.set(c.value, c.value);
  CATEGORY_BY_ALIAS.set(c.label.toLowerCase(), c.value);
  for (const a of c.aliases ?? []) CATEGORY_BY_ALIAS.set(a.toLowerCase(), c.value);
}

export type TradeDef = {
  value: string;
  label: string;
  category: CategoryCode;
  aliases?: string[];
};

/** The skill a Work Order needs. Every trade rolls up to one shared category. */
export const TRADES: TradeDef[] = [
  { value: "cleaning", label: "Cleaning", category: "cleaning", aliases: ["housekeeping"] },
  { value: "trash_valet", label: "Trash valet", category: "cleaning" },
  { value: "assessment", label: "Assessment", category: "maintenance", aliases: ["inspection"] },
  {
    value: "handyman",
    label: "Handyman",
    category: "maintenance",
    aliases: ["maintenance", "general", "general maintenance"],
  },
  { value: "plumbing", label: "Plumbing", category: "maintenance" },
  { value: "electrical", label: "Electrical", category: "maintenance" },
  { value: "hvac", label: "HVAC", category: "maintenance", aliases: ["heating", "cooling", "ac"] },
  { value: "appliance", label: "Appliance", category: "maintenance", aliases: ["appliance repair"] },
  { value: "roofing", label: "Roofing", category: "maintenance", aliases: ["roof"] },
  { value: "structural", label: "Structural", category: "maintenance" },
  { value: "flooring", label: "Flooring", category: "maintenance" },
  { value: "painting", label: "Painting", category: "maintenance" },
  { value: "furniture", label: "Furniture", category: "maintenance", aliases: ["furnishing"] },
  { value: "restoration", label: "Restoration", category: "maintenance", aliases: ["mitigation"] },
  { value: "pest_control", label: "Pest control", category: "maintenance", aliases: ["pest"] },
  { value: "landscaping", label: "Landscaping", category: "maintenance", aliases: ["lawn"] },
  { value: "pool_spa", label: "Pool and spa", category: "maintenance", aliases: ["pool & spa", "pool / hot tub"] },
  {
    value: "locks_access",
    label: "Locks and access",
    category: "access",
    aliases: ["locks & access", "locksmith"],
  },
  { value: "safety_devices", label: "Safety devices", category: "safety", aliases: ["smoke", "co"] },
  { value: "photography", label: "Photography", category: "admin" },
  { value: "other", label: "Other", category: "other" },
];

const TRADE_BY_VALUE = new Map<string, TradeDef>(TRADES.map((t) => [t.value, t]));

const TRADE_BY_ALIAS = new Map<string, TradeDef>();
for (const t of TRADES) {
  TRADE_BY_ALIAS.set(t.value, t);
  TRADE_BY_ALIAS.set(t.label.toLowerCase(), t);
  for (const a of t.aliases ?? []) TRADE_BY_ALIAS.set(a.toLowerCase(), t);
}

function key(raw: string | null | undefined) {
  return (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Resolve any historic spelling onto the shared category code. */
export function normalizeCategory(raw: string | null | undefined): CategoryCode | null {
  const k = key(raw);
  if (!k) return null;
  const direct = CATEGORY_BY_ALIAS.get(k) ?? CATEGORY_BY_ALIAS.get(k.replace(/[\s-]+/g, "_"));
  if (direct) return direct;
  const trade = TRADE_BY_ALIAS.get(k) ?? TRADE_BY_ALIAS.get(k.replace(/[\s-]+/g, "_"));
  return trade ? trade.category : null;
}

/** Resolve any historic work-order category / vendor service label onto a trade. */
export function normalizeTrade(raw: string | null | undefined): TradeDef | null {
  const k = key(raw);
  if (!k) return null;
  return TRADE_BY_ALIAS.get(k) ?? TRADE_BY_ALIAS.get(k.replace(/[\s-]+/g, "_")) ?? null;
}

export function categoryLabel(raw: string | null | undefined): string {
  const code = normalizeCategory(raw);
  if (!code) return raw?.trim() ? String(raw) : "Not categorized";
  return CATEGORY_BY_CODE.get(code)?.label ?? code;
}

export function categoryHint(raw: string | null | undefined): string | null {
  const code = normalizeCategory(raw);
  return code ? (CATEGORY_BY_CODE.get(code)?.hint ?? null) : null;
}

export function tradeLabel(raw: string | null | undefined): string {
  const trade = normalizeTrade(raw);
  if (trade) return trade.label;
  return raw?.trim() ? String(raw) : "No trade set";
}

/** The category a work order inherits from its trade. */
export function categoryForTrade(raw: string | null | undefined): CategoryCode | null {
  return normalizeTrade(raw)?.category ?? null;
}

/**
 * One line of guidance per field, so the same field reads the same way on
 * every screen. Keyed by `record.field`.
 */
export const FIELD_GUIDANCE: Record<string, string> = {
  "ticket.category": "What kind of work this is. Pick the home's problem, not who will fix it.",
  "ticket.priority": "P1 urgent and unsafe, P2 same day, P3 planned. Supervisors set this.",
  "workOrder.trade": "The skill the vendor needs. The category is set from this for you.",
  "workOrder.category": "Set from the trade — shown so tickets and work orders read the same.",
  "workOrder.phase": "Permanent fixes the problem. Mitigation only stops it getting worse.",
  "claim.type": "Who we are recovering the money from. Sets the evidence checklist.",
  "claim.category": "What kind of work caused the loss, using the same list as tickets.",
  "vendor.serviceCategory": "The trades this vendor is approved to take work in.",
};

export function fieldGuidance(key: string): string | null {
  return FIELD_GUIDANCE[key] ?? null;
}
