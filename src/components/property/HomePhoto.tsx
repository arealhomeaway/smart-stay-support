/**
 * A home's own photo, cropped to fill its box and loaded only when it scrolls
 * into view. With no photo, or a photo link that no longer loads, it shows a
 * plain neutral block, never a broken image.
 *
 * Pure presentation.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function HomePhoto({
  url,
  alt,
  className,
}: {
  url?: string | null | undefined;
  alt: string;
  className?: string | undefined;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) {
    return <div aria-hidden="true" data-photo="none" className={cn("bg-muted", className)} />;
  }
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}

/** The photo a card or header shows: the medium copy first, then the full one. */
export function homePhotoUrl(p: {
  primary_photo_medium_url?: string | null;
  primary_photo_url?: string | null;
}): string | null {
  return p.primary_photo_medium_url || p.primary_photo_url || null;
}
