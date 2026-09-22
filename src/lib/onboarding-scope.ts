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

import { authorityLadder } from "./maintenance-policy";

export type FurnishingScope = "full_furnishing" | "owner_furnished" | "no_furnishing";

export const FURNISHING_SCOPES: { value: FurnishingScope; label: string; blurb: string }[] = [
  {
    value: "full_furnishing",
    label: "Full furnishing",
    blurb: "Design, mood board, floor plan, budget, orders, delivery, assembly and staging apply.",
  },
  {
    value: "owner_furnished",
    label: "Owner furnished",
    blurb:
      "The owner is furnishing the home. Design and purchasing are skipped; staging, inventory and readiness still apply.",
  },
  {
    value: "no_furnishing",
    label: "Existing home (no furnishing)",
    blurb:
      "Skip design and purchasing. Access, condition, repairs, utilities, safety and listing readiness still apply.",
  },
];

/* ------------------------------------------------- appliances and pool */

export type ApplianceScope = "new" | "existing" | "both";

export const APPLIANCE_SCOPES: { value: ApplianceScope; label: string; blurb: string }[] = [
  { value: "new", label: "New", blurb: "Purchase, delivery, install and warranty capture." },
  {
    value: "existing",
    label: "Existing",
    blurb: "Document and assess the appliances already in the home.",
  },
  { value: "both", label: "Both", blurb: "Some appliances stay, some are being bought." },
];

export type PoolLocation = "none" | "neighborhood" | "property";

export const POOL_LOCATIONS: { value: PoolLocation; label: string; blurb: string }[] = [
  { value: "none", label: "None", blurb: "No pool or hot tub for guests at this home." },
  {
    value: "neighborhood",
    label: "Neighborhood pool / hot tub",
    blurb: "A shared amenity. Guest rules and access apply; ARHA does not service it.",
  },
  {
    value: "property",
    label: "At the property",
    blurb: "Service vendor, safety, chemicals and equipment records apply.",
  },
];

/** The appliance answer, read from the modules a project already carries. */
export function applianceScope(modules: string[]): ApplianceScope {
  const isNew = modules.includes("new_appliances");
  const existing = modules.includes("existing_appliances");
  if (isNew && existing) return "both";
  if (isNew) return "new";
  return "existing";
}

/** Turn the appliance answer back into modules, leaving other modules alone. */
export function applyApplianceScope(modules: string[], choice: ApplianceScope): string[] {
  const rest = modules.filter((m) => m !== "new_appliances" && m !== "existing_appliances");
  if (choice === "new") return [...rest, "new_appliances"];
  if (choice === "existing") return [...rest, "existing_appliances"];
  return [...rest, "new_appliances", "existing_appliances"];
}

/** Pool answer for a project row, tolerant of rows saved before the question existed. */
export function poolLocation(project: {
  pool_location?: string | null;
  modules?: string[] | null;
}): PoolLocation {
  const stored = project.pool_location as PoolLocation | null | undefined;
  if (stored && stored !== "none") return stored;
  return (project.modules ?? []).includes("pool") ? "property" : "none";
}

/** Only a pool at the home puts pool service work in scope. */
export function applyPoolLocation(modules: string[], choice: PoolLocation): string[] {
  const rest = modules.filter((m) => m !== "pool");
  return choice === "property" ? [...rest, "pool"] : rest;
}


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
  {
    key: "utilities",
    label: "Utility setup",
    blurb: "Accounts, transfers, autopay and billing owner.",
    defaultOn: true,
  },
  {
    key: "repairs",
    label: "Repair work",
    blurb: "Make-ready repairs, estimates and approvals.",
    defaultOn: true,
  },
  {
    key: "smart_lock",
    label: "Smart lock / access",
    blurb: "Access devices, codes and handover to Operations.",
    defaultOn: true,
  },
  {
    key: "existing_appliances",
    label: "Existing appliances",
    blurb: "Document and assess appliances already in the home.",
    defaultOn: true,
  },
  {
    key: "new_appliances",
    label: "New appliances",
    blurb: "Purchase, delivery, install and warranty capture.",
    defaultOn: false,
  },
  {
    key: "pool",
    label: "Pool / hot tub",
    blurb: "Service vendor, safety, chemicals and equipment records.",
    defaultOn: false,
  },
  {
    key: "hoa",
    label: "HOA / covenants",
    blurb: "Covenant evidence, restrictions and registration.",
    defaultOn: false,
  },
  {
    key: "cameras",
    label: "Cameras / security",
    blurb: "Exterior cameras, alarm and monitoring setup.",
    defaultOn: false,
  },
  {
    key: "furniture_warranty",
    label: "Furniture warranty",
    blurb: "Warranty registration and claim references.",
    defaultOn: false,
  },
  {
    key: "landscaping",
    label: "Landscaping",
    blurb: "Recurring yard care and responsibility split.",
    defaultOn: false,
  },
  {
    key: "active_owner",
    label: "Active Owner program",
    blurb: "This property participates in owner participation.",
    defaultOn: false,
  },
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
  { module: "existing_appliances", match: /\bexisting appliance/i },
  { module: "active_owner", match: /\bactive owner|owner participation/i },
  { module: "furniture_warranty", match: /\bfurniture warranty|warranty registration\b/i },
  { module: "landscaping", match: /\blandscap|yard care|lawn\b/i },
  { module: "repairs", match: /\brepair|make[- ]ready\b/i },
];

