/** Who wrote last in an owner item's conversation: events and system lines are ignored. */
export function lastSpeaker(messages: { author_type: string; event?: string | null }[]): "homeowner" | "staff" | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.event || m.author_type === "system") continue;
    return m.author_type === "homeowner" ? "homeowner" : "staff";
  }
  return null;
}
