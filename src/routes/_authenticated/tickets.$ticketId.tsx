import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { breezewayOutboundState } from "@/lib/breezeway-outbound.functions";
import { ticketStage, repairIsPossible } from "@/lib/ticket-stage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  BellRing,
  Building2,
  Camera,
  CheckCircle2,
  Circle,
  PauseCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AttachmentsPanel } from "@/components/AttachmentsPanel";
import { BreezewayTaskPanel } from "@/components/BreezewayTaskPanel";
import { GuidanceCard } from "@/components/GuidanceCard";
import { GuestContextPanel } from "@/components/GuestContextPanel";

import { OutlookSourceCard } from "@/components/OutlookSourceCard";
import { HandoffPanel } from "@/components/HandoffPanel";
import { SpecialHandlingNotice } from "@/components/SpecialHandlingNotice";
import { MatterOwnershipPanel } from "@/components/MatterOwnershipPanel";
import { VendorRatingPanel } from "@/components/VendorRatingPanel";
import { ReservationContextPanel } from "@/components/ReservationContextPanel";
import { TicketClaimPanel } from "@/components/claims/TicketClaimPanel";
import { TicketRecoveryPanel } from "@/components/recovery/TicketRecoveryPanel";
import { TicketWorkOrderPanel } from "@/components/workorders/TicketWorkOrderPanel";
import { useRole } from "@/hooks/useRole";
import { QueueRail, RecordHeaderNav, useRecordOrigin } from "@/components/nav/NavContext";
import { PropertyContextDrawer } from "@/components/PropertyContextDrawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { VisitLogPanel } from "@/components/VisitLogPanel";
import { ticketNextAction } from "@/lib/ticket-next-action";
import { classifyTicketText } from "@/lib/ticket-classify";
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
        content:
          "Acknowledge, work the playbook, and close with the evidence the work type requires.",
      },
      { property: "og:title", content: "Ticket detail — Resolve Operations" },
      {
        property: "og:description",
        content: "Acknowledge, work the playbook, and close it properly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): { from?: string | undefined } =>
    typeof raw["from"] === "string" && raw["from"] ? { from: raw["from"] } : {},
  component: TicketDetail,
  errorComponent: () => <p className="text-muted-foreground">This ticket could not be loaded.</p>,
  notFoundComponent: () => <p className="text-muted-foreground">Ticket not found.</p>,
});

