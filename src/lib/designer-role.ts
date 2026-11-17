/**
 * One Designer per home (business rule, Nov 17). Resolve keeps one functional role, code
 * `designer`, label "Designer". The older codes `lead_designer` and `design_staging` were the
 * same job; their data moves to `designer` (docs/pending/onboarding-team-cleanup). The
 * "Staging Team" role (`staging_team`) is retired: staging is one vendor per home (the Stager).
 *
 * The file category `design_staging` ("Staging instructions") is a document type, not a role,
 * and is not covered here.
 */
export const DESIGNER_ROLE = "designer" as const;
export const DESIGNER_LABEL = "Designer";

/** Older codes for the Designer, read only so history and not-yet-moved rows still show "Designer". */
export const RETIRED_DESIGNER_CODES = ["lead_designer", "design_staging"] as const;
/** Role codes no list offers any more. */
export const RETIRED_ROLE_CODES = [...RETIRED_DESIGNER_CODES, "staging_team"] as const;

/** Where a home's Designer is read from, newest code first. */
export const DESIGNER_KEYS = [DESIGNER_ROLE, ...RETIRED_DESIGNER_CODES] as const;

export function isRetiredRoleCode(code: string | null | undefined): boolean {
  return Boolean(code) && (RETIRED_ROLE_CODES as readonly string[]).includes(code as string);
}

/** An older Designer code reads as `designer`; every other code is returned unchanged. */
export function canonicalRoleCode<T extends string | null | undefined>(code: T): T | typeof DESIGNER_ROLE {
  return code && (RETIRED_DESIGNER_CODES as readonly string[]).includes(code) ? DESIGNER_ROLE : code;
}

/** The home's Designer from its role assignments (the `designer` key first). */
export function homeDesigner(assignments: Record<string, unknown> | null | undefined): string | null {
  for (const k of DESIGNER_KEYS) {
    const v = assignments?.[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

/**
 * CSV import labels for the Designer, old and new. "Lead Designer", "Design" and
 * "Design & Staging" are older exports of the same role.
 */
export const DESIGNER_IMPORT_LABELS = ["designer", "lead designer", "design", "design & staging", "design and staging", "design & staging (older steps)"] as const;