/** Work that only exists when the home is being furnished by ARHA. */
const FURNISHING_ONLY =
  /\bdesign|mood board|floor plan|furnish|furniture|staging|stage the|d[eé]cor|assembl/i;

/** Buying and designing — skipped when the owner furnishes, staging is not. */
const FURNISHING_PURCHASING =
  /\bdesign|mood board|floor plan|furniture (order|budget|purchase|selection)|purchase furniture|assembl/i;

/**
 * Does this piece of work apply to a project with this scope?
 *
 * Conservative by design: anything that does not match a rule applies. Scope
 * removes work, it never invents it.
 */
export function appliesToScope(title: string, scope: ProjectScope): boolean {
  return outOfScopeReason(title, scope) === null;
}

/** Why a task is out of scope, for the "Not applicable" explanation. */
export function outOfScopeReason(title: string, scope: ProjectScope): string | null {
  const text = title ?? "";
  if (scope.furnishing === "no_furnishing" && FURNISHING_ONLY.test(text)) {
    return "This home is set up without ARHA furnishing.";
  }
  if (scope.furnishing === "owner_furnished" && FURNISHING_PURCHASING.test(text)) {
    return "The owner is furnishing this home, so ARHA design and purchasing do not apply.";
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

/* -------------------------------------------------------------- work release */

/** Scope of a persisted project row, with a safe default before initialization. */
export function projectScope(
  project: { furnishing_scope?: string | null; modules?: string[] | null } | null | undefined,
): ProjectScope {
  return {
    furnishing: (project?.furnishing_scope as FurnishingScope) ?? "full_furnishing",
    modules: (project?.modules as ModuleKey[] | undefined) ?? defaultModules(),
  };
}

/**
 * Split work into what this home is actually being asked for and what scope
 * has switched off. Out-of-scope work is never deleted and never counted as
 * missing — it is listed separately with the reason it does not apply.
 */
export function splitByScope<
  T extends { title: string; id?: string; parent_task_id?: string | null },
>(tasks: T[], scope: ProjectScope) {
  const inScope: T[] = [];
  const outOfScope: { task: T; reason: string }[] = [];
  const byId = new Map(tasks.filter((t) => t.id).map((t) => [t.id!, t]));
  function reasonFor(task: T, visited = new Set<string>()): string | null {
    const own = outOfScopeReason(task.title, scope);
    if (own) return own;
    if (!task.parent_task_id || visited.has(task.parent_task_id)) return null;
    visited.add(task.parent_task_id);
    const parent = byId.get(task.parent_task_id);
    return parent ? reasonFor(parent, visited) : null;
  }
  for (const t of tasks) {
    const reason = reasonFor(t);
    if (reason) outOfScope.push({ task: t, reason });
    else inScope.push(t);
  }
  return { inScope, outOfScope };
}

/* --------------------------------------------------- repair spend authority */

/**
 * Onboarding repairs follow the same authority policy Operations uses — the
 * threshold is never restated here, only read.
 */
export function repairApprovalGuidance(title: string): string | null {
  if (!/\brepair|make[- ]ready|estimate|quote\b/i.test(title ?? "")) return null;
  return authorityLadder().join(" ");
}