function TicketDetail() {
  const { ticketId } = Route.useParams();
  const qc = useQueryClient();
  const role = useRole();
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [outcome, setOutcome] = useState("resolved");
  const [evidence, setEvidence] = useState("");
  const [guestConfirmed, setGuestConfirmed] = useState(false);
  const [finalComms, setFinalComms] = useState(false);
  // Closure stays compact until the coordinator is actually closing the ticket.
  const [closeOpen, setCloseOpen] = useState(false);
  const [waitOn, setWaitOn] = useState("vendor");
  const [waitReason, setWaitReason] = useState("");
  const [waitReview, setWaitReview] = useState("");
  // Where this ticket was opened from, so Back restores that workspace.
  const { origin, token } = useRecordOrigin("ticket");
  const [propertyOpen, setPropertyOpen] = useState(false);

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
        ? ((await supabase.from("profiles").select("id, full_name, email").in("id", authorIds))
            .data ?? [])
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

  // One incident, several lanes. Resolve knows which lanes are actually live,
  // so the ones that are not stay out of the way instead of shouting.
  const { data: branches } = useQuery({
    queryKey: ["ticket-branches", ticketId],
    queryFn: async () => {
      const [claims, recoveries] = await Promise.all([
        supabase.from("claims").select("id").eq("ticket_id", ticketId),
        supabase.from("guest_recovery").select("id").eq("ticket_id", ticketId),
      ]);
      return {
        claim: (claims.data ?? []).length > 0,
        recovery: (recoveries.data ?? []).length > 0,
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

  // Repair state at page level so the workspace knows which stage it is in.
  // Same query key as the repair panel, so there is one fetch and one truth.
  const repairStateFn = useServerFn(breezewayOutboundState);
  const { data: repairState } = useQuery({
    queryKey: ["breezeway-outbound", "ticket", ticketId],
    queryFn: () => repairStateFn({ data: { sourceType: "ticket", sourceId: ticketId } }),
  });

  const ownerId = data?.ticket.current_action_owner ?? null;
  const { data: assignee } = useQuery({
    queryKey: ["ticket-assignee", ownerId],
    enabled: Boolean(ownerId),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", ownerId!)
        .maybeSingle();
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
  // Readiness is a read of the same gates the close action enforces — no new
  // rules. Anything Resolve already recorded counts as done automatically.
  const closureChecklist: { label: string; done: boolean; hint?: string }[] = [
    ...requiredOpen.map((s) => ({
      label: s.instruction,
      done: false,
      hint: "Tick it off in the playbook above.",
    })),
    {
      label: "What was wrong and what was done",
      done: resolution.trim().length > 0 || Boolean(ticket.resolution_notes),
      hint: "One line in the closing summary.",
    },
    ...(workType?.required_closure_evidence
      ? [
          {
            label: workType.required_closure_evidence,
            done: evidence.trim().length > 0 || Boolean(ticket.closure_evidence),
            hint: "Add the photo or confirmation this work needs.",
          },
        ]
      : []),
    ...(guestCommsRequired
      ? [
          {
            label: "Final message sent to the guest",
            done: finalComms,
            hint: "Confirm it when you close.",
          },
        ]
      : []),
    ...(ticket.guest_in_residence
      ? [
          {
            label: "Guest confirmed it is fixed",
            done: guestConfirmed,
            hint: "Get it in writing first.",
          },
        ]
      : []),
  ];
  const closureReady = closureChecklist.every((c) => c.done);
  const remaining = closureChecklist.filter((c) => !c.done).length;
  // Evidence appears when the work actually calls for it — never as an empty
  // upload box on an ordinary ticket.
  const needsEvidence = Boolean(
    workType?.required_closure_evidence ||
    steps.some((s) => s.photo_required) ||
    branches?.claim ||
    ticket.vendor_name,
  );
  // Derived, never stored: the one thing to do next.
  const nextAction = ticketNextAction({
    status: ticket.status,
    resolved_at: ticket.resolved_at,
    next_review_at: ticket.next_review_at,
    waiting_reason: ticket.waiting_reason,
    acknowledged_at: ticket.acknowledged_at,
    action_started_at: ticket.action_started_at,
    waiting_on: ticket.waiting_on,
    guest_in_residence: ticket.guest_in_residence,
    vendor_name: ticket.vendor_name,
    vendor_status: ticket.vendor_status,
    requiredOpenSteps: requiredOpen.length,
    missingClosureEvidence: Boolean(
      workType?.required_closure_evidence && !ticket.closure_evidence,
    ),
  });

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

  /**
   * One start. Acknowledging and starting the clock are the same human moment,
   * so Resolve records both, moves the ticket into progress and writes the
   * audit trail from a single click.
   */
  const canStart = !closed && (!ticket.acknowledged_at || !ticket.action_started_at);

  async function startWorking() {
    const now = new Date().toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const firstTouch = !ticket.acknowledged_at;
    const { error } = await supabase
      .from("tickets")
      .update({
        acknowledged_at: ticket.acknowledged_at ?? now,
        action_started_at: ticket.action_started_at ?? now,
        status: ticket.status === "open" ? "in_progress" : ticket.status,
        ...(firstTouch
          ? {
              current_action_owner: userData.user?.id ?? null,
              assignment_source: "manual",
              assignment_note: null,
            }
          : {}),
      })
      .eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (firstTouch)
      await log("acknowledged", "Acknowledged — this ticket is being worked.", "acknowledged");
    await log("action_started", "Work started on this ticket.", "action_started");
    await refresh();
    toast.success("You're working this ticket.");
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
      .update({
        status: "in_progress",
        waiting_on: null,
        waiting_reason: null,
        next_review_at: null,
      })
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
    await log(
      "step",
      `${completed ? "Completed" : "Reopened"} step: ${instruction}`,
      "step_completed",
    );
    await refresh();
  }

  async function changeStatus(status: string) {
    const now = new Date().toISOString();
    // Moving a ticket into progress is the action starting — stop both clocks
    // even when the coordinator uses the status menu instead of the clock buttons.
    const patch: { status: string; acknowledged_at?: string; action_started_at?: string } = {
      status,
    };
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
    <div className="flex items-start gap-6">
      <QueueRail
        origin={origin}
        token={token}
        currentId={ticketId}
        to="/tickets/$ticketId"
        paramKey="ticketId"
      />
      <div className="min-w-0 flex-1 space-y-6">
        <RecordHeaderNav
          origin={origin}
          token={token}
          current={`Ticket #${ticket.ref}`}
          recordId={ticketId}
          to="/tickets/$ticketId"
          paramKey="ticketId"
        />

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
              <Badge variant="outline">
                {workType?.name ?? labelFor(CATEGORIES, ticket.category)}
              </Badge>
              {ticket.property_id && (
                <button
                  type="button"
                  onClick={() => setPropertyOpen(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                >
                  <Building2 className="size-3.5" aria-hidden="true" />
                  {ticket.properties?.nickname ?? ticket.properties?.name ?? "Property"}
                </button>
              )}
              {(ticket.reopen_count ?? 0) > 0 && (
                <Badge variant="outline" className="border-warning/40 bg-warning/10">
                  Reopened {ticket.reopen_count}×
                </Badge>
              )}
            </div>
          </div>
          {/* Status is a supervisory correction, not the way work moves. Frontline
            staff move the ticket through the Next Action, never a dropdown. */}
          {role.isSupervisor && (
            <div className="w-56">
              <Label className="text-xs text-muted-foreground">Status (supervisor)</Label>
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
          )}
        </div>

        {sla.escalation && (
          <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4">
            <BellRing className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="font-medium text-danger">P1 escalated — {sla.escalation.who}</p>
              <p className="text-sm text-muted-foreground">
                {sla.escalation.minutes} minutes since this came in with no action started.
              </p>
            </div>
          </div>
        )}

        {/* Derived Next Action — one instruction, one button, nothing competing. */}
        {nextAction && (
          <Card className="border-primary/40 bg-primary/5 shadow-sm">
            <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Do this now
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {canStart ? "Start working" : nextAction.label}
                </p>
                <p className="text-sm text-muted-foreground">{nextAction.because}</p>
              </div>
              {canStart && (
                <Button size="lg" onClick={startWorking}>
                  Start working
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* The response standard is system context, read-only, never a workflow. */}
        {!closed && ticket.record_type !== "completed_interaction" && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Response
            </span>
            <ClockText state={sla.response} />
            <ClockText state={sla.action} />
            {workType?.completion_target && (
              <span className="text-muted-foreground">Complete: {workType.completion_target}</span>
            )}
          </div>
        )}

        {!closed && (
          <GuidanceCard
            subjectType="ticket"
            subjectId={ticket.id}
            context={{
              objectType: "ticket",
              workTypeName: workType?.name ?? null,
              category: ticket.category ?? null,
              text: [ticket.title, ticket.description].filter(Boolean).join(" — "),
              situationId:
                classifyTicketText([ticket.title, ticket.description].filter(Boolean).join(". "))
                  ?.situation.id ?? null,
              priority: (ticket.priority as "p1" | "p2" | "p3" | null) ?? null,
              escalationFlags: sla.escalation ? ["p1_escalated"] : [],
              propertySpecialHandling: [
                ticket.properties?.access_notes,
                ticket.properties?.notes,
              ].filter((v): v is string => Boolean(v && v.trim())),
            }}
            why={[
              meta.summary,
              ...(sla.escalation
                ? [
                    `P1 escalated to ${sla.escalation.who} — ${sla.escalation.minutes} minutes with no action started.`,
                  ]
                : []),
              ...(ticket.status === "waiting"
                ? [
                    `Waiting on ${labelFor(WAITING_ON, ticket.waiting_on)} — this clock is paused, not finished.`,
                  ]
                : []),
              ...(requiredOpen.length > 0
                ? [`${requiredOpen.length} required playbook step(s) still open.`]
                : []),
            ]}
            escalations={
              sla.escalation
                ? [`Already escalated — ${sla.escalation.who} owns the next check-in.`]
                : []
            }
            requiredEvidence={
              workType?.required_closure_evidence ? [workType.required_closure_evidence] : []
            }
            specialHandling={[ticket.properties?.access_notes, ticket.properties?.notes].filter(
              (v): v is string => Boolean(v && v.trim()),
            )}
            vendorEngaged={Boolean(ticket.vendor_name)}
          />
        )}

        {ticket.status === "waiting" && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-secondary/40 p-4">
            <PauseCircle className="size-5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                Parked with {labelFor(WAITING_ON, ticket.waiting_on).toLowerCase()}
              </p>
              <p className="text-sm text-muted-foreground">
                {ticket.waiting_reason}
                {ticket.next_review_at
                  ? ` · comes back to you ${new Date(ticket.next_review_at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}`
                  : ""}
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
                    {done} of {steps.length} steps done · {requiredOpen.length} required step(s)
                    remaining
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
                        <p
                          className={`text-sm font-medium ${s.completed ? "text-muted-foreground line-through" : ""}`}
                        >
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
                            <span className="text-xs text-muted-foreground">
                              {relativeTime(s.completed_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Special Handling is read live from the property, right before any
              maintenance decision is made on this ticket. */}
            <SpecialHandlingNotice propertyId={ticket.property_id} moment="maintenance" />

            <MatterOwnershipPanel ticket={ticket} closed={closed} onChanged={refresh} />

            {ticket.record_type !== "completed_interaction" && (
              <HandoffPanel ticket={ticket} closed={closed} onChanged={refresh} />
            )}

            {/* Vendor dispatch is hidden from the frontline until the Vendor Portal is live.
              "Send for repair" (Work Order) is the single repair path. Backend fields stay. */}

            {ticket.vendor_user_id && ticket.vendor_status === "completed" && (
              <VendorRatingPanel ticketId={ticket.id} priority={ticket.priority ?? null} />
            )}

            {ticket.vendor_user_id && <VisitLogPanel ticketId={ticket.id} />}

            {!closed && ticket.status !== "waiting" && (
              <WaitingControl
                waitOn={waitOn}
                setWaitOn={setWaitOn}
                waitReason={waitReason}
                setWaitReason={setWaitReason}
                waitReview={waitReview}
                setWaitReview={setWaitReview}
                onPark={setWaiting}
              />
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
                  {activity.length === 0 && (
                    <p className="text-sm text-muted-foreground">No activity yet.</p>
                  )}
                  {activity.map((a) => (
                    <div key={a.id} className="text-sm">
                      <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                        <LaneChip lane={laneOf(a.kind, a.event_type, a.body)} />
                        <span className="font-medium text-foreground">
                          {a.author?.full_name ?? a.author?.email ?? "Team member"}
                        </span>{" "}
                        · {relativeTime(a.event_at ?? a.created_at)}
                      </div>
                      <p className="mt-0.5">{a.body}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <OutlookSourceCard entityType="ticket" entityId={ticketId} />

            {needsEvidence && (
              <AttachmentsPanel
                entityType="ticket"
                entityId={ticketId}
                title="Evidence this work needs"
              />
            )}

            <BreezewayTaskPanel
              sourceType="ticket"
              sourceId={ticketId}
              defaultTitle={ticket.title}
              defaultDescription={ticket.description}
              propertyId={ticket.property_id}
              authorityNote={
                ticket.guest_in_residence
                  ? "A guest is in the home. Emergency mitigation comes before the permanent repair, and owner approval follows the maintenance authority policy."
                  : "Owner approval follows the maintenance authority policy — Resolve applies the threshold, you do not have to remember it."
              }
            />

            {/* Close is the end of the workflow: context, activity, evidence and related work come first. */}
            {!closed && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {closureReady ? "Ready to close" : "Almost done"}
                  </CardTitle>
                  <CardDescription>
                    {closureReady
                      ? "Everything required for this ticket is complete."
                      : `${remaining} thing${remaining === 1 ? "" : "s"} left before this ticket can close.`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {closureChecklist.map((c, i) => (
                      <li key={i} className="flex items-start gap-2">
                        {c.done ? (
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                        ) : (
                          <Circle className="mt-0.5 size-4 shrink-0 text-warning" />
                        )}
                        <div className="min-w-0">
                          <p
                            className={
                              c.done ? "text-muted-foreground line-through" : "font-medium"
                            }
                          >
                            {c.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {c.done ? "Complete" : `Needs you${c.hint ? ` — ${c.hint}` : ""}`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {!closeOpen && (
                    <Button
                      onClick={() => setCloseOpen(true)}
                      variant={closureReady ? "default" : "secondary"}
                      className="w-full"
                    >
                      {closureReady ? "Close ticket" : "Finish the remaining items"}
                    </Button>
                  )}

                  {closeOpen && (
                    <div className="space-y-4 border-t border-border pt-4">
                      {requiredOpen.length > 0 && (
                        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                          <div>
                            <p className="font-medium">
                              {requiredOpen.length} required step(s) still open
                            </p>
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
                          <p className="text-xs text-muted-foreground">
                            {workType.required_closure_evidence}
                          </p>
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
                    </div>
                  )}
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
            {/* One live guest & stay block. The frozen snapshot stays available,
              clearly labelled, instead of competing with the live read. */}
            <GuestContextPanel ticketId={ticketId} />
            <details className="rounded-lg border border-border px-3 py-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                View the reservation snapshot from when this ticket opened
              </summary>
              <div className="pt-3">
                <ReservationContextPanel
                  ticket={ticket}
                  ownerRezPropertyId={ticket.properties?.ownerrez_property_id ?? null}
                />
              </div>
            </details>
            {/* Internal Work Orders are not part of the beta — Breezeway is the
              only visible repair path. Kept for platform owners only. */}
            {role.can("work_orders_internal") && <TicketWorkOrderPanel ticket={ticket} />}
            {/* The incident is one ticket. Repair is the default lane; the guest
              and cost lanes only open out when they are actually in play. */}
            <IncidentBranch
              open={Boolean(branches?.recovery)}
              label="Make it right for the guest"
              hint="Credit, refund, a gesture — and who has to approve it."
            >
              <TicketRecoveryPanel ticket={ticket} />
            </IncidentBranch>

            <IncidentBranch
              open={Boolean(branches?.claim)}
              label="Recover the cost"
              hint="Damage, deposit or a channel claim on the same incident."
            >
              <TicketClaimPanel ticket={ticket} />
            </IncidentBranch>
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    Property
                  </span>
                  <button
                    type="button"
                    onClick={() => setPropertyOpen(true)}
                    className="truncate text-right font-medium text-primary hover:underline"
                  >
                    {ticket.properties?.nickname ?? ticket.properties?.name ?? "—"}
                  </button>
                </div>
                <Field
                  label="Address"
                  value={
                    [ticket.properties?.address_line1, ticket.properties?.city]
                      .filter(Boolean)
                      .join(", ") || "—"
                  }
                />

                <Field label="Received" value={relativeTime(ticket.reported_at)} />
                <Field label="Acknowledged" value={relativeTime(ticket.acknowledged_at)} />
                <Field label="Action started" value={relativeTime(ticket.action_started_at)} />
                <Field label="Vendor" value={ticket.vendor_name ?? "—"} />
                {ticket.priority_override_reason && (
                  <Field label="Priority override" value={ticket.priority_override_reason} />
                )}
                {ticket.description && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Description
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                )}
                {ticket.properties?.access_notes && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Access notes
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{ticket.properties.access_notes}</p>
                  </div>
                )}
                {ticket.resolution_notes && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Resolution
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{ticket.resolution_notes}</p>
                  </div>
                )}
                {ticket.closure_evidence && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Evidence
                    </p>
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
                  <p className="text-sm text-muted-foreground">
                    No other tickets at this property.
                  </p>
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

        <PropertyContextDrawer
          propertyId={ticket.property_id}
          open={propertyOpen}
          onOpenChange={setPropertyOpen}
          originToken={token}
        />
      </div>
    </div>
  );
}

/** Response timing as one quiet line of context, coloured only when it matters. */
function ClockText({ state }: { state: ReturnType<typeof slaState>["response"] }) {
  if (!state) return null;
  const tone = state.breached
    ? "text-danger font-medium"
    : state.met
      ? "text-success"
      : "text-muted-foreground";
  return <span className={tone}>{state.label}</span>;
}

/** Parking a ticket is focused work — it opens over the ticket, never in it. */
function WaitingControl({
  waitOn,
  setWaitOn,
  waitReason,
  setWaitReason,
  waitReview,
  setWaitReview,
  onPark,
}: {
  waitOn: string;
  setWaitOn: (v: string) => void;
  waitReason: string;
  setWaitReason: (v: string) => void;
  waitReview: string;
  setWaitReview: (v: string) => void;
  onPark: () => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <PauseCircle className="size-4" /> Waiting on someone?
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Park this and remind me</SheetTitle>
          <SheetDescription>It comes back to you at the time you set.</SheetDescription>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Who are we waiting on?</Label>
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">What are we waiting for?</Label>
            <Input
              placeholder="e.g. vendor confirming a Thursday window"
              value={waitReason}
              onChange={(e) => setWaitReason(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Bring it back to me</Label>
            <Input
              type="datetime-local"
              value={waitReview}
              onChange={(e) => setWaitReview(e.target.value)}
            />
          </div>
          <Button variant="secondary" onClick={onPark} className="w-full">
            Park this and remind me
          </Button>
        </div>
      </SheetContent>
    </Sheet>
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

/* ------------------------------------------------------------------ */
/* One incident, several lanes                                         */
/* ------------------------------------------------------------------ */

/**
 * Which lane a piece of history belongs to, read from what was recorded.
 * The order of the incident never changes — only the label beside it.
 */
type Lane = "repair" | "claim" | "guest";

function laneOf(kind: string | null, eventType: string | null, body: string | null): Lane {
  const text = `${kind ?? ""} ${eventType ?? ""} ${body ?? ""}`.toLowerCase();
  if (text.includes("claim") || text.includes("deposit") || text.includes("aircover"))
    return "claim";
  if (
    text.includes("guest") ||
    text.includes("recovery") ||
    text.includes("refund") ||
    text.includes("credit") ||
    text.includes("compensat")
  )
    return "guest";
  return "repair";
}

const LANE_STYLE: Record<Lane, { label: string; className: string }> = {
  repair: { label: "Repair", className: "border-border" },
  claim: { label: "Claim", className: "border-warning/40 bg-warning/10" },
  guest: { label: "Guest", className: "border-primary/30 bg-primary/10 text-primary" },
};

function LaneChip({ lane }: { lane: Lane }) {
  const style = LANE_STYLE[lane];
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${style.className}`}>
      {style.label}
    </Badge>
  );
}

/** An inactive lane is one quiet line until somebody opens it. */
function IncidentBranch({
  open,
  label,
  hint,
  children,
}: {
  open: boolean;
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  if (open) return <>{children}</>;
  // The lane is not in play yet: starting it is focused work that opens over
  // the ticket, never a long form pushed into the ticket's vertical flow.
  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-secondary/60"
      >
        <span className="text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{label}</SheetTitle>
            <SheetDescription>{hint}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
