/**
 * Active Owner Opportunities for one home, managed from its Onboarding
 * workspace. Shares the editor and status view with the Task drawer's Owner
 * collaboration section. Opportunity status never controls the internal Task.
 */
import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GripVertical, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RESPONSE_TYPES, compareArhaPriority, reorderArhaOpportunities } from "@/lib/v2-workflow.functions";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";
import { ownerPrograms } from "@/lib/owner-program.functions";
import { OpportunityDetail, OpportunityEditor, ownerState, useOwnerCollaboration, type CollabOpp } from "@/components/onboarding/OwnerCollaboration";

function fmt(d: string | null | undefined) {
  if (!d) return null;
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** One sortable ARHA card: only the grip handle starts a drag, so Details/Edit/links/text stay normal. */
function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label="Drag to change the order the homeowner sees"
      title="Drag to reorder"
      className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
    >
      <GripVertical className="size-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "relative z-10 opacity-80" : undefined}>
      {children(handle)}
    </div>
  );
}

function whenTs(ts: string | null | undefined) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** One plain sentence for the homeowner's latest response — never raw events. */
function latestResponse(o: CollabOpp, owner: string, docs: { at: string }[]): { text: string; at: string } | null {
  const items: { text: string; at: string }[] = [];
  for (const r of o.owner_response ?? []) {
    const verb =
      r.kind === "decision"
        ? r.decision === "authorize"
          ? "authorized this work"
          : r.decision === "changes"
            ? "requested changes"
            : "recorded a decision"
        : r.kind === "acknowledge"
          ? "acknowledged this"
          : "submitted feedback";
    if (r.at) items.push({ text: `${owner} ${verb}`, at: r.at });
  }
  for (const d of docs) items.push({ text: `${owner} uploaded documentation`, at: d.at });
  if (o.status === "complete" && o.completed_at) items.push({ text: `${owner} marked this Opportunity complete`, at: o.completed_at });
  items.sort((a, b) => b.at.localeCompare(a.at));
  return items[0] ?? null;
}

function preview(text: string | null | undefined) {
  const t = (text ?? "").trim();
  return t ? t : null;
}

