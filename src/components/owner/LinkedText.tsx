import { splitLinks } from "@/lib/owner-links";

/** Owner words with any web link made clickable. Opens in a new tab. */
export function LinkedText({ text, className }: { text: string | null | undefined; className?: string }) {
  return (
    <span className={className}>
      {splitLinks(text).map((p, i) =>
        p.kind === "link" ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
            {p.value}
          </a>
        ) : (
          <span key={i}>{p.value}</span>
        ),
      )}
    </span>
  );
}
