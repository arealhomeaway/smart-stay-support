/**
 * Resource helpers for the Opportunity editor:
 *  - a searchable, multi-select picker over THIS home's existing files
 *    (the list comes from the server, already scoped to the property), and
 *  - a drag-handle list that sets the order the homeowner sees.
 * Picking a file only links the existing record — nothing is copied.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, FileText, FolderOpen, GripVertical, Link2, Search, Trash2 } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { documentCategoryLabel } from "@/lib/attachments";
import type { ResourceInput } from "@/lib/v2-workflow.functions";

export type PickerFile = { id: string; title: string; filename?: string | null; category?: string | null; note?: string | null; uploadedAt?: string | null };

const LINK_TYPES: Record<string, string> = { video: "Video", document: "Document", reference: "Reference", other: "Other" };

export const resourceKey = (r: ResourceInput) => (r.kind === "file" ? `file:${r.document_id}` : `link:${r.url}|${r.label}`);

export function ExistingFilePicker({
  files,
  attached,
  onAttach,
}: {
  files: PickerFile[];
  attached: Set<string>;
  onAttach: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return files;
    return files.filter((f) =>
      [f.title, f.filename, f.note, documentCategoryLabel(f.category ?? null), f.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [files, q]);

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const reset = (o: boolean) => {
    setOpen(o);
    if (!o) { setQ(""); setChosen([]); }
  };

  return (
    <Popover open={open} onOpenChange={reset}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline"><Search className="size-3.5" /> Attach existing files</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(26rem,90vw)] p-2">
        <Input autoFocus aria-label="Search this home's files" placeholder="Search by name or type…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto" role="listbox" aria-multiselectable="true">
          {shown.length === 0 ? (
            <li className="p-2 text-xs text-muted-foreground">{files.length ? "No files match that search." : "No files on this home yet."}</li>
          ) : (
            shown.map((f) => {
              const already = attached.has(f.id);
              const on = chosen.includes(f.id);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    disabled={already}
                    onClick={() => toggle(f.id)}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border border-border ${on ? "bg-primary text-primary-foreground" : ""}`}>
                      {on || already ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{f.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {[documentCategoryLabel(f.category ?? null), already ? "Already attached" : null].filter(Boolean).join(" · ") || "\u00a0"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2">
          <span className="text-xs text-muted-foreground">{chosen.length ? `${chosen.length} selected` : "Select one or more"}</span>
          <Button type="button" size="sm" disabled={!chosen.length} onClick={() => { onAttach(chosen); reset(false); }}>Attach</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ViewPropertyFilesLink({ propertyId }: { propertyId: string }) {
  return (
    <Button asChild type="button" size="sm" variant="ghost">
      <Link to="/onboarding/$propertyId" params={{ propertyId }} search={{ tab: "files" } as never} target="_blank">
        <FolderOpen className="size-3.5" /> View property files
      </Link>
    </Button>
  );
}

function Row({ id, r, name, onRemove }: { id: string; r: ResourceInput; name: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2 py-1 text-sm ${isDragging ? "opacity-70 shadow" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-1">
        <button ref={setActivatorNodeRef} type="button" aria-label={`Reorder ${name}`} className="cursor-grab touch-none text-muted-foreground" {...attributes} {...listeners}>
          <GripVertical className="size-4" />
        </button>
        {r.kind === "file" ? <FileText className="size-3.5 shrink-0" /> : <Link2 className="size-3.5 shrink-0" />}
        <span className="truncate" title={r.kind === "link" ? r.url : undefined}>
          {name}
          {r.kind === "link" ? <span className="text-muted-foreground"> · {r.resource_type ? `${LINK_TYPES[r.resource_type]} link` : "link"}</span> : null}
        </span>
      </span>
      <Button type="button" size="icon" variant="ghost" aria-label="Remove resource" onClick={onRemove}>
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

export function SortableResourceList({
  resources,
  onChange,
  fileName,
}: {
  resources: ResourceInput[];
  onChange: (next: ResourceInput[]) => void;
  fileName: (id: string) => string;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = resources.map(resourceKey);
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(arrayMove(resources, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="space-y-1">
          {resources.map((r, i) => (
            <Row
              key={ids[i]}
              id={ids[i]!}
              r={r}
              name={r.kind === "file" ? fileName(r.document_id) : r.label}
              onRemove={() => onChange(resources.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
