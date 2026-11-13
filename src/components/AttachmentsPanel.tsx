/**
 * Files on a ticket or an onboarding task.
 *
 * Everything shown here has already been decided server-side: the list only
 * contains files this person may see, and each action re-checks on the server
 * before anything happens. Retries retain completed bytes and finalize the
 * same intent; failed transfers use a fresh intent through the existing path.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  Eye,
  FileText,
  Film,
  Image as ImageIcon,
  Paperclip,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  attachmentUploadInvalidationKeys,
  type AttachmentEntity,
  DOCUMENT_CATEGORIES,
  documentCategoryLabel,
  ownerCategoryLabel,
  formatBytes,
  MAX_FILE_BYTES,
} from "@/lib/attachments";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  attachmentUrlFn,
  beginUploadFn,
  completeUploadFn,
  listAttachmentsFn,
  removeAttachmentFn,
  setAttachmentVisibilityFn,
} from "@/lib/attachments.functions";
import { usDate } from "@/lib/dates";
import { MultiFileUpload } from "@/components/MultiFileUpload";
import { createAttachmentUploader } from "@/lib/attachment-upload-client";
import { moveHomeFileFn } from "@/lib/home-details.functions";
import { UPLOAD_FOLDERS, uploadCategory, type HomeFolder } from "@/lib/home-details";

type Props = {
  entityType: AttachmentEntity;
  entityId: string;
  /** Owners uploading against a specific staff request pass its id. */
  fulfilsRequestId?: string | null;
  title?: string;
  description?: string;
  /** History view: show what is on file, but never a second uploader. */
  readOnly?: boolean;
  onUploaded?: (ids: string[]) => void;
  onUploadBusyChange?: (busy: boolean) => void;
  /** Limit the folder picker to these choices (the home's Design tab). */
  categories?: readonly { value: string; label: string }[] | undefined;
  /** The folder picked first. */
  defaultCategory?: string | undefined;
  /** The drop prompt. */
  dropLabel?: string | undefined;
  /** Only list files in these folders. */
  onlyCategories?: readonly string[] | undefined;
  /** List files under a heading per folder. */
  groupByCategory?: boolean | undefined;
  /**
   * Property page Part 3 (3.2): every upload on a home's page picks one of the home's Files
   * folders (never Other); a Task starts on the folder of its kind. Task files are filed after
   * upload through move_home_file.
   */
  folderPick?: { defaultFolder: HomeFolder | null } | undefined;
};

function iconFor(kind: string) {
  if (kind === "photo") return <ImageIcon className="size-4" />;
  if (kind === "video") return <Film className="size-4" />;
  return <FileText className="size-4" />;
}

