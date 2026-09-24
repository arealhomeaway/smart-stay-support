import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { RequireCapability } from "@/components/RequireCapability";
import { LoadingPage, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  manageOptionalLibrary,
  reorderOptionalLibrary,
  saveOptionalTemplate,
  type LibraryTemplate,
} from "@/lib/opportunity-library.functions";
import { LIBRARY_CATEGORIES, OPPORTUNITY_IMAGES, imageFor, type OpportunityImageKey } from "@/lib/opportunity-images";

export const Route = createFileRoute("/_authenticated/owner-library")({
  head: () => ({
    meta: [
      { title: "Optional Opportunity Library — Resolve" },
      { name: "description", content: "Manage the optional, remote participation ideas homeowners can start from their portal." },
      { property: "og:title", content: "Optional Opportunity Library — Resolve" },
      { property: "og:description", content: "Manage optional remote participation ideas for homeowners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="owner_programs">
      <LibraryPage />
    </RequireCapability>
  ),
});

type Draft = Omit<LibraryTemplate, "id" | "sort_order"> & { id: string | null };
const blank: Draft = {
  id: null, title: "", summary: "", what: "", why: "", how: "", ways_to_document: "",
  suggested_minutes: 60, category: "market", image_key: "market", tags: [],
  resource_label: null, resource_url: null, active: true,
};

function LibraryPage() {
  const qc = useQueryClient();
  const list = useServerFn(manageOptionalLibrary);
  const reorder = useServerFn(reorderOptionalLibrary);
  const q = useQuery({ queryKey: ["optional-library-manage"], queryFn: () => list() });
  const [editing, setEditing] = useState<Draft | null>(null);
  const move = useMutation({
    mutationFn: (ids: string[]) => reorder({ data: { ids } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["optional-library-manage"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not reorder."),
  });
  if (q.isLoading) return <LoadingPage tiles={2} />;
  const rows = q.data ?? [];
  const shift = (i: number, d: -1 | 1) => {
    const ids = rows.map((r) => r.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    move.mutate(ids);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Active Owner"
        title="Optional Opportunity Library"
        description="Remote, optional ideas homeowners may start on one of their homes. Templates are never assigned or required; starting one creates a single Opportunity for that home."
        actions={<Button onClick={() => setEditing({ ...blank })}><Plus className="size-4" /> New template</Button>}
      />
      <ul className="space-y-3">
        {rows.map((t, i) => (
          <li key={t.id} className="flex gap-4 rounded-xl border border-border bg-card p-3">
            <img src={imageFor(t.image_key)} alt="" loading="lazy" width={1024} height={640} className="h-20 w-28 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{t.title}</p>
                <Badge variant="outline">{LIBRARY_CATEGORIES.find((c) => c.code === t.category)?.label ?? t.category}</Badge>
                {t.active ? null : <Badge variant="secondary">Inactive</Badge>}
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{t.summary}</p>
            </div>
            <div className="flex shrink-0 items-start gap-1">
              <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0 || move.isPending} onClick={() => shift(i, -1)}><ArrowUp className="size-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === rows.length - 1 || move.isPending} onClick={() => shift(i, 1)}><ArrowDown className="size-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => setEditing({ ...t })}>Edit</Button>
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No templates yet.</p> : null}
      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        {editing ? <Editor draft={editing} onDone={() => setEditing(null)} /> : null}
      </Dialog>
    </div>
  );
}

function Editor({ draft, onDone }: { draft: Draft; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveOptionalTemplate);
  const [d, setD] = useState<Draft>(draft);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const m = useMutation({
    mutationFn: () => save({ data: { ...d, resource_label: d.resource_label || null, resource_url: d.resource_url || null } }),
    onSuccess: () => {
      toast.success("Template saved.");
      void qc.invalidateQueries({ queryKey: ["optional-library-manage"] });
      void qc.invalidateQueries({ queryKey: ["owner-opportunity-library"] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });
  const area = (k: "summary" | "what" | "why" | "how" | "ways_to_document", label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`t-${k}`}>{label}</Label>
      <Textarea id={`t-${k}`} rows={k === "summary" ? 2 : 3} value={d[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>{d.id ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
      <img src={imageFor(d.image_key)} alt="" width={1024} height={640} className="h-32 w-full rounded-lg object-cover" />
      <div className="grid gap-3">
        <div className="space-y-1"><Label htmlFor="t-title">Title</Label><Input id="t-title" value={d.title} onChange={(e) => set("title", e.target.value)} /></div>
        {area("summary", "One-line summary (shown on the card)")}
        {area("what", "What you'll do")}
        {area("why", "Why it matters")}
        {area("how", "How to complete it remotely")}
        {area("ways_to_document", "Ways to document your participation")}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={d.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LIBRARY_CATEGORIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Image</Label>
            <Select value={d.image_key} onValueChange={(v) => set("image_key", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(OPPORTUNITY_IMAGES) as OpportunityImageKey[]).map((k) => <SelectItem key={k} value={k}>{OPPORTUNITY_IMAGES[k].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="t-min">Suggested minutes</Label>
            <Input id="t-min" type="number" min={5} max={1440} value={d.suggested_minutes ?? ""} onChange={(e) => set("suggested_minutes", e.target.value ? Number(e.target.value) : null)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label htmlFor="t-rl">Helpful link label (optional)</Label><Input id="t-rl" value={d.resource_label ?? ""} onChange={(e) => set("resource_label", e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="t-ru">Helpful link URL (optional)</Label><Input id="t-ru" value={d.resource_url ?? ""} onChange={(e) => set("resource_url", e.target.value)} /></div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="t-tags">Tags (comma separated)</Label>
          <Input id="t-tags" value={d.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
        </div>
        <div className="flex items-center gap-2"><Switch id="t-active" checked={d.active} onCheckedChange={(v) => set("active", v)} /><Label htmlFor="t-active">Active — homeowners can see and start it</Label></div>
      </div>
      <DialogFooter><Button disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Saving…" : "Save template"}</Button></DialogFooter>
    </DialogContent>
  );
}
