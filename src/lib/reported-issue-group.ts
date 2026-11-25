/** Preserve the exact rolled-up membership when opening a Ticket panel. */
export function reportedIssueIds(value: unknown, lead: string): string[] {
  const ids = typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set([lead, ...ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id))]));
}