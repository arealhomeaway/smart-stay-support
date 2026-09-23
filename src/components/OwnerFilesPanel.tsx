/**
 * The homeowner's Documents & Photos: one flat library for the selected home
 * or all homes. Files ARHA shared, the owner's own uploads, and open
 * coordinator requests. Internal record grouping is never shown.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, FileText, Film, FolderOpen, Image as ImageIcon, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { attachmentUrlFn, listOwnerDocumentsFn } from "@/lib/attachments.functions";
import { formatBytes, MAX_FILE_BYTES, ownerCategoryLabel, type AttachmentEntity } from "@/lib/attachments";
import { usDate } from "@/lib/dates";
import { OwnerUploadDialog, type OwnerHome } from "@/components/owner/OwnerUploadDialog";

export function useOwnerDocuments() {
  const list = useServerFn(listOwnerDocumentsFn);
  return useQuery({ queryKey: ["owner-documents"], queryFn: () => list({}) });
}

function iconFor(kind: string) {
  if (kind === "photo") return <ImageIcon className="size-4" />;
  if (kind === "video") return <Film className="size-4" />;
  return <FileText className="size-4" />;
}

export function OwnerFileRow({ f, showHome }: { f: { id: string; title: string; kind: string; uploaded_at: string | null; created_at: string; uploaded_by_name: string | null; owner_category: string | null; note: string | null; propertyName: string }; showHome: boolean }) {
  const urlFor = useServerFn(attachmentUrlFn);
  const openFile = async (download: boolean) => {
    try {
      const { url } = await urlFor({ data: { documentId: f.id, download } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open that file.");
    }
  };
  const by = f.uploaded_by_name === "You" ? "uploaded by you" : "shared by ARHA";
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
      <div className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 text-muted-foreground">{iconFor(f.kind)}</span>
        <div className="min-w-0">
          <p className="truncate font-medium">{f.title}</p>
          <p className="text-xs text-muted-foreground">
            {showHome ? `${f.propertyName} · ` : ""}{by} · {usDate(f.uploaded_at ?? f.created_at)}
          </p>
          {f.note ? <p className="text-xs text-muted-foreground">{f.note}</p> : null}
        </div>
        {ownerCategoryLabel(f.owner_category) ? <Badge variant="outline">{ownerCategoryLabel(f.owner_category)}</Badge> : null}
      </div>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => void openFile(false)} aria-label={`View ${f.title}`}><Eye className="size-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => void openFile(true)} aria-label={`Download ${f.title}`}><Download className="size-4" /></Button>
      </div>
    </li>
  );
}

export function OwnerFilesPanel({ homes, selectedHomeId, readOnly = false }: { homes: OwnerHome[]; selectedHomeId: string | null; readOnly?: boolean }) {
  const q = useOwnerDocuments();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [request, setRequest] = useState<{ id: string; title: string; entityType: AttachmentEntity; entityId: string; propertyId: string | null } | null>(null);
  const inScope = <T extends { property_id?: string | null; propertyId?: string | null }>(x: T) =>
    !selectedHomeId || (x.property_id ?? x.propertyId) === selectedHomeId;
  const files = (q.data?.files ?? []).filter(inScope);
  const requests = (q.data?.requests ?? []).filter(inScope);
  const showHome = !selectedHomeId && homes.length > 1;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 pb-3">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderOpen className="size-4 text-primary" /> Documents &amp; photos
          </CardTitle>
          <CardDescription>
            Files ARHA has shared with you, and any document your coordinator has asked you to upload.
            Each file can be up to {formatBytes(MAX_FILE_BYTES)} — longer videos need to be trimmed or
            shared as a smaller copy.
          </CardDescription>
        </div>
        {!readOnly && homes.length ? (
          <Button onClick={() => setUploadOpen(true)}><Plus className="size-4" /> Upload</Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : q.isError ? (
          <p className="text-sm text-muted-foreground">
            {q.error instanceof Error ? q.error.message : "Your files could not be loaded."}
          </p>
        ) : (
          <>
            {requests.length ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Requested by your coordinator</h3>
                <ul className="space-y-2">
                  {requests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border p-3">
                      <div>
                        <p className="font-medium">{r.title}</p>
                        <p className="text-xs text-muted-foreground">{showHome ? `${r.propertyName} · ` : ""}{r.note ?? "Please upload this document."}</p>
                      </div>
                      {!readOnly ? <Button size="sm" variant="outline" onClick={() => setRequest(r)}><Upload className="size-4" /> Upload</Button> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {files.length === 0 && requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing here yet. Use Upload to add a document or photo.</p>
            ) : (
              <ul className="space-y-2">{files.map((f) => <OwnerFileRow key={f.id} f={f} showHome={showHome} />)}</ul>
            )}
          </>
        )}
      </CardContent>
      <OwnerUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} homes={homes} fixedPropertyId={selectedHomeId} />
      <OwnerUploadDialog open={request !== null} onOpenChange={(o) => !o && setRequest(null)} homes={homes} request={request} />
    </Card>
  );
}