export function AttachmentsPanel({
  entityType,
  entityId,
  fulfilsRequestId = null,
  title = "Files",
  description,
  readOnly = false,
  onUploaded,
  onUploadBusyChange,
  categories,
  defaultCategory,
  dropLabel,
  onlyCategories,
  groupByCategory = false,
  folderPick,
}: Props) {
  const propertyLevel = entityType === "property";
  const pickable = categories ?? DOCUMENT_CATEGORIES;
  const [category, setCategory] = useState<string>(defaultCategory ?? "reference");
  const qc = useQueryClient();
  const list = useServerFn(listAttachmentsFn);
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const urlFor = useServerFn(attachmentUrlFn);
  const remove = useServerFn(removeAttachmentFn);
  const share = useServerFn(setAttachmentVisibilityFn);
  const fileInto = useServerFn(moveHomeFileFn);
  const [folder, setFolder] = useState<HomeFolder | "">(folderPick?.defaultFolder ?? "");
  const folderRef = useRef(folder);
  folderRef.current = folder;
  const intentCategory = () =>
    propertyLevel ? (folderPick ? (folderRef.current ? uploadCategory(folderRef.current) : null) : category) : null;

  const key = ["attachments", entityType, entityId];
  const files = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { entityType, entityId } }),
  });

  const uploadIntent = useRef((file: File, key: string) => ({ entityType, entityId, uploadKey: key, filename: file.name, mimeType: file.type, sizeBytes: file.size, category: intentCategory(), fulfilsRequestId }));
  uploadIntent.current = (file: File, key: string) => ({ entityType, entityId, uploadKey: key, filename: file.name, mimeType: file.type, sizeBytes: file.size, category: intentCategory(), fulfilsRequestId });
  const [upload] = useState(() => createAttachmentUploader(begin, complete, (file, key) => uploadIntent.current(file, key)));

  const open = useMutation({
    mutationFn: async (v: { documentId: string; download: boolean }) =>
      urlFor({ data: { documentId: v.documentId, download: v.download } }),
    onSuccess: (r) => window.open(r.url, "_blank", "noopener,noreferrer"),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "That file could not be opened."),
  });

  const del = useMutation({
    mutationFn: async (documentId: string) =>
      remove({ data: { documentId, reason: "Removed from the record" } }),
    onSuccess: () => {
      toast.success("File removed. The removal is on the record.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "That file could not be removed."),
  });

  const toggleShare = useMutation({
    mutationFn: async (v: { documentId: string; shared: boolean }) =>
      share({
        data: { documentId: v.documentId, visibility: v.shared ? "owner_shared" : "internal" },
      }),
    onSuccess: () => {
      for (const queryKey of [key, ["property-hub"], ["owner-files"], ["owner-home"]])
        void qc.invalidateQueries({ queryKey });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Sharing could not be changed."),
  });

  const data = files.data;
  const canDrop = Boolean(data?.canUpload) && !readOnly && (!folderPick || Boolean(folder));
  type FileRow = NonNullable<typeof data>["files"][number];
  const shownFiles: FileRow[] = (data?.files ?? []).filter(
    (f) => !onlyCategories || onlyCategories.includes(String((f as { category?: string | null }).category ?? "")),
  );
  const groupedFiles = (() => {
    const map = new Map<string, FileRow[]>();
    for (const f of shownFiles) {
      const label = documentCategoryLabel((f as { category?: string | null }).category) ?? "Other files";
      map.set(label, [...(map.get(label) ?? []), f]);
    }
    return [...map.entries()].map(([label, files]) => ({ label, files }));
  })();
  const renderFile = (f: FileRow) => (
    <li key={f.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{iconFor(f.kind)}</span>
      <span className="min-w-0 flex-1 truncate font-medium">
        {f.original_filename ?? f.title}
      </span>
      {documentCategoryLabel((f as { category?: string | null }).category) ? (
        <Badge variant="outline">
          {documentCategoryLabel((f as { category?: string | null }).category)}
        </Badge>
      ) : null}
      {f.upload_status === "pending" ? (
        <Badge variant="secondary">
          {f.requested_from === "owner" ? "Requested from owner" : "Upload unfinished"}
        </Badge>
      ) : !f.original_filename ? (
        <Badge variant="secondary">Request completed</Badge>
      ) : (
        <span className="text-muted-foreground">
          {formatBytes(f.size_bytes ?? 0)} · {f.uploaded_by_name ?? "Not set"} ·{" "}
          {usDate(f.uploaded_at)}
        </span>
      )}
      {ownerCategoryLabel((f as { owner_category?: string | null }).owner_category) ? (
        <Badge variant="outline">
          Owner upload · {ownerCategoryLabel((f as { owner_category?: string | null }).owner_category)}
        </Badge>
      ) : null}
      {(f as { work_items?: { title: string } | null }).work_items?.title ? (
        <Badge variant="outline">
          Opportunity: {(f as { work_items?: { title: string } | null }).work_items!.title}
        </Badge>
      ) : null}
      {f.note && f.upload_status === "stored" ? (
        <span className="w-full text-xs text-muted-foreground">Note: {f.note}</span>
      ) : null}
      {f.visibility === "owner_shared" && f.owner_recipient_id ? (
        <Badge variant="outline">Shared with the homeowner</Badge>
      ) : null}
      {f.can_share && entityType !== "expense" ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <Switch
              checked={f.visibility === "owner_shared" && !!f.owner_recipient_id}
              onCheckedChange={(shared) =>
                toggleShare.mutate({ documentId: f.id, shared })
              }
            />
            Owner
          </label>
          {f.visibility === "owner_shared" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={toggleShare.isPending}
              onClick={() => toggleShare.mutate({ documentId: f.id, shared: true })}
            >
              {f.owner_recipient_id
                ? "Re-share to current owner"
                : "Review and share to current owner"}
            </Button>
          ) : null}
        </div>
      ) : null}
      {f.upload_status === "stored" && f.original_filename ? (
        <>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => open.mutate({ documentId: f.id, download: false })}
            aria-label={`View ${f.title}`}
          >
            <Eye className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => open.mutate({ documentId: f.id, download: true })}
            aria-label={`Download ${f.title}`}
          >
            <Download className="size-4" />
          </Button>
        </>
      ) : null}
      {f.can_delete ? (
        <Button size="icon" variant="ghost" onClick={() => del.mutate(f.id)} aria-label={`Remove ${f.title}`}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      ) : null}
    </li>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="size-4" /> {title}
            </CardTitle>
            <CardDescription className="mt-1">
              {description ??
                "Photos, video and documents stay attached to this record through assignment, review, handoff and closure. Homeowners see only what is marked shared."}{" "}
              Each file can be up to {formatBytes(MAX_FILE_BYTES)}.
            </CardDescription>
          </div>
          {data?.canUpload && propertyLevel && !folderPick ? (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-11 w-56" aria-label={categories ? "Folder" : "Document type"}>
                <SelectValue placeholder={categories ? "Folder" : "Document type"} />
              </SelectTrigger>
              <SelectContent>
                {pickable.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {data?.canUpload && !readOnly && folderPick ? (
            <Select value={folder} onValueChange={(v) => setFolder(v as HomeFolder)}>
              <SelectTrigger className="h-11 w-56" aria-label="Folder">
                <SelectValue placeholder="Pick a folder first" />
              </SelectTrigger>
              <SelectContent>
                {UPLOAD_FOLDERS.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {folderPick && !folder && data?.canUpload && !readOnly ? (
          <p className="text-sm text-muted-foreground">Pick a folder, then add the files.</p>
        ) : null}
        {canDrop ? <MultiFileUpload key={`${entityType}-${entityId}`} upload={upload} multiple={!fulfilsRequestId} label={dropLabel} onBusyChange={onUploadBusyChange} onResults={ids => {
          onUploaded?.(ids);
          const into = folderPick && !propertyLevel && folderRef.current ? uploadCategory(folderRef.current) : null;
          if (into && ids.length) {
            void Promise.all(ids.map((id) => fileInto({ data: { documentId: id, category: into } })))
              .catch((e: Error) => toast.message(`File saved. Its folder could not be set: ${e.message}`))
              .finally(() => void qc.invalidateQueries({ queryKey: ["home-files"] }));
          }
          for (const queryKey of attachmentUploadInvalidationKeys(entityType, entityId)) void qc.invalidateQueries({ queryKey });
        }}/> : null}

        {files.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : files.isError ? (
          <p className="text-sm text-muted-foreground">
            {files.error instanceof Error
              ? files.error.message
              : "These files could not be loaded."}
          </p>
        ) : data && shownFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No files yet.{" "}
            {data.recordClosed
              ? "This record is closed."
              : data.canUpload
                ? "Add the first one above."
                : ""}
          </p>
        ) : (
          groupByCategory ? (
            <div className="space-y-4">
              {groupedFiles.map((g) => (
                <section key={g.label} aria-label={g.label} className="space-y-1.5">
                  <h3 className="text-sm font-semibold">
                    {g.label} <span className="numeric font-normal text-muted-foreground">({g.files.length})</span>
                  </h3>
                  <ul className="divide-y divide-border rounded-md border border-border">{g.files.map(renderFile)}</ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">{shownFiles.map(renderFile)}</ul>
          )
        )}
      </CardContent>
    </Card>
  );
}
