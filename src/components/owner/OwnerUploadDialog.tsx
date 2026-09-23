/**
 * The homeowner's one upload flow. Every file lands on exactly one home's
 * property record (the shared document architecture); an Opportunity upload
 * is the same property file with an optional Opportunity link.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OWNER_UPLOAD_CATEGORIES, type AttachmentEntity, validateFile } from "@/lib/attachments";
import { beginUploadFn, completeUploadFn, tagOwnerUploadFn } from "@/lib/attachments.functions";

export type OwnerHome = { propertyId: string; name: string; address?: string | null };

export function OwnerUploadDialog({
  open,
  onOpenChange,
  homes,
  fixedPropertyId,
  opportunity,
  request,
  defaultCategory = "property_document",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Only homes this owner can reach. */
  homes: OwnerHome[];
  /** Set when a specific home (or an Opportunity's home) is already known. */
  fixedPropertyId?: string | null;
  opportunity?: { id: string; title: string } | null;
  /** A coordinator's document request being answered. */
  request?: { id: string; title: string; entityType: AttachmentEntity; entityId: string; propertyId: string | null } | null;
  defaultCategory?: string;
}) {
  const qc = useQueryClient();
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const tag = useServerFn(tagOwnerUploadFn);
  const known = request?.propertyId ?? fixedPropertyId ?? null;
  const [picked, setPicked] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(defaultCategory);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const propertyId = known ?? (homes.some((h) => h.propertyId === picked) ? picked : null);
  const home = homes.find((h) => h.propertyId === propertyId);
  const reset = () => { setPicked(""); setFiles([]); setNote(""); setCategory(defaultCategory); };

  const run = async () => {
    if (!propertyId || files.length === 0) return;
    const internal = OWNER_UPLOAD_CATEGORIES.find((c) => c.value === category)?.internal ?? "other";
    const { supabase } = await import("@/integrations/supabase/client");
    let done = 0;
    for (const file of files) {
      const check = validateFile({ name: file.name, type: file.type, size: file.size });
      if (!check.ok) { toast.error(`${file.name}: ${check.message}`); continue; }
      setBusy(`Uploading ${file.name}…`);
      try {
        const entityType: AttachmentEntity = request?.entityType ?? "property";
        const started = await begin({
          data: {
            entityType,
            entityId: request?.entityId ?? propertyId,
            uploadKey: crypto.randomUUID(),
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
            note: note.trim() || null,
            category: entityType === "property" ? internal : null,
            fulfilsRequestId: request?.id ?? null,
          },
        });
        if (!started.alreadyStored) {
          const put = await supabase.storage.from("resolve-attachments").uploadToSignedUrl(started.path, started.token!, file, { upsert: false });
          if (put.error) {
            await complete({ data: { documentId: started.documentId, ok: false, fulfilsRequestId: request?.id ?? null } });
            throw put.error;
          }
          await complete({ data: { documentId: started.documentId, ok: true, fulfilsRequestId: request?.id ?? null } });
        }
        await tag({ data: { documentId: started.documentId, ownerCategory: category, workItemId: opportunity?.id ?? null } });
        done += 1;
        if (request) break; // one file answers one request
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "Upload failed."}`);
      }
    }
    setBusy(null);
    if (done) {
      toast.success(done === 1 ? "File uploaded." : `${done} files uploaded.`);
      void qc.invalidateQueries({ queryKey: ["owner-documents"] });
      void qc.invalidateQueries({ queryKey: ["attachments"] });
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) { if (!o) reset(); onOpenChange(o); } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{request ? request.title : opportunity ? "Document your participation" : "Upload"}</DialogTitle>
          <DialogDescription>
            {opportunity ? `For the Opportunity “${opportunity.title}”. ` : null}
            Files are saved to one home and shared with your ARHA team.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {known ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">Uploading to</p>
              <p className="font-medium">{home?.name ?? "Your home"}</p>
              {home?.address ? <p className="text-muted-foreground">{home.address}</p> : null}
            </div>
          ) : (
            <div className="grid gap-1">
              <Label>Which property is this for?*</Label>
              <Select value={picked} onValueChange={setPicked}>
                <SelectTrigger aria-label="Which property is this for?"><SelectValue placeholder="Choose a home" /></SelectTrigger>
                <SelectContent>
                  {homes.map((h) => <SelectItem key={h.propertyId} value={h.propertyId}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-1">
            <Label htmlFor="owner-upload-files">Choose file(s)</Label>
            <Input id="owner-upload-files" type="file" multiple={!request} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </div>
          {!request ? (
            <div className="grid gap-1">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OWNER_UPLOAD_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid gap-1">
            <Label htmlFor="owner-upload-note">Description / note (optional)</Label>
            <Textarea id="owner-upload-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {busy ? <p className="text-sm text-muted-foreground">{busy}</p> : null}
        </div>
        <DialogFooter>
          <Button disabled={!propertyId || files.length === 0 || Boolean(busy)} onClick={() => void run()}>Upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
