import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BellRing, Camera, CheckCircle2, PlayCircle, PauseCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { BreezewayTaskPanel } from "@/components/BreezewayTaskPanel";

import { GuestContextPanel } from "@/components/GuestContextPanel";
import { OutlookSourceCard } from "@/components/OutlookSourceCard";
import { HandoffPanel } from "@/components/HandoffPanel";
import { MatterOwnershipPanel } from "@/components/MatterOwnershipPanel";
import { VendorDispatchPanel } from "@/components/VendorDispatchPanel";
import { VendorRatingPanel } from "@/components/VendorRatingPanel";
import { ReservationContextPanel } from "@/components/ReservationContextPanel";
import { TicketClaimPanel } from "@/components/claims/TicketClaimPanel";
import { TicketRecoveryPanel } from "@/components/recovery/TicketRecoveryPanel";
import { VisitLogPanel } from "@/components/VisitLogPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  OUTCOME_TYPES,
  STATUSES,
  WAITING_ON,
  isClosed,
  labelFor,
  priorityMeta,
  priorityTone,
  relativeTime,
  slaState,
  statusTone,
} from "@/lib/tickets";

export const Route = createFileRoute("/_authenticated/tickets/$ticketId")({
  head: () => ({
    meta: [
      { title: "Ticket detail — Resolve Operations" },
      {
        name: "description",
        content: "Acknowledge, work the playbook, and close with the evidence the work type requires.",
      },
      { property: "og:title", content: "Ticket detail — Resolve Operations" },
      { property: "og:description", content: "Acknowledge, work the playbook, and close it properly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const [outcome, setOutcome] = useState("resolved");
  const [evidence, setEvidence] = useState("");
  const [guestConfirmed, setGuestConfirmed] = useState(false);
  const [finalComms, setFinalComms] = useState(false);
  const [waitOn, setWaitOn] = useState("vendor");
  const [waitReason, setWaitReason] = useState("");
  const [waitReview, setWaitReview] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const [ticket, steps, activity] = await Promise.all([
        supabase
          .from("tickets")
          .select(
            "*, properties(id, name, nickname, address_line1, city, access_notes, notes, ownerrez_property_id), work_types(name, response_minutes, action_start_minutes, completion_target, required_closure_evidence, guest_communication_required)",
          )
          .eq("id", ticketId)
          .single(),
        supabase.from("ticket_steps").select("*").eq("ticket_id", ticketId).order("position"),
        supabase
          .from("ticket_activity")
          .select("*")
          .eq("ticket_id", ticketId)
          .order("event_at", { ascending: false }),
      ]);
      if (ticket.error) throw ticket.error;
      const authorIds = [
        ...new Set((activity.data ?? []).map((a) => a.author_id).filter(Boolean)),
      ] as string[];
      const authors = authorIds.length
        ? (await supabase.from("profiles").select("id, full_name, email").in("id", authorIds)).data ?? []
        : [];
      const authorMap = new Map(authors.map((a) => [a.id, a]));
      return {
        ticket: ticket.data,
        steps: steps.data ?? [],
        activity: (activity.data ?? []).map((a) => ({
          ...a,
          author: a.author_id ? (authorMap.get(a.author_id) ?? null) : null,
        })),
      };
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
        .eq("is_demo", false)
        .is("archived_at", null)
        .order("reported_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const { ticket, steps, activity } = data;
  const workType = ticket.work_types;
  const requiredOpen = steps.filter((s) => s.required && !s.completed);
  const done = steps.filter((s) => s.completed).length;
  const closed = isClosed(ticket.status);
  const meta = priorityMeta(ticket.priority);
  const sla = slaState(ticket);
  const guestCommsRequired = workType?.guest_communication_required ?? false;

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["ticket", ticketId] });
    await qc.invalidateQueries({ queryKey: ["tickets"] });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function log(kind: string, body: string, eventType = kind) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    await supabase.from("ticket_activity").insert({
      ticket_id: ticketId,
      author_id: userData.user.id,
      kind,
      event_type: eventType,
      body,
    });
  }

  async function acknowledge() {
    const now = new Date().toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("tickets")
      .update({
        acknowledged_at: now,
        current_action_owner: userData.user?.id ?? null,
        assignment_source: "manual",
        assignment_note: null,
      })
      .eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("acknowledged", "Acknowledged — this ticket is being worked.", "acknowledged");
    await refresh();
    toast.success("Acknowledged.");
  }

  async function startAction() {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("tickets")
      .update({
        action_started_at: now,
        acknowledged_at: ticket.acknowledged_at ?? now,
        status: ticket.status === "open" ? "in_progress" : ticket.status,
      })
      .eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("action_started", "Work started on this ticket.", "action_started");
    await refresh();
    toast.success("Action started.");
  }

  async function setWaiting() {
    if (!waitReason.trim()) {
      toast.error("Say what you are waiting for.");
      return;
    }
    if (!waitReview) {
      toast.error("Set a review date so this doesn't disappear.");
      return;
    }
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "waiting",
        waiting_on: waitOn,
        waiting_reason: waitReason.trim(),
        next_review_at: new Date(waitReview).toISOString(),
      })
      .eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log(
      "waiting",
      `Waiting on ${labelFor(WAITING_ON, waitOn)}: ${waitReason.trim()} — review ${new Date(waitReview).toLocaleString()}`,
      "waiting_set",
    );
    setWaitReason("");
    setWaitReview("");
    await refresh();
    toast.success("Marked as waiting, with a review date.");
  }

  async function clearWaiting() {
    const { error } = await supabase
      .from("tickets")
      .update({ status: "in_progress", waiting_on: null, waiting_reason: null, next_review_at: null })
      .eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("waiting", "No longer waiting — back in progress.", "waiting_cleared");
    await refresh();
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
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("step", `${completed ? "Completed" : "Reopened"} step: ${instruction}`, "step_completed");
    await refresh();
  }

  async function changeStatus(status: string) {
    const now = new Date().toISOString();
    // Moving a ticket into progress is the action starting — stop both clocks
    // even when the coordinator uses the status menu instead of the clock buttons.
    const patch: { status: string; acknowledged_at?: string; action_started_at?: string } = { status };
    if (status === "in_progress") {
      if (!ticket.acknowledged_at) patch.acknowledged_at = now;
      if (!ticket.action_started_at) patch.action_started_at = now;
    }
    const { error } = await supabase.from("tickets").update(patch).eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("status", `Status changed to ${labelFor(STATUSES, status)}.`, "status_changed");
    await refresh();
    toast.success("Status updated.");
  }

  async function addNote() {
    if (!note.trim()) return;
    await log("note", note.trim(), "note");
    setNote("");
    await refresh();
    toast.success("Note added.");
  }

  async function resolveTicket() {
    // A supervisor exception is the only way past a closure gate, and it is recorded.
    const waived = Boolean(ticket.closure_exception_reason);
    if (requiredOpen.length > 0 && !waived) {
      toast.error(`${requiredOpen.length} required step(s) still open.`);
      return;
    }
    if (!resolution.trim()) {
      toast.error("Add a resolution summary — what was wrong and what was done.");
      return;
    }
    if (workType?.required_closure_evidence && !evidence.trim() && !waived) {
      toast.error("This work type requires closure evidence before you can close.");
      return;
    }
    if (guestCommsRequired && !finalComms && !waived) {
      toast.error("Confirm the final message went to the guest.");
      return;
    }
    if (ticket.guest_in_residence && !guestConfirmed && !waived) {
      toast.error("Confirm the guest verified the fix before resolving.");
      return;
    }

    const { error } = await supabase
      .from("tickets")
      .update({
        status: "resolved",
        outcome_type: outcome,
        resolution_notes: resolution.trim(),
        closure_evidence: evidence.trim() || null,
        final_communication_sent: finalComms,
        guest_confirmed: guestConfirmed,
        resolved_at: new Date().toISOString(),
        late_reason: sla.breached ? "SLA target missed" : null,
      })
      .eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log(
      "resolved",
      `Closed as ${labelFor(OUTCOME_TYPES, outcome)}. ${resolution.trim()}`,
      "closed",
    );
    setResolution("");
    setEvidence("");
    await refresh();
    toast.success("Ticket closed.");
  }

  async function reopen() {
    const { error } = await supabase
      .from("tickets")
      .update({
        status: "in_progress",
        resolved_at: null,
        reopen_count: (ticket.reopen_count ?? 0) + 1,
        last_reopened_at: new Date().toISOString(),
      })
      .eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("reopened", "Reopened — the issue was not fully resolved.", "reopened");
    await refresh();
    toast.success("Reopened.");
  }

  return (
    <div className="space-y-6">
      <Link to="/tickets" className="text-sm text-muted-foreground hover:underline">
        ← All tickets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            #{ticket.ref}
            {ticket.record_type === "completed_interaction" ? " · Completed interaction" : ""}
          </p>
          <h1 className="text-3xl font-semibold">{ticket.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={priorityTone(ticket.priority)}>
              {meta.short}
            </Badge>
            <Badge variant="outline" className={statusTone(ticket.status)}>
              {labelFor(STATUSES, ticket.status)}
            </Badge>
            <Badge variant="outline">{workType?.name ?? labelFor(CATEGORIES, ticket.category)}</Badge>
            {(ticket.reopen_count ?? 0) > 0 && (
              <Badge variant="outline" className="border-warning/40 bg-warning/10">
                Reopened {ticket.reopen_count}×
              </Badge>
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

      {sla.escalation && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4">
          <BellRing className="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p className="font-medium text-danger">
              P1 escalated — {sla.escalation.who}
            </p>
            <p className="text-sm text-muted-foreground">
              {sla.escalation.minutes} minutes since this came in with no action started.
            </p>
          </div>
        </div>
      )}

      {!closed && ticket.record_type !== "completed_interaction" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Response standard</CardTitle>
            <CardDescription>{meta.summary}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <ClockChip
              state={sla.response}
              actionLabel="Acknowledge"
              onAction={ticket.acknowledged_at ? undefined : acknowledge}
            />
            <ClockChip
              state={sla.action}
              actionLabel="Start action"
              icon={<PlayCircle className="size-4" />}
              onAction={ticket.action_started_at ? undefined : startAction}
            />
            {workType?.completion_target && (
              <span className="text-sm text-muted-foreground">
                Complete: {workType.completion_target}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {ticket.status === "waiting" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/40 p-4">
          <PauseCircle className="size-5 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Waiting on {labelFor(WAITING_ON, ticket.waiting_on)}</p>
            <p className="text-sm text-muted-foreground">
              {ticket.waiting_reason}
              {ticket.next_review_at ? ` · review ${new Date(ticket.next_review_at).toLocaleString()}` : ""}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={clearWaiting}>
            Resume
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {steps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resolution playbook</CardTitle>
                <CardDescription>
                  {done} of {steps.length} steps done · {requiredOpen.length} required step(s) remaining
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
          )}

          <MatterOwnershipPanel ticket={ticket} closed={closed} onChanged={refresh} />

          {ticket.record_type !== "completed_interaction" && (
            <HandoffPanel ticket={ticket} closed={closed} onChanged={refresh} />
          )}


          {!closed && (
            <VendorDispatchPanel
              ticketId={ticket.id}
              vendorUserId={ticket.vendor_user_id ?? null}
              vendorBrief={ticket.vendor_brief ?? null}
              vendorStatus={ticket.vendor_status ?? null}
              onChanged={refresh}
            />
          )}

          {ticket.vendor_user_id && ticket.vendor_status === "completed" && (
            <VendorRatingPanel ticketId={ticket.id} priority={ticket.priority ?? null} />
          )}

          {ticket.vendor_user_id && <VisitLogPanel ticketId={ticket.id} />}




          {!closed && ticket.status !== "waiting" && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Blocked on someone else?</CardTitle>
                <CardDescription>Waiting is fine. Waiting without a review date is not.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <Select value={waitOn} onValueChange={setWaitOn}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WAITING_ON.map((w) => (
                      <SelectItem key={w.value} value={w.value}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Waiting for what?"
                  value={waitReason}
                  onChange={(e) => setWaitReason(e.target.value)}
                />
                <Input
                  type="datetime-local"
                  value={waitReview}
                  onChange={(e) => setWaitReview(e.target.value)}
                />
                <Button variant="secondary" onClick={setWaiting} className="sm:col-span-3">
                  Mark as waiting
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
                  placeholder="Add an update: who you called, what the vendor found, what the guest said…"
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
                        {a.author?.full_name ?? a.author?.email ?? "Team member"}
                      </span>{" "}
                      · {relativeTime(a.event_at ?? a.created_at)}
                    </p>
                    <p className="mt-0.5">{a.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <OutlookSourceCard entityType="ticket" entityId={ticketId} />

          <AttachmentsPanel entityType="ticket" entityId={ticketId} title="Photos, video & documents" />

          <BreezewayTaskPanel
            sourceType="ticket"
            sourceId={ticketId}
            defaultTitle={ticket.title}
            defaultDescription={ticket.description}
          />

          {/* Close is the end of the workflow: context, activity, evidence and related work come first. */}
          {!closed && (
            <Card>
              <CardHeader>
                <CardTitle>Close it out properly</CardTitle>
                <CardDescription>
                  This work type sets what evidence is required before the ticket can close.
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

                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <Select value={outcome} onValueChange={setOutcome}>
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
                  <Label>Resolution summary</Label>
                  <Textarea
                    rows={3}
                    placeholder="What was actually wrong and what was done to fix it?"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                </div>

                {workType?.required_closure_evidence && (
                  <div className="space-y-2">
                    <Label>Required evidence</Label>
                    <p className="text-xs text-muted-foreground">{workType.required_closure_evidence}</p>
                    <Textarea
                      rows={2}
                      placeholder="Describe or link the evidence (photo, invoice, serial number, vendor confirmation)."
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                    />
                  </div>
                )}

                {guestCommsRequired && (
                  <ToggleRow
                    title="Final message sent to the guest"
                    hint="This work type requires closing the loop in writing."
                    checked={finalComms}
                    onChange={setFinalComms}
                  />
                )}

                {ticket.guest_in_residence && (
                  <ToggleRow
                    title="Guest confirmed the issue is fully resolved"
                    hint="Get it in writing before you check this."
                    checked={guestConfirmed}
                    onChange={setGuestConfirmed}
                  />
                )}

                <Button onClick={resolveTicket} className="w-full">
                  <CheckCircle2 className="size-4" /> Close ticket
                </Button>
              </CardContent>
            </Card>
          )}

          {closed && ticket.record_type !== "completed_interaction" && (
            <Button variant="outline" onClick={reopen}>
              Reopen this ticket
            </Button>
          )}

        </div>

        <div className="space-y-6">
          <GuestContextPanel ticketId={ticketId} />
          <ReservationContextPanel
            ticket={ticket}
            ownerRezPropertyId={ticket.properties?.ownerrez_property_id ?? null}
          />
          <TicketWorkOrderPanel ticket={ticket} />
          <TicketRecoveryPanel ticket={ticket} />

          <TicketClaimPanel ticket={ticket} />
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
              <Field label="Received" value={relativeTime(ticket.reported_at)} />
              <Field label="Acknowledged" value={relativeTime(ticket.acknowledged_at)} />
              <Field label="Action started" value={relativeTime(ticket.action_started_at)} />
              <Field label="Vendor" value={ticket.vendor_name ?? "—"} />
              {ticket.priority_override_reason && (
                <Field label="Priority override" value={ticket.priority_override_reason} />
              )}
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
              {ticket.closure_evidence && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</p>
                  <p className="mt-1 whitespace-pre-wrap">{ticket.closure_evidence}</p>
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

function ClockChip({
  state,
  actionLabel,
  onAction,
  icon,
}: {
  state: ReturnType<typeof slaState>["response"];
  actionLabel: string;
  onAction?: (() => void) | undefined;
  icon?: React.ReactNode | undefined;
}) {
  if (!state) return null;
  const tone = state.breached
    ? "border-danger/40 bg-danger/10 text-danger"
    : state.met
      ? "border-success/30 bg-success/10 text-success"
      : "border-border bg-secondary/40";
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <span className="font-medium">{state.label}</span>
      {onAction && (
        <Button size="sm" variant="secondary" onClick={onAction}>
          {icon}
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
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
