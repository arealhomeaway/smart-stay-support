/**
 * Property page Part 3 (3.2): the Files tab. Six folders with counts (Design, Agreements,
 * Estimates and invoices, Photos, Inspections, Other), a search across folders, file cards with
 * previews and who added them when, and one upload that always picks a folder (never Other).
 * Design's old six buckets are groups inside Design and Photos. Owner sharing and re-share stay.
 * Rules: src/lib/home-details.ts; filing is move_home_file (staged).
 */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiFileUpload } from "@/components/MultiFileUpload";
import { createAttachmentUploader } from "@/lib/attachment-upload-client";
import { beginUploadFn, completeUploadFn, listAttachmentsFn, setAttachmentVisibilityFn } from "@/lib/attachments.functions";
import { homeFilesFn, moveHomeFileFn, type HomeFileRow } from "@/lib/home-details.functions";
import {
  DESIGN_SUBGROUPS,
  HOME_FOLDERS,
  PHOTO_SUBGROUPS,
  UPLOAD_FOLDERS,
  folderCounts,
  folderForCategory,
  searchFiles,
  uploadCategory,
  type HomeFolder,
} from "@/lib/home-details";
import { cn } from "@/lib/utils";
import { FileCard } from "./FileCard";

const label = (f: HomeFolder) => HOME_FOLDERS.find((x) => x.id === f)!.label;

