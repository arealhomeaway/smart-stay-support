import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OUTCOME_TYPES,
  PRIORITIES,
  SOURCE_CHANNELS,
  labelFor,
  priorityMeta,
  priorityTone,
  slaDueDates,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/tickets/new")({
  head: () => ({
    meta: [
      { title: "Log a matter — Resolve Operations" },
      {
        name: "description",
        content:
          "Log a completed interaction in seconds or open an active task with its response standard and playbook attached.",
      },
      { property: "og:title", content: "Log a matter — Resolve Operations" },
      {
        property: "og:description",
        content: "Log a completed interaction or open an active task with its response standard attached.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewMatter,
});

type Mode = "completed_interaction" | "active_task";

function NewMatter() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("active_task");
  const [saving, setSaving] = useState(false);
  const [priorityTouched, setPriorityTouched] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    property_id: "",
    work_type_id: "",
    priority: "p3",
    priority_override_reason: "",
    source_channel: "guest_message",
    guest_name: "",
    guest_contact: "",
    guest_in_residence: true,
    playbook_id: "auto",
    // completed-interaction only
    outcome_type: "resolved",
    resolution_notes: "",
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

  const { data: workTypes } = useQuery({
    queryKey: ["work-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_types")
        .select("*")
        .eq("active", true)
        .order("sort_order");
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

  const workType = useMemo(
    () => workTypes?.find((w) => w.id === form.work_type_id) ?? null,
    [workTypes, form.work_type_id],
  );

  // The work type sets the default priority — the coordinator can override,
  // but then they owe a reason.
  useEffect(() => {
    if (workType && !priorityTouched) {
      setForm((f) => ({ ...f, priority: workType.default_priority }));
    }
  }, [workType, priorityTouched]);

  const overridden = Boolean(workType && form.priority !== workType.default_priority);
  const meta = priorityMeta(form.priority);

  const resolvedPlaybookId = useMemo(() => {
    if (form.playbook_id !== "auto") return form.playbook_id === "none" ? null : form.playbook_id;
    return workType?.playbook_id ?? null;
  }, [form.playbook_id, workType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.work_type_id) {
      toast.error("Pick a work type — it sets the response standard.");
      return;
    }
    if (overridden && !form.priority_override_reason.trim()) {
      toast.error("You changed the priority. Say why in one line.");
      return;
    }
    if (mode === "completed_interaction" && !form.resolution_notes.trim()) {
      toast.error("Write what you did — that is the whole record.");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const now = new Date();
      const { response_due_at, action_due_at } = slaDueDates(form.priority, now);
      const completed = mode === "completed_interaction";

      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          record_type: mode,
          title: form.title,
          description: form.description || null,
          property_id: form.property_id || null,
          work_type_id: form.work_type_id,
          category: workType?.category ?? "other",
          bucket: workType?.bucket ?? null,
          priority: form.priority,
          priority_override_reason: overridden ? form.priority_override_reason.trim() : null,
          source_channel: form.source_channel,
          guest_name: form.guest_name || null,
          guest_contact: form.guest_contact || null,
          guest_in_residence: form.guest_in_residence,
          playbook_id: completed ? null : resolvedPlaybookId,
          reported_at: now.toISOString(),
          response_due_at: completed ? null : response_due_at,
          action_due_at: completed ? null : action_due_at,
          acknowledged_at: now.toISOString(),
          action_started_at: completed ? now.toISOString() : null,
          due_at: completed ? null : action_due_at,
          created_by: userId,
          accountable_owner: userId,
          current_action_owner: completed ? null : userId,
          status: completed ? "closed" : "open",
          outcome_type: completed ? form.outcome_type : null,
          resolution_notes: completed ? form.resolution_notes.trim() : null,
          resolved_at: completed ? now.toISOString() : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (!completed && resolvedPlaybookId) {
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
          kind: completed ? "completed" : "created",
          event_type: completed ? "logged_completed" : "created",
          channel: form.source_channel,
          body: completed
            ? `Logged as a completed interaction. ${form.resolution_notes.trim()}`
            : `Matter opened at ${meta.short}. Acknowledge within ${meta.responseMinutes}m.`,
        });
      }

      toast.success(completed ? "Interaction logged." : "Matter opened with its playbook and clocks running.");
      router.navigate({ to: "/tickets/$ticketId", params: { ticketId: ticket.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this matter");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Log a matter</h1>
        <p className="mt-1 text-muted-foreground">
          One record for everything. Already handled it? Log it and move on.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={mode === "completed_interaction"}
          onClick={() => setMode("completed_interaction")}
          icon={<Zap className="size-4" />}
          title="Completed interaction"
          hint="Done in one touch. Logged for history, never hits the queue."
        />
        <ModeCard
          active={mode === "active_task"}
          onClick={() => setMode("active_task")}
          icon={<Clock className="size-4" />}
          title="Active task"
          hint="Needs follow-through. Clocks start and you own it."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{mode === "completed_interaction" ? "What happened?" : "What needs to happen?"}</CardTitle>
          <CardDescription>Write it the way it was reported to you.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="title">Summary</Label>
              <Input
                id="title"
                required
                placeholder="Leak under the kitchen sink"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
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
                <Label>How did it come in?</Label>
                <Select
                  value={form.source_channel}
                  onValueChange={(v) => setForm({ ...form, source_channel: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Work type</Label>
              <Select
                value={form.work_type_id}
                onValueChange={(v) => setForm({ ...form, work_type_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick the closest match" />
                </SelectTrigger>
                <SelectContent>
                  {(workTypes ?? []).map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} · {w.default_priority.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workType && mode === "active_task" && (
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                  <p className="font-medium">Response standard</p>
                  <p className="mt-1 text-muted-foreground">
                    Acknowledge within {workType.response_minutes}m · start within{" "}
                    {workType.action_start_minutes === 0 ? "immediately" : `${workType.action_start_minutes}m`}
                    {workType.completion_target ? ` · complete ${workType.completion_target.toLowerCase()}` : ""}
                  </p>
                  {workType.required_closure_evidence && (
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-medium text-foreground">To close:</span>{" "}
                      {workType.required_closure_evidence}
                    </p>
                  )}
                </div>
              )}
            </div>

            {mode === "active_task" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => {
                      setPriorityTouched(true);
                      setForm({ ...form, priority: v });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{meta.summary}</p>
                </div>

                <div className="space-y-2">
                  <Label>Playbook</Label>
                  <Select
                    value={form.playbook_id}
                    onValueChange={(v) => setForm({ ...form, playbook_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Use the work type&apos;s playbook</SelectItem>
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
            )}

            {mode === "active_task" && overridden && (
              <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <Label htmlFor="override">
                  Why {form.priority.toUpperCase()} instead of {workType?.default_priority.toUpperCase()}?
                </Label>
                <Input
                  id="override"
                  placeholder="Guest is elderly and alone in the home"
                  value={form.priority_override_reason}
                  onChange={(e) => setForm({ ...form, priority_override_reason: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Details</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="What the guest said, what they've tried, anything the tech should know."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {mode === "completed_interaction" && (
              <>
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select
                    value={form.outcome_type}
                    onValueChange={(v) => setForm({ ...form, outcome_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTCOME_TYPES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolution">What did you do?</Label>
                  <Textarea
                    id="resolution"
                    rows={3}
                    required
                    placeholder="Sent the guest the parking instructions and confirmed they found the spot."
                    value={form.resolution_notes}
                    onChange={(e) => setForm({ ...form, resolution_notes: e.target.value })}
                  />
                </div>
              </>
            )}

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
                <p className="text-xs text-muted-foreground">Drives urgency and required guest communication.</p>
              </div>
              <Switch
                checked={form.guest_in_residence}
                onCheckedChange={(v) => setForm({ ...form, guest_in_residence: v })}
              />
            </div>

            {mode === "active_task" && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <Badge variant="outline" className={priorityTone(form.priority)}>
                  {meta.short}
                </Badge>
                <span className="text-muted-foreground">
                  Acknowledge by {new Date(Date.now() + meta.responseMinutes * 60_000).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {labelFor(SOURCE_CHANNELS, form.source_channel)}
                </span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving
                ? "Saving…"
                : mode === "completed_interaction"
                  ? "Log interaction"
                  : "Open active task"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </button>
  );
}
