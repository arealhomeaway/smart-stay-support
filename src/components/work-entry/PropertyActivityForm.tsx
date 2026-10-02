import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTIVITY_CATEGORIES } from "@/lib/work-entry";

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * Log Property Activity — history only. Never a Ticket: no queue, no clocks,
 * no handoff, nothing to close.
 */
export function PropertyActivityForm({
  propertyId,
  propertyPicker,
  isDemo,
  onLogged,
}: {
  propertyId: string;
  propertyPicker: React.ReactNode;
  isDemo: boolean;
  onLogged: (propertyId: string) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    occurred_at: localNow(),
    category: "",
    what_happened: "",
    outcome: "",
    involved: "",
  });

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!propertyId) { toast.error("Pick the property."); return; }
    if (!f.category) { toast.error("Pick a category."); return; }
    if (!f.what_happened.trim() || !f.outcome.trim())
      { toast.error("Say what happened and what was done."); return; }
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("property_activity_log").insert({
      property_id: propertyId,
      occurred_at: new Date(f.occurred_at).toISOString(),
      category: f.category,
      what_happened: f.what_happened.trim(),
      outcome: f.outcome.trim(),
      involved: f.involved.trim() || null,
      ...(u.user ? { logged_by: u.user.id } : {}),
      is_demo: isDemo,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    void qc.invalidateQueries({ queryKey: ["property-activity", propertyId] });
    toast.success("Saved to the property's history.");
    onLogged(propertyId);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {propertyPicker}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pa-when">When it happened</Label>
          <Input
            id="pa-when"
            type="datetime-local"
            value={f.occurred_at}
            onChange={(e) => setF({ ...f, occurred_at: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
            <SelectTrigger aria-label="Category">
              <SelectValue placeholder="Pick a category" />
            </SelectTrigger>
            <SelectContent>
              {ACTIVITY_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pa-what">What happened</Label>
        <Textarea
          id="pa-what"
          rows={3}
          value={f.what_happened}
          onChange={(e) => setF({ ...f, what_happened: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pa-outcome">What was done / outcome</Label>
        <Textarea
          id="pa-outcome"
          rows={2}
          value={f.outcome}
          onChange={(e) => setF({ ...f, outcome: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pa-who">Who was involved (optional)</Label>
        <Input
          id="pa-who"
          placeholder="Cleaner, vendor, guest…"
          value={f.involved}
          onChange={(e) => setF({ ...f, involved: e.target.value })}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        This goes into the property's history only. It does not open a Ticket, start any clock or
        appear in My Work.
      </p>
      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving…" : "Save to property history"}
      </Button>
    </form>
  );
}
