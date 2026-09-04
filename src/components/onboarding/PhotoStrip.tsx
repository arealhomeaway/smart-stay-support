/**
 * Recent visual evidence — property/task photos shown as images, not
 * filename rows. Presentation only: reuses the same attachment records and
 * signed-URL lookups AttachmentsPanel already uses.
 */
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageOff } from "lucide-react";
import { attachmentUrlFn, listAttachmentsFn } from "@/lib/attachments.functions";
import type { AttachmentEntity } from "@/lib/attachments";
import { usDate } from "@/lib/dates";

export function PhotoStrip({
  entityType,
  entityId,
  title = "Recent photos",
  limit = 8,
  emptyHint = "No photos on file yet.",
}: {
  entityType: AttachmentEntity;
  entityId: string;
  title?: string;
  limit?: number;
  emptyHint?: string;
}) {
  const list = useServerFn(listAttachmentsFn);
  const urlFor = useServerFn(attachmentUrlFn);

  const files = useQuery({
    queryKey: ["attachments", entityType, entityId],
    queryFn: () => list({ data: { entityType, entityId } }),
  });

  const photos = (files.data?.files ?? [])
    .filter((f) => f.kind === "photo" && f.upload_status === "stored")
    .slice(0, limit);

  const urls = useQueries({
    queries: photos.map((f) => ({
      queryKey: ["attachment-url", f.id],
      queryFn: () => urlFor({ data: { documentId: f.id, download: false } }),
      enabled: photos.length > 0,
      staleTime: 5 * 60 * 1000,
    })),
  });

  if (files.isLoading) return null;
  if (photos.length === 0) {
    return (
      <div>
        <p className="eyebrow">{title}</p>
        <p className="pt-1 text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">{title}</p>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
        {photos.map((f, i) => {
          const url = urls[i]?.data?.url;
          return (
            <a
              key={f.id}
              href={url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block w-36 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40"
            >
              {url ? (
                <img
                  src={url}
                  alt={f.original_filename ?? f.title ?? "Property photo"}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition group-hover:opacity-90"
                />
              ) : (
                <span className="flex aspect-[4/3] w-full items-center justify-center text-muted-foreground">
                  <ImageOff className="size-5" />
                </span>
              )}
              <span className="block truncate px-2 py-1 text-[0.6875rem] text-muted-foreground">
                {f.uploaded_at ? usDate(f.uploaded_at) : ""}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
