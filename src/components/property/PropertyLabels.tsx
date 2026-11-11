/**
 * Labels on homes (register P2). Gray chips; an Admin creates, renames,
 * removes and assigns; other staff who edit a home pick from the list on one
 * home and can remove one. Every change is saved with the person and the time
 * by the database; the list here only shows it.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/ui/page";
import { usDateTime } from "@/lib/dates";
import { LABEL_CREATE_NOTE } from "@/lib/property-page";

export type LabelRow = { id: string; name: string; system_key?: string | null };

export function LabelChip({ name, onRemove }: { name: string; onRemove?: (() => void) | undefined }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-muted px-2.5 text-xs text-muted-foreground">
      {name}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="-mr-2 inline-flex size-11 items-center justify-center rounded-full hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}

/** Live labels on the list. */
export function useLabelList() {
  return useQuery({
    queryKey: ["property-labels"],
    queryFn: async (): Promise<LabelRow[]> => {
      // system_key marks a label Resolve adds and removes by itself (Active Owner); it exists only
      // once the staged change is applied, so read without it until then.
      const withKey = await supabase
        .from("property_labels")
        .select("id, name, system_key" as "id, name")
        .is("retired_at", null)
        .order("name");
      if (!withKey.error) return (withKey.data ?? []) as LabelRow[];
      const { data, error } = await supabase
        .from("property_labels")
        .select("id, name")
        .is("retired_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Live labels on one home, with the last change. */
export function useHomeLabels(propertyId: string) {
  return useQuery({
    queryKey: ["property-labels", "home", propertyId],
    queryFn: async () => {
      const [assigned, last] = await Promise.all([
        supabase
          .from("property_label_assignments")
          .select("label_id, property_labels(id, name)")
          .eq("property_id", propertyId)
          .is("removed_at", null),
        supabase
          .from("property_label_events")
          .select("actor_id, actor_label, at")
          .eq("property_id", propertyId)
          .order("at", { ascending: false })
          .limit(1),
      ]);
      if (assigned.error) throw assigned.error;
      const system = new Set(
        ((await supabase.from("property_labels").select("id, system_key" as "id").not("system_key" as "id", "is", null)).data ?? [])
          .map((r) => r.id),
      );
      const labels = (assigned.data ?? [])
        .map((a) => a.property_labels as unknown as LabelRow | null)
        .filter((l): l is LabelRow => Boolean(l))
        .map((l) => (system.has(l.id) ? { ...l, system_key: "system" } : l))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { labels, last: (last.data ?? [])[0] ?? null };
    },
  });
}

export function PropertyLabelsSection({
  propertyId,
  canEdit,
  isAdmin,
  userId,
}: {
  propertyId: string;
  canEdit: boolean;
  isAdmin: boolean;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const list = useLabelList();
  const home = useHomeLabels(propertyId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LabelRow[]>([]);
  const [pick, setPick] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [savedNow, setSavedNow] = useState(false);

  const current = home.data?.labels ?? [];
  const available = useMemo(
    () => (list.data ?? []).filter((l) => !l.system_key && !draft.some((d) => d.id === l.id)),
    [list.data, draft],
  );

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["property-labels"] });
    void qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
    void qc.invalidateQueries({ queryKey: ["property-hub", propertyId] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const adds = draft.filter((d) => !current.some((c) => c.id === d.id));
      const removes = current.filter((c) => !draft.some((d) => d.id === c.id));
      for (const a of adds) {
        const { error } = await supabase.rpc("property_label_add", { _label_id: a.id, _property_ids: [propertyId] });
        if (error) throw error;
      }
      for (const r of removes) {
        const { error } = await supabase.rpc("property_label_remove", { _label_id: r.id, _property_id: propertyId });
        if (error) throw error;
      }
      return adds.length + removes.length;
    },
    onSuccess: (n) => {
      setEditing(false);
      setSavedNow(n > 0);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("property_label_create", { _name: newName });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (id) => {
      setDraft((d) => [...d, { id, name: newName.trim() }]);
      setNewName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rename = useMutation({
    mutationFn: async (v: { id: string; name: string }) => {
      const { error } = await supabase.rpc("property_label_rename", { _label_id: v.id, _name: v.name });
      if (error) throw error;
    },
    onSuccess: () => {
      setRenaming(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const retire = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("property_label_retire", { _label_id: id });
      if (error) throw error;
    },
    onSuccess: (_v, id) => {
      setDraft((d) => d.filter((x) => x.id !== id));
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const last = home.data?.last ?? null;
  const lastLine = savedNow
    ? "Saved just now by you"
    : last
      ? `Saved ${usDateTime(last.at)} by ${last.actor_id && last.actor_id === userId ? "you" : (last.actor_label ?? "ARHA staff")}`
      : null;

  return (
    <SectionCard
      title="Labels"
      actions={
        canEdit && !editing ? (
          <Button
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setDraft(current);
              setEditing(true);
              setSavedNow(false);
            }}
          >
            Edit labels
          </Button>
        ) : null
      }
    >
      <div id="labels" className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(editing ? draft : current).length === 0 ? (
            <span className="text-sm text-muted-foreground">No labels yet.</span>
          ) : (
            (editing ? draft : current).map((l) => (
              <LabelChip
                key={l.id}
                name={l.name}
                onRemove={editing && !l.system_key ? () => setDraft((d) => d.filter((x) => x.id !== l.id)) : undefined}
              />
            ))
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={pick}
                onValueChange={(v) => {
                  const found = (list.data ?? []).find((l) => l.id === v);
                  if (found) setDraft((d) => [...d, found]);
                  setPick("");
                }}
              >
                <SelectTrigger className="min-h-11 w-56" aria-label="Add label">
                  <SelectValue placeholder="Add label" />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">Every label is on this home.</div>
                  ) : (
                    available.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {isAdmin ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium">The label list</p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="min-h-11 max-w-xs"
                    aria-label="New label"
                    placeholder="New label"
                    maxLength={40}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <Button
                    className="min-h-11"
                    variant="outline"
                    disabled={!newName.trim() || create.isPending}
                    onClick={() => create.mutate()}
                  >
                    Create
                  </Button>
                </div>
                <ul className="divide-y divide-border">
                  {(list.data ?? []).map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                      {renaming?.id === l.id ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <Input
                            className="min-h-11 w-48"
                            aria-label={`Rename ${l.name}`}
                            maxLength={40}
                            value={renaming.name}
                            onChange={(e) => setRenaming({ id: l.id, name: e.target.value })}
                          />
                          <Button
                            size="sm"
                            className="min-h-11"
                            disabled={!renaming.name.trim() || rename.isPending}
                            onClick={() => rename.mutate(renaming)}
                          >
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setRenaming(null)}>
                            Cancel
                          </Button>
                        </span>
                      ) : (
                        <span className="text-sm">{l.name}</span>
                      )}
                      {renaming?.id === l.id ? null : l.system_key ? (
                        <span className="text-xs text-muted-foreground">Follows the homeowner program</span>
                      ) : (
                        <span className="flex gap-1">
                          <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setRenaming({ id: l.id, name: l.name })}>
                            Rename
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-11"
                            disabled={retire.isPending}
                            onClick={() => {
                              if (window.confirm(`Remove ${l.name} from the list? It comes off every home. History stays.`))
                                retire.mutate(l.id);
                            }}
                          >
                            Remove
                          </Button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{LABEL_CREATE_NOTE}</p>
            )}

            <div className="flex gap-2">
              <Button className="min-h-11" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? "Saving…" : "Save"}
              </Button>
              <Button className="min-h-11" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {lastLine ? <p className="text-xs text-muted-foreground">{lastLine}</p> : null}
      </div>
    </SectionCard>
  );
}
