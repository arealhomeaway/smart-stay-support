import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { RequireCapability } from "@/components/RequireCapability";
import { EmptyState, LoadingPage, PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getAfterHandoffPlan,
  reorderAfterHandoffPlan,
  saveAfterHandoffPlanItem,
  setAfterHandoffPlanItemActive,
} from "@/lib/after-handoff.functions";
import { PLAN_CHANGE_NOTE, dayLabel, moveWithinDay, sortPlan, sourceLabel, type PlanItem } from "@/lib/after-handoff";

export const Route = createFileRoute("/_authenticated/owner-handoff-plan")({
  head: () => ({
    meta: [
      { title: "After handoff plan — Resolve" },
      { name: "description", content: "The owner tasks each home receives after Operations accepts the handoff." },
      { property: "og:title", content: "After handoff plan — Resolve" },
      { property: "og:description", content: "Plan which owner tasks are scheduled after a home is handed off." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="owner_programs">
      <PlanPage />
    </RequireCapability>
  ),
});

type Draft = { id: string | null; title: string; sourceKey: string; days: string; notes: string };

function PlanPage() {
  const qc = useQueryClient();
  const load = useServerFn(getAfterHandoffPlan);
  const save = useServerFn(saveAfterHandoffPlanItem);
  const setActive = useServerFn(setAfterHandoffPlanItemActive);
  const reorder = useServerFn(reorderAfterHandoffPlan);
  const q = useQuery({ queryKey: ["after-handoff-plan"], queryFn: () => load() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["after-handoff-plan"] });
  const onError = (e: Error) => toast.error(e.message);

  const saveM = useMutation({
    mutationFn: (d: Draft) => {
      const [kind, id] = d.sourceKey.split(":") as ["template" | "library", string];
      return save({ data: { id: d.id, title: d.title, source_kind: kind, source_id: id, send_after_days: Number(d.days), notes: d.notes } });
    },
    onSuccess: () => { toast.success("Plan saved"); setDraft(null); refresh(); },
    onError,
  });
  const activeM = useMutation({ mutationFn: (v: { id: string; active: boolean }) => setActive({ data: v }), onSuccess: refresh, onError });
  const orderM = useMutation({ mutationFn: (ids: string[]) => reorder({ data: { ids } }), onSuccess: refresh, onError });

  if (q.isLoading) return <LoadingPage />;
  if (q.error) return <EmptyState title="Could not load the plan" hint={(q.error as Error).message} />;
  const data = q.data;
  if (!data || !data.enabled)
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Active Owner" title="After handoff plan" />
        <EmptyState title="Not switched on yet" hint="The after-handoff plan will appear here once it is turned on." />
      </div>
    );

  const items = sortPlan(data.items);
  const titleFor = (o: { kind: string; id: string }) => data.options.find((x) => x.kind === o.kind && x.id === o.id)?.title;
  const daysValid = draft !== null && /^\d+$/.test(draft.days);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Active Owner"
        title="After handoff plan"
        description="Owner tasks scheduled for each home once Operations accepts the handoff. Day 0 is the day of acceptance."
        actions={data.canEdit ? (
          <Button onClick={() => setDraft({ id: null, title: "", sourceKey: "", days: "0", notes: "" })}>
            <Plus className="mr-1 h-4 w-4" /> Add item
          </Button>
        ) : null}
      />
      <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm">{PLAN_CHANGE_NOTE}</p>
      {!data.canEdit && (
        <p className="text-sm text-muted-foreground">You can view this plan. An Admin or the Director of Operations can change it.</p>
      )}
      <SectionCard title="Plan items">
        {items.length === 0 ? (
          <EmptyState title="No items yet" hint={data.canEdit ? "Add the first owner task to send after handoff." : "Nothing is planned yet."} />
        ) : (
          <ul className="divide-y">
            {items.map((it: PlanItem, i) => {
              const src = it.source_kind === "template" ? it.template_id : it.library_id;
              const prev = items[i - 1];
              const next = items[i + 1];
              return (
                <li key={it.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Badge variant="outline" className="w-16 justify-center">{dayLabel(it.send_after_days)}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className={it.active ? "font-medium" : "font-medium text-muted-foreground line-through"}>{it.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {sourceLabel(it.source_kind)}{src && titleFor({ kind: it.source_kind, id: src }) ? `: ${titleFor({ kind: it.source_kind, id: src })}` : ""}
                      {it.notes ? ` · ${it.notes}` : ""}
                    </p>
                  </div>
                  {data.canEdit && (
                    <div className="flex items-center gap-2">
                      <Button size="icon" variant="ghost" aria-label="Move up" disabled={!prev || prev.send_after_days !== it.send_after_days || orderM.isPending}
                        onClick={() => orderM.mutate(moveWithinDay(items, it.id, -1))}><ArrowUp className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Move down" disabled={!next || next.send_after_days !== it.send_after_days || orderM.isPending}
                        onClick={() => orderM.mutate(moveWithinDay(items, it.id, 1))}><ArrowDown className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" onClick={() => setDraft({ id: it.id, title: it.title, sourceKey: `${it.source_kind}:${src}`, days: String(it.send_after_days), notes: it.notes ?? "" })}>Edit</Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch aria-label={`Active: ${it.title}`} checked={it.active} disabled={!data.canEdit || activeM.isPending}
                      onCheckedChange={(v) => activeM.mutate({ id: it.id, active: v })} />
                    <span className="text-xs text-muted-foreground">{it.active ? "Active" : "Off"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <Dialog open={draft !== null} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? "Edit plan item" : "Add plan item"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={draft.sourceKey} onValueChange={(v) => setDraft({ ...draft, sourceKey: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick a template or Library item" /></SelectTrigger>
                  <SelectContent>
                    {data.options.map((o) => (
                      <SelectItem key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>{sourceLabel(o.kind)}: {o.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ahp-title">Title (optional, uses the source title if blank)</Label>
                <Input id="ahp-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ahp-days">Send this many days after handoff (0 = day of acceptance)</Label>
                <Input id="ahp-days" inputMode="numeric" value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ahp-notes">Notes</Label>
                <Textarea id="ahp-notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
            <Button disabled={!draft?.sourceKey || !daysValid || saveM.isPending} onClick={() => draft && saveM.mutate(draft)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
