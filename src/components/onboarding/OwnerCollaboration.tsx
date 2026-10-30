/**
 * ARHA-provided owner collaboration: the one editor and status view used from
 * both the property Overview and inside an internal Task. The Opportunity is
 * the homeowner's side of the work; the internal Task keeps its own status and
 * is never blocked by it. Resources are links to existing home files (or new
 * files added to the home's library) — never copies.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Link2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RESPONSE_TYPES,
  opportunityResourceUrl,
  readOwnerCollaboration,
  saveArhaOpportunity,
  setOwnerAttention,
  type OpportunityContent,
  type ResourceInput,
  type ResponseType,
} from "@/lib/v2-workflow.functions";
import { attachmentUrlFn, beginUploadFn, completeUploadFn } from "@/lib/attachments.functions";
import { MultiFileUpload } from "@/components/MultiFileUpload";
import { createAttachmentUploader } from "@/lib/attachment-upload-client";
import { OpportunityCreationReceipt } from "@/lib/create-opportunity-priority";

const LINK_TYPES = { video: "Video", document: "Document", reference: "Reference", other: "Other" } as const;

import { ExistingFilePicker, SortableResourceList, ViewPropertyFilesLink } from "@/components/onboarding/ResourceControls";
import { ownerPrograms } from "@/lib/owner-program.functions";
import { OwnerConversation } from "@/components/OwnerConversation";

export type CollabData = Awaited<ReturnType<typeof readOwnerCollaboration>>;
export type CollabOpp = CollabData["opportunities"][number];

export function useOwnerCollaboration(propertyId: string) {
  const read = useServerFn(readOwnerCollaboration);
  return useQuery({ queryKey: ["owner-collaboration", propertyId], queryFn: () => read({ data: { propertyId } }) });
}

function when(ts: string | null | undefined) {
  if (!ts) return null;
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Where the homeowner is with it — separate from the internal Task's status. */
export function ownerState(o: CollabOpp) {
  if (o.status === "draft") return "Draft — not visible to the homeowner";
  if (o.status === "complete") return `Completed ${when(o.completed_at) ?? ""}`.trim();
  if (o.responded_at) return `Owner responded ${when(o.responded_at)}`;
  if (o.viewed_at) return `Viewed ${when(o.viewed_at)} · awaiting response`;
  if (o.sent_at) return `Sent ${when(o.sent_at)} · not opened yet`;
  return "Sent · awaiting homeowner"; // older records have no send time
}


