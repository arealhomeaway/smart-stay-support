/**
 * Email the homeowner from an onboarding Task. Pure rules shared by the
 * composer, the server and tests. The main homeowner is the To line; any other
 * homeowner on file is offered as an optional CC, unchecked by default.
 * Merge values come only from the home label, the owner's name and the sender,
 * so lock codes, guest details and internal notes can never be merged in.
 */

export type HomeownerContact = { name: string | null; email: string };

export function splitHomeowners(contacts: HomeownerContact[]): {
  primary: HomeownerContact | null;
  coOwners: HomeownerContact[];
} {
  const seen = new Set<string>();
  const unique = contacts.filter((c) => {
    const key = c.email.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { primary: unique[0] ?? null, coOwners: unique.slice(1) };
}

/** CC list from the checked boxes only. Nothing is checked until staff choose. */
export function checkedCc(coOwners: HomeownerContact[], checked: Record<string, boolean>) {
  return coOwners.filter((c) => checked[c.email] === true).map((c) => c.email);
}

export function firstName(name: string | null | undefined): string | null {
  const clean = (name ?? "").trim();
  if (!clean) return null;
  return clean.split(/\s+/)[0] ?? null;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** A template whose name matches the Task title, if exactly one is linked by name. */
export function suggestTemplateId(
  templates: { id: string; name: string; contexts?: string[] }[],
  taskTitle: string | null | undefined,
): string | null {
  const title = normalize(taskTitle ?? "");
  if (!title) return null;
  const usable = templates.filter((t) => !t.contexts || t.contexts.includes("onboarding_task"));
  const exact = usable.filter((t) => normalize(t.name) === title);
  if (exact.length === 1) return exact[0]!.id;
  const partial = usable.filter((t) => {
    const n = normalize(t.name);
    return n.length >= 4 && (title.includes(n) || n.includes(title));
  });
  return partial.length === 1 ? partial[0]!.id : null;
}

/** The only values a Task email can merge in. */
export const TASK_MERGE_KEYS = [
  "property",
  "property_address",
  "owner_name",
  "owner_first_name",
  "arha_contact",
  "task_title",
  "task_due",
  "sender_name",
] as const;

export function taskEmailEventSummary(subject: string) {
  return `Emailed homeowner: ${subject.trim()}`;
}

export const NO_HOMEOWNER_EMAIL =
  "This home has no homeowner email on file yet. Add one on the home's Homeowners list, or type an address above.";
