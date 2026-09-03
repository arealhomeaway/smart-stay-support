/**
 * Onboarding scope / applicability engine (browser-safe, pure).
 *
 * A property existing does not mean onboarding has started, and an onboarding
 * project does not mean every possible requirement applies. Initialization
 * records which modules apply to THIS home; everything downstream — released
 * work, evidence requirements, review gates, owner opportunities — asks this
 * module whether a piece of work is in scope.
 *
 * The rules are data, not branches: adding a module never means writing a new
 * hard-coded workflow.
 */

export type FurnishingScope = "full_furnishing" | "no_furnishing";

export const FURNISHING_SCOPES: { value: FurnishingScope; label: string; blurb: string }[] = [
  {
    value: "full_furnishing",
    label: "Full furnishing",
    blurb: "Design, mood board, floor plan, budget, orders, delivery, assembly and staging apply.",
  },
  {
    value: "no_furnishing",
    label: "No furnishings / existing home",
    blurb:
      "Skip design and purchasing. Access, condition, repairs, utilities, safety and listing readiness still apply.",
  },
];

export type ModuleKey =
  | "pool"
  | "hoa"
  | "utilities"
  | "repairs"
  | "existing_appliances"
  | "new_appliances"
  | "smart_lock"
  | "cameras"
  | "furniture_warranty"
  | "landscaping"
  | "active_owner";

export const SCOPE_MODULES: {
  key: ModuleKey;
  label: string;
  blurb: string;
  /** Default for a new project when Resolve has no better signal. */
  defaultOn: boolean;
}[] = [
  { key: "utilities", label: "Utility setup", blurb: "Accounts, transfers, autopay and billing owner.", defaultOn: true },
  { key: "repairs", label: "Repair work", blurb: "Make-ready repairs, estimates and approvals.", defaultOn: true },
  { key: "smart_lock", label: "Smart lock / access", blurb: "Access devices, codes and handover to Operations.", defaultOn: true },
  { key: "existing_appliances", label: "Existing appliances", blurb: "Document and assess appliances already in the home.", defaultOn: true },
  { key: "new_appliances", label: "New appliances", blurb: "Purchase, delivery, install and warranty capture.", defaultOn: false },
  { key: "pool", label: "Pool / hot tub", blurb: "Service vendor, safety, chemicals and equipment records.", defaultOn: false },
  { key: "hoa", label: "HOA / covenants", blurb: "Covenant evidence, restrictions and registration.", defaultOn: false },
  { key: "cameras", label: "Cameras / security", blurb: "Exterior cameras, alarm and monitoring setup.", defaultOn: false },
  { key: "furniture_warranty", label: "Furniture warranty", blurb: "Warranty registration and claim references.", defaultOn: false },
  { key: "landscaping", label: "Landscaping", blurb: "Recurring yard care and responsibility split.", defaultOn: false },
  { key: "active_owner", label: "Active Owner program", blurb: "This property participates in owner participation.", defaultOn: false },
];

export function moduleLabel(key: string) {
  return SCOPE_MODULES.find((m) => m.key === key)?.label ?? key;
}

export function defaultModules(): ModuleKey[] {
  return SCOPE_MODULES.filter((m) => m.defaultOn).map((m) => m.key);
}

/**
 * Modules Resolve can reasonably pre-select from what it already knows about
 * the home. Initialization never asks for information Resolve already has.
 */
export function suggestedModules(property: {
  pool_spa?: string | boolean | null;
  hoa?: string | boolean | null;
}): ModuleKey[] {
  const on = new Set<ModuleKey>(defaultModules());
  if (truthy(property.pool_spa)) on.add("pool");
  if (truthy(property.hoa)) on.add("hoa");
  return [...on];
}

function truthy(v: string | boolean | null | undefined) {
  if (typeof v === "boolean") return v;
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s !== "" && s !== "no" && s !== "none" && s !== "n/a" && s !== "false";
}

/* ------------------------------------------------------------ applicability */

export type ProjectScope = {
  furnishing: FurnishingScope;
  modules: ModuleKey[];
};

/** Keyword rules mapping a piece of work to the module that must be enabled. */
const REQUIRES: { module: ModuleKey; match: RegExp }[] = [
  { module: "pool", match: /\bpool|hot tub|spa\b/i },
  { module: "hoa", match: /\bhoa|covenant\b/i },
  { module: "utilities", match: /\butilit|electric|water|gas account|internet account\b/i },
  { module: "cameras", match: /\bcamera|alarm|security system\b/i },
  { module: "smart_lock", match: /\bsmart lock|lock code|keypad|access device\b/i },
  { module: "new_appliances", match: /\bnew appliance|appliance purchase|appliance delivery\b/i },
  { module: "furniture_warranty", match: /\bfurniture warranty|warranty registration\b/i },
  { module: "landscaping", match: /\blandscap|yard care|lawn\b/i },
  { module: "repairs", match: /\brepair|make[- ]ready\b/i },
];

/** Work that only exists when the home is being furnished by ARHA. */
const FURNISHING_ONLY =
  /\bdesign|mood board|floor plan|furnish|furniture|staging|stage the|d[eé]cor|purchas(e|ing)|delivery|assembl/i;

/**
 * Does this piece of work apply to a project with this scope?
 *
 * Conservative by design: anything that does not match a rule applies. Scope
 * removes work, it never invents it.
 */
export function appliesToScope(title: string, scope: ProjectScope): boolean {
  const text = title ?? "";
  if (scope.furnishing === "no_furnishing" && FURNISHING_ONLY.test(text)) return false;
  for (const rule of REQUIRES) {
    if (rule.match.test(text) && !scope.modules.includes(rule.module)) return false;
  }
  return true;
}

/** Why a task is out of scope, for the "Not applicable" explanation. */
export function outOfScopeReason(title: string, scope: ProjectScope): string | null {
  const text = title ?? "";
  if (scope.furnishing === "no_furnishing" && FURNISHING_ONLY.test(text)) {
    return "This home is set up without ARHA furnishing.";
  }
  for (const rule of REQUIRES) {
    if (rule.match.test(text) && !scope.modules.includes(rule.module)) {
      return `${moduleLabel(rule.module)} is not part of this project's scope.`;
    }
  }
  return null;
}

export function scopeSummary(scope: ProjectScope): string {
  const furnishing = FURNISHING_SCOPES.find((f) => f.value === scope.furnishing)?.label ?? "Scope";
  const extras = scope.modules.filter((m) => m !== "active_owner").map(moduleLabel);
  return extras.length ? `${furnishing} · ${extras.join(", ")}` : furnishing;
}

export function isActiveOwnerProject(scope: ProjectScope) {
  return scope.modules.includes("active_owner");
}
