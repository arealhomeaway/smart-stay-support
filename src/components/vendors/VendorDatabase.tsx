/**
 * Spreadsheet-style Database view for Operations leadership. Same canonical
 * vendor rows as the Directory. Managers/Supervisors get Notion-style control
 * (custom columns, views, bulk edit) but can never rename, archive or delete
 * system fields — the database refuses those regardless of the UI.
 */
import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Archive, EyeOff, Lock, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip, EmptyState, LoadingRows } from "@/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VENDOR_STATUS_LABELS, type VendorStatus } from "@/lib/vendors";
import { customFieldKey, DISPATCH_METHOD_LABELS, type DispatchMethod } from "@/lib/vendor-gold";
import {
  errorText,
  useInvalidateVendors,
  useVendorWorkspace,
  type CustomField,
  type VendorRecord,
} from "./useVendorWorkspace";

type Col = {
  key: string;
  label: string;
  system: boolean;
  /** Who may edit values inline: none, staff-leadership (manager+), or admin/director. */
  edit: "none" | "manager" | "lead";
  kind: "text" | "bool" | "tags" | "status" | "dispatch" | "custom";
  field?: CustomField;
};

const SYSTEM_COLS: Col[] = [
  { key: "display_name", label: "Company", system: true, edit: "none", kind: "text" },
  { key: "status", label: "Gold Standard", system: true, edit: "none", kind: "status" },
  { key: "is_active", label: "Active", system: true, edit: "manager", kind: "bool" },
  { key: "primary_contact_name", label: "Contact", system: false, edit: "manager", kind: "text" },
  { key: "primary_contact_phone", label: "Phone", system: false, edit: "manager", kind: "text" },
  { key: "primary_contact_email", label: "Email", system: false, edit: "manager", kind: "text" },
  { key: "website", label: "Website", system: false, edit: "manager", kind: "text" },
  { key: "markets", label: "Markets", system: false, edit: "none", kind: "tags" },
  { key: "service_categories", label: "Categories", system: false, edit: "none", kind: "tags" },
  { key: "dispatch_method", label: "Dispatch Method", system: true, edit: "lead", kind: "dispatch" },
  { key: "breezeway_person_id", label: "Breezeway ID", system: true, edit: "lead", kind: "text" },
  { key: "work_order_email", label: "Work Order Email", system: false, edit: "manager", kind: "text" },
  { key: "pricing_note", label: "Pricing / Rates", system: false, edit: "manager", kind: "text" },
  { key: "payment_terms", label: "Payment Type", system: false, edit: "manager", kind: "text" },
  { key: "tags", label: "Tags", system: false, edit: "manager", kind: "tags" },
  { key: "qualification_score", label: "Qual. Score", system: true, edit: "none", kind: "text" },
  { key: "source_system", label: "Source", system: true, edit: "none", kind: "text" },
  { key: "legacy_notion_id", label: "Notion ID", system: true, edit: "none", kind: "text" },
  { key: "migration_status", label: "Migration", system: true, edit: "none", kind: "text" },
  { key: "id", label: "Vendor ID", system: true, edit: "none", kind: "text" },
];

type ViewConfig = {
  order: string[];
  hidden: string[];
  sort: { key: string; dir: "asc" | "desc" } | null;
  filter: string;
  group: string | null;
};
const DEFAULT_VIEW: ViewConfig = {
  order: SYSTEM_COLS.map((c) => c.key),
  hidden: ["source_system", "legacy_notion_id", "migration_status", "id", "breezeway_person_id"],
  sort: { key: "display_name", dir: "asc" },
  filter: "",
  group: null,
};

