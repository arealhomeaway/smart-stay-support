/**
 * The Properties list card, as drawn on the PropertiesList board (Nov 9).
 * Pure wording rules so the card reads the same everywhere it is tested.
 */

/** "4 bd · 3 ba · sleeps 8", leaving out anything not recorded; no neighborhood (board, Build 16 D). */
export function homeFactsLine(p: {
  bedrooms?: number | null;
  bathrooms?: number | null;
  max_guests?: number | null;
  neighborhood?: string | null;
}): string {
  return [
    p.bedrooms == null ? null : `${p.bedrooms} bd`,
    p.bathrooms == null ? null : `${p.bathrooms} ba`,
    p.max_guests == null ? null : `sleeps ${p.max_guests}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The chip over the photo: "1 open ticket", "3 open tickets", or none. */
export function openTicketsChip(open: number): string | null {
  return open > 0 ? `${open} open ticket${open === 1 ? "" : "s"}` : null;
}

/** The last line: "N open tickets · N total", or nothing when the home has no tickets. */
export function ticketCountLine(open: number, total: number): string | null {
  if (total <= 0) return null;
  return `${open} open ticket${open === 1 ? "" : "s"} · ${total} total`;
}

/** "N carried over" when work was carried over at handoff. */
export function carriedOverChip(carried: number): string | null {
  return carried > 0 ? `${carried} carried over` : null;
}

/** The board's market order on the Properties list; any other market a home has follows (Build 16 D). */
export const BOARD_MARKETS = ["Fort Worth", "OKC", "Tulsa", "Indy"] as const;

export function marketOptions(homeMarkets: (string | null | undefined)[]): string[] {
  const seen = new Set(homeMarkets.filter((m): m is string => Boolean(m && m.trim())));
  const extra = [...seen].filter((m) => !(BOARD_MARKETS as readonly string[]).includes(m)).sort();
  return [...BOARD_MARKETS, ...extra];
}
