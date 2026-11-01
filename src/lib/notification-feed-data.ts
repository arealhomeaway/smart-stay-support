/**
 * Data calls behind the staff notification feed, kept client-agnostic so the
 * paging, counting and mark-all rules can be tested with a fake client.
 * Row access stays the database's recipient rule.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type NotificationsClient = { from: (table: "staff_notifications") => any };

/** Every unread kind for the signed-in person, read in pages of 1000. */
export async function readUnreadKinds(client: NotificationsClient, demo: boolean): Promise<string[]> {
  const kinds: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("staff_notifications")
      .select("kind")
      .eq("is_demo", demo)
      .is("retracted_at", null)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    for (const r of (data ?? []) as { kind: string }[]) kinds.push(r.kind);
    if (!data || data.length < 1000) break;
  }
  return kinds;
}

/** One set-based update covering every unread notification for this person. */
export async function markAllUnread(
  client: NotificationsClient,
  userId: string,
  demo: boolean,
  now: string = new Date().toISOString(),
): Promise<number> {
  const { error, count } = await client
    .from("staff_notifications")
    .update({ read_at: now }, { count: "exact" })
    .eq("user_id", userId)
    .eq("is_demo", demo)
    .is("retracted_at", null)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}
