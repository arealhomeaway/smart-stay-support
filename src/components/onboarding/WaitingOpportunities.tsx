import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import type { OwnerTabItem } from "@/lib/onboarding-cleanup";
import { WaitingOrderDraft, savedWaitingOrder } from "@/lib/owner-waiting-order";

function MoveRow({ item, index, total, busy, move, open }: { item: OwnerTabItem; index: number; total: number; busy: boolean; move: (from: number, to: number) => void; open: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({ id: item.id, disabled: busy });
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-center gap-1 border-b border-border py-2">
    <Button ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={busy} variant="ghost" size="icon" aria-label={`Reorder ${item.title}`} className="shrink-0 touch-none"><GripVertical className="size-4"/></Button>
    <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start whitespace-normal break-words text-left" onClick={open}>{item.title}</Button>
    <Button variant="ghost" size="icon" aria-label="Move up" title="Move up" disabled={busy || index === 0} onClick={() => move(index, index - 1)}><ArrowUp className="size-4"/></Button>
    <Button variant="ghost" size="icon" aria-label="Move down" title="Move down" disabled={busy || index === total - 1} onClick={() => move(index, index + 1)}><ArrowDown className="size-4"/></Button>
  </li>;
}
export function WaitingOpportunities({ items, allStaffIds, readOnly, save, row, open }: {
  items: OwnerTabItem[]; allStaffIds: string[]; readOnly: boolean; save: (ids: string[]) => Promise<unknown>;
  row: (item: OwnerTabItem) => React.ReactNode; open: (id: string) => void;
}) {
  const [session, setSession] = useState<WaitingOrderDraft | null>(null), [draft, setDraft] = useState<string[]>([]), [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null), [saved, setSaved] = useState<string[] | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const incoming = allStaffIds.join(",");
  useEffect(() => { setSaved(null); }, [incoming]);
  const ordered = savedWaitingOrder(items, saved ?? allStaffIds);
  const staff = ordered.filter(i => i.kind === "request" && allStaffIds.includes(i.id));
  const rest = ordered.filter(i => !staff.includes(i));
  function move(from: number, to: number) { if (!session || readOnly || saving) return; session.move(from, to); setDraft([...session.ids]); }
  function drag(event: DragEndEvent) { if (!event.over) return; move(draft.indexOf(String(event.active.id)), draft.indexOf(String(event.over.id))); }
  async function commit() {
    if (!session || readOnly || saving) return;
    setSaving(true); setError(null);
    try { const full = await session.save(allStaffIds, save); setSaved(full); setSession(null); }
    catch (e) { setError(e instanceof Error ? e.message : "The order could not be saved."); }
    finally { setSaving(false); }
  }
  return <section><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Waiting on homeowner</h2>
    {session ? <div className="flex gap-2"><Button variant="ghost" disabled={saving} onClick={() => { session.cancel(); setDraft([...session.ids]); setSession(null); setError(null); }}>Cancel</Button><Button disabled={saving || readOnly} onClick={() => void commit()}>{saving ? "Saving…" : "Save"}</Button></div> : staff.length > 1 ? <Button variant="ghost" disabled={readOnly} onClick={() => { const next = new WaitingOrderDraft(staff.map(i => i.id), !readOnly); setSession(next); setDraft([...next.ids]); setError(null); }}>Reorder</Button> : null}
  </div>{error ? <p role="alert" className="py-2 text-sm text-destructive">{error}</p> : null}
    {session ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drag}><SortableContext items={draft} strategy={verticalListSortingStrategy}><ul>{draft.map((id, index) => { const item = staff.find(i => i.id === id); return item ? <MoveRow key={id} item={item} index={index} total={draft.length} busy={saving || readOnly} move={move} open={() => open(id)}/> : null; })}{rest.map(row)}</ul></SortableContext></DndContext> : <ul>{ordered.map(row)}</ul>}
    {!items.length ? <p className="py-3 text-sm text-muted-foreground">Nothing waiting on the homeowner.</p> : null}
  </section>;
}