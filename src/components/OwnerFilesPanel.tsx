/**
 * The homeowner's file surface.
 *
 * Deliberately narrow: it shows only the records where ARHA has shared a file
 * with this owner or asked them for one. It is not a general file library, and
 * every action still re-checks on the server.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FolderOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { listOwnerFileRecordsFn } from "@/lib/attachments.functions";
import { formatBytes, MAX_FILE_BYTES } from "@/lib/attachments";

export function OwnerFilesPanel() {
  const listRecords = useServerFn(listOwnerFileRecordsFn);
  const q = useQuery({ queryKey: ["owner-file-records"], queryFn: () => listRecords({}) });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="size-4 text-primary" /> Documents &amp; photos
        </CardTitle>
        <CardDescription>
          Files ARHA has shared with you, and any document your coordinator has asked you to upload. Each file can be up
          to {formatBytes(MAX_FILE_BYTES)} — longer videos need to be trimmed or shared as a smaller copy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : q.isError ? (
          <p className="text-sm text-muted-foreground">
            {q.error instanceof Error ? q.error.message : "Your files could not be loaded."}
          </p>
        ) : (q.data?.records.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing here yet. Files appear once ARHA shares one with you or asks you for a document.
          </p>
        ) : (
          (q.data?.records ?? []).map((r) => (
            <AttachmentsPanel
              key={`${r.entityType}:${r.entityId}`}
              entityType={r.entityType}
              entityId={r.entityId}
              fulfilsRequestId={r.openRequestId}
              title={r.label}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
