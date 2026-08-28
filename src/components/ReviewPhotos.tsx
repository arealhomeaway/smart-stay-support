import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import type { ReviewPhoto } from "@/lib/owner-participation";

/**
 * Photo evidence attached to an owner decision. Thumbnails open full size so an
 * owner can actually look at what they are approving before they respond.
 */
export function ReviewPhotos({
  photos,
  size = "sm",
}: {
  photos: ReviewPhoto[];
  size?: "sm" | "lg";
}) {
  const [open, setOpen] = useState<ReviewPhoto | null>(null);
  if (photos.length === 0) return null;

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((p) => (
          <button
            key={p.url}
            type="button"
            onClick={() => setOpen(p)}
            className="group overflow-hidden rounded-md border border-border text-left"
            aria-label={p.caption ? `View photo: ${p.caption}` : "View photo"}
          >
            <img
              src={p.url}
              alt={p.caption ?? "Photo from the team"}
              loading="lazy"
              className={
                size === "lg"
                  ? "h-32 w-44 object-cover"
                  : "h-16 w-24 object-cover"
              }
            />
            {p.caption && (
              <span className="block max-w-44 truncate bg-muted px-1.5 py-1 text-[11px] text-muted-foreground">
                {p.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={() => setOpen(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{open?.caption ?? "Photo from the team"}</DialogTitle>
          </DialogHeader>
          {open && (
            <img
              src={open.url}
              alt={open.caption ?? "Photo from the team"}
              className="w-full rounded-md border border-border object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
