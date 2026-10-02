/**
 * Files on a ticket or an onboarding task.
 *
 * Everything shown here has already been decided server-side: the list only
 * contains files this person may see, and each action re-checks on the server
 * before anything happens. A retried upload reuses its own upload key, so a
 * second attempt never leaves a second row behind.
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
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  ALLOWED_MIME_TYPES,
  attachmentUploadInvalidationKeys,
  type AttachmentEntity,
  DOCUMENT_CATEGORIES,
  documentCategoryLabel,
  ownerCategoryLabel,
  formatBytes,
  MAX_FILE_BYTES,
  validateFile,
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

type Props = {
  entityType: AttachmentEntity;
  entityId: string;
  /** Owners uploading against a specific staff request pass its id. */
  fulfilsRequestId?: string | null;
  title?: string;
  description?: string;
  /** History view: show what is on file, but never a second uploader. */
  readOnly?: boolean;
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
}: Props) {
  const propertyLevel = entityType === "property";
  const [category, setCategory] = useState<string>("reference");
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [retry, setRetry] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const uploadAttempt = useRef<{
    file: File;
    key: string;
    category: string | null;
    requestId: string | null;
    bytesUploaded: boolean;
  } | null>(null);

  const list = useServerFn(listAttachmentsFn);
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const urlFor = useServerFn(attachmentUrlFn);
  const remove = useServerFn(removeAttachmentFn);
  const share = useServerFn(setAttachmentVisibilityFn);

  const key = ["attachments", entityType, entityId];
  const files = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { entityType, entityId } }),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const check = validateFile({ name: file.name, type: file.type, size: file.size });
      if (!check.ok) throw new Error(check.message);

      if (uploadAttempt.current?.file !== file) {
        uploadAttempt.current = {
          file,
          key: crypto.randomUUID(),
          category: propertyLevel ? category : null,
          requestId: fulfilsRequestId,
          bytesUploaded: false,
        };
      }
      const attempt = uploadAttempt.current;
      const uploadKey = attempt.key;
      setProgress({ name: file.name, pct: 5 });
      const started = await begin({
        data: {
          entityType,
          entityId,
          uploadKey,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          category: attempt.category,
          fulfilsRequestId: attempt.requestId,
        },
      });
      if (started.alreadyStored) return { skipped: true as const };

      setProgress({ name: file.name, pct: 5 });
      try {
        if (!attempt.bytesUploaded) {
          const { uploadToSignedSlot } = await import("@/lib/signed-upload");
          await uploadToSignedSlot(started.path, started.token!, file, (pct) =>
            setProgress({ name: file.name, pct: 5 + Math.round(pct * 0.85) }),
          );
          attempt.bytesUploaded = true;
        }
      } catch (err) {
        uploadAttempt.current = null;
        await complete({
          data: { documentId: started.documentId!, ok: false, fulfilsRequestId: attempt.requestId },
        });
        throw err instanceof Error ? err : new Error("The upload did not finish.");
      }

      setProgress({ name: file.name, pct: 95 });
      await complete({
        data: { documentId: started.documentId!, ok: true, fulfilsRequestId: attempt.requestId },
      });
      return { skipped: false as const };
    },
    onSuccess: (r) => {
      setProgress(null);
      setRetry(null);
      uploadAttempt.current = null;
      toast.success(r.skipped ? "That file was already on this record." : "File added.");
      for (const queryKey of attachmentUploadInvalidationKeys(entityType, entityId)) {
        void qc.invalidateQueries({ queryKey });
      }
    },
    onError: (err, file) => {
      setProgress(null);
      setRetry(file);
      toast.error(err instanceof Error ? err.message : "The upload failed.");
    },
  });

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
  const canDrop = Boolean(data?.canUpload) && !readOnly;

  return (
    <Card
      onDragOver={(e) => {
        if (!canDrop) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canDrop) return;
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) upload.mutate(f);
      }}
      className={dragging ? "border-primary ring-2 ring-primary/30" : undefined}
    >

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
          {data?.canUpload && propertyLevel ? (
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9 w-56" aria-label="Document type">
                <SelectValue placeholder="Document type" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {data?.canUpload && !readOnly ? (
            <Button size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}{" "}
              Add file
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ALLOWED_MIME_TYPES.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) upload.mutate(f);
          }}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        {canDrop ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`w-full rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
              dragging
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/60"
            }`}
          >
            Drag a photo or document here, or click to choose one.
          </button>
        ) : null}

        {progress ? (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Uploading {progress.name}…</p>
            <Progress value={progress.pct} />
          </div>
        ) : null}

        {retry && !upload.isPending ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
            <span className="flex-1">{retry.name} did not finish uploading.</span>
            <Button size="sm" variant="outline" onClick={() => upload.mutate(retry)}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRetry(null)}>
              Dismiss
            </Button>
          </div>
        ) : null}

        {files.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : files.isError ? (
          <p className="text-sm text-muted-foreground">
            {files.error instanceof Error
              ? files.error.message
              : "These files could not be loaded."}
          </p>
        ) : data && data.files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No files yet.{" "}
            {data.recordClosed
              ? "This record is closed."
              : data.canUpload
                ? "Add the first one above."
                : ""}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {(data?.files ?? []).map((f) => (
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
                    {formatBytes(f.size_bytes ?? 0)} · {f.uploaded_by_name ?? "—"} ·{" "}
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
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => open.mutate({ documentId: f.id, download: true })}
                    >
                      <Download className="size-4" />
                    </Button>
                  </>
                ) : null}
                {f.can_delete ? (
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(f.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