export function PropertyOpportunitiesPanel({ propertyId }: { propertyId: string }) {
  const loadPrograms = useServerFn(ownerPrograms);
  const [editing, setEditing] = useState<CollabOpp | "new" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  // Demo homes belong to demo programs, which the production list leaves out.
  const programs = useQuery({
    queryKey: ["owner-programs", "property", propertyId],
    queryFn: async () => {
      const live = await loadPrograms({ data: {} });
      if (live.rows.some((p) => p.properties.some((h) => h.id === propertyId))) return live;
      const demo = await loadPrograms({ data: { demo: true } });
      return { ...live, rows: [...live.rows, ...demo.rows] };
    },
  });
  const program = (programs.data?.rows ?? []).find((p) => p.properties.some((h) => h.id === propertyId));
  const q = useOwnerCollaboration(propertyId);
  const qc = useQueryClient();
  const reorderFn = useServerFn(reorderArhaOpportunities);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderFn({ data: { propertyId, ids } }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["owner-collaboration"] }); setLocalOrder(null); toast.success("Order saved. The homeowner now sees this order."); },
    onError: (e) => { setLocalOrder(null); toast.error(e instanceof Error ? e.message : "Could not save the order."); },
  });

  if (!programs.isLoading && !program) return null;

  const opps = q.data?.opportunities ?? [];
  const drafts = opps.filter((o) => o.status === "draft");
  const sent = opps.filter((o) => o.status !== "draft" && o.status !== "complete");
  const arhaSaved = sent.filter((o) => o.source === "arha").sort(compareArhaPriority);
  const arhaSent = localOrder ? localOrder.map((id) => arhaSaved.find((o) => o.id === id)).filter((o): o is CollabOpp => Boolean(o)) : arhaSaved;
  const otherSent = sent.filter((o) => o.source !== "arha");
  const available = [...arhaSent, ...otherSent];
  const completed = opps.filter((o) => o.status === "complete");
  const closing = q.data?.actualClosingOn ?? program?.startedOn ?? q.data?.plannedClosingOn ?? null;
  const taskTitle = (id: string | null) => q.data?.tasks.find((t) => t.id === id)?.title;

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = arhaSent.map((o) => o.id);
    const next = arrayMove(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
    setLocalOrder(next);
    reorder.mutate(next);
  };

  const ownerFirst = (program?.ownerName ?? "The homeowner").split(" ")[0] || "The homeowner";
  const row = (o: CollabOpp, handle?: ReactNode, position?: number) => {
    const c = o.owner_content;
    const what = preview(c?.what);
    const why = preview(c?.why);
    const types = o.response_types.map((t) => RESPONSE_TYPES.find((r) => r.code === t)?.label ?? t);
    const docs = (q.data?.files ?? []).filter((f) => f.workItemId === o.id).map((f) => ({ at: String(f.uploadedAt ?? "") })).filter((d) => d.at);
    const latest = o.status === "draft" ? null : latestResponse(o, ownerFirst, docs);
    const waitingFor =
      o.status === "draft"
        ? "Not sent — the homeowner can't see this yet."
        : o.status === "complete"
          ? null
          : latest
            ? "Review the homeowner's response."
            : `Waiting for ${ownerFirst} to ${types.length ? types.join(" / ").toLowerCase() : "respond"}.`;
    return (
    <li key={o.id} className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
        {handle}
        {position ? <span className="numeric mt-0.5 text-xs font-semibold text-muted-foreground">{position}.</span> : null}
        <div className="min-w-0">
          <p className="font-medium">{o.title}</p>
          <p className="text-xs text-muted-foreground">
            {ownerState(o)}
            {o.source === "arha" ? " · From your ARHA Onboarding Team" : ""}
          </p>
          {types.length ? <p className="mt-1 text-xs"><span className="text-muted-foreground">Response type: </span>{types.join(", ")}</p> : null}
          {what ? <p className="mt-1 line-clamp-2 text-sm"><span className="text-muted-foreground">What you&apos;ll do: </span>{what}</p> : null}
          {why ? <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">Why this matters: {why}</p> : null}
          {o.resources.length ? (
            <p className="mt-1 text-xs"><span className="text-muted-foreground">Resources: </span>{o.resources.map((r) => r.label).join(" · ")}</p>
          ) : null}
          {taskTitle(o.taskId) ? <p className="mt-0.5 text-xs"><span className="text-muted-foreground">Related Task: </span>{taskTitle(o.taskId)}</p> : null}
          {latest ? (
            <p className="mt-1 text-xs font-medium">{latest.text} · {whenTs(latest.at)}</p>
          ) : null}
          {waitingFor ? <p className="mt-0.5 text-xs text-muted-foreground">{waitingFor}</p> : null}
        </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>{expanded === o.id ? "Hide" : "Details"}</Button>
          {o.status !== "complete" ? <Button size="sm" variant="outline" onClick={() => setEditing(o)}>{o.status === "draft" ? "Edit draft" : "Edit"}</Button> : null}
        </div>
      </div>
      {expanded === o.id ? (
        <div className="mt-2 space-y-2 border-t border-border pt-2">
          {what ? <div className="text-sm"><p className="text-xs font-medium">What you&apos;ll do</p><p className="whitespace-pre-wrap">{what}</p></div> : null}
          {why ? <div className="text-sm"><p className="text-xs font-medium">Why this matters</p><p className="whitespace-pre-wrap">{why}</p></div> : null}
          <OpportunityDetail o={o} files={q.data?.files ?? []} />
        </div>
      ) : null}
    </li>
    );
  };

  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><Sparkles className="size-4" aria-hidden="true" /> Active Owner Opportunities</span>}
      description="Owner collaboration for this property. Review what ARHA has shared and track the homeowner's response."
      actions={<Button onClick={() => setEditing("new")}><Plus className="size-4" /> Create Opportunity</Button>}
    >
      <dl className="mb-4 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted-foreground">Active Owner</dt><dd className="font-medium">{program?.ownerName ?? "—"}</dd></div>
        <div><dt className="text-muted-foreground">Program period</dt><dd className="font-medium">{fmt(closing) ?? "Closing date not set"} → Dec 31, 2026</dd></div>
        <div><dt className="text-muted-foreground">Hours logged</dt><dd className="numeric font-medium">{(program?.reportedHours ?? 0).toFixed(1)} / 100+ hours</dd></div>
      </dl>
      <div className="space-y-4">
        {drafts.length ? <div><h3 className="mb-2 text-sm font-semibold">Drafts (not visible to the homeowner)</h3><ul className="space-y-2">{drafts.map((o) => row(o))}</ul></div> : null}
        <div>
          <h3 className="mb-2 text-sm font-semibold">Sent to the homeowner ({available.length})</h3>
          {arhaSent.length > 1 ? <p className="mb-2 text-xs text-muted-foreground">Drag the handle to set the order the homeowner sees ARHA Opportunities for this home. Presentation only — it never changes Tasks.</p> : null}
          {available.length ? (
            <ul className="space-y-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={arhaSent.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                  {arhaSent.map((o, i) => (
                    <SortableRow key={o.id} id={o.id}>{(handle) => row(o, arhaSent.length > 1 ? handle : undefined, arhaSent.length > 1 ? i + 1 : undefined)}</SortableRow>
                  ))}
                </SortableContext>
              </DndContext>
              {otherSent.map((o) => row(o))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">None sent yet. Use Create Opportunity.</p>}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Completed ({completed.length})</h3>
          {completed.length ? <ul className="space-y-2">{completed.map((o) => row(o))}</ul> : <p className="text-sm text-muted-foreground">None completed yet.</p>}
        </div>
      </div>
      <OpportunityEditor propertyId={propertyId} data={q.data} editing={editing} onClose={() => setEditing(null)} />
    </SectionCard>
  );
}
