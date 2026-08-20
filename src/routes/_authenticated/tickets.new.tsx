import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPropertyStay } from "@/lib/ownerrez.functions";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Users, Zap } from "lucide-react";
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
  GUEST_IMPACT,
  OCCUPANCY_STATUS,
  OUTCOME_TYPES,
  PRIORITIES,
  SOURCE_CHANNELS,
  labelFor,
  mechanicalPriority,
  priorityMeta,
  priorityTone,
  slaDueDates,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/tickets/new")({
  head: () => ({
    meta: [
      { title: "Log work — Resolve Operations" },
      {
        name: "description",
        content:
          "Log a one-touch resolution in seconds or open a ticket with its owning role, response standard and playbook attached.",
      },
      { property: "og:title", content: "Log work — Resolve Operations" },
      {
        property: "og:description",
        content: "Log a one-touch resolution or open a ticket with its response standard attached.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewMatter,
});

type Mode = "one_touch" | "ticket";

function NewMatter() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("ticket");
  const [saving, setSaving] = useState(false);
  const [priorityTouched, setPriorityTouched] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    property_id: "",
    work_type_id: "",
    guest_impact: "none",
    occupancy_status: "vacant",
    priority: "p3",
    priority_override_reason: "",
    functional_role_code: "",
    cross_team: false,
    source_channel: "guest_message",
    guest_name: "",
    guest_contact: "",
    guest_in_residence: false,
    playbook_id: "auto",
    // one-touch only
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

  // OwnerRez tells us who is actually in the home right now.
  const fetchStay = useServerFn(getPropertyStay);
  const { data: stay, isFetching: stayLoading } = useQuery({
    queryKey: ["ownerrez-stay", form.property_id],
    queryFn: () => fetchStay({ data: { propertyId: form.property_id } }),
    enabled: Boolean(form.property_id),
    retry: false,
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

  const { data: roles } = useQuery({
    queryKey: ["functional-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("functional_roles")
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

  const role = useMemo(
    () => roles?.find((r) => r.code === form.functional_role_code) ?? null,
    [roles, form.functional_role_code],
  );

  // Mechanical priority model: work type suggests, guest impact and occupancy decide.
  const mechanical = useMemo(
    () => mechanicalPriority(workType?.default_priority, form.guest_impact, form.occupancy_status),
    [workType, form.guest_impact, form.occupancy_status],
  );

  useEffect(() => {
    if (!priorityTouched) setForm((f) => ({ ...f, priority: mechanical }));
  }, [mechanical, priorityTouched]);

  // The work type also carries its owning seat from the ownership matrix.
  useEffect(() => {
    if (workType?.functional_role_code) {
      setForm((f) => ({ ...f, functional_role_code: workType.functional_role_code as string }));
    }
  }, [workType]);

  const overridden = Boolean(workType && form.priority !== mechanical);
  const meta = priorityMeta(form.priority);

  const resolvedPlaybookId = useMemo(() => {
    if (form.playbook_id !== "auto") return form.playbook_id === "none" ? null : form.playbook_id;
    return workType?.playbook_id ?? null;
  }, [form.playbook_id, workType]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.work_type_id) {
      toast.error("Pick a work type — it sets the owning role and the response standard.");
      return;
    }
    if (overridden && !form.priority_override_reason.trim()) {
      toast.error(`The rubric says ${mechanical.toUpperCase()}. Document why you changed it.`);
      return;
    }
    if (mode === "one_touch" && !form.resolution_notes.trim()) {
      toast.error("Write what you did — that is the whole record.");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const now = new Date();
      const { response_due_at, action_due_at } = slaDueDates(form.priority, now, workType);
      const oneTouch = mode === "one_touch";

      const { data: ticket, error } = await supabase
        .from("tickets")
        .insert({
          record_type: mode,
          title: form.title,
          description: form.description || null,
          property_id: form.property_id || null,
          work_type_id: form.work_type_id,
          functional_role_code: form.functional_role_code || null,
          cross_team: oneTouch ? false : form.cross_team,
          category: workType?.category ?? "other",
          bucket: workType?.bucket ?? null,
          guest_impact: form.guest_impact,
          occupancy_status: form.occupancy_status,
          suggested_priority: mechanical,
          priority: form.priority,
          priority_override_reason: overridden ? form.priority_override_reason.trim() : null,
          source_channel: form.source_channel,
          guest_name: form.guest_name || null,
          guest_contact: form.guest_contact || null,
          guest_in_residence: form.guest_in_residence,
          playbook_id: oneTouch ? null : resolvedPlaybookId,
          reported_at: now.toISOString(),
          response_due_at: oneTouch ? null : response_due_at,
          action_due_at: oneTouch ? null : action_due_at,
          acknowledged_at: now.toISOString(),
          action_started_at: oneTouch ? now.toISOString() : null,
          due_at: oneTouch ? null : action_due_at,
          created_by: userId,
          record_owner: userId,
          accountable_owner: userId,
          current_action_owner: oneTouch ? null : userId,
          status: oneTouch ? "closed" : "open",
          outcome_type: oneTouch ? form.outcome_type : null,
          resolution_notes: oneTouch ? form.resolution_notes.trim() : null,
          resolved_at: oneTouch ? now.toISOString() : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (!oneTouch && resolvedPlaybookId) {
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
          kind: oneTouch ? "completed" : "created",
          event_type: oneTouch ? "logged_completed" : "created",
          channel: form.source_channel,
          body: oneTouch
            ? `Logged as a one-touch resolution. ${form.resolution_notes.trim()}`
            : `Ticket opened at ${meta.short} (${labelFor(GUEST_IMPACT, form.guest_impact)} · ${labelFor(
                OCCUPANCY_STATUS,
                form.occupancy_status,
              )}). Acknowledge within ${workType?.response_minutes ?? meta.responseMinutes}m.`,
        });
      }

      toast.success(oneTouch ? "One-touch resolution logged." : "Ticket opened with its clocks running.");
      router.navigate({ to: "/tickets/$ticketId", params: { ticketId: ticket.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this record");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Log work</h1>
        <p className="mt-1 text-muted-foreground">
          Every meaningful operational interaction gets recorded. Already handled it? Log it and move on.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          active={mode === "one_touch"}
          onClick={() => setMode("one_touch")}
          icon={<Zap className="size-4" />}
          title="One-touch resolution"
          hint="Resolved in a single action. Kept in history, never hits the queue."
        />
        <ModeCard
          active={mode === "ticket"}
          onClick={() => setMode("ticket")}
          icon={<Clock className="size-4" />}
          title="Ticket"
          hint="Needs follow-up or another touchpoint. Clocks start and you own it."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{mode === "one_touch" ? "What happened?" : "What needs to happen?"}</CardTitle>
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
                      {w.name} · suggests {w.default_priority.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workType && mode === "ticket" && (
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm">
                  <p className="font-medium">Operating standard</p>
                  <p className="mt-1 text-muted-foreground">{workType.operating_standard}</p>
                  <p className="mt-1 text-muted-foreground">
                    Acknowledge within {workType.response_minutes}m · start within{" "}
                    {workType.action_start_minutes === 0 ? "immediately" : `${workType.action_start_minutes}m`}
                    {workType.completion_target ? ` · target ${workType.completion_target.toLowerCase()}` : ""}
                  </p>
                  {workType.backup_coverage && (
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-medium text-foreground">Backup:</span> {workType.backup_coverage}
                    </p>
                  )}
                  {workType.required_closure_evidence && (
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-medium text-foreground">To close:</span>{" "}
                      {workType.required_closure_evidence}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Guest impact</Label>
                <Select
                  value={form.guest_impact}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      guest_impact: v,
                      guest_in_residence:
                        v === "active_guest_affected" || v === "safety_security" ? true : form.guest_in_residence,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GUEST_IMPACT.map((g) => (
                      <SelectItem key={g.value} value={g.value}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Occupancy status</Label>
                <Select
                  value={form.occupancy_status}
                  onValueChange={(v) => setForm({ ...form, occupancy_status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCUPANCY_STATUS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mode === "ticket" && (
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
                  <p className="text-xs text-muted-foreground">
                    Rubric says <span className="font-medium">{mechanical.toUpperCase()}</span> ·{" "}
                    {meta.summary}
                  </p>
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

            {mode === "ticket" && (
              <div className="space-y-2">
                <Label>Owning functional role</Label>
                <Select
                  value={form.functional_role_code}
                  onValueChange={(v) => setForm({ ...form, functional_role_code: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Which seat owns this process?" />
                  </SelectTrigger>
                  <SelectContent>
                    {(roles ?? []).map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {role && (
                  <p className="text-xs text-muted-foreground">
                    Currently held by {role.current_seat_name ?? "an unassigned seat"} · {role.coverage_window}
                  </p>
                )}
              </div>
            )}

            {mode === "ticket" && overridden && (
              <div className="space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <Label htmlFor="override">
                  Why {form.priority.toUpperCase()} instead of {mechanical.toUpperCase()}?
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
                placeholder="What the guest said, what they've tried, anything the vendor should know."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {mode === "one_touch" && (
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
                <p className="text-xs text-muted-foreground">Drives required guest communication before closure.</p>
              </div>
              <Switch
                checked={form.guest_in_residence}
                onCheckedChange={(v) => setForm({ ...form, guest_in_residence: v })}
              />
            </div>

            {mode === "ticket" && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Users className="size-4" /> Cross-team
                  </p>
                  <p className="text-xs text-muted-foreground">
                    More than one role, department or vendor has to act on this.
                  </p>
                </div>
                <Switch
                  checked={form.cross_team}
                  onCheckedChange={(v) => setForm({ ...form, cross_team: v })}
                />
              </div>
            )}

            {mode === "ticket" && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm">
                <Badge variant="outline" className={priorityTone(form.priority)}>
                  {meta.short}
                </Badge>
                <span className="text-muted-foreground">
                  Acknowledge by{" "}
                  {new Date(
                    Date.now() + (workType?.response_minutes ?? meta.responseMinutes) * 60_000,
                  ).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  {" · "}
                  {labelFor(SOURCE_CHANNELS, form.source_channel)}
                </span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving…" : mode === "one_touch" ? "Log resolution" : "Open ticket"}
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
