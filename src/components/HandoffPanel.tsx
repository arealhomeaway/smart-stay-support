import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRightLeft, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GUEST_COMM_STATUS,
  HANDOFF_TYPES,
  labelFor,
  priorityTone,
  relativeTime,
} from "@/lib/tickets";

type Ticket = {
  id: string;
  priority: string;
  status: string;
  next_action: string | null;
  functional_role_code: string | null;
};

/**
 * A task is not handed off because someone was tagged. A valid handoff carries
 * the full summary and is not complete until the receiver accepts it.
 */
export function HandoffPanel({
  ticket,
  closed,
  onChanged,
}: {
  ticket: Ticket;
  closed: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [form, setForm] = useState({
    to_role_code: ticket.functional_role_code ?? "",
    to_user: "",
    handoff_type: "ownership_transfer",
    summary: "",
    actions_completed: "",
    current_status: "",
    next_action: ticket.next_action ?? "",
    due_at: "",
    guest_comm_status: "not_required",
    risks: "",
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

  const { data: people } = useQuery({
    queryKey: ["profiles-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: handoffs, refetch } = useQuery({
    queryKey: ["handoffs", ticket.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("handoffs")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pending = (handoffs ?? []).filter((h) => h.status === "pending");
  const settled = (handoffs ?? []).filter((h) => h.status !== "pending");

  async function log(body: string, eventType: string) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("ticket_activity").insert({
      ticket_id: ticket.id,
      author_id: userData.user.id,
      kind: "handoff",
      event_type: eventType,
      body,
    });
  }

  async function submit() {
    const missing = [
      !form.to_role_code && "receiving role",
      !form.summary.trim() && "issue summary",
      !form.actions_completed.trim() && "actions already completed",
      !form.current_status.trim() && "current status",
      !form.next_action.trim() && "next required action",
    ].filter(Boolean);
    if (missing.length) {
      toast.error(`A valid handoff needs: ${missing.join(", ")}.`);
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("handoffs").insert({
        ticket_id: ticket.id,
        from_user: userData.user?.id ?? null,
        to_user: form.to_user || null,
        to_role_code: form.to_role_code,
        handoff_type: form.handoff_type,
        summary: form.summary.trim(),
        priority: ticket.priority,
        actions_completed: form.actions_completed.trim(),
        current_status: form.current_status.trim(),
        next_action: form.next_action.trim(),
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        guest_comm_status: form.guest_comm_status,
        risks: form.risks.trim() || null,
      });
      if (error) throw error;
      await supabase
        .from("tickets")
        .update({
          handoff_status: "pending",
          pending_handoff_to: form.to_user || null,
          handoff_type: form.handoff_type,
          handoff_note: form.summary.trim(),
          next_action: form.next_action.trim(),
        })
        .eq("id", ticket.id);
      await log(
        `Handoff requested to ${labelFor(
          (roles ?? []).map((r) => ({ value: r.code, label: r.name })),
          form.to_role_code,
        )}. Not complete until accepted — you remain accountable.`,
        "handoff_requested",
      );
      toast.success("Handoff requested. You stay accountable until it is accepted.");
      setOpen(false);
      setForm({ ...form, summary: "", actions_completed: "", current_status: "", risks: "" });
      await refetch();
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the handoff");
    } finally {
      setSaving(false);
    }
  }

  async function accept(handoffId: string) {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("handoffs")
      .update({ status: "accepted", responded_at: new Date().toISOString(), to_user: userData.user?.id ?? null })
      .eq("id", handoffId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("tickets")
      .update({
        handoff_status: "accepted",
        pending_handoff_to: null,
        current_action_owner: userData.user?.id ?? null,
      })
      .eq("id", ticket.id);
    await log("Handoff accepted — ownership of the next action transferred.", "handoff_accepted");
    await refetch();
    await onChanged();
    toast.success("Handoff accepted.");
  }

  async function reject(handoffId: string) {
    if (!rejectReason.trim()) {
      toast.error("A rejected handoff must include a reason.");
      return;
    }
    const { error } = await supabase
      .from("handoffs")
      .update({
        status: "rejected",
        responded_at: new Date().toISOString(),
        response_reason: rejectReason.trim(),
      })
      .eq("id", handoffId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase
      .from("tickets")
      .update({ handoff_status: "rejected", pending_handoff_to: null })
      .eq("id", ticket.id);
    await log(`Handoff rejected: ${rejectReason.trim()} — returned to the original owner.`, "handoff_rejected");
    setRejecting(null);
    setRejectReason("");
    await refetch();
    await onChanged();
    toast.success("Handoff rejected and returned.");
  }

  const roleName = (code: string | null) => (roles ?? []).find((r) => r.code === code)?.name ?? code ?? "—";
  const personName = (id: string | null) => {
    const p = (people ?? []).find((x) => x.id === id);
    return p?.full_name ?? p?.email ?? null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowRightLeft className="size-4" /> Handoffs
        </CardTitle>
        <CardDescription>
          Tagging someone is not a handoff. It is not complete until the receiver accepts it — until then you
          remain accountable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pending.map((h) => (
          <div key={h.id} className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={priorityTone(h.priority)}>
                {h.priority.toUpperCase()}
              </Badge>
              <span className="text-sm font-medium">
                Pending acceptance · {roleName(h.to_role_code)}
                {personName(h.to_user) ? ` (${personName(h.to_user)})` : ""}
              </span>
              <span className="text-xs text-muted-foreground">{relativeTime(h.created_at)}</span>
            </div>
            <div className="space-y-1 text-sm">
              <p>{h.summary}</p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Done so far:</span> {h.actions_completed}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Status:</span> {h.current_status}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Next action:</span> {h.next_action}
                {h.due_at ? ` by ${new Date(h.due_at).toLocaleString()}` : ""}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Guest comms:</span>{" "}
                {labelFor(GUEST_COMM_STATUS, h.guest_comm_status)}
              </p>
              {h.risks && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Risks:</span> {h.risks}
                </p>
              )}
            </div>
            {h.priority === "p1" && (
              <p className="flex items-center gap-2 text-xs font-medium text-danger">
                <ShieldAlert className="size-3.5" /> Unaccepted P1 handoff — the Operations Supervisor is notified.
              </p>
            )}
            {rejecting === h.id ? (
              <div className="space-y-2">
                <Input
                  placeholder="Why are you rejecting this handoff?"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => reject(h.id)}>
                    Confirm rejection
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => accept(h.id)}>
                  Accept handoff
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(h.id)}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        ))}

        {settled.map((h) => (
          <div key={h.id} className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">
              {h.status === "accepted" ? "Accepted" : "Rejected"} · {roleName(h.to_role_code)}{" "}
              <span className="font-normal text-muted-foreground">{relativeTime(h.responded_at)}</span>
            </p>
            <p className="text-muted-foreground">{h.summary}</p>
            {h.response_reason && <p className="text-muted-foreground">Reason: {h.response_reason}</p>}
          </div>
        ))}

        {!closed &&
          (open ? (
            <div className="space-y-3 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Receiving role</Label>
                  <Select
                    value={form.to_role_code}
                    onValueChange={(v) => setForm({ ...form, to_role_code: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Which seat takes the next action?" />
                    </SelectTrigger>
                    <SelectContent>
                      {(roles ?? []).map((r) => (
                        <SelectItem key={r.code} value={r.code}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Person (optional)</Label>
                  <Select value={form.to_user} onValueChange={(v) => setForm({ ...form, to_user: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Whoever is on duty" />
                    </SelectTrigger>
                    <SelectContent>
                      {(people ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name ?? p.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Reason for the handoff</Label>
                <Select
                  value={form.handoff_type}
                  onValueChange={(v) => setForm({ ...form, handoff_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HANDOFF_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} — {t.hint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Issue summary</Label>
                <Textarea
                  rows={2}
                  value={form.summary}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  placeholder="Leak under the kitchen sink at Willow #2, guest in residence."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Actions already completed</Label>
                <Textarea
                  rows={2}
                  value={form.actions_completed}
                  onChange={(e) => setForm({ ...form, actions_completed: e.target.value })}
                  placeholder="Handyman dispatched, shut-off valve located, guest acknowledged."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Current status</Label>
                  <Input
                    value={form.current_status}
                    onChange={(e) => setForm({ ...form, current_status: e.target.value })}
                    placeholder="Vendor on site, cause not yet identified"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Next required action</Label>
                  <Input
                    value={form.next_action}
                    onChange={(e) => setForm({ ...form, next_action: e.target.value })}
                    placeholder="Verify every smoke and CO device before the vendor leaves"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Deadline / expected follow-up</Label>
                  <Input
                    type="datetime-local"
                    value={form.due_at}
                    onChange={(e) => setForm({ ...form, due_at: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Guest communication status</Label>
                  <Select
                    value={form.guest_comm_status}
                    onValueChange={(v) => setForm({ ...form, guest_comm_status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GUEST_COMM_STATUS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Known risks or barriers</Label>
                <Input
                  value={form.risks}
                  onChange={(e) => setForm({ ...form, risks: e.target.value })}
                  placeholder="Parts not available until Monday"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={submit} disabled={saving}>
                  {saving ? "Sending…" : "Request handoff"}
                </Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setOpen(true)}>
              <ArrowRightLeft className="size-4" /> Hand this off
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}
