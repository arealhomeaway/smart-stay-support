/**
 * Staff write owner-facing instructions as plain text, and those instructions
 * regularly contain a link the homeowner is expected to open. Rendering them
 * as dead text means the homeowner cannot actually work the task, so links are
 * detected and made clickable at display time. Nothing is stored linkified.
 */
import type { ReactNode } from "react";

const PATTERN = /(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]|www\.[^\s<>()]+[^\s<>().,;:!?'"])/gi;

/** Splits text into plain runs and clickable links, preserving line breaks. */
export function linkifyText(text: string | null | undefined): ReactNode[] {
  const value = text ?? "";
  if (!value) return [];
  const parts = value.split(PATTERN);
  return parts.map((part, index) => {
    if (!part) return null;
    if (!PATTERN.test(part)) {
      PATTERN.lastIndex = 0;
      return <span key={index}>{part}</span>;
    }
    PATTERN.lastIndex = 0;
    const href = part.startsWith("www.") ? `https://${part}` : part;
    return (
      <a
        key={index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline underline-offset-2 break-words"
      >
        {part}
      </a>
    );
  });
}
