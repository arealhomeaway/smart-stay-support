import { fieldGuidance } from "@/lib/taxonomy";

/**
 * The one place field guidance is rendered, so the same field reads the same
 * way on every screen. Pass a guidance key (`ticket.category`) or literal text.
 */
export function FieldHint({ guide, text }: { guide?: string; text?: string }) {
  const copy = text ?? (guide ? fieldGuidance(guide) : null);
  if (!copy) return null;
  return <p className="text-[11px] leading-snug text-muted-foreground">{copy}</p>;
}

export default FieldHint;
