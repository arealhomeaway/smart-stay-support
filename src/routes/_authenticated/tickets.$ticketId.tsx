import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { humanizeHistoryText } from "@/lib/ticket-lifecycle";
import { setTicketStatusFn } from "@/lib/ticket-lifecycle.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { breezewayOutboundState } from "@/lib/breezeway-outbound.functions";
import { ticketStage, repairIsPossible } from "@/lib/ticket-stage";
import { scopedClosureEvidence } from "@/lib/closure-evidence";
import { closureEvidenceSatisfied, requiresPhotoOrFile } from "@/lib/evidence-requirements";
import { listAttachmentsFn } from "@/lib/attachments.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge, ticketTone, type StatusTone } from "@/components/ui/status";
import { ActivityList, type ActivityKind } from "@/components/ui/activity";
import { Celebrate } from "@/components/ui/feedback";
import { PropertyPhoto } from "@/components/PropertyPhoto";
import { usDate, usDateTime } from "@/lib/dates";
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
import { OwnerParticipationOffer } from "@/components/OwnerParticipationOffer";
import { HandoffPanel } from "@/components/HandoffPanel";
import { FinalReviewPanel } from "@/components/FinalReviewPanel";
import { EscalationPanel } from "@/components/EscalationPanel";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Chip } from "@/components/ui/page";
import { stateChip } from "@/lib/semantic";
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
  const navigate = useNavigate();
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
  const [showCelebrate, setShowCelebrate] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ticket", ticketId],
    queryFn: async () => {
      const [ticket, steps, activity] = await Promise.all([
        supabase
          .from("tickets")
          .select(
            "*, properties(id, name, nickname, address_line1, city, access_notes, notes, ownerrez_property_id, primary_photo_url), work_types(name, response_minutes, action_start_minutes, completion_target, required_closure_evidence, guest_communication_required)",
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
  const setStatusFn = useServerFn(setTicketStatusFn);
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

  // Real files on this ticket. A photo requirement is satisfied by an actual
  // stored upload, never by a sentence in the evidence box.
  const listAttachments = useServerFn(listAttachmentsFn);
  const { data: attachments } = useQuery({
    queryKey: ["attachments", "ticket", ticketId],
    queryFn: () => listAttachments({ data: { entityType: "ticket" as const, entityId: ticketId } }),
  });

  // Field repair can be raised as a Breezeway task or as an internal work
  // order. Either one means a repair exists, and either one completing means
  // the ticket stops asking whether a repair is needed.
  const { data: workOrders } = useQuery({
    queryKey: ["ticket-work-orders", ticketId],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("id, phase, closed_at, vendor_completed_at")
        .eq("ticket_id", ticketId);
      return data ?? [];
    },
  });

  // Waiting is a saved state, not a form: reopening the ticket shows exactly
  // what was parked, on what, and when it comes back.
  const savedWaitOn = data?.ticket.waiting_on ?? null;
  const savedWaitReason = data?.ticket.waiting_reason ?? null;
  const savedWaitReview = data?.ticket.next_review_at ?? null;
  useEffect(() => {
    if (savedWaitOn) setWaitOn(savedWaitOn);
    if (savedWaitReason) setWaitReason(savedWaitReason);
    if (savedWaitReview) {
      // <input type="datetime-local"> wants local wall time, not an ISO stamp.
      const d = new Date(savedWaitReview);
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      setWaitReview(local.toISOString().slice(0, 16));
    }
  }, [savedWaitOn, savedWaitReason, savedWaitReview]);

  useEffect(() => {
    if (!data) return;
    const t = data.ticket;
    const closedNow = t.status === "resolved" || t.status === "closed";
    if (!closedNow) return;
    const key = `celebrate-ticket-${ticketId}`;
    if (typeof window !== "undefined" && !window.sessionStorage.getItem(key)) {
      window.sessionStorage.setItem(key, "1");
      setShowCelebrate(true);
    }
  }, [data, ticketId]);

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  const { ticket, steps, activity } = data;
  const workType = ticket.work_types;
  const requiredOpen = steps.filter((s) => s.required && !s.completed);
  const done = steps.filter((s) => s.completed).length;
  const closed = isClosed(ticket.status);
  const meta = priorityMeta(ticket.priority);
  const sla = slaState(ticket);
  // The requirement, scoped to this scenario: a porch railing never has to
  // certify every smoke and CO device in the home.
  const requiredEvidence = scopedClosureEvidence(workType?.required_closure_evidence, {
    category: ticket.category,
    workTypeName: workType?.name ?? null,
    text: [ticket.title, ticket.description].filter(Boolean).join(" — "),
  });
  const attachmentRows = (attachments?.files ?? []) as {
    upload_status?: string | null;
    size_bytes?: number | null;
  }[];
  const qualifyingFiles = attachmentRows.filter(
    (f) =>
      (f.upload_status === "stored" || f.upload_status === "uploaded") &&
      Number(f.size_bytes ?? 0) > 0,
  ).length;
  const evidenceNeedsFile = requiresPhotoOrFile(requiredEvidence);
  const evidenceSatisfied = closureEvidenceSatisfied({
    requirement: requiredEvidence,
    text: evidence.trim() || ticket.closure_evidence,
    fileCount: qualifyingFiles,
  });
  // A guest message can only be required when there is a guest to write to.
  const guestPresent = Boolean(
    ticket.guest_in_residence ||
    ticket.guest_name ||
    ticket.guest_contact ||
    ticket.reservation_confirmation ||
    ticket.reservation_guest_name,
  );
  const guestCommsRequired = (workType?.guest_communication_required ?? false) && guestPresent;
  // Readiness is a read of the same gates the close action enforces — no new
  // rules. Anything Resolve already recorded counts as done automatically.
  // These are evaluated by Resolve, never ticked off by hand: each row states
  // whether it is satisfied, needs the coordinator, or is waiting on someone.
  const closureChecklist: {
    label: string;
    done: boolean;
    state: "complete" | "needs_you" | "waiting";
    waitingOn?: string;
    hint?: string;
    action?: string;
  }[] = [
    ...requiredOpen.map((s) => ({
      label: s.instruction,
      done: false,
      state: "needs_you" as const,
      hint: "A required step on this ticket is still open.",
    })),
    {
      label: "Closing summary",
      done: resolution.trim().length > 0 || Boolean(ticket.resolution_notes),
      state:
        resolution.trim().length > 0 || Boolean(ticket.resolution_notes)
          ? ("complete" as const)
          : ("needs_you" as const),
      hint: "Add what was wrong and what was done.",
      action: "Add summary",
    },
    ...(requiredEvidence
      ? [
          {
            label: requiredEvidence,
            done: evidenceSatisfied,
            state: evidenceSatisfied ? ("complete" as const) : ("needs_you" as const),
            hint: evidenceNeedsFile
              ? `Upload the photo or file this work needs${qualifyingFiles > 0 ? "" : " — nothing is attached yet"}.`
              : "Add the confirmation this work needs.",
            action: "Add evidence",
          },
        ]
      : []),
    ...(guestCommsRequired
      ? [
          {
            label: "Final message to the guest",
            done: finalComms,
            state: finalComms ? ("complete" as const) : ("needs_you" as const),
            hint: "Confirm the closing message when you close.",
            action: "Confirm",
          },
        ]
      : []),
    ...(ticket.guest_in_residence
      ? [
          {
            label: "Guest confirmation",
            done: guestConfirmed,
            state: guestConfirmed ? ("complete" as const) : ("waiting" as const),
            waitingOn: "Waiting on guest",
            hint: "Resolve will mark this complete when confirmation is recorded.",
          },
        ]
      : []),
  ];
  const closureReady = closureChecklist.every((c) => c.done);
  const remaining = closureChecklist.filter((c) => !c.done).length;

  // Evidence appears when the work actually calls for it — never as an empty
  // upload box on an ordinary ticket.
  const needsEvidence = Boolean(
    requiredEvidence ||
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
    missingClosureEvidence: Boolean(requiredEvidence) && !evidenceSatisfied,
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

  /**
   * Every status write in this file goes through the one server-side
   * validator. The browser no longer decides what a legal transition is; it
   * only asks, and shows the refusal when the answer is no.
   */
  async function applyStatus(
    status: string,
    patch: Record<string, unknown> = {},
  ): Promise<boolean> {
    try {
      const result = await setStatusFn({ data: { ticketId, status, patch } });
      if (!result.ok) {
        toast.error(result.message);
        return false;
      }
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That change could not be saved.");
      return false;
    }
  }

  async function startWorking() {
    const now = new Date().toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const firstTouch = !ticket.acknowledged_at;
    if (ticket.status === "open") {
      if (!(await applyStatus("in_progress"))) return;
    }
    const { error } = await supabase
      .from("tickets")
      .update({
        acknowledged_at: ticket.acknowledged_at ?? now,
        action_started_at: ticket.action_started_at ?? now,
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
    const review = new Date(waitReview);
    if (Number.isNaN(review.getTime()) || review.getTime() <= Date.now()) {
      toast.error("The review time has to be in the future — that is when this comes back to you.");
      return;
    }
    const ok = await applyStatus("waiting", {
      waiting_on: waitOn,
      waiting_reason: waitReason.trim(),
      next_review_at: new Date(waitReview).toISOString(),
    });
    if (!ok) return;
    await log(
      "waiting",
      `Waiting on ${labelFor(WAITING_ON, waitOn)}: ${waitReason.trim()} — review ${usDateTime(waitReview)}`,
      "waiting_set",
    );
    await refresh();
    toast.success("Marked as waiting, with a review date.");
  }

  async function clearWaiting() {
    const ok = await applyStatus("in_progress", {
      waiting_on: null,
      waiting_reason: null,
      next_review_at: null,
    });
    if (!ok) return;
    await log("waiting", "No longer waiting — back in progress.", "waiting_cleared");
    setWaitReason("");
    setWaitReview("");
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
    if (!(await applyStatus(status))) return;
    await log("status", `Status changed to ${labelFor(STATUSES, status)}.`, "status_changed");
    await refresh();
    toast.success("Status updated.");
  }

  /** Supervisor cleanup for duplicates, tests and junk — never a frontline action. */
  async function deleteTicket() {
    const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ticket deleted.");
    void navigate({ to: "/tickets" });
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
    // The summary already on file counts. Work sent back for changes keeps the
    // summary it was written with, so nobody has to retype it to close again.
    const summary = (resolution.trim() || String(ticket.resolution_notes ?? "").trim()).trim();
    if (requiredOpen.length > 0 && !waived) {
      toast.error(`${requiredOpen.length} required step(s) still open.`);
      return;
    }
    if (!summary) {
      toast.error("Add a resolution summary — what was wrong and what was done.");
      return;
    }
    if (requiredEvidence && !evidenceSatisfied && !waived) {
      toast.error(
        evidenceNeedsFile
          ? "Attach the photo or file this work requires — a description is not enough."
          : "Add the closure evidence this work requires.",
      );
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

    const ok = await applyStatus("resolved", {
      outcome_type: outcome,
      resolution_notes: summary,
      closure_evidence: evidence.trim() || null,
      final_communication_sent: finalComms,
      guest_confirmed: guestConfirmed,
      late_reason: sla.breached ? "SLA target missed" : null,
      // Finishing the work again puts it back in front of a reviewer; an
      // earlier "changes needed" answer is history, not a standing decision.
      closure_qa_result: "not_reviewed",
    });

    if (!ok) return;
    await log(
      "resolved",
      `Resolved as ${labelFor(OUTCOME_TYPES, outcome)} — closure review is next. ${summary}`,
      "resolved",
    );

    setResolution("");
    setEvidence("");
    await refresh();
    toast.success("Resolved — it moves to closure review before it is closed.");
  }

  async function reopen() {
    const ok = await applyStatus("in_progress", {
      resolved_at: null,
      reopen_count: (ticket.reopen_count ?? 0) + 1,
      last_reopened_at: new Date().toISOString(),
    });
    if (!ok) return;
    await log("reopened", "Reopened — the issue was not fully resolved.", "reopened");
    await refresh();
    toast.success("Reopened.");
  }

  /** The guest has told us it is genuinely fixed. */
  async function markVerified() {
    const { error } = await supabase
      .from("tickets")
      .update({ guest_confirmed: true })
      .eq("id", ticketId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await log("guest", "Guest confirmed the issue is resolved.", "guest_confirmed");
    await refresh();
    toast.success("Recorded — the guest confirmed it.");
  }

  /* ---------------- where this ticket is in the work ---------------- */
  const repairLinks = (repairState?.links ?? []) as { status: string }[];
  const orders = (workOrders ?? []) as {
    phase: string | null;
    closed_at: string | null;
    vendor_completed_at: string | null;
  }[];
  const liveOrders = orders.filter((o) => o.phase !== "cancelled");
  const repairExists = repairLinks.length > 0 || liveOrders.length > 0;
  const repairComplete =
    ticket.vendor_status === "completed" ||
    repairLinks.some((l) => l.status === "completed") ||
    (liveOrders.length > 0 &&
      liveOrders.every((o) => Boolean(o.closed_at) || Boolean(o.vendor_completed_at)));
  const verified = !ticket.guest_in_residence || Boolean(ticket.guest_confirmed);
  const rawStage = ticketStage({
    status: ticket.status,
    closed,
    acknowledged_at: ticket.acknowledged_at,
    action_started_at: ticket.action_started_at,
    repairExists,
    repairComplete,
    verified,
    requiredOpenSteps: requiredOpen.length,
    repairPossible: repairIsPossible(ticket.category, workType?.name),
  });
  // The coordinator can say "this needs no repair" and go straight to finishing.
  const stage = rawStage === "repair" && closeOpen ? "closure" : rawStage;
  // One active upload path: while an evidence requirement is live the uploader
  // lives in Current Work, and the Evidence tab shows history only.
  const evidenceRequirementActive =
    !closed &&
    ((stage === "verify" && needsEvidence) || (Boolean(requiredEvidence) && !evidenceSatisfied));

  const assigneeName = assignee?.full_name ?? assignee?.email ?? "Unassigned";
  const propertyName = ticket.properties?.nickname ?? ticket.properties?.name ?? "Property";
  const activeBranch = { claim: Boolean(branches?.claim), recovery: Boolean(branches?.recovery) };

  // One plain-language sentence: what is happening and what comes next. No stat wall.
  const nextStepLine = closed
    ? ticket.status === "resolved"
      ? "Resolved — waiting on closure review."
      : "Closed and filed."
    : stage === "start"
      ? "Not started yet — acknowledge it and start the clock."
      : stage === "waiting"
        ? `Waiting on ${labelFor(WAITING_ON, ticket.waiting_on).toLowerCase()}.`
        : stage === "repair_active"
          ? "Field team has it — watch for completion, then verify."
          : stage === "verify"
            ? "Repair reported complete — confirm with the guest."
            : stage === "steps"
              ? (nextAction?.label ?? "Work the remaining steps.")
              : stage === "repair"
                ? "Decide whether this needs a field repair."
                : stage === "closure"
                  ? closureReady
                    ? "Everything required is satisfied — ready to close."
                    : `${remaining} thing${remaining === 1 ? "" : "s"} left before this can close.`
                  : "In progress.";

  function priorityTone2(priority: string | null | undefined): StatusTone {
    if (priority === "p1") return "escalated";
    if (priority === "p2") return "waiting";
    return "context";
  }

  const guidance = !closed && (
    <details className="group rounded-lg border border-border bg-card px-3 py-2">
      <summary className="cursor-pointer text-sm text-muted-foreground">
        Why this action? View guidance
      </summary>
      <div className="pt-3">
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
      </div>
    </details>
  );

  const repairPanel = (
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
  );

  const closureBlock = (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">
          {closureReady ? "Ready to close" : "Before this ticket can close"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {closureReady
            ? "Everything Resolve requires on this ticket is satisfied."
            : `Resolve checks these automatically. ${remaining} still outstanding.`}
        </p>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {closureChecklist.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.label}</p>
              {!c.done && c.hint && <p className="text-xs text-muted-foreground">{c.hint}</p>}
            </div>
            {c.state === "complete" ? (
              <StatusBadge tone="resolved">Complete</StatusBadge>
            ) : c.state === "waiting" ? (
              <StatusBadge tone="waiting">{c.waitingOn ?? "Waiting"}</StatusBadge>
            ) : (
              <StatusBadge tone="escalated">Needs you</StatusBadge>
            )}
            {c.state === "needs_you" && c.action && !closeOpen && (
              <Button size="sm" variant="outline" onClick={() => setCloseOpen(true)}>
                {c.action}
              </Button>
            )}
          </li>
        ))}
      </ul>

      {!closeOpen ? (
        <Button onClick={() => setCloseOpen(true)} size="lg">
          {closureReady ? "Close ticket" : "Work through what is missing"}
        </Button>
      ) : (
        <div className="space-y-4 border-t border-border pt-4">
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
            <Label>What was wrong and what was done</Label>
            <Textarea rows={3} value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </div>

          {requiredEvidence && (
            <div className="space-y-2">
              <Label>{requiredEvidence}</Label>
              <Textarea
                rows={2}
                placeholder="Describe or link the evidence (photo, invoice, serial number, vendor confirmation)."
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
              />
              <AttachmentsPanel entityType="ticket" entityId={ticketId} title="Add photos" />
              {evidenceNeedsFile && qualifyingFiles === 0 && (
                <p className="text-sm text-danger">
                  A photo or file is required here — a written description on its own will not close
                  this ticket.
                </p>
              )}
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
              checked={guestConfirmed || Boolean(ticket.guest_confirmed)}
              onChange={setGuestConfirmed}
            />
          )}

          <Button onClick={resolveTicket} size="lg">
            <CheckCircle2 className="size-4" /> Close ticket
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex items-start gap-6">
      <QueueRail
        origin={origin}
        token={token}
        currentId={ticketId}
        to="/tickets/$ticketId"
        paramKey="ticketId"
      />
      <div className="min-w-0 flex-1 space-y-5">
        <RecordHeaderNav
          origin={origin}
          token={token}
          current={`Ticket #${ticket.ref}`}
          recordId={ticketId}
          to="/tickets/$ticketId"
          paramKey="ticketId"
        />

        {/* ---------------- A. identity & state ---------------- */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="flex min-w-0 gap-3">
            {ticket.property_id && (
              <button type="button" onClick={() => setPropertyOpen(true)} className="shrink-0">
                <PropertyPhoto
                  url={ticket.properties?.primary_photo_url}
                  name={propertyName}
                  className="size-12"
                />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                #{ticket.ref}
                {ticket.record_type === "completed_interaction" ? " · Completed interaction" : ""}
              </p>
              <h1 className="text-2xl font-semibold sm:text-3xl">{ticket.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone={priorityTone2(ticket.priority)}>{meta.short}</StatusBadge>
                <StatusBadge tone={ticketTone(ticket.status)}>
                  {labelFor(STATUSES, ticket.status)}
                </StatusBadge>
                {ticket.guest_in_residence && (
                  <StatusBadge tone="brand">Guest in the home</StatusBadge>
                )}
                {ticket.property_id && (
                  <button
                    type="button"
                    onClick={() => setPropertyOpen(true)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    <Building2 className="size-3.5" aria-hidden="true" />
                    {propertyName}
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm font-medium text-muted-foreground">{nextStepLine}</p>
            </div>
          </div>
          <MoreActions
            ticket={ticket}
            closed={closed}
            role={role}
            branches={activeBranch}
            onChanged={refresh}
            onStatus={changeStatus}
            onDelete={deleteTicket}
          />
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

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ---------------- B. dominant active-work canvas ---------------- */}
          <div className="space-y-5 lg:col-span-2">
            <section aria-label="Current work">
              <h2 className="eyebrow text-muted-foreground">Current work</h2>

              {stage === "start" && (
                <div className="mt-2 space-y-3">
                  <h2 className="text-xl font-semibold">Start working</h2>
                  <p className="text-sm text-muted-foreground">
                    One click acknowledges this, starts the clock and puts it in your name.
                  </p>
                  <Button size="lg" onClick={startWorking}>
                    Start working
                  </Button>
                </div>
              )}

              {stage === "waiting" && (
                <div className="mt-2 space-y-3">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <PauseCircle className="size-5" /> Waiting on{" "}
                    {labelFor(WAITING_ON, ticket.waiting_on).toLowerCase()}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {ticket.waiting_reason}
                    {ticket.next_review_at
                      ? ` · comes back to you ${usDateTime(ticket.next_review_at)}`
                      : ""}
                  </p>
                  <Button size="lg" onClick={clearWaiting}>
                    Pick it back up
                  </Button>
                </div>
              )}

              {stage === "repair_active" && (
                <div className="mt-2 space-y-3">
                  <h2 className="text-xl font-semibold">Waiting on the repair</h2>
                  <p className="text-sm text-muted-foreground">
                    The field team has this. Watch for completion, then verify it.
                  </p>
                  {repairPanel}
                </div>
              )}

              {stage === "verify" && (
                <div className="mt-2 space-y-3">
                  <h2 className="text-xl font-semibold">Verify the outcome</h2>
                  <p className="text-sm text-muted-foreground">
                    The repair is reported complete. Contact the guest and confirm it is genuinely
                    fixed.
                  </p>
                  {needsEvidence && (
                    <AttachmentsPanel
                      entityType="ticket"
                      entityId={ticketId}
                      title="Add completion evidence"
                    />
                  )}
                  <Button size="lg" onClick={markVerified}>
                    Guest confirmed it is fixed
                  </Button>
                </div>
              )}

              {stage === "steps" && (
                <div className="mt-2 space-y-3">
                  <h2 className="text-xl font-semibold">{nextAction?.label ?? "Work the steps"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {done} of {steps.length} done · {requiredOpen.length} required step
                    {requiredOpen.length === 1 ? "" : "s"} left
                  </p>
                  <div className="space-y-2">
                    {steps.map((s) => (
                      <div
                        key={s.id}
                        className={`flex gap-3 rounded-lg border bg-card p-3 ${
                          s.completed ? "border-success/30 bg-success/5" : "border-border"
                        }`}
                      >
                        <Checkbox
                          checked={s.completed}
                          onCheckedChange={(v) => toggleStep(s.id, s.instruction, v === true)}
                          className="mt-1"
                        />
                        <div className="min-w-0 space-y-1">
                          <p
                            className={`text-sm font-medium ${s.completed ? "text-muted-foreground line-through" : ""}`}
                          >
                            {s.instruction}
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {steps.some((s) => s.photo_required && !s.completed) && (
                    <AttachmentsPanel
                      entityType="ticket"
                      entityId={ticketId}
                      title="Add the photo this step needs"
                    />
                  )}
                </div>
              )}

              {stage === "repair" && (
                <div className="mt-2 space-y-3">
                  <h2 className="text-xl font-semibold">Does this need a field repair?</h2>
                  <p className="text-sm text-muted-foreground">
                    Send it to the field team and Resolve tracks it from here.
                  </p>
                  {repairPanel}
                  <Button variant="ghost" size="sm" onClick={() => setCloseOpen(true)}>
                    No repair needed — finish this ticket
                  </Button>
                </div>
              )}

              {stage === "closure" && <div className="mt-2">{closureBlock}</div>}

              {stage === "closed" && (
                <div className="mt-2 space-y-3">
                  {showCelebrate ? (
                    <Celebrate
                      title={
                        ticket.status === "resolved" ? "Work is finished" : "This ticket is closed"
                      }
                    >
                      {ticket.resolution_notes ?? "Nice work."}
                    </Celebrate>
                  ) : (
                    <>
                      <h2 className="text-xl font-semibold">
                        {ticket.status === "resolved"
                          ? "Work is finished"
                          : "This ticket is closed"}
                      </h2>
                      {ticket.resolution_notes && (
                        <p className="text-sm text-muted-foreground">{ticket.resolution_notes}</p>
                      )}
                    </>
                  )}
                  {ticket.status === "resolved" && (
                    <FinalReviewPanel
                      ticketId={String(ticket["id"])}
                      result={ticket["closure_qa_result"] as string | null}
                      note={ticket["final_review_note"] as string | null}
                      facts={{
                        priority: ticket["priority"] as string,
                        category: ticket["category"] as string,
                        guest_in_residence: ticket["guest_in_residence"] as boolean,
                        guest_impact: ticket["guest_impact"] as string,
                        escalated: Boolean(ticket["escalated_at"]),
                        escalation_level: ticket["escalation_level"] as string,
                        reopen_count: ticket["reopen_count"] as number,
                        hasClaim: activeBranch.claim,
                        hasRecovery: activeBranch.recovery,
                      }}
                    />
                  )}
                  {ticket.record_type !== "completed_interaction" && (
                    <Button variant="outline" onClick={reopen}>
                      Reopen this ticket
                    </Button>
                  )}
                </div>
              )}

              {/* Special Handling belongs with the decision, never as page furniture. */}
              {(stage === "repair" || stage === "repair_active" || stage === "steps") && (
                <div className="mt-4">
                  <SpecialHandlingNotice propertyId={ticket.property_id} moment="maintenance" />
                </div>
              )}

              {!closed && stage !== "waiting" && stage !== "start" && (
                <div className="mt-3">
                  <WaitingControl
                    waitOn={waitOn}
                    setWaitOn={setWaitOn}
                    waitReason={waitReason}
                    setWaitReason={setWaitReason}
                    waitReview={waitReview}
                    setWaitReview={setWaitReview}
                    onPark={setWaiting}
                  />
                </div>
              )}
            </section>

            {guidance}

            {/* Live lanes on the same incident — only when they are actually open. */}
            {activeBranch.recovery && <TicketRecoveryPanel ticket={ticket} />}
            {activeBranch.claim && <TicketClaimPanel ticket={ticket} />}
          </div>

          {/* ---------------- B. context rail ---------------- */}
          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!closed && ticket.record_type !== "completed_interaction" && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Response
                    </p>
                    <div className="flex flex-wrap gap-x-3">
                      <ClockText state={sla.response} />
                      <ClockText state={sla.action} />
                    </div>
                  </div>
                )}
                <Field label="Assigned to" value={assigneeName} />
                <Field label="Priority" value={meta.short} />
                <Field
                  label="Type"
                  value={workType?.name ?? labelFor(CATEGORIES, ticket.category)}
                />
                <Field label="Received" value={relativeTime(ticket.reported_at)} />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">Property</span>
                  <button
                    type="button"
                    onClick={() => setPropertyOpen(true)}
                    className="truncate text-right font-medium text-primary hover:underline"
                  >
                    {propertyName}
                  </button>
                </div>
              </CardContent>
            </Card>

            <GuestContextPanel ticketId={ticketId} />
          </aside>
        </div>

        {/* ---------------- C. record & history ---------------- */}
        <Tabs defaultValue="activity" className="w-full">
          <TabsList>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="history">Property history</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4 pt-4">
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
            <div className="border-t border-border pt-2">
              <ActivityList
                events={activity.map((a) => ({
                  id: a.id,
                  kind: activityKindFor(a.kind, a.event_type, a.body),
                  label: (
                    <>
                      {humanizeHistoryText(a.body)}{" "}
                      <span className="text-muted-foreground">
                        — {a.author?.full_name ?? a.author?.email ?? "Team member"}
                      </span>
                    </>
                  ),
                  when: relativeTime(a.event_at ?? a.created_at),
                }))}
                emptyLabel="No activity yet."
              />
            </div>
          </TabsContent>

          <TabsContent value="evidence" className="pt-4">
            <AttachmentsPanel
              entityType="ticket"
              entityId={ticketId}
              title="Evidence on file"
              readOnly={evidenceRequirementActive}
              {...(evidenceRequirementActive
                ? {
                    description:
                      "An upload is required for the current step — add it in Current Work so Resolve credits the requirement.",
                  }
                : {})}
            />
          </TabsContent>

          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="space-y-3 text-sm">
              <Field
                label="Address"
                value={
                  [ticket.properties?.address_line1, ticket.properties?.city]
                    .filter(Boolean)
                    .join(", ") || "—"
                }
              />
              <Field label="Acknowledged" value={relativeTime(ticket.acknowledged_at)} />
              <Field label="Action started" value={relativeTime(ticket.action_started_at)} />
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">Vendor</span>
                <span className="flex items-center gap-2 text-right font-medium">
                  {ticket.vendor_name ?? "—"}
                  {ticket.vendor_name && ticket.vendor_status && (
                    <StatusBadge tone={vendorStatusTone(ticket.vendor_status)}>
                      {labelFor(
                        [
                          { value: "dispatched", label: "Dispatched" },
                          { value: "in_progress", label: "In progress" },
                          { value: "completed", label: "Completed" },
                        ],
                        ticket.vendor_status,
                      )}
                    </StatusBadge>
                  )}
                </span>
              </div>
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
              {ticket.closure_evidence && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Evidence</p>
                  <p className="mt-1 whitespace-pre-wrap">{ticket.closure_evidence}</p>
                </div>
              )}
            </div>

            <details className="group rounded-lg border border-border px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground">
                More about this ticket
              </summary>
              <div className="mt-3 space-y-4 border-t border-border pt-3">
                <OutlookSourceCard entityType="ticket" entityId={ticketId} />
                <details className="rounded-lg border border-border px-3 py-2 text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Reservation snapshot from when this ticket opened
                  </summary>
                  <div className="pt-3">
                    <ReservationContextPanel
                      ticket={ticket}
                      ownerRezPropertyId={ticket.properties?.ownerrez_property_id ?? null}
                    />
                  </div>
                </details>
                {ticket.vendor_user_id && ticket.vendor_status === "completed" && (
                  <VendorRatingPanel ticketId={ticket.id} priority={ticket.priority ?? null} />
                )}
                {ticket.vendor_user_id && <VisitLogPanel ticketId={ticket.id} />}
                {role.can("work_orders_internal") && (
                  <TicketWorkOrderPanel ticket={ticket} readOnly />
                )}
              </div>
            </details>
          </TabsContent>

          <TabsContent value="history" className="space-y-2 pt-4">
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
          </TabsContent>
        </Tabs>

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

/**
 * Everything that is not the current work: assignment, handoff, the lanes that
 * are not open yet, and supervisor corrections. One home, out of the way.
 */
function MoreActions({
  ticket,
  closed,
  role,
  branches,
  onChanged,
  onStatus,
  onDelete,
}: {
  ticket: Record<string, unknown> & { id: string; status: string; record_type?: string | null };
  closed: boolean;
  role: ReturnType<typeof useRole>;
  branches: { claim: boolean; recovery: boolean };
  onChanged: () => Promise<void> | void;
  onStatus: (status: string) => void;
  onDelete: () => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          More
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>More actions</SheetTitle>
          <SheetDescription>
            Assignment, handoff, escalation and the lanes that are not open.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-8">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <MatterOwnershipPanel ticket={ticket as any} closed={closed} onChanged={onChanged} />
          {!closed && (
            <div className="rounded-lg border border-border/60 p-4">
              <h3 className="font-medium">Stuck on a decision?</h3>
              <p className="mb-3 mt-1 text-sm text-muted-foreground">
                Escalating asks for a decision. You keep the ticket unless the person answering
                takes it.
              </p>
              <EscalationPanel ticketId={String(ticket["id"])} />
            </div>
          )}
          {ticket.record_type !== "completed_interaction" && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <HandoffPanel ticket={ticket as any} closed={closed} onChanged={onChanged} />
          )}

          {/* Only shows when this property belongs to an Active Owner program. */}
          <OwnerParticipationOffer source="operations" sourceId={String(ticket["id"])} />
          {!branches.recovery && (
            <IncidentBranch
              open={false}
              label="Make it right for the guest"
              hint="Credit, refund, a gesture — and who has to approve it."
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <TicketRecoveryPanel ticket={ticket as any} />
            </IncidentBranch>
          )}
          {!branches.claim && (
            <IncidentBranch
              open={false}
              label="Recover the cost"
              hint="Damage, deposit or a channel claim on the same incident."
            >
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <TicketClaimPanel ticket={ticket as any} />
            </IncidentBranch>
          )}
          {role.isSupervisor && (
            <div className="space-y-1.5 border-t border-border pt-4">
              <Label className="text-xs text-muted-foreground">Status (supervisor)</Label>
              <Select value={ticket.status} onValueChange={onStatus} disabled={closed}>
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
              {closed && (
                // Reopening has one home: the explicit action in Current Work.
                <p className="text-xs text-muted-foreground">
                  This ticket is closed. Use “Reopen this ticket” to put it back into work.
                </p>
              )}
            </div>
          )}
          {role.isSupervisor && (
            <div className="space-y-2 border-t border-border pt-4">
              <Label className="text-xs text-muted-foreground">Danger zone</Label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full text-danger">
                    Delete ticket
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Delete ticket #{String(ticket["ref"] ?? "")}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action permanently removes this ticket from normal Resolve records. Use
                      it for duplicates, accidental tickets, tests and junk records.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Delete ticket</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
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

/** Which Activity List icon/colour a logged event gets. */
function activityKindFor(
  kind: string | null,
  eventType: string | null,
  body: string | null,
): ActivityKind {
  if (kind === "note") return "note";
  if (
    kind === "resolved" ||
    (eventType === "status_changed" && body?.toLowerCase().includes("closed"))
  )
    return "completed";
  if (kind === "waiting") return "waiting";
  const text = `${kind ?? ""} ${eventType ?? ""}`.toLowerCase();
  if (text.includes("escalat")) return "escalation";
  const lane = laneOf(kind, eventType, body);
  if (lane === "claim") return "approval";
  if (lane === "guest") return "owner";
  return "repair";
}

/** Plain-language vendor status → the shared status vocabulary. */
function vendorStatusTone(status: string | null | undefined): StatusTone {
  if (status === "completed") return "resolved";
  if (status === "dispatched") return "waiting";
  return "progress";
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
