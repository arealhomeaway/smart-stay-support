/**
 * A real ARHA home, shown wherever recognising the property helps the work.
 *
 * Resolve never invents a house: if the property has no photograph on record,
 * this falls back to a calm lettered plate rather than a stock image of a home
 * that is not ours.
 *
 * Pure presentation.
 */
import { Home } from "lucide-react";
import { cn } from "@/lib/utils";

export function PropertyPhoto({
  url,
  name,
  className,
  rounded = "rounded-lg",
}: {
  url?: string | null | undefined;
  name?: string | null | undefined;
  className?: string | undefined;
  rounded?: string | undefined;
}) {
  const label = (name ?? "").trim();
  const initials =
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || null;

  if (url) {
    return (
      <img
        src={url}
        alt={label ? `${label} — ARHA property photo` : "ARHA property photo"}
        loading="lazy"
        className={cn("size-10 shrink-0 object-cover", rounded, className)}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center bg-aqua/12 text-xs font-semibold text-aqua",
        rounded,
        className,
      )}
    >
      {initials ?? <Home className="size-4" />}
    </span>
  );
}
