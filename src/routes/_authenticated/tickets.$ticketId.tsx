import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Camera, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  STATUSES,
  dueLabel,
  labelFor,
  priorityTone,
  relativeTime,
  statusTone,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/tickets/$ticketId")({
  head: () => ({
    meta: [
      { title: "Ticket detail — Resolve Operations" },
      { name: "description", content: "Work the playbook, log activity, and confirm the fix with the guest." },
      { property: "og:title", content: "Ticket detail — Resolve Operations" },
      { property: "og:description", content: "Work the playbook and confirm the fix with the guest." },
    ],
  }),
  component: TicketDetail,
  errorComponent: () => <p className="text-muted-foreground">This ticket could not be loaded.</p>,
  notFoundComponent: () => <p className="text-muted-foreground">Ticket not found.</p>,
});

function TicketDetail() {
  const { ticketId } = Route.useParams();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [guestConfirmed, setGuestConfirmed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const [ticket, steps, activity] = await Promise.all([
        supabase
          .from("tickets")
          .select("*, properties(id, name, nickname, address_line1, city, access_notes, notes)")
          .eq("id", ticketId)
          .single(),
        supabase.from("ticket_steps").select("*").eq("ticket_id", ticketId).order("position"),
        supabase
          .from("ticket_activity")
          .select("*, profiles:author_id(full_name, email)")
          .eq("ticket_id", ticketId)
          .order("created_at", { ascending: false }),
      ]);
      if (ticket.error) throw ticket.error;
      return { ticket: ticket.data, steps: steps.data ?? [], activity: activity.data ?? [] };
    },
  });

  const propertyId = data?.ticket.property_id;
  const { data: history } = useQuery({
    queryKey: ["property-history", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ref, title, status, reported_at, category")
        .eq("property_id", propertyId!)
        .neq("id", ticketId)
        .order("reported_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const { ticket, steps, activity } = data;
  const requiredOpen = steps.filter((s) => s.required && !s.completed);
  const done = steps.filter((s) => s.completed).length;
  const due = dueLabel(ticket.due_at, ticket.status);
  const closed = ticket.status === "resolved" || ticket.status === "closed";

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    await qc.invalidateQueries({ queryKey: ["tickets"] });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function log(kind: string, body: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("ticket_activity").insert({
      ticket_id: ticketId,
      author_id: userData.user.id,
      kind,
      body,
    });
  }

  async function toggleStep(stepId: string, instruction: string, completed: boolean) {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("ticket_steps")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? (userData.user?.id ?? null) : null,
      })
      .eq("id", stepId);
    if (error) return toast.error(error.message);
    await log("step", `${completed ? "Completed" : "Reopened"} step: ${instruction}`);
    await refresh();
  }

  async function changeStatus(status: string) {
    const { error } = await supabase.from("tickets").update({ status }).eq("id", ticketId);
    if (error) return toast.error(error.message);
    await log("status", `Status changed to ${labelFor(STATUSES, status)}.`);
    await refresh();
    toast.success("Status updated.");
  }

  async function addNote() {
    if (!note.trim()) return;
    await log("note", note.trim());
    setNote("");
    await refresh();
    toast.success("Note added.");
  }

  async function resolveTicket() {
    if (requiredOpen.length > 0) {
      return toast.error(`${requiredOpen.length} required step(s) still open.`);
    }
    if (!guestConfirmed) {
      return toast.error("Confirm the guest verified the fix before resolving.");
    }
    if (!resolution.trim()) {
      return toast.error("Add a short resolution summary.");
    }
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "resolved",
        resolution_notes: resolution.trim(),
        guest_confirmed: true,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", ticketId);
    if (error) return toast.error(error.message);
    await log("resolved", `Resolved and confirmed with the guest. ${resolution.trim()}`);
    setResolution("");
    await refresh();
    toast.success("Ticket resolved.");
  }

  return (
    <div className="space-y-6">
      <Link to="/tickets" className="text-sm text-muted-foreground hover:underline">
        ← All tickets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Ticket #{ticket.ref}</p>
          <h1 className="text-3xl font-semibold">{ticket.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={priorityTone(ticket.priority)}>
              {ticket.priority}
            </Badge>
            <Badge variant="outline" className={statusTone(ticket.status)}>
              {labelFor(STATUSES, ticket.status)}
            </Badge>
            <Badge variant="outline">{labelFor(CATEGORIES, ticket.category)}</Badge>
            {due && (
              <span className={`text-sm ${due.overdue ? "font-medium text-danger" : "text-muted-foreground"}`}>
                {due.text}
              </span>
            )}
          </div>
        </div>
        <div className="w-56">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={ticket.status} onValueChange={changeStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Resolution playbook</CardTitle>
              <CardDescription>
                {steps.length === 0
                  ? "No playbook attached to this ticket."
                  : `${done} of ${steps.length} steps done · ${requiredOpen.length} required step(s) remaining`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={`flex gap-3 rounded-lg border p-3 ${
                    s.completed ? "border-success/30 bg-success/5" : "border-border"
                  }`}
                >
                  <Checkbox
                    checked={s.completed}
                    onCheckedChange={(v) => toggleStep(s.id, s.instruction, v === true)}
                    className="mt-1"
                  />
                  <div className="space-y-1">
                    <p className={`text-sm font-medium ${s.completed ? "text-muted-foreground line-through" : ""}`}>
                      {s.position}. {s.instruction}
                    </p>
                    {s.detail && <p className="text-sm text-muted-foreground">{s.detail}</p>}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {s.required && (
                        <Badge variant="outline" className="text-xs">
                          Required
                        </Badge>
                      )}
                      {s.photo_required && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Camera className="size-3" /> Photo proof
                        </Badge>
                      )}
                      {s.completed && s.completed_at && (
                        <span className="text-xs text-muted-foreground">{relativeTime(s.completed_at)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {!closed && (
            <Card>
              <CardHeader>
                <CardTitle>Close it out properly</CardTitle>
                <CardDescription>
                  Required steps and written guest confirmation are enforced before resolving.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {requiredOpen.length > 0 && (
                  <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-medium">{requiredOpen.length} required step(s) still open</p>
                      <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                        {requiredOpen.map((s) => (
                          <li key={s.id}>{s.instruction}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                <Textarea
                  rows={3}
                  placeholder="What was actually wrong and what was done to fix it?"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                />
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Guest confirmed the issue is fully resolved</p>
                    <p className="text-xs text-muted-foreground">Get it in writing before you check this.</p>
                  </div>
                  <Switch checked={guestConfirmed} onCheckedChange={setGuestConfirmed} />
                </div>
                <Button onClick={resolveTicket} className="w-full">
                  <CheckCircle2 className="size-4" /> Mark resolved
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  placeholder="Add an update: who you called, what the tech found, what the guest said…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button onClick={addNote} size="sm" variant="secondary">
                  Add note
                </Button>
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                {activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
                {activity.map((a) => (
                  <div key={a.id} className="text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {a.profiles?.full_name ?? a.profiles?.email ?? "Team member"}
                      </span>{" "}
                      · {relativeTime(a.created_at)}
                    </p>
                    <p className="mt-0.5">{a.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Property" value={ticket.properties?.nickname ?? ticket.properties?.name ?? "—"} />
              <Field
                label="Address"
                value={[ticket.properties?.address_line1, ticket.properties?.city].filter(Boolean).join(", ") || "—"}
              />
              <Field label="Guest" value={ticket.guest_name ?? "—"} />
              <Field label="Guest contact" value={ticket.guest_contact ?? "—"} />
              <Field label="Guest in home" value={ticket.guest_in_residence ? "Yes" : "No"} />
              <Field label="Reported" value={relativeTime(ticket.reported_at)} />
              <Field label="Vendor" value={ticket.vendor_name ?? "—"} />
              {ticket.description && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                  <p className="mt-1 whitespace-pre-wrap">{ticket.description}</p>
                </div>
              )}
              {ticket.properties?.access_notes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Access notes</p>
                  <p className="mt-1 whitespace-pre-wrap">{ticket.properties.access_notes}</p>
                </div>
              )}
              {ticket.resolution_notes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Resolution</p>
                  <p className="mt-1 whitespace-pre-wrap">{ticket.resolution_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History at this property</CardTitle>
              <CardDescription>Spot recurring problems.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(history ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No other tickets at this property.</p>
              )}
              {(history ?? []).map((h) => (
                <Link
                  key={h.id}
                  to="/tickets/$ticketId"
                  params={{ ticketId: h.id }}
                  className="block rounded-md border border-border p-2 text-sm transition-colors hover:bg-secondary"
                >
                  <p className="font-medium">{h.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {labelFor(CATEGORIES, h.category)} · {labelFor(STATUSES, h.status)} ·{" "}
                    {relativeTime(h.reported_at)}
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