/** Staff-only owner-priority flag. Separate from workflow status. */
function OwnerPriorityControl({ o }: { o: CollabOpp }) {
  const qc = useQueryClient();
  const setFn = useServerFn(setOwnerAttention);
  const m = useMutation({
    mutationFn: (on: boolean) => setFn({ data: { id: o.id, on } }),
    onSuccess: (_r, on) => {
      toast.success(on ? "Added to the owner's Needs Your Attention queue." : "Removed from Needs Your Attention.");
      void qc.invalidateQueries({ queryKey: ["owner-collaboration", o.property_id] });
      void qc.invalidateQueries({ queryKey: ["owner-opportunities"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not change owner priority"),
  });
  if (o.status === "draft" || o.status === "complete") return null;
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs font-medium">Owner Priority</p>
      <label className="mt-1 flex items-start gap-2 text-sm">
        <Checkbox
          checked={Boolean(o.needs_owner_attention)}
          disabled={m.isPending}
          onCheckedChange={(c) => m.mutate(c === true)}
          aria-label="Needs Owner Attention"
        />
        <span>
          Needs Owner Attention
          <span className="block text-xs text-muted-foreground">
            Adds this Opportunity to the owner&apos;s Needs Your Attention queue. This does not change the Opportunity&apos;s workflow status.
          </span>
        </span>
      </label>
    </div>
  );
}

export function OpportunityDetail({ o, files, readOnly = false }: { o: CollabOpp; files: CollabData["files"]; readOnly?: boolean }) {
  const openRes = useServerFn(opportunityResourceUrl);
  const ownerDocs = files.filter((f) => f.workItemId === o.id);
  const fileUrl = useServerFn(attachmentUrlFn);
  // Homeowner-submitted files stay openable after the Opportunity is complete;
  // the shared attachment rule decides access — opening never reopens work.
  const openOwnerDoc = async (documentId: string, download: boolean) => {
    const w = window.open("", "_blank");
    try {
      const r = await fileUrl({ data: { documentId, download } });
      if (w) w.location.href = r.url;
      else window.location.href = r.url;
    } catch (e) {
      w?.close();
      toast.error(e instanceof Error ? e.message : "Resolve could not open that file.");
    }
  };
  return (
    <div className="space-y-2 text-sm">
      <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-4">
        <div><dt>Sent</dt><dd className="text-foreground">{when(o.sent_at) ?? (o.status === "draft" ? "Not sent" : "—")}</dd></div>
        <div><dt>Viewed</dt><dd className="text-foreground">{when(o.viewed_at) ?? "Not yet"}</dd></div>
        <div><dt>Responded</dt><dd className="text-foreground">{when(o.responded_at) ?? "Not yet"}</dd></div>
        <div><dt>Completed</dt><dd className="text-foreground">{when(o.completed_at) ?? "Not yet"}</dd></div>
      </dl>
      {o.response_types.length ? (
        <p className="text-xs text-muted-foreground">
          Asks for: {o.response_types.map((t) => RESPONSE_TYPES.find((r) => r.code === t)?.label ?? t).join(", ")}
        </p>
      ) : null}
      {o.resources.length ? (
        <div>
          <p className="text-xs font-medium">Resources shared with the homeowner</p>
          <ul className="mt-1 space-y-1">
            {o.resources.map((r) => (
              <li key={r.id}>
                {r.kind === "file" ? (
                  <button
                    type="button"
                    className="flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                    onClick={async () => {
                      try { window.open((await openRes({ data: { resourceId: r.id } })).url, "_blank", "noopener"); }
                      catch (e) { toast.error(e instanceof Error ? e.message : "Could not open the file."); }
                    }}
                  >
                    <FileText className="size-3.5" /> {r.label}
                  </button>
                ) : (
                  <a href={r.url ?? "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                    <Link2 className="size-3.5" /> {r.label}
                  </a>
                )}
                {r.kind === "link" && r.note ? <p className="pl-5 text-xs text-muted-foreground">{r.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {readOnly ? null : <OwnerPriorityControl o={o} />}
      {o.status !== "draft" ? (
        <OwnerConversation
          workItemId={o.id}
          status={o.status}
          legacy={o.owner_response}
          viewer="staff"
          readOnly={readOnly}
          refreshKeys={[["owner-collaboration", o.property_id], ["onboarding"]]}
        />
      ) : null}
      {o.owner_response.filter((r) => r.task_approval).slice(-1).map((r, i) => (
        <p key={i} className="text-xs font-medium">
          {r.task_approval === "approved"
            ? "Owner approval on this Task: approved — the Task can proceed."
            : "Owner approval on this Task: still waiting for the homeowner's authorization."}
        </p>
      ))}
      {ownerDocs.length ? (
        <div>
          <p className="text-xs font-medium">Homeowner documentation</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {ownerDocs.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  onClick={() => openOwnerDoc(f.id, false)}
                >
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  {f.title}
                </button>
                <span className="text-muted-foreground">· {when(f.uploadedAt)}</span>
                <button
                  type="button"
                  className="text-muted-foreground underline-offset-2 hover:underline"
                  aria-label={`Download ${f.title}`}
                  onClick={() => openOwnerDoc(f.id, true)}
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY = { title: "", what: "", why: "", how: "", ways: "", minutes: "", task: "none" };

export function OpportunityEditor({
  propertyId,
  data,
  editing,
  fixedTaskId,
  defaultTitle,
  defaultResponseType,
  onClose,
  operations,
}: {
  propertyId: string;
  data: CollabData | undefined;
  editing: CollabOpp | "new" | null;
  fixedTaskId?: string | null;
  defaultTitle?: string;
  /** From the Task's owner dependency — a starting point Kati can change. */
  defaultResponseType?: ResponseType | undefined;
  onClose: () => void;
  operations?: { kind: 'owner_task' | 'review'; ticketId: string | null; ready: boolean; onSent: () => void };
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveArhaOpportunity);
  const attention = useServerFn(setOwnerAttention);
  const [priority, setPriority] = useState(false);
  const creation = useRef(new OpportunityCreationReceipt());
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const [form, setForm] = useState(EMPTY);
  const [types, setTypes] = useState<ResponseType[]>(["acknowledge"]);
  const [resources, setResources] = useState<ResourceInput[]>([]);
  const EMPTY_LINK = { label: "", url: "", note: "", type: "video" as "video" | "document" | "reference" | "other" };
  const [link, setLink] = useState(EMPTY_LINK);
  const [uploading, setUploading] = useState(false);
  const [uploadedIds, setUploadedIds] = useState<string[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [dueOn, setDueOn] = useState('');

  // Load the form when the dialog opens for a different record.
  const key = editing === null ? null : editing === "new" ? "new" : editing.id;
  if (key !== loadedFor) {
    setLoadedFor(key);
    setPriority(false);
    creation.current = new OpportunityCreationReceipt();
    if (editing === "new") {
      setForm({ ...EMPTY, title: defaultTitle ?? "", task: fixedTaskId ?? "none" });
      setTypes([defaultResponseType ?? "acknowledge"]);
      setResources([]);
    } else if (editing) {
      const c = editing.owner_content;
      setForm({
        title: editing.title,
        what: c?.what ?? "",
        why: c?.why ?? "",
        how: c?.how ?? "",
        ways: c?.ways_to_document ?? "",
        minutes: c?.suggested_minutes ? String(c.suggested_minutes / 60) : "",
        task: fixedTaskId ?? editing.taskId ?? "none",
      });
      setTypes(editing.response_types.length ? editing.response_types : ["acknowledge"]);
      setResources(
        editing.resources.map((r) =>
          r.kind === "file" && r.documentId ? { kind: "file", document_id: r.documentId } : { kind: "link", label: r.label, url: r.url ?? "", note: r.note ?? undefined, resource_type: (r.resourceType ?? undefined) as "video" | "document" | "reference" | "other" | undefined },
        ),
      );
    }
    setLink(EMPTY_LINK);
    setUploadedIds([]);
  }

  const files = data?.files ?? [];
  const fileName = (id: string) => files.find((f) => f.id === id)?.title ?? "File";

  const mutation = useMutation({
    mutationFn: (send: boolean) => {
      const content: OpportunityContent = {
        title: form.title.trim(),
        what: form.what.trim(),
        why: form.why.trim(),
        how: form.how.trim(),
        resources: [],
        ways_to_document: form.ways.trim(),
        suggested_minutes: form.minutes ? Math.round(Number(form.minutes) * 60) : null,
      };
      const input = {
          id: editing && editing !== "new" ? editing.id : null,
          propertyId,
          sourceTaskId: form.task === "none" ? null : form.task,
          content,
          responseTypes: types,
          resources,
          send,
          ...(operations ? { operations: { kind: operations.kind, ticketId: operations.ticketId, dueOn } } : {}),
      };
      return editing === "new"
        ? creation.current.save(input, priority, data => save({ data }), (id, on) => attention({ data: { id, on } }))
        : save({ data: input });
    },
    onSuccess: (_r, send) => {
      const wasDraft = editing === "new" || editing?.status === "draft";
      toast.success(send && wasDraft ? "Opportunity sent to the homeowner." : send ? "Changes saved." : "Draft saved.");
      onClose();
      operations?.onSent();
      void qc.invalidateQueries({ queryKey: ["owner-collaboration", propertyId] });
      void qc.invalidateQueries({ queryKey: ["property-opportunities", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadIntent = useRef((file: File, key: string) => ({ entityType: "property" as const, entityId: propertyId, uploadKey: key, filename: file.name, mimeType: file.type, sizeBytes: file.size, category: null }));
  uploadIntent.current = (file: File, key: string) => ({ entityType: "property" as const, entityId: propertyId, uploadKey: key, filename: file.name, mimeType: file.type, sizeBytes: file.size, category: null });
  const [upload] = useState(() => createAttachmentUploader(begin, complete, (file, key) => uploadIntent.current(file, key)));

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isDraft = editing === "new" || (editing && editing.status === "draft");
  const canSubmit = form.title.trim().length >= 3 && types.length > 0 && !mutation.isPending && !uploading;

  const body = (
      <>
        <DialogHeader>
          <DialogTitle>{operations ? `${preview ? '3. Preview' : '2. Fill in'}: ${operations.kind === 'review' ? 'For review' : 'Owner task'}` : editing === "new" ? "Create Opportunity" : "Edit Opportunity"}</DialogTitle>
          <DialogDescription>Written for the homeowner. It never blocks or changes the internal Task.</DialogDescription>
        </DialogHeader>
        {preview && operations ? <section aria-label="Homeowner preview" className="space-y-4 whitespace-pre-wrap">
          <h3 className="text-xl font-semibold">{form.title}</h3>
          {([['What you\'ll do',form.what],['Why this matters',form.why],['How to complete it',form.how]] as const).map(([label,value])=><div key={label}><h4 className="text-sm font-semibold">{label}</h4><p>{value}</p></div>)}
          {dueOn ? <p>Due {dueOn}</p> : null}
          <p>{operations.kind==='review'?"I've reviewed this":types.map(t=>RESPONSE_TYPES.find(r=>r.code===t)?.label).join(', ')}</p>
          <ul>{resources.map((r,i)=><li key={i}>{r.kind==='file'?fileName(r.document_id):r.label}</li>)}</ul>
          {priority?<p>Needs your attention</p>:null}
        </section> : <div className="grid gap-3">
          <div className="grid gap-1"><Label htmlFor="op-title">Opportunity title</Label><Input id="op-title" value={form.title} onChange={set("title")} placeholder="Review your floor plans" /></div>
          <div className="grid gap-1"><Label htmlFor="op-what">What you&apos;ll do</Label><Textarea id="op-what" rows={3} value={form.what} onChange={set("what")} /></div>
          <div className="grid gap-1"><Label htmlFor="op-why">Why this matters</Label><Textarea id="op-why" rows={2} value={form.why} onChange={set("why")} /></div>
          <div className="grid gap-1"><Label htmlFor="op-how">How to complete it</Label><Textarea id="op-how" rows={3} value={form.how} onChange={set("how")} /></div>
          {editing === "new" ? <label className="flex items-center gap-2 text-sm"><Checkbox checked={priority} onCheckedChange={value => setPriority(value === true)} aria-label="Owner priority" />Owner priority</label> : null}

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">How the homeowner responds</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {RESPONSE_TYPES.filter(t=>!operations||operations.kind!=='review'||t.code==='acknowledge').map((t) => (
                <label key={t.code} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={types.includes(t.code)}
                    onCheckedChange={(v) => setTypes((cur) => (v ? [...cur, t.code] : cur.filter((x) => x !== t.code)))}
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>
          {operations ? <div className="grid gap-1"><Label htmlFor="op-due">Due date (optional)</Label><Input id="op-due" type="date" value={dueOn} onChange={e=>setDueOn(e.target.value)}/></div> : null}

          <div className="grid gap-2">
            <Label>Resources for the homeowner</Label>
            {resources.length ? (
              <>
                <SortableResourceList resources={resources} onChange={setResources} fileName={fileName} />
                <p className="text-xs text-muted-foreground">Drag the handle to set the order the homeowner sees. Saved when you save the Opportunity.</p>
              </>
            ) : <p className="text-xs text-muted-foreground">No resources yet.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <ExistingFilePicker
                files={files}
                attached={new Set(resources.flatMap((r) => (r.kind === "file" ? [r.document_id] : [])))}
                onAttach={(ids) => setResources((cur) => [...cur, ...ids.filter((id) => !cur.some((r) => r.kind === "file" && r.document_id === id)).map((id) => ({ kind: "file" as const, document_id: id }))])}
              />
              <ViewPropertyFilesLink propertyId={propertyId} />
            </div>
            {editing !== null ? <MultiFileUpload key={key} autoStart upload={upload} onBusyChange={setUploading} disabled={mutation.isPending} onResults={ids => {
              setResources(cur => [...cur.filter(r => r.kind !== "file" || !uploadedIds.includes(r.document_id)), ...ids.map(id => ({ kind: "file" as const, document_id: id }))]);
              setUploadedIds(ids);
              void qc.invalidateQueries({ queryKey: ["owner-collaboration", propertyId] });
            }}/> : null}
            <div className="grid gap-2 rounded-md border border-dashed border-border p-2">
              <p className="text-xs text-muted-foreground">Or add a link — for large videos kept in your approved file-sharing location. Resolve links to it; it never copies it.</p>
              <div className="flex flex-wrap gap-2">
                <Input className="min-w-40 flex-1" aria-label="Link display name" placeholder="Display name, e.g. Pre-Work Walkthrough" value={link.label} onChange={(e) => setLink((l) => ({ ...l, label: e.target.value }))} />
                <Select value={link.type} onValueChange={(v) => setLink((l) => ({ ...l, type: v as typeof l.type }))}>
                  <SelectTrigger className="w-36" aria-label="Link type"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(LINK_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input aria-label="Link address" placeholder="https://…" value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} />
              <Input aria-label="Link note" placeholder="Short note (optional)" value={link.note} onChange={(e) => setLink((l) => ({ ...l, note: e.target.value }))} />
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!link.label.trim() || !/^https:\/\/\S+$/i.test(link.url.trim())}
                  onClick={() => { setResources((cur) => [...cur, { kind: "link", label: link.label.trim(), url: link.url.trim(), note: link.note.trim() || undefined, resource_type: link.type }]); setLink(EMPTY_LINK); }}
                >
                  <Plus className="size-3.5" /> Add link
                </Button>
                {link.url.trim() && !/^https:\/\/\S+$/i.test(link.url.trim()) ? <span className="ml-2 text-xs text-destructive">Use a secure address starting with https://</span> : null}
              </div>
            </div>
          </div>

          {operations ? null : <><div className="grid gap-1"><Label htmlFor="op-ways">Ways to document your participation</Label><Textarea id="op-ways" rows={2} value={form.ways} onChange={set("ways")} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1"><Label htmlFor="op-min">Suggested time (hours, optional)</Label><Input id="op-min" type="number" min={0} step={0.25} value={form.minutes} onChange={set("minutes")} /></div>
            {fixedTaskId ? null : (
              <div className="grid gap-1">
                <Label>Related internal Task (optional)</Label>
                <Select value={form.task} onValueChange={(v) => setForm((f) => ({ ...f, task: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(data?.tasks ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div></>}
        </div>}
        {operations && !operations.ready ? <p role="status" className="text-sm text-muted-foreground">Operations sending will be available after the approved update. Nothing has been sent.</p> : null}
        {uploading ? <p role="status" className="text-sm text-muted-foreground">Files are still uploading. Sending unlocks when every file shows Done, or remove the cause shown under any file marked Failed.</p> : null}
        <DialogFooter className="gap-2">
          {operations ? <><Button variant="outline" disabled={mutation.isPending} onClick={()=>preview?setPreview(false):onClose()}>Back</Button>{preview?<Button disabled={!canSubmit||!operations.ready} onClick={()=>mutation.mutate(true)}>{mutation.isPending?'Sending...':'Send'}</Button>:<Button disabled={!canSubmit} onClick={()=>setPreview(true)}>Preview</Button>}</> : <>{isDraft ? <Button variant="outline" disabled={!canSubmit || (editing === "new" && priority)} onClick={() => mutation.mutate(false)}>Save draft</Button> : null}
          <Button disabled={!canSubmit} onClick={() => mutation.mutate(true)}>{isDraft ? "Send to homeowner" : "Save changes"}</Button></>}
        </DialogFooter>
      </>
  );
  return operations ? body : (
    <Dialog open={editing !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {body}
      </DialogContent>
    </Dialog>
  );
}

/** Owner Collaboration inside one internal Task. Hidden when the home has no Active Owner program. */
export function TaskOwnerCollaboration({ propertyId, taskId, taskTitle, defaultResponseType }: { propertyId: string; taskId: string; taskTitle: string; defaultResponseType?: ResponseType | undefined }) {
  const loadPrograms = useServerFn(ownerPrograms);
  const programs = useQuery({ queryKey: ["owner-programs", "property", propertyId], queryFn: () => loadPrograms({ data: {} }) });
  const enrolled = (programs.data?.rows ?? []).some((p) => p.properties.some((h) => h.id === propertyId));
  const q = useOwnerCollaboration(propertyId);
  const [editing, setEditing] = useState<CollabOpp | "new" | null>(null);
  if (!enrolled) return null;
  const mine = (q.data?.opportunities ?? []).filter((o) => o.taskId === taskId);
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">Owner collaboration</p>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}><Plus className="size-3.5" /> Create Opportunity</Button>
      </div>
      <p className="text-xs text-muted-foreground">What you ask the homeowner to review, provide or decide. This Task&apos;s status stays yours — the homeowner&apos;s response never blocks it.</p>
      {mine.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Opportunity for the homeowner on this Task.</p>
      ) : (
        <ul className="space-y-2">
          {mine.map((o) => (
            <li key={o.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{o.title}</p>
                  <p className="text-xs text-muted-foreground">{ownerState(o)}</p>
                </div>
                {o.status !== "complete" ? <Button size="sm" variant="ghost" onClick={() => setEditing(o)}>Edit</Button> : null}
              </div>
              <div className="mt-2"><OpportunityDetail o={o} files={q.data?.files ?? []} /></div>
            </li>
          ))}
        </ul>
      )}
      <OpportunityEditor propertyId={propertyId} data={q.data} editing={editing} fixedTaskId={taskId} defaultTitle={`Review: ${taskTitle}`} defaultResponseType={defaultResponseType} onClose={() => setEditing(null)} />
    </section>
  );
}
