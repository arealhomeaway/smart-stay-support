/**
 * Homeowner directory — pure shaping and filtering.
 *
 * One row per homeowner, with the homes they own, whether they can sign in to
 * Resolve, and where they stand in the Active Owner program.
 */

export type HomeownerEnrollment = "enrolled" | "completed" | "not_enrolled";

export type HomeownerRow = {
  /** Owner record id when we have one, otherwise the contact row id. */
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** primary owner record vs a contact captured on a property. */
  ownerType: "primary" | "secondary";
  properties: { id: string; name: string }[];
  hasLogin: boolean;
  enrollment: HomeownerEnrollment;
  /** Program record to open, when they are or were enrolled. */
  programId: string | null;
  daysLeft: number | null;
};

export type HomeownerFilters = {
  search?: string;
  enrollment?: HomeownerEnrollment | "all";
  login?: "all" | "has_login" | "no_login";
};

export function matchesHomeownerSearch(row: HomeownerRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [row.name, row.email ?? "", row.phone ?? "", ...row.properties.map((p) => p.name)]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function filterHomeowners(rows: HomeownerRow[], f: HomeownerFilters = {}): HomeownerRow[] {
  const enrollment = f.enrollment ?? "all";
  const login = f.login ?? "all";
  return rows
    .filter((r) => enrollment === "all" || r.enrollment === enrollment)
    .filter((r) =>
      login === "all" ? true : login === "has_login" ? r.hasLogin : !r.hasLogin,
    )
    .filter((r) => matchesHomeownerSearch(r, f.search ?? ""))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function homeownerCounts(rows: HomeownerRow[]) {
  return {
    total: rows.length,
    enrolled: rows.filter((r) => r.enrollment === "enrolled").length,
    completed: rows.filter((r) => r.enrollment === "completed").length,
    withLogin: rows.filter((r) => r.hasLogin).length,
  };
}

export const ENROLLMENT_LABEL: Record<HomeownerEnrollment, string> = {
  enrolled: "In the program",
  completed: "Completed",
  not_enrolled: "Not enrolled",
};
