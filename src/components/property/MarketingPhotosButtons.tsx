import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usCalendarDate } from "@/lib/dates";
import { PHOTOS_NOT_READY } from "@/lib/marketing-photos";
import {
  marketingPhotoSummary,
  marketingPhotosFolder,
  startMarketingPhotoDownload,
} from "@/lib/marketing-photos.functions";

/** Staff: opens the home's Marketing Photos folder in the ARHA Resolve SharePoint site. */
export function OpenPhotosFolderButton({ propertyId }: { propertyId: string }) {
  const getFolder = useServerFn(marketingPhotosFolder);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await getFolder({ data: { propertyId } });
          if (r.url) window.open(r.url, "_blank", "noopener");
          else toast.message(r.note ?? "The photos folder could not be found.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "The photos folder could not be opened.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <FolderOpen className="size-4" aria-hidden="true" /> Open the photos folder
    </Button>
  );
}

/** Owner: one zip of the home's marketing photos, streamed by Resolve. */
export function DownloadPhotosButton({ propertyId }: { propertyId: string }) {
  const getSummary = useServerFn(marketingPhotoSummary);
  const start = useServerFn(startMarketingPhotoDownload);
  const [busy, setBusy] = useState(false);
  const summary = useQuery({
    queryKey: ["marketing-photos", propertyId],
    queryFn: () => getSummary({ data: { propertyId } }),
    staleTime: 60_000,
  });
  const s = summary.data;
  if (summary.isLoading) return <p className="text-xs text-muted-foreground">Checking your photos…</p>;
  if (summary.isError) return <p className="text-xs text-muted-foreground">Photos could not be checked right now.</p>;
  if (!s || !s.ready) return <p className="text-sm text-muted-foreground">{PHOTOS_NOT_READY}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        disabled={busy || s.tooLarge}
        onClick={async () => {
          setBusy(true);
          try {
            const { url } = await start({ data: { propertyId } });
            window.location.assign(url);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "The download could not start.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Download className="size-4" aria-hidden="true" /> Download all photos
      </Button>
      <span className="text-xs text-muted-foreground">
        {s.count} photo{s.count === 1 ? "" : "s"}
        {s.updatedAt ? ` · Updated ${usCalendarDate(s.updatedAt.slice(0, 10))}` : ""}
        {s.tooLarge ? " · Too large to download at once, ask ARHA for help" : ""}
      </span>
    </div>
  );
}
