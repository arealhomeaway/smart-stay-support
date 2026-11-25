/** Web links inside an owner's own words (Google Docs and the like). Pure, browser-safe. */
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/gi;
const TRAIL = /[.,;:!?)\]]+$/;

export type TextPart = { kind: "text"; value: string } | { kind: "link"; value: string; href: string };

export function splitLinks(text: string | null | undefined): TextPart[] {
  const s = text ?? "";
  const out: TextPart[] = [];
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    let url = m[0];
    const trail = TRAIL.exec(url)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    const start = m.index ?? 0;
    if (start > last) out.push({ kind: "text", value: s.slice(last, start) });
    out.push({ kind: "link", value: url, href: url });
    last = start + url.length;
  }
  if (last < s.length) out.push({ kind: "text", value: s.slice(last) });
  return out;
}

export function linkCount(...texts: (string | null | undefined)[]): number {
  return new Set(texts.flatMap((t) => splitLinks(t).filter((p) => p.kind === "link").map((p) => p.value))).size;
}

/** "1 link attached" / "2 links attached", or null. */
export function linkCountLabel(n: number): string | null {
  return n > 0 ? `${n} ${n === 1 ? "link" : "links"} attached` : null;
}
