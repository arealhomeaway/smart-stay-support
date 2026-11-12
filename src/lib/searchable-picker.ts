/**
 * Searchable pickers (Nov 12 item 34): typing filters the list by any part of
 * the name, and two options with the same name stay distinguishable by a small
 * second line (for Breezeway templates, the department and template number).
 * Pure and browser-safe.
 */
export type PickerOption = { value: string; label: string; detail?: string | null };

const norm = (s: string) => s.toLocaleLowerCase().replace(/\s+/g, " ").trim();

/** Options whose name contains the typed text anywhere, case and spacing ignored. */
export function filterPickerOptions<T extends PickerOption>(options: readonly T[], term: string): T[] {
  const q = norm(term);
  if (!q) return options.slice();
  return options.filter((o) => norm(o.label).includes(q));
}

/** Keep `detail` only on options whose name is shared with another option. */
export function distinguishDuplicates<T extends { label: string; hint?: string | null }>(
  options: readonly T[],
): (T & { detail: string | null })[] {
  const counts = new Map<string, number>();
  for (const o of options) counts.set(norm(o.label), (counts.get(norm(o.label)) ?? 0) + 1);
  return options.map((o) => ({ ...o, detail: (counts.get(norm(o.label)) ?? 0) > 1 ? (o.hint ?? null) : null }));
}

const titleCase = (s: string) =>
  s.replace(/[_-]+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());

/** Breezeway templates as picker options; duplicate names show department and template number. */
export function breezewayTemplateOptions(
  templates: readonly { id: number; name: string; department?: string | null }[],
): PickerOption[] {
  return distinguishDuplicates(
    templates.map((t) => ({
      value: String(t.id),
      label: t.name,
      hint: [t.department ? titleCase(t.department) : null, `Template ${t.id}`].filter(Boolean).join(" · "),
    })),
  ).map(({ value, label, detail }) => ({ value, label, detail }));
}

/** Breezeway people for Assign to: Unassigned first (the default), duplicates show the person number. */
export const UNASSIGNED_VALUE = "unassigned";
export function breezewayPersonOptions(people: readonly { id: number; name: string }[]): PickerOption[] {
  const sorted = people.slice().sort((a, b) => a.name.localeCompare(b.name));
  return [
    { value: UNASSIGNED_VALUE, label: "Unassigned", detail: null },
    ...distinguishDuplicates(sorted.map((p) => ({ value: String(p.id), label: p.name, hint: `Person ${p.id}` }))).map(
      ({ value, label, detail }) => ({ value, label, detail }),
    ),
  ];
}
