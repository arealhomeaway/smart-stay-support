/**
 * @mentions in ticket notes (Emily, Nov 7, 2026). Pure and browser-safe.
 *
 * Typing @ opens a picker of staff who can see the ticket (every internal staff account can read
 * tickets). Picking a person writes "@Full Name " into the note and remembers their id. When the
 * note is saved, only people whose "@Full Name" is still in the text are recorded in
 * ticket_activity.mentions; the database then alerts them.
 */

export type MentionPerson = { id: string; full_name: string | null; email: string | null };

export const MENTION_COPY = {
  label: "People you can mention",
  empty: "Nobody by that name",
  hint: "Type @ to mention someone.",
} as const;

/** The name a person is mentioned by. */
export function mentionName(p: MentionPerson): string {
  return (p.full_name ?? "").trim() || (p.email ?? "").split("@")[0] || "Teammate";
}

/**
 * The @word being typed just before the caret, or null. A mention starts at the start of the
 * text or after a space or new line, and may hold spaces (full names) up to 40 characters.
 */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before.charAt(at - 1))) return null;
  const query = before.slice(at + 1);
  if (query.length > 40 || /[\n@]/.test(query) || /\s{2,}/.test(query)) return null;
  return { start: at, query };
}

/** People matching what was typed: names starting with it first, then names containing it. */
export function matchPeople<T extends MentionPerson>(people: T[], query: string, limit = 6): T[] {
  const q = query.trim().toLowerCase();
  const scored = people
    .map((p) => {
      const name = mentionName(p).toLowerCase();
      const email = (p.email ?? "").toLowerCase();
      const rank = !q ? 1 : name.startsWith(q) ? 0 : name.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : name.includes(q) || email.startsWith(q) ? 2 : 9;
      return { p, rank, name };
    })
    .filter((x) => x.rank < 9)
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((x) => x.p);
}

/** Replaces the @query being typed with "@Full Name " and returns the new text and caret. */
export function insertMention(text: string, start: number, caret: number, person: MentionPerson) {
  const token = `@${mentionName(person)} `;
  const next = text.slice(0, start) + token + text.slice(caret);
  return { text: next, caret: start + token.length };
}

/** The ids to record: picked people whose "@Full Name" is still in the note, once each. */
export function mentionsInText(text: string, picked: string[], people: MentionPerson[]): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  for (const id of picked) {
    if (out.includes(id)) continue;
    const p = people.find((x) => x.id === id);
    if (p && lower.includes(`@${mentionName(p).toLowerCase()}`)) out.push(id);
  }
  return out;
}

/** Staff who can see tickets and can be mentioned: internal accounts that are still here. */
export const MENTIONABLE_ROLES = ["admin", "manager", "tech", "onboarding"] as const;
