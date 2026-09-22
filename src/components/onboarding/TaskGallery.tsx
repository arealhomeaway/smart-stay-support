/**
 * Inline visual gallery for design and staging steps.
 *
 * Mood boards, layouts and staging photos as thumbnails, with a lightbox that
 * steps through them side by side — no downloading to look at a picture.
 * Presentation only: the same attachment records and signed-URL lookups the
 * attachments panel already uses.
 */
import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { attachmentUrlFn, listAttachmentsFn } from "@/lib/attachments.functions";
import { usDate } from "@/lib/dates";

export function TaskGallery({
  taskId,
  title = "Mood boards & staging photos",
}: {
  taskId: string;
  title?: string;
}) {
  const list = useServerFn(listAttachmentsFn);
  const urlFor = useServerFn(attachmentUrlFn);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const files = useQuery({
    queryKey: ["attachments", "onboarding_task", taskId],
    queryFn: () => list({ data: { entityType: "onboarding_task", entityId: taskId } }),
  });

  const photos = (files.data?.files ?? []).filter(
    (f) => f.kind === "photo" && f.upload_status === "stored",
  );

  const urls = useQueries({
    queries: photos.map((f) => ({
      queryKey: ["attachment-url", f.id],
      queryFn: () => urlFor({ data: { documentId: f.id, download: false } }),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const count = photos.length;
  useEffect(() => {
    if (openIndex !== null && openIndex >= count) setOpenIndex(null);
  }, [openIndex, count]);

  useEffect(() => {
    if (openIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : (i + 1) % count));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : (i - 1 + count) % count));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openIndex, count]);

  if (files.isLoading || count === 0) return null;

  const current = openIndex === null ? null : photos[openIndex];
  const currentUrl = openIndex === null ? undefined : urls[openIndex]?.data?.url;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">{title}</p>
        <span className="text-xs text-muted-foreground">
          {count} {count === 1 ? "image" : "images"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((f, i) => {
          const url = urls[i]?.data?.url;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group overflow-hidden rounded-lg border border-border bg-muted/40 text-left"
              aria-label={`Open ${f.title || f.original_filename || "image"} full size`}
            >
              {url ? (
                <img
                  src={url}
                  alt={f.title || f.original_filename || "Design image"}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition group-hover:opacity-90"
                />
              ) : (
                <span className="flex aspect-[4/3] w-full items-center justify-center text-muted-foreground">
                  <ImageOff className="size-5" />
                </span>
              )}
              <span className="block truncate px-2 py-1 text-[0.6875rem] text-muted-foreground">
                {f.title || f.original_filename || "Image"}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(v) => !v && setOpenIndex(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {current?.title || current?.original_filename || "Design image"}
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            {currentUrl ? (
              <img
                src={currentUrl}
                alt={current?.title || current?.original_filename || "Design image"}
                className="max-h-[70vh] w-full rounded-md border border-border object-contain"
              />
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">Loading image…</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={count < 2}
              onClick={() => setOpenIndex((i) => (i === null ? i : (i - 1 + count) % count))}
            >
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              {openIndex !== null ? openIndex + 1 : 0} of {count}
              {current?.uploaded_at ? ` · added ${usDate(current.uploaded_at)}` : ""}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={count < 2}
              onClick={() => setOpenIndex((i) => (i === null ? i : (i + 1) % count))}
            >
              Next <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
