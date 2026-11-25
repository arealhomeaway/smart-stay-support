import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireCapability } from "@/components/RequireCapability";
import { useRole } from "@/hooks/useRole";
import { useGuestReadyStandards } from "@/hooks/useGuestReadyStandards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canEditStandards, dueModeLabel, type GuestReadyStandard } from "@/lib/guest-ready-standards";

export const Route = createFileRoute("/_authenticated/guest-ready-standards")({
  head: () => ({
    meta: [
      { title: "Guest-ready standards · Resolve" },
      { name: "description", content: "When each ticket type must be done, and which due dates are locked." },
      { property: "og:title", content: "Guest-ready standards · Resolve" },
      { property: "og:description", content: "When each ticket type must be done, and which due dates are locked." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireCapability capability="playbooks_view" title="Guest-ready standards">
      <GuestReadyStandardsPage />
    </RequireCapability>
  ),
});

type Db = { from: (t: string) => any; rpc: (f: string, a: unknown) => any };
const db = supabase as unknown as Db;
const NO_TYPE = "none";

type Draft = { id: string | null; label: string; mustBeDone: string; locked: boolean; workTypeId: string; p1: boolean; lockNote: string };

function toDraft(s: GuestReadyStandard | null): Draft {
  return s
    ? { id: s.id, label: s.label, mustBeDone: s.mustBeDone, locked: s.locked, workTypeId: s.workTypeId ?? NO_TYPE, p1: s.matchPriority === "p1", lockNote: s.lockNote ?? "" }
    : { id: null, label: "", mustBeDone: "Not set", locked: false, workTypeId: NO_TYPE, p1: false, lockNote: "" };
}

function GuestReadyStandardsPage() {
  const role = useRole();
  const qc = useQueryClient();
  const q = useGuestReadyStandards();
  const canEdit = canEditStandards(role.roles, role.access.seats) && !role.readOnly && Boolean(q.data?.saved);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const types = useQuery({
    queryKey: ["work-types-names"],
    enabled: canEdit,
    queryFn: async () => {
      const { data, error } = await supabase.from("work_types").select("id, name").eq("active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  async function save() {
    if (!draft || !draft.label.trim()) return;
    const original = q.data?.rows.find((r) => r.id === draft.id) ?? null;
    setSaving(true);
    try {
      const { error } = await db.rpc("save_guest_ready_standard", {
        _id: draft.id,
        _label: draft.label,
        _must_be_done: draft.mustBeDone,
        _locked: draft.locked,
        // An existing row keeps its rule; a new row starts as Not set (today's due date rule).
        _rule: original?.rule ?? "not_set",
        _rule_days: original?.ruleDays ?? null,
        _work_type_id: draft.workTypeId === NO_TYPE ? null : draft.workTypeId,
        _lock_note: draft.locked ? draft.lockNote : null,
      });
      if (error) throw new Error(error.message);
      toast.success("Saved.");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["guest-ready-standards"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const rows = q.data?.rows ?? [];
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-24 sm:pb-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Guest-ready standards</h1>
          <p className="text-sm text-muted-foreground">When each ticket type must be done.</p>
        </div>
        {canEdit ? (
          <Button className="min-h-11" onClick={() => setDraft(toDraft(null))}>
            <Plus className="size-4" aria-hidden="true" /> Add ticket type
          </Button>
        ) : null}
      </div>

      {q.isLoading ? <p className="text-muted-foreground">Loading</p> : null}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Ticket type</th>
              <th className="px-3 py-2 font-medium">Must be done</th>
              <th className="px-3 py-2 font-medium">Due date</th>
              {canEdit ? <th className="px-3 py-2"><span className="sr-only">Edit</span></th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top" data-testid="standard-row">
                <td className="px-3 py-3 font-medium">{r.label}</td>
                <td className="px-3 py-3">{r.mustBeDone}</td>
                <td className="px-3 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    {r.locked ? <Lock className="size-3.5" aria-hidden="true" /> : null}
                    {dueModeLabel(r.locked)}
                  </span>
                </td>
                {canEdit ? (
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" className="min-h-11" onClick={() => setDraft(toDraft(r))}>Edit</Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4" data-testid="standard-editor">
          <h2 className="font-semibold">{draft.id ? "Edit ticket type" : "Add ticket type"}</h2>
          <div className="space-y-1">
            <Label htmlFor="gs-label">Ticket type</Label>
            <Input id="gs-label" className="min-h-11" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </div>
          {!draft.p1 ? (
            <div className="space-y-1">
              <Label>Linked ticket type</Label>
              <Select value={draft.workTypeId} onValueChange={(v) => setDraft({ ...draft, workTypeId: v })}>
                <SelectTrigger className="min-h-11" aria-label="Linked ticket type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TYPE}>None yet</SelectItem>
                  {(types.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="gs-must">Must be done</Label>
            <Input id="gs-must" className="min-h-11" value={draft.mustBeDone} onChange={(e) => setDraft({ ...draft, mustBeDone: e.target.value })} />
          </div>
          <div className="flex min-h-11 items-center gap-3">
            <Switch id="gs-locked" checked={draft.locked} onCheckedChange={(v) => setDraft({ ...draft, locked: v })} />
            <Label htmlFor="gs-locked">{dueModeLabel(draft.locked)}</Label>
          </div>
          {draft.locked ? (
            <div className="space-y-1">
              <Label htmlFor="gs-note">Lock note on the ticket</Label>
              <Input id="gs-note" className="min-h-11" placeholder="Cleaning reviews are always due before 4:00 PM." value={draft.lockNote} onChange={(e) => setDraft({ ...draft, lockNote: e.target.value })} />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11" disabled={saving || !draft.label.trim()} onClick={() => void save()}>{saving ? "Saving" : "Save"}</Button>
            <Button variant="ghost" className="min-h-11" onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
