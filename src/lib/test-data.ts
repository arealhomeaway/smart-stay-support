/**
 * One shared definition of "this is test data" for the whole app.
 *
 * QA and demo records must read the same way everywhere: a home marked
 * `is_demo`, or one whose name carries an explicit QA/demo/test marker, is
 * hidden from every default list, count and metric. Surfaces that let staff
 * work the QA scenarios expose the same opt-in toggle rather than inventing
 * their own rule.
 */

const NAME_MARKERS = [/^zz\s*qa/i, /\bqa\b/i, /\(demo\)/i, /\bdemo\b/i, /do not use/i];

export type TestDataSubject = {
  name?: string | null;
  is_demo?: boolean | null;
};

/** True when a record should be treated as QA/demo rather than production. */
export function isTestRecord(subject: TestDataSubject | null | undefined): boolean {
  if (!subject) return false;
  if (subject.is_demo) return true;
  const name = subject.name ?? "";
  return NAME_MARKERS.some((re) => re.test(name));
}

/** Filters a list to production records unless the viewer opted into test data. */
export function applyTestDataFilter<T>(
  rows: T[],
  showTest: boolean,
  pick: (row: T) => TestDataSubject | null | undefined,
): T[] {
  if (showTest) return rows;
  return rows.filter((row) => !isTestRecord(pick(row)));
}

/** How many of these rows are test data — used for the toggle label. */
export function countTestRecords<T>(
  rows: T[],
  pick: (row: T) => TestDataSubject | null | undefined,
): number {
  return rows.filter((row) => isTestRecord(pick(row))).length;
}
