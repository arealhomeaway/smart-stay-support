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
  type OpportunityContent,
  type ResourceInput,
  type ResponseType,
} from "@/lib/v2-workflow.functions";
import { beginUploadFn, completeUploadFn } from "@/lib/attachments.functions";
import { validateFile } from "@/lib/attachments";

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

const DECISION_LABEL: Record<string, string> = { authorize: "Authorized", changes: "Requested changes" };

export function OpportunityDetail({ o, files }: { o: CollabOpp; files: CollabData["files"] }) {
  const openRes = useServerFn(opportunityResourceUrl);
  const ownerDocs = files.filter((f) => f.workItemId === o.id);
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
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {o.owner_response.length ? (
        <div>
          <p className="text-xs font-medium">Homeowner responses</p>
          <ul className="mt-1 space-y-1">
            {o.owner_response.map((r, i) => (
              <li key={i} className="rounded-md bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground">
                  {r.kind === "decision" ? DECISION_LABEL[r.decision ?? ""] ?? "Decision" : r.kind === "acknowledge" ? "Acknowledged" : "Feedback"} · {when(r.at)}
                </p>
                {r.text ? <p className="whitespace-pre-wrap">{r.text}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {ownerDocs.length ? (
        <div>
          <p className="text-xs font-medium">Homeowner documentation</p>
          <ul className="mt-1 space-y-0.5 text-xs">{ownerDocs.map((f) => <li key={f.id}>{f.title} · {when(f.uploadedAt)}</li>)}</ul>
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
  onClose,
}: {
  propertyId: string;
  data: CollabData | undefined;
  editing: CollabOpp | "new" | null;
  fixedTaskId?: string | null;
  defaultTitle?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveArhaOpportunity);
  const begin = useServerFn(beginUploadFn);
  const complete = useServerFn(completeUploadFn);
  const [form, setForm] = useState(EMPTY);
  const [types, setTypes] = useState<ResponseType[]>(["acknowledge"]);
  const [resources, setResources] = useState<ResourceInput[]>([]);
  const [link, setLink] = useState({ label: "", url: "" });
  const [pick, setPick] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the form when the dialog opens for a different record.
  const key = editing === null ? null : editing === "new" ? "new" : editing.id;
  if (key !== loadedFor) {
    setLoadedFor(key);
    if (editing === "new") {
      setForm({ ...EMPTY, title: defaultTitle ?? "", task: fixedTaskId ?? "none" });
      setTypes(["acknowledge"]);
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
          r.kind === "file" ? { kind: "file", document_id: r.documentId! } : { kind: "link", label: r.label, url: r.url ?? "" },
        ),
      );
    }
    setLink({ label: "", url: "" });
    setPick("");
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
      return save({
        data: {
          id: editing && editing !== "new" ? editing.id : null,
          propertyId,
          sourceTaskId: form.task === "none" ? null : form.task,
          content,
          responseTypes: types,
          resources,
          send,
        },
      });
    },
    onSuccess: (_r, send) => {
      const wasDraft = editing === "new" || editing?.status === "draft";
      toast.success(send && wasDraft ? "Opportunity sent to the homeowner." : send ? "Changes saved." : "Draft saved.");
      onClose();
      void qc.invalidateQueries({ queryKey: ["owner-collaboration", propertyId] });
      void qc.invalidateQueries({ queryKey: ["property-opportunities", propertyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function upload(file: File) {
    const check = validateFile({ name: file.name, type: file.type, size: file.size });
    if (!check.ok) { toast.error(check.message); return; }
    setUploading(true);
    try {
      const started = await begin({
        data: { entityType: "property", entityId: propertyId, uploadKey: crypto.randomUUID(), filename: file.name, mimeType: file.type, sizeBytes: file.size, category: null },
      });
      if (!started.documentId) throw new Error("The upload could not start.");
      const { supabase } = await import("@/integrations/supabase/client");
      const put = await supabase.storage.from("resolve-attachments").uploadToSignedUrl(started.path!, started.token!, file, { upsert: false });
      await complete({ data: { documentId: started.documentId, ok: !put.error } });
      if (put.error) throw put.error;
      setResources((r) => [...r, { kind: "file", document_id: started.documentId! }]);
      await qc.invalidateQueries({ queryKey: ["owner-collaboration", propertyId] });
      toast.success("File added to this home's files and attached.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The upload did not finish.");
    } finally {
      setUploading(false);
    }
  }

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isDraft = editing === "new" || (editing && editing.status === "draft");
  const canSubmit = form.title.trim().length >= 3 && types.length > 0 && !mutation.isPending && !uploading;

  return (
    <Dialog open={editing !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing === "new" ? "Create Opportunity" : "Edit Opportunity"}</DialogTitle>
          <DialogDescription>Written for the homeowner. It never blocks or changes the internal Task.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1"><Label htmlFor="op-title">Opportunity title</Label><Input id="op-title" value={form.title} onChange={set("title")} placeholder="Review your floor plans" /></div>
          <div className="grid gap-1"><Label htmlFor="op-what">What you&apos;ll do</Label><Textarea id="op-what" rows={3} value={form.what} onChange={set("what")} /></div>
          <div className="grid gap-1"><Label htmlFor="op-why">Why this matters</Label><Textarea id="op-why" rows={2} value={form.why} onChange={set("why")} /></div>
          <div className="grid gap-1"><Label htmlFor="op-how">How to complete it</Label><Textarea id="op-how" rows={3} value={form.how} onChange={set("how")} /></div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">How the homeowner responds</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {RESPONSE_TYPES.map((t) => (
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

          <div className="grid gap-2">
            <Label>Resources for the homeowner</Label>
            {resources.length ? (
              <ul className="space-y-1">
                {resources.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-sm">
                    <span className="flex min-w-0 items-center gap-1 truncate">
                      {r.kind === "file" ? <FileText className="size-3.5 shrink-0" /> : <Link2 className="size-3.5 shrink-0" />}
                      {r.kind === "file" ? fileName(r.document_id) : `${r.label} — ${r.url}`}
                    </span>
                    <Button size="icon" variant="ghost" aria-label="Remove resource" onClick={() => setResources((cur) => cur.filter((_, j) => j !== i))}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">No resources yet.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Select value={pick} onValueChange={(v) => { setPick(""); if (!resources.some((r) => r.kind === "file" && r.document_id === v)) setResources((cur) => [...cur, { kind: "file", document_id: v }]); }}>
                <SelectTrigger className="w-64"><SelectValue placeholder="Choose an existing file…" /></SelectTrigger>
                <SelectContent>
                  {files.length ? files.map((f) => <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>) : <SelectItem value="__none" disabled>No files on this home</SelectItem>}
                </SelectContent>
              </Select>
              <input ref={fileInput} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
              <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
                <Upload className="size-3.5" /> {uploading ? "Uploading…" : "Add file"}
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Input className="w-40" placeholder="Link label" value={link.label} onChange={(e) => setLink((l) => ({ ...l, label: e.target.value }))} />
              <Input className="min-w-0 flex-1" placeholder="https://…" value={link.url} onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!link.label.trim() || !/^https?:\/\//i.test(link.url.trim())}
                onClick={() => { setResources((cur) => [...cur, { kind: "link", label: link.label.trim(), url: link.url.trim() }]); setLink({ label: "", url: "" }); }}
              >
                <Plus className="size-3.5" /> Add link
              </Button>
            </div>
          </div>

          <div className="grid gap-1"><Label htmlFor="op-ways">Ways to document your participation</Label><Textarea id="op-ways" rows={2} value={form.ways} onChange={set("ways")} /></div>
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
          </div>
        </div>
        <DialogFooter className="gap-2">
          {isDraft ? <Button variant="outline" disabled={!canSubmit} onClick={() => mutation.mutate(false)}>Save draft</Button> : null}
          <Button disabled={!canSubmit} onClick={() => mutation.mutate(true)}>{isDraft ? "Send to homeowner" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Owner Collaboration inside one internal Task. Hidden when the home has no Active Owner program. */
export function TaskOwnerCollaboration({ propertyId, taskId, taskTitle, enrolled }: { propertyId: string; taskId: string; taskTitle: string; enrolled: boolean }) {
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
      <p className="text-xs text-muted-foreground">What you ask the homeowner to review or decide. This Task&apos;s status stays yours — the homeowner&apos;s response never blocks it.</p>
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
      <OpportunityEditor propertyId={propertyId} data={q.data} editing={editing} fixedTaskId={taskId} defaultTitle={`Review: ${taskTitle}`} onClose={() => setEditing(null)} />
    </section>
  );
}