function valueOf(v: VendorRecord, col: Col): unknown {
  if (col.kind === "custom") return (v.custom_fields as Record<string, unknown> | null)?.[col.key] ?? null;
  return (v as Record<string, unknown>)[col.key];
}
function display(v: unknown, col: Col): string {
  if (v === null || v === undefined || v === "") return "";
  if (col.kind === "status") return VENDOR_STATUS_LABELS[v as VendorStatus] ?? String(v);
  if (col.kind === "dispatch") return DISPATCH_METHOD_LABELS[v as DispatchMethod] ?? String(v);
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function VendorDatabase({ canManage, isLead }: { canManage: boolean; isLead: boolean }) {
  const ws = useVendorWorkspace();
  const invalidate = useInvalidateVendors();
  const [view, setView] = useState<ViewConfig>(DEFAULT_VIEW);
  const [viewId, setViewId] = useState<string>("default");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; key: string; value: string } | null>(null);
  const [newCol, setNewCol] = useState({ label: "", type: "text", options: "" });
  const [bulkTag, setBulkTag] = useState("");

  const cols: Col[] = useMemo(() => {
    const custom: Col[] = (ws.data?.customFields ?? [])
      .filter((f) => !f.archived_at)
      .map((f) => ({ key: f.key, label: f.label, system: false, edit: "manager", kind: "custom", field: f }));
    const all = [...SYSTEM_COLS, ...custom];
    const order = [...view.order.filter((k) => all.some((c) => c.key === k)), ...all.map((c) => c.key).filter((k) => !view.order.includes(k))];
    return order.map((k) => all.find((c) => c.key === k)!);
  }, [ws.data, view.order]);

  const rows = useMemo(() => {
    let list = [...(ws.data?.vendors ?? [])];
    const f = view.filter.trim().toLowerCase();
    if (f) list = list.filter((v) => cols.some((c) => display(valueOf(v, c), c).toLowerCase().includes(f)));
    if (view.sort) {
      const col = cols.find((c) => c.key === view.sort!.key);
      if (col)
        list.sort((a, b) => {
          const x = display(valueOf(a, col), col);
          const y = display(valueOf(b, col), col);
          return (view.sort!.dir === "asc" ? 1 : -1) * x.localeCompare(y, undefined, { numeric: true });
        });
    }
    return list;
  }, [ws.data, view.filter, view.sort, cols]);

  const groups = useMemo(() => {
    if (!view.group) return [["", rows] as const];
    const col = cols.find((c) => c.key === view.group);
    const m = new Map<string, VendorRecord[]>();
    for (const r of rows) {
      const k = col ? display(valueOf(r, col), col) || "(empty)" : "";
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return [...m.entries()];
  }, [rows, view.group, cols]);

  if (ws.isLoading) return <LoadingRows rows={6} />;
  if (!ws.data) return <EmptyState title="Could not load vendors" hint="Refresh to try again." />;
  const allTags = [...new Set(ws.data.vendors.flatMap((v) => v.tags))].sort();
  const visible = cols.filter((c) => !view.hidden.includes(c.key));
  const canEdit = (c: Col) => canManage && (c.edit === "manager" || (c.edit === "lead" && isLead));

  async function saveCell(v: VendorRecord, col: Col, raw: string) {
    let value: unknown = raw.trim() === "" ? null : raw.trim();
    if (col.kind === "tags") value = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (col.kind === "bool") value = raw === "true";
    const patch =
      col.kind === "custom"
        ? { custom_fields: { ...((v.custom_fields as Record<string, Json>) ?? {}), [col.key]: value as Json } }
        : { [col.key]: value };
    const { error } = await supabase.from("vendor_orgs").update(patch as never).eq("id", v.id);
    setEditing(null);
    if (error) return toast.error(errorText(error));
    toast.success("Saved");
    invalidate();
  }

  async function bulk(patch: "activate" | "deactivate" | "tag") {
    const targets = ws.data!.vendors.filter((v) => selected.has(v.id));
    for (const v of targets) {
      const update =
        patch === "tag"
          ? { tags: [...new Set([...v.tags, bulkTag.trim()])] }
          : { is_active: patch === "activate" };
      const { error } = await supabase.from("vendor_orgs").update(update).eq("id", v.id);
      if (error) return toast.error(errorText(error));
    }
    toast.success(`Updated ${targets.length} vendor${targets.length === 1 ? "" : "s"}`);
    setSelected(new Set());
    invalidate();
  }

  async function addColumn() {
    const label = newCol.label.trim();
    if (!label) return;
    const { error } = await supabase.from("vendor_custom_fields").insert({
      key: customFieldKey(label),
      label,
      field_type: newCol.type,
      options: newCol.options.split(",").map((o) => o.trim()).filter(Boolean),
      sort_order: (ws.data?.customFields.length ?? 0) + 1,
    });
    if (error) return toast.error(error.code === "23505" ? "A column with that name already exists." : errorText(error));
    setNewCol({ label: "", type: "text", options: "" });
    toast.success("Column added");
    invalidate();
  }

  async function renameColumn(f: CustomField) {
    const label = window.prompt("Rename column", f.label)?.trim();
    if (!label || label === f.label) return;
    const { error } = await supabase.from("vendor_custom_fields").update({ label }).eq("id", f.id);
    if (error) return toast.error(errorText(error));
    invalidate();
  }

  async function removeColumn(f: CustomField) {
    if (!window.confirm(`Remove the "${f.label}" column? If any vendor has a value it is archived, not deleted.`)) return;
    const { data, error } = await supabase.rpc("remove_vendor_custom_field", { _field_id: f.id });
    if (error) return toast.error(errorText(error));
    toast.success(data === "archived" ? "Column archived — its history is kept." : "Column removed");
    invalidate();
  }

  function move(key: string, dir: -1 | 1) {
    const order = cols.map((c) => c.key);
    const i = order.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j]!, order[i]!];
    setView({ ...view, order });
  }

  async function saveView() {
    const name = window.prompt("Name this view")?.trim();
    if (!name) return;
    const shared = window.confirm("Share this view with the Operations team? (Cancel keeps it personal.)");
    const { error } = await supabase.from("vendor_saved_views").insert({ name, shared, config: view as unknown as Json });
    if (error) return toast.error(errorText(error));
    toast.success("View saved");
    invalidate();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={viewId}
          onValueChange={(id) => {
            setViewId(id);
            const sv = ws.data!.savedViews.find((v) => v.id === id);
            setView(sv ? { ...DEFAULT_VIEW, ...(sv.config as unknown as ViewConfig) } : DEFAULT_VIEW);
          }}
        >
          <SelectTrigger className="h-9 w-48" aria-label="Saved view">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default view</SelectItem>
            {ws.data.savedViews.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
                {v.shared ? " (shared)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-9 w-56"
          placeholder="Filter rows"
          value={view.filter}
          onChange={(e) => setView({ ...view, filter: e.target.value })}
        />
        <Select value={view.group ?? "none"} onValueChange={(g) => setView({ ...view, group: g === "none" ? null : g })}>
          <SelectTrigger className="h-9 w-44" aria-label="Group by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            {cols.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                Group: {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage && (
          <Button size="sm" variant="outline" onClick={saveView}>
            <Save className="size-4" /> Save view
          </Button>
        )}
      </div>

      {view.hidden.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          Hidden:
          {view.hidden.map((k) => (
            <button
              key={k}
              className="rounded border border-border px-1.5 py-0.5 hover:bg-secondary"
              onClick={() => setView({ ...view, hidden: view.hidden.filter((h) => h !== k) })}
            >
              {cols.find((c) => c.key === k)?.label ?? k} ＋
            </button>
          ))}
        </div>
      )}

      {canManage && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-secondary/40 p-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulk("activate")}>Mark active</Button>
          <Button size="sm" variant="outline" onClick={() => bulk("deactivate")}>Mark inactive</Button>
          <Input
            className="h-8 w-40"
            list="vendor-tag-options"
            placeholder="Tag"
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
          />
          <Button size="sm" variant="outline" disabled={!bulkTag.trim()} onClick={() => bulk("tag")}>
            Add tag
          </Button>
        </div>
      )}
      <datalist id="vendor-tag-options">
        {allTags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-secondary/50 text-left">
            <tr>
              {canManage && <th className="w-8 p-2" />}
              {visible.map((c) => (
                <th key={c.key} className="whitespace-nowrap p-2 font-medium">
                  <div className="flex items-center gap-1">
                    <button
                      className="hover:underline"
                      onClick={() =>
                        setView({
                          ...view,
                          sort: { key: c.key, dir: view.sort?.key === c.key && view.sort.dir === "asc" ? "desc" : "asc" },
                        })
                      }
                    >
                      {c.label}
                      {view.sort?.key === c.key ? (view.sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                    {c.system && <Lock className="size-3 text-muted-foreground" aria-label="Protected system field" />}
                    <button aria-label={`Move ${c.label} left`} onClick={() => move(c.key, -1)}>
                      <ArrowUp className="size-3 -rotate-90 text-muted-foreground" />
                    </button>
                    <button aria-label={`Move ${c.label} right`} onClick={() => move(c.key, 1)}>
                      <ArrowDown className="size-3 -rotate-90 text-muted-foreground" />
                    </button>
                    <button aria-label={`Hide ${c.label}`} onClick={() => setView({ ...view, hidden: [...view.hidden, c.key] })}>
                      <EyeOff className="size-3 text-muted-foreground" />
                    </button>
                    {canManage && c.field && (
                      <>
                        <button aria-label={`Rename ${c.label}`} onClick={() => renameColumn(c.field!)}>
                          <Pencil className="size-3 text-muted-foreground" />
                        </button>
                        <button aria-label={`Remove ${c.label}`} onClick={() => removeColumn(c.field!)}>
                          <Archive className="size-3 text-muted-foreground" />
                        </button>
                      </>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(([g, list]) => (
              <Fragment key={g || "all"}>
                {view.group && (
                  <tr className="bg-muted/40">
                    <td colSpan={visible.length + 1} className="p-2 text-xs font-semibold">
                      {g} · {list.length}
                    </td>
                  </tr>
                )}
                {list.map((v) => (
                  <tr key={v.id} className="border-t border-border">
                    {canManage && (
                      <td className="p-2">
                        <Checkbox
                          checked={selected.has(v.id)}
                          aria-label={`Select ${v.display_name}`}
                          onCheckedChange={(on) => {
                            const s = new Set(selected);
                            if (on) s.add(v.id);
                            else s.delete(v.id);
                            setSelected(s);
                          }}
                        />
                      </td>
                    )}
                    {visible.map((c) => {
                      const val = valueOf(v, c);
                      const isEditing = editing?.id === v.id && editing.key === c.key;
                      return (
                        <td
                          key={c.key}
                          className={`max-w-[16rem] truncate p-2 ${canEdit(c) ? "cursor-text hover:bg-secondary/40" : ""}`}
                          onDoubleClick={() =>
                            canEdit(c) &&
                            setEditing({ id: v.id, key: c.key, value: Array.isArray(val) ? val.join(", ") : String(val ?? "") })
                          }
                        >
                          {isEditing ? (
                            c.kind === "bool" || c.field?.field_type === "checkbox" ? (
                              <Select defaultValue={String(Boolean(val))} onValueChange={(x) => saveCell(v, c, x)}>
                                <SelectTrigger className="h-7"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="true">Yes</SelectItem>
                                  <SelectItem value="false">No</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : c.kind === "dispatch" ? (
                              <Select defaultValue={String(val)} onValueChange={(x) => saveCell(v, c, x)}>
                                <SelectTrigger className="h-7"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {Object.entries(DISPATCH_METHOD_LABELS).map(([k, l]) => (
                                    <SelectItem key={k} value={k}>{l}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : c.field?.field_type === "select" ? (
                              <Select defaultValue={String(val ?? "")} onValueChange={(x) => saveCell(v, c, x)}>
                                <SelectTrigger className="h-7"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {c.field.options.map((o) => (
                                    <SelectItem key={o} value={o}>{o}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                autoFocus
                                className="h-7"
                                list={c.key === "tags" ? "vendor-tag-options" : undefined}
                                type={c.field?.field_type === "number" ? "number" : c.field?.field_type === "date" ? "date" : "text"}
                                value={editing.value}
                                onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void saveCell(v, c, editing.value);
                                  if (e.key === "Escape") setEditing(null);
                                }}
                                onBlur={() => void saveCell(v, c, editing.value)}
                              />
                            )
                          ) : c.kind === "tags" && Array.isArray(val) ? (
                            <span className="flex gap-1">
                              {val.map((t) => (
                                <Chip key={String(t)}>{String(t)}</Chip>
                              ))}
                            </span>
                          ) : (
                            display(val, c) || <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No vendors to show.</p>}
      </div>

      {canManage ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border p-3">
          <div>
            <p className="text-xs text-muted-foreground">New column</p>
            <Input className="h-9 w-48" placeholder="Column name" value={newCol.label} onChange={(e) => setNewCol({ ...newCol, label: e.target.value })} />
          </div>
          <Select value={newCol.type} onValueChange={(t) => setNewCol({ ...newCol, type: t })}>
            <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["text", "number", "date", "select", "multi_select", "checkbox", "url"].map((t) => (
                <SelectItem key={t} value={t}>{t.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(newCol.type === "select" || newCol.type === "multi_select") && (
            <Input className="h-9 w-56" placeholder="Options, comma separated" value={newCol.options} onChange={(e) => setNewCol({ ...newCol, options: e.target.value })} />
          )}
          <Button size="sm" onClick={addColumn} disabled={!newCol.label.trim()}>
            <Plus className="size-4" /> Add column
          </Button>
          <p className="basis-full text-xs text-muted-foreground">
            Double-click a cell to edit. Locked columns are system fields used by dispatch and integrations —
            they can't be renamed or removed{isLead ? "" : ", and only Admin or the Director of Operations can change their values"}.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Read-only. Managers and supervisors maintain this table.</p>
      )}
    </div>
  );
}
