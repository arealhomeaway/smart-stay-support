/**
 * Who can actually be put on onboarding work.
 *
 * The profiles table holds every account, including homeowner logins and test
 * accounts left over from QA. Those names have no business in an assignment
 * dropdown, so they are filtered out here rather than in each component.
 */

export type AssignablePerson = { id: string; full_name: string | null; email: string | null };

const TEST_EMAIL = /(\.invalid$|@example\.(com|invalid)$|@demo\.|resolve-test|\.test$)/i;

export function isRealTeamMember(person: AssignablePerson): boolean {
  const email = (person.email ?? "").trim().toLowerCase();
  if (!email) return false;
  if (TEST_EMAIL.test(email)) return false;
  return true;
}

/** Real teammates, in name order, for assignment pickers. */
export function assignablePeople<T extends AssignablePerson>(people: T[]): T[] {
  return people
    .filter(isRealTeamMember)
    .sort((a, b) =>
      (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "", "en"),
    );
}
