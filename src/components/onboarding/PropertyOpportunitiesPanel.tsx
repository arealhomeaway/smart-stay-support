/**
 * Active Owner Opportunities for one home, managed from its Onboarding
 * workspace. An Opportunity is the homeowner's own work — written in owner
 * language, linked to internal work only for traceability. Its status never
 * controls or blocks the internal Task.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/page";
import { ownerPrograms } from "@/lib/owner-program.functions";
import { readPropertyOpportunities, saveOwnerOpportunity, type OpportunityContent } from "@/lib/v2-workflow.functions";

type Opp = Awaited<ReturnType<typeof readPropertyOpportunities>>["opportunities"][number];

const EMPTY = { title: "", what: "", why: "", how: "", resources: "", ways: "", minutes: "", linked: "none" };

function fmt(d: string | null | undefined) {
  if (!d) return null;
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PropertyOpportunitiesPanel({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const loadPrograms = useServerFn(ownerPrograms);
  const read = useServerFn(readPropertyOpportunities);
  const save = useServerFn(saveOwnerOpportunity);
  const [editing, setEditing] = useState<Opp | "new" | null>(null);
  const [form, setForm] = useState(EMPTY);

  const programs = useQuery({ queryKey: ["owner-programs", "property", propertyId], queryFn: () => loadPrograms({ data: {} }) });
  const program = (programs.data?.rows ?? []).find((p) => p.properties.some((h) => h.id === propertyId));
  const q = useQuery({ queryKey: ["property-opportunities", propertyId], queryFn: () => read({ data: { propertyId } }) });

  const mutation = useMutation({
    mutationFn: (send: boolean) => {
      const content: OpportunityContent = {
        title: form.title.trim(),
        what: form.what.trim(),
        why: form.why.trim(),
        how: form.how.trim(),
        resources: form.resources.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10),
        ways_to_document: form.ways.trim(),
        suggested_minutes: form.minutes ? Math.round(Number(form.minutes) * 60) : null,
      };
      return save({
        data: {
          id: editing && editing !== "new" ? editing.id : null,
          propertyId,
          content,
          linkedTaskId: form.linked === "none" ? null : form.linked,
          send,
        },
      });
    },
    onSuccess: (_r, send) => {
      toast.success(send ? "Opportunity sent to the homeowner." : "Draft saved.");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["property-opportunities", propertyId] });
      void qc.invalidateQueries({ queryKey: ["owner-opportunities"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = (o: Opp | "new") => {
    if (o === "new") setForm(EMPTY);
    else {
      const c = o.owner_content;
      setForm({
        title: o.title,
        what: c?.what ?? "",
        why: c?.why ?? "",
        how: c?.how ?? "",
        resources: (c?.resources ?? []).join("\n"),
        ways: c?.ways_to_document ?? "",
        minutes: c?.suggested_minutes ? String(c.suggested_minutes / 60) : "",
        linked: o.linked_task_id ?? "none",
      });
    }
    setEditing(o);
  };

  if (!programs.isLoading && !program) return null;

  const opps = q.data?.opportunities ?? [];
  const drafts = opps.filter((o) => o.status === "draft");
  const available = opps.filter((o) => o.status !== "draft" && o.status !== "complete");
  const completed = opps.filter((o) => o.status === "complete");
  const closing = q.data?.actualClosingOn ?? program?.startedOn ?? q.data?.plannedClosingOn ?? null;
  const taskTitle = (id: string | null) => q.data?.tasks.find((t) => t.id === id)?.title;
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const row = (o: Opp) => (
    <li key={o.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="font-medium">{o.title}</p>
        {o.owner_content?.what ? <p className="line-clamp-2 text-sm text-muted-foreground">{o.owner_content.what}</p> : null}
        <p className="text-xs text-muted-foreground">
          {o.owner_content?.suggested_minutes ? `Suggested ${o.owner_content.suggested_minutes / 60} h` : null}
          {taskTitle(o.linked_task_id) ? ` · Related work: ${taskTitle(o.linked_task_id)}` : null}
        </p>
      </div>
      {o.status === "complete" ? (
        <span className="flex items-center gap-1 text-sm text-state-done"><CheckCircle2 className="size-4" /> Done</span>
      ) : (
        <Button size="sm" variant="outline" onClick={() => open(o)}>{o.status === "draft" ? "Edit draft" : "Edit"}</Button>
      )}
    </li>
  );

  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><Sparkles className="size-4" aria-hidden="true" /> Active Owner Opportunities</span>}
      description="The homeowner's own ways to take part. Separate from ARHA's Tasks — they never block or change internal work."
      actions={<Button onClick={() => open("new")}><Plus className="size-4" /> Create Opportunity</Button>}
    >
      <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Active Owner</dt><dd className="font-medium">{program?.ownerName ?? "—"}</dd></div>
        <div>
          <dt className="text-muted-foreground">Program period</dt>
          <dd className="font-medium">{fmt(closing) ?? "Closing date not set"} → Dec 31, 2026</dd>
        </div>
        <div><dt className="text-muted-foreground">Hours logged</dt><dd className="numeric font-medium">{(program?.reportedHours ?? 0).toFixed(1)} / 100+ hours</dd></div>
      </dl>
      <div className="space-y-4">
        {drafts.length ? (
          <div><h3 className="mb-2 text-sm font-semibold">Drafts (not visible to the homeowner)</h3><ul className="space-y-2">{drafts.map(row)}</ul></div>
        ) : null}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Available Opportunities ({available.length})</h3>
          {available.length ? <ul className="space-y-2">{available.map(row)}</ul> : <p className="text-sm text-muted-foreground">None sent yet. Use Create Opportunity.</p>}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Completed Opportunities ({completed.length})</h3>
          {completed.length ? <ul className="space-y-2">{completed.map(row)}</ul> : <p className="text-sm text-muted-foreground">None completed yet.</p>}
        </div>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Create Opportunity" : "Edit Opportunity"}</DialogTitle>
            <DialogDescription>Written for the homeowner. Don&apos;t paste internal staff instructions.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label htmlFor="op-title">Opportunity title</Label><Input id="op-title" value={form.title} onChange={set("title")} placeholder="Research comparable furnished rentals in your market" /></div>
            <div className="grid gap-1"><Label htmlFor="op-what">What you&apos;ll do</Label><Textarea id="op-what" rows={3} value={form.what} onChange={set("what")} /></div>
            <div className="grid gap-1"><Label htmlFor="op-why">Why this matters</Label><Textarea id="op-why" rows={3} value={form.why} onChange={set("why")} /></div>
            <div className="grid gap-1"><Label htmlFor="op-how">How to complete it</Label><Textarea id="op-how" rows={3} value={form.how} onChange={set("how")} /></div>
            <div className="grid gap-1"><Label htmlFor="op-res">Resources (one link per line — worksheets, videos, files, guides)</Label><Textarea id="op-res" rows={3} value={form.resources} onChange={set("resources")} placeholder="https://…" /></div>
            <div className="grid gap-1"><Label htmlFor="op-ways">Ways to document your participation</Label><Textarea id="op-ways" rows={3} value={form.ways} onChange={set("ways")} placeholder="Notes, screenshots, links, photos, uploads…" /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1"><Label htmlFor="op-min">Suggested time (hours, optional)</Label><Input id="op-min" type="number" min={0} step={0.25} value={form.minutes} onChange={set("minutes")} /></div>
              <div className="grid gap-1">
                <Label>Related onboarding work (optional)</Label>
                <Select value={form.linked} onValueChange={(v) => setForm((f) => ({ ...f, linked: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(q.data?.tasks ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editing === "new" || (editing && editing.status === "draft") ? (
              <Button variant="outline" disabled={form.title.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate(false)}>Save draft</Button>
            ) : null}
            <Button disabled={form.title.trim().length < 3 || mutation.isPending} onClick={() => mutation.mutate(true)}>
              {editing !== "new" && editing?.status !== "draft" ? "Save changes" : "Send Opportunity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
