/** Browser-safe presentation of who acted. Totals are never computed here. */
export type AttributionRow = { kind: string; ref_id: string | null; user_id: string; display_name: string | null };
export type Attribution = { names: Map<string, string>; answers: Map<string, string> };

export function buildAttribution(rows: AttributionRow[]): Attribution {
  const names = new Map<string, string>();
  const answers = new Map<string, string>();
  for (const r of rows) {
    if (r.kind === "member" && r.display_name) names.set(r.user_id, r.display_name);
    if (r.kind === "answer" && r.ref_id) answers.set(r.ref_id, r.user_id);
  }
  return { names, answers };
}

/** Only programs that have ever had more than one homeowner show names; single owners see no change. */
export function sharedProgram(a: Attribution) {
  return a.names.size > 1;
}

export function loggedByLabel(a: Attribution, userId: string | null | undefined) {
  if (!sharedProgram(a) || !userId) return null;
  const name = a.names.get(userId);
  return name ? `Logged by ${name}` : null;
}

export function answeredByLabel(a: Attribution, reviewId: string) {
  if (!sharedProgram(a)) return null;
  const who = a.answers.get(reviewId);
  const name = who ? a.names.get(who) : undefined;
  return name ? `Answered by ${name}` : null;
}
