/** Property page, Operations tab: the home's Guidebook link (Emily, Nov 25). Operations edit; shown on arrival checks. */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/useRole";

type Loose = { from: (t: string) => any; rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }; // eslint-disable-line @typescript-eslint/no-explicit-any

export function useGuidebookLink(propertyId: string | null) {
  return useQuery({
    queryKey: ["guidebook-link", propertyId],
    enabled: Boolean(propertyId),
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as Loose).from("properties").select("guidebook_url").eq("id", propertyId).maybeSingle();
      if (error) return null; // field not live until property-guidebook-link is applied
      return ((data as { guidebook_url?: string | null } | null)?.guidebook_url ?? null) as string | null;
    },
  });
}

export function GuidebookLinkCard({ propertyId }: { propertyId: string }) {
  const role = useRole();
  const canEdit = !role.readOnly && !role.onboardingOnly;
  const q = useGuidebookLink(propertyId);
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(q.data ?? ""), [q.data]);
  async function save() {
    setSaving(true);
    const { error } = await (supabase as unknown as Loose).rpc("set_property_guidebook_link", { _property_id: propertyId, _url: value });
    setSaving(false);
    if (error) { toast.error(error.message.includes("https") ? "Paste a full link starting with https://" : "Not saved. Try again."); return; }
    toast.success("Saved.");
    void qc.invalidateQueries({ queryKey: ["guidebook-link", propertyId] });
  }
  return (
    <SectionCard title="Guidebook link">
      {canEdit ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input className="min-h-11" type="url" inputMode="url" placeholder="https://" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Guidebook link" />
          <Button className="min-h-11" onClick={() => void save()} disabled={saving || value.trim() === (q.data ?? "")}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      ) : q.data ? (
        <a className="break-all text-primary underline" href={q.data} target="_blank" rel="noreferrer">{q.data}</a>
      ) : (
        <p className="text-sm text-muted-foreground">Not set</p>
      )}
    </SectionCard>
  );
}