export function HomeFilesTab({
  propertyId,
  folder,
  onFolder,
  canUpload,
  canMove,
  sharepointUrl,
}: {
  propertyId: string;
  folder: HomeFolder;
  onFolder: (f: HomeFolder) => void;
  canUpload: boolean;
  canMove: boolean;
  sharepointUrl: string | null;
}) {
  const qc = useQueryClient();
  const listHome = useServerFn(homeFilesFn);
  const listProperty = useServerFn(listAttachmentsFn);
  const files = useQuery({ queryKey: ["home-files", propertyId], queryFn: () => listHome({ data: { propertyId } }) });
  const shareInfo = useQuery({
    queryKey: ["attachments", "property", propertyId],
    queryFn: () => listProperty({ data: { entityType: "property", entityId: propertyId } }),
  });
  const shareable = useMemo(() => {
    const m = new Map<string, { can: boolean; shared: boolean; current: boolean }>();
    for (const f of (shareInfo.data?.files ?? []) as { id: string; can_share?: boolean; visibility?: string; owner_recipient_id?: string | null }[])
      m.set(f.id, { can: Boolean(f.can_share), shared: f.visibility === "owner_shared", current: Boolean(f.owner_recipient_id) });
    return m;
  }, [shareInfo.data]);

  const [query, setQuery] = useState("");
  const all = files.data ?? [];
  const counts = folderCounts(all);
  const found = query.trim() ? searchFiles(all, query) : null;
  const inFolder = all.filter((f) => folderForCategory(f.category) === folder);

  const share = useServerFn(setAttachmentVisibilityFn);
  const toggle = useMutation({
    mutationFn: (v: { documentId: string; shared: boolean }) => share({ data: { documentId: v.documentId, visibility: v.shared ? "owner_shared" : "internal" } }),
    onSuccess: () => {
      for (const k of [["attachments", "property", propertyId], ["home-files", propertyId], ["owner-files"], ["owner-home"]]) void qc.invalidateQueries({ queryKey: k });
    },
    onError: (e: Error) => toast.error(e.message || "Sharing could not be changed."),
  });
  const moveFn = useServerFn(moveHomeFileFn);
  const move = useMutation({
    mutationFn: (v: { documentId: string; category: string }) => moveFn({ data: v }),
    onSuccess: () => {
      toast.success("Moved.");
      void qc.invalidateQueries({ queryKey: ["home-files", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const footer = (f: HomeFileRow) => {
    const s = f.entity_type === "property" ? shareable.get(f.id) : undefined;
    return (
      <>
        {canMove ? (
          <Select value="" onValueChange={(v) => move.mutate({ documentId: f.id, category: v })}>
            <SelectTrigger className="h-11 w-auto min-w-[7rem]" aria-label={`Move ${f.original_filename ?? f.title ?? "file"}`}>
              <SelectValue placeholder="Move to" />
            </SelectTrigger>
            <SelectContent>
              {UPLOAD_FOLDERS.map((x) => (
                <SelectItem key={x.id} value={x.upload}>{x.label}</SelectItem>
              ))}
              {DESIGN_SUBGROUPS.filter((g) => g.value !== "design").map((g) => (
                <SelectItem key={g.value} value={g.value}>Design: {g.label}</SelectItem>
              ))}
              <SelectItem value="design_photo">Photos: Design photos</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
        {s?.can ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <label className="flex min-h-11 items-center gap-1.5">
              <Switch checked={s.shared && s.current} onCheckedChange={(shared) => toggle.mutate({ documentId: f.id, shared })} aria-label="Shared with the owner" />
              Owner
            </label>
            {s.shared ? (
              <Button size="sm" variant="outline" className="min-h-11" disabled={toggle.isPending} onClick={() => toggle.mutate({ documentId: f.id, shared: true })}>
                {s.current ? "Re-share" : "Share to current owner"}
              </Button>
            ) : null}
          </span>
        ) : null}
      </>
    );
  };
  const grid = (list: HomeFileRow[], showFolder = false) => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {list.map((f) => (
        <FileCard key={f.id} file={f} source={showFolder ? `${label(folderForCategory(f.category))}${f.task_title ? ` · ${f.task_title}` : ""}` : f.task_title} footer={footer(f)} />
      ))}
    </div>
  );
  const groups = folder === "design" ? DESIGN_SUBGROUPS : folder === "photos" ? PHOTO_SUBGROUPS : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input className="min-h-11 pl-9" aria-label="Search files" placeholder="Search files" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {sharepointUrl && /^https?:\/\//i.test(sharepointUrl) ? (
          <a href={sharepointUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
            Open the home folder in SharePoint <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      <div className="md:hidden">
        <Select value={folder} onValueChange={(v) => onFolder(v as HomeFolder)}>
          <SelectTrigger className="min-h-11" aria-label="Folder"><SelectValue /></SelectTrigger>
          <SelectContent>
            {HOME_FOLDERS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label} ({counts[f.id]})</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <ul className="hidden grid-cols-3 gap-2 md:grid lg:grid-cols-6" aria-label="Folders">
        {HOME_FOLDERS.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              aria-current={folder === f.id ? "page" : undefined}
              onClick={() => onFolder(f.id)}
              className={cn("surface flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm", folder === f.id && "ring-2 ring-primary")}
            >
              <span className="font-medium">{f.label}</span>
              <span className="numeric text-muted-foreground">{counts[f.id]}</span>
            </button>
          </li>
        ))}
      </ul>

      {canUpload ? <FolderUpload propertyId={propertyId} folder={folder} onFolder={onFolder} /> : null}

      {files.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading files…</p>
      ) : files.isError ? (
        <p role="alert" className="text-sm text-destructive">These files could not be loaded.</p>
      ) : found ? (
        <section aria-label="Files found" className="space-y-2">
          <h2 className="font-semibold">Found {found.length}</h2>
          {found.length ? grid(found, true) : <p className="text-sm text-muted-foreground">No file matches.</p>}
        </section>
      ) : (
        <section aria-label={label(folder)} className="space-y-4">
          <h2 className="font-display text-xl">{label(folder)}</h2>
          {folder === "other" ? <p className="text-sm text-muted-foreground">Files from before the folders. Move each one to its folder; nothing new goes here.</p> : null}
          {inFolder.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in this folder yet.</p>
          ) : groups ? (
            groups.map((g) => {
              const list = inFolder.filter((f) => f.category === g.value);
              if (!list.length) return null;
              return (
                <div key={g.value} className="space-y-2">
                  <h3 className="text-sm font-semibold">{g.label} <span className="numeric font-normal text-muted-foreground">({list.length})</span></h3>
                  {grid(list)}
                </div>
              );
            })
          ) : (
            grid(inFolder)
          )}
        </section>
      )}
    </div>
  );
}

function FolderUpload({ propertyId, folder, onFolder }: { propertyId: string; folder: HomeFolder; onFolder: (f: HomeFolder) => void }) {
  const qc = useQueryClient();
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const target: HomeFolder | "" = folder === "other" ? "" : folder;
  const [group, setGroup] = useState<string>("");
  const groups = target === "design" ? DESIGN_SUBGROUPS : target === "photos" ? PHOTO_SUBGROUPS : null;
  const cat = useRef<string | null>(null);
  cat.current = target ? uploadCategory(target, group || null) : null;
  const [upload] = useState(() =>
    createAttachmentUploader(begin, complete, (file, key) => ({
      entityType: "property",
      entityId: propertyId,
      uploadKey: key,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      category: cat.current,
      fulfilsRequestId: null,
    })),
  );
  return (
    <section className="surface space-y-3 p-4" aria-label="Add files">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">Add files to</p>
        <Select value={target} onValueChange={(v) => { setGroup(""); onFolder(v as HomeFolder); }}>
          <SelectTrigger className="h-11 w-56" aria-label="Folder for new files"><SelectValue placeholder="Pick a folder first" /></SelectTrigger>
          <SelectContent>
            {UPLOAD_FOLDERS.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {groups ? (
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="h-11 w-56" aria-label="Group"><SelectValue placeholder="Group (optional)" /></SelectTrigger>
            <SelectContent>
              {groups.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      {target ? (
        <MultiFileUpload
          key={`${target}-${group}`}
          upload={upload}
          label="Drop files here or choose them"
          onResults={() => {
            for (const k of [["home-files", propertyId], ["attachments", "property", propertyId]]) void qc.invalidateQueries({ queryKey: k });
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Pick a folder, then add the files. Nothing new goes into Other.</p>
      )}
    </section>
  );
}
