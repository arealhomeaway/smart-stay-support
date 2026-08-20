import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPEN_STATUSES } from "@/lib/tickets";
import { listOwnerRezListings, importOwnerRezProperties } from "@/lib/ownerrez.functions";
import { listBreezewayHomes } from "@/lib/breezeway.functions";

export const Route = createFileRoute("/_authenticated/properties")({
  head: () => ({
    meta: [
      { title: "Properties — Resolve Operations" },
      { name: "description", content: "Every managed home with access notes and its live issue count." },
      { property: "og:title", content: "Properties — Resolve Operations" },
      { property: "og:description", content: "Managed homes with access notes and live issue counts." },
    ],
  }),
  component: PropertiesPage,
});

const empty = {
  name: "",
  nickname: "",
  address_line1: "",
  city: "",
  state: "",
  postal_code: "",
  unit: "",
  access_notes: "",
  wifi_notes: "",
  notes: "",
};

function PropertiesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchListings = useServerFn(listOwnerRezListings);
  const { data: ownerRez } = useQuery({
    queryKey: ["ownerrez-listings"],
    queryFn: () => fetchListings(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const runImport = useServerFn(importOwnerRezProperties);

  async function importAll() {
    setImporting(true);
    try {
      const res = await runImport();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const added = res.created + res.matched;
      toast.success(
        added === 0
          ? "All OwnerRez listings are already linked."
          : `${res.created} home${res.created === 1 ? "" : "s"} added, ${res.matched} linked to existing homes.`,
      );
      await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
      await qc.invalidateQueries({ queryKey: ["properties"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function linkListing(propertyId: string, listingId: string) {
    const { error } = await supabase
      .from("properties")
      .update({
        ownerrez_property_id: listingId === "none" ? null : listingId,
        ownerrez_synced_at: new Date().toISOString(),
      })
      .eq("id", propertyId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(listingId === "none" ? "Unlinked from OwnerRez." : "Linked to OwnerRez.");
    await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
  }

  const { data, isLoading } = useQuery({
    queryKey: ["properties-with-counts"],
    queryFn: async () => {
      const [properties, tickets] = await Promise.all([
        supabase.from("properties").select("*").order("name"),
        supabase.from("tickets").select("id, property_id, status"),
      ]);
      if (properties.error) throw properties.error;
      return { properties: properties.data ?? [], tickets: tickets.data ?? [] };
    },
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("properties").insert({
        ...form,
        nickname: form.nickname || null,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Property added.");
      setForm(empty);
      setOpen(false);
      await qc.invalidateQueries({ queryKey: ["properties-with-counts"] });
      await qc.invalidateQueries({ queryKey: ["properties"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the property");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Properties</h1>
          <p className="mt-1 text-muted-foreground">Every ticket links back to one of these homes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={importAll} disabled={importing}>
          {importing ? "Importing…" : "Import from OwnerRez"}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add property</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add a property</DialogTitle>
              <DialogDescription>Access notes here show up on every ticket for this home.</DialogDescription>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Property name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <Field label="Nickname" value={form.nickname} onChange={(v) => setForm({ ...form, nickname: v })} />
                <Field label="Street address" value={form.address_line1} onChange={(v) => setForm({ ...form, address_line1: v })} />
                <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
                <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
                <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
                <Field label="Postal code" value={form.postal_code} onChange={(v) => setForm({ ...form, postal_code: v })} />
              </div>
              <div className="space-y-2">
                <Label>Access notes</Label>
                <Textarea
                  rows={3}
                  placeholder="Lock codes, parking, gate, where the water shutoff is."
                  value={form.access_notes}
                  onChange={(e) => setForm({ ...form, access_notes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Other notes</Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Saving…" : "Save property"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : data.properties.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No properties yet. Add your first home to start logging tickets against it.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.properties.map((p) => {
            const all = data.tickets.filter((t) => t.property_id === p.id);
            const openCount = all.filter((t) => OPEN_STATUSES.includes(t.status)).length;
            return (
              <Card key={p.id}>
                <CardHeader>
                  <CardTitle>{p.nickname ?? p.name}</CardTitle>
                  <CardDescription>
                    {[p.address_line1, p.unit, p.city, p.state].filter(Boolean).join(", ") || "No address on file"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>
                    <span className={openCount > 0 ? "font-medium text-danger" : "text-muted-foreground"}>
                      {openCount} open
                    </span>{" "}
                    <span className="text-muted-foreground">· {all.length} total tickets</span>
                  </p>
                  {p.access_notes && <p className="text-muted-foreground">{p.access_notes}</p>}
                  <div className="space-y-1 border-t border-border pt-3">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      OwnerRez listing
                    </Label>
                    {ownerRez?.ok ? (
                      <Select
                        value={p.ownerrez_property_id ?? "none"}
                        onValueChange={(v) => linkListing(p.id, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Not linked" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not linked</SelectItem>
                          {ownerRez.data.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                              {l.location ? ` — ${l.location}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {ownerRez?.error ?? "Checking OwnerRez…"}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
