/**
 * Property page Part 3 (3.2): one file as a card, with a preview (image, first page of a PDF,
 * a video frame), its name and who added it when. Previews load only when the card is on screen,
 * through the same short-lived file link as View.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { attachmentUrlFn } from "@/lib/attachments.functions";
import { usDate } from "@/lib/dates";
import { previewKind } from "@/lib/home-details";

export type CardFile = {
  id: string;
  title?: string | null;
  original_filename?: string | null;
  mime_type?: string | null;
  uploaded_by_name?: string | null;
  uploaded_at?: string | null;
  created_at?: string | null;
};

export function FileCard({ file, footer, source }: { file: CardFile; footer?: ReactNode; source?: string | null }) {
  const urlFor = useServerFn(attachmentUrlFn);
  const ref = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const name = file.original_filename || file.title || "File";
  const kind = previewKind(file.mime_type, name);

  useEffect(() => {
    if (kind === "icon" || src || failed || !ref.current) return;
    const el = ref.current;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      urlFor({ data: { documentId: file.id, download: false } })
        .then((r) => setSrc(r.url))
        .catch(() => setFailed(true));
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [kind, src, failed, file.id, urlFor]);

  const open = (download: boolean) =>
    urlFor({ data: { documentId: file.id, download } })
      .then((r) => window.open(r.url, "_blank", "noopener,noreferrer"))
      .catch((e: Error) => toast.error(e.message || "That file could not be opened."));

  return (
    <article className="surface flex min-w-0 flex-col overflow-hidden" aria-label={name}>
      <div ref={ref} className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted">
        {src && kind === "image" && !failed ? (
          <img src={src} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />
        ) : src && kind === "pdf" && !failed ? (
          <object data={`${src}#page=1&toolbar=0&navpanes=0&view=FitH`} type="application/pdf" aria-label={`${name} first page`} className="pointer-events-none size-full">
            <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
          </object>
        ) : src && kind === "video" && !failed ? (
          <video src={`${src}#t=0.5`} preload="metadata" muted playsInline className="size-full object-cover" onError={() => setFailed(true)} />
        ) : (
          <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
        <p className="truncate text-sm font-medium" title={name}>{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {file.uploaded_by_name || "A teammate"} · {usDate(file.uploaded_at ?? file.created_at ?? null)}
        </p>
        {source ? <p className="truncate text-xs text-muted-foreground">From {source}</p> : null}
        <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
          <Button size="icon" variant="ghost" className="size-11" aria-label={`View ${name}`} onClick={() => void open(false)}>
            <Eye className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="size-11" aria-label={`Download ${name}`} onClick={() => void open(true)}>
            <Download className="size-4" />
          </Button>
          {footer}
        </div>
      </div>
    </article>
  );
}
