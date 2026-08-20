import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, PRIORITIES, priorityHours } from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/tickets/new")({
  head: () => ({
    meta: [
      { title: "Log a new ticket — Resolve" },
      { name: "description", content: "Log a guest or maintenance issue and load the matching resolution playbook." },
      { property: "og:title", content: "Log a new ticket — Resolve" },
      { property: "og:description", content: "Log an issue and load the matching resolution playbook." },
    ],
  }),
  component: NewTicket,
});

function NewTicket() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    property_id: "",
    category: "plumbing",
    priority: "urgent",
    guest_name: "",
    guest_contact: "",
    guest_in_residence: true,
    playbook_id: "auto",
  });

  const { data: properties } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, name, nickname")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: playbooks } = useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playbooks")
        .select("id, title, category")
        .eq("active", true)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const resolvedPlaybookId = useMemo(() => {
    if (form.playbook_id !== "auto") return form.playbook_id === "none" ? null : form.playbook_id;
    return playbooks?.find((p) => p.category === form.category)?.id ?? null;
  }, [form.playbook_id, form.category, playbooks]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const dueAt = new Date(Date.now() + priorityHours(form.priority) * 3600_000).toISOString();

      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          title: form.title,
          description: form.description || null,
          property_id: form.property_id || null,
          category: form.category,
          priority: form.priority,
          guest_name: form.guest_name || null,
          guest_contact: form.guest_contact || null,
          guest_in_residence: form.guest_in_residence,
          playbook_id: resolvedPlaybookId,
          due_at: dueAt,
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (resolvedPlaybookId) {
        const { data: steps, error: stepsError } = await supabase
          .from("playbook_steps")
          .select("position, instruction, detail, required, photo_required")
          .eq("playbook_id", resolvedPlaybookId)
          .order("position");
        if (stepsError) throw stepsError;
        if (steps?.length) {
          const { error: insertError } = await supabase
            .from("ticket_steps")
            .insert(steps.map((s) => ({ ...s, ticket_id: ticket.id })));
          if (insertError) throw insertError;
        }
      }

      if (userId) {
        await supabase.from("ticket_activity").insert({
          ticket_id: ticket.id,
          author_id: userId,
          kind: "created",
          body: "Ticket created.",
        });
      }

      toast.success("Ticket created with its playbook steps.");
      router.navigate({ to: "/tickets/$ticketId", params: { ticketId: ticket.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the ticket");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Log a ticket</h1>
        <p className="mt-1 text-muted-foreground">
          The matching playbook loads automatically so nothing gets skipped.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issue details</CardTitle>
          <CardDescription>Write it the way the guest described it.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">What is happening?</Label>
              <Input
                id="title"
                required
                placeholder="Leak under the kitchen sink"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Details</Label>
              <Textarea
                id="description"
                rows={4}
                placeholder="Guest message, what they've tried, anything the tech should know."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Property</Label>
                <Select
                  value={form.property_id}
                  onValueChange={(v) => setForm({ ...form, property_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a property" />
                  </SelectTrigger>
                  <SelectContent>
                    {(properties ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nickname ?? p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {properties?.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    <Link to="/properties" className="text-primary hover:underline">
                      Add your first property
                    </Link>
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label} · respond within {p.hours}h
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Playbook</Label>
                <Select value={form.playbook_id} onValueChange={(v) => setForm({ ...form, playbook_id: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Match my category automatically</SelectItem>
                    <SelectItem value="none">No playbook</SelectItem>
                    {(playbooks ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="guest_name">Guest name</Label>
                <Input
                  id="guest_name"
                  value={form.guest_name}
                  onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest_contact">Guest contact</Label>
                <Input
                  id="guest_contact"
                  placeholder="Phone, email or platform thread"
                  value={form.guest_contact}
                  onChange={(e) => setForm({ ...form, guest_contact: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Guest currently in the home</p>
                <p className="text-xs text-muted-foreground">Raises urgency and requires guest confirmation.</p>
              </div>
              <Switch
                checked={form.guest_in_residence}
                onCheckedChange={(v) => setForm({ ...form, guest_in_residence: v })}
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Creating…" : "Create ticket"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
