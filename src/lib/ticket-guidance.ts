/**
 * Guided Ticket — "What do you need to do now?"
 *
 * A derived UX layer over the canonical Ticket lifecycle. It never replaces
 * ticket statuses, the SLA engine, closure gates or the Current Action engine;
 * it adds the few decisions Resolve cannot work out on its own (guest update,
 * how to resolve, who to send) and presents the Ticket as one of seven stages.
 *
 * Pure and deterministic — unit-tested in __tests__/ticket-guidance.test.ts.
 */

export const GUIDANCE_STAGES = [
  "needs_acknowledgment",
  "needs_decision",
  "needs_action",
  "waiting",
  "needs_follow_up",
  "ready_to_close",
  "closed",
] as const;
export type GuidanceStage = (typeof GUIDANCE_STAGES)[number];

export const GUIDANCE_STAGE_LABELS: Record<GuidanceStage, string> = {
  needs_acknowledgment: "Needs Acknowledgment",
  needs_decision: "Needs Decision",
  needs_action: "Needs Action",
  waiting: "Waiting",
  needs_follow_up: "Needs Follow-Up",
  ready_to_close: "Ready to Close",
  closed: "Closed",
};

export type ResolutionPath = "guest" | "field" | "escalate" | "already_resolved";

export const RESOLUTION_OPTIONS: { value: ResolutionPath; label: string; help: string }[] = [
  {
    value: "guest",
    label: "Try to solve this with the guest",
    help: "Resolve walks you through approved troubleshooting steps, one at a time.",
  },
  {
    value: "field",
    label: "Send someone to the property",
    help: "Choose a vendor or ARHA team member to go fix it.",
  },
  {
    value: "escalate",
    label: "Escalate to a supervisor",
    help: "A supervisor takes the decision. The ticket waits on them.",
  },
  {
    value: "already_resolved",
    label: "Issue already resolved",
    help: "Nothing more to do — record what fixed it and close.",
  },
];

export type GuidanceInput = {
  status: string | null | undefined;
  closed: boolean;
  acknowledged_at: string | null | undefined;
  guest_in_residence?: boolean | null;
  reservation_arrival?: string | null;
  reservation_departure?: string | null;
  guest_update_at?: string | null;
  next_guest_update_at?: string | null;
  resolution_path?: string | null;
  resolution_notes?: string | null;
  waiting_on?: string | null;
  waiting_reason?: string | null;
  next_review_at?: string | null;
  selected_vendor_org_id?: string | null;
  /** Troubleshooting: guide steps exist / answered / last outcome. */
  troubleshooting?: { total: number; answered: number; fixed: boolean; notFixed: boolean } | null;
  /** Linked Work Orders that are not cancelled. */
  openWorkOrders: number;
  completeWorkOrders: number;
  requiredOpenSteps: number;
  missingEvidence: boolean;
  guestConfirmed?: boolean | null;
  now?: Date;
};

/** A guest is in the home right now — from OwnerRez stay dates or the ticket flag. */
export function activeGuestStay(
  t: Pick<GuidanceInput, "guest_in_residence" | "reservation_arrival" | "reservation_departure">,
  now = new Date(),
): boolean {
  if (t.reservation_arrival && t.reservation_departure) {
    const today = now.toISOString().slice(0, 10);
    if (t.reservation_arrival <= today && today <= t.reservation_departure) return true;
  }
  return Boolean(t.guest_in_residence);
}

export type GuidedStepKind = "guest_update" | "decide" | "troubleshoot" | "choose_vendor";

export type CloseItem = { label: string; done: boolean };

export type Guidance = {
  stage: GuidanceStage;
  /** A step this layer owns; null = the existing Current Action engine leads. */
  step: GuidedStepKind | null;
  title: string;
  body: string;
  waiting: { on: string; next: string; guestUpdateDue: string | null } | null;
  closeItems: CloseItem[];
  remaining: number;
};

const WAITING_LABEL: Record<string, string> = {
  vendor: "Vendor ETA",
  guest: "Guest Response",
  owner: "Owner Approval",
  approval: "Approval",
  supervisor: "Supervisor",
  scheduled_date: "Scheduled Visit",
  parts: "Parts / delivery",
  internal_team: "ARHA team",
  other: "another party",
};

export function waitingLabel(on: string | null | undefined) {
  return WAITING_LABEL[on ?? ""] ?? (on ? on.replace(/_/g, " ") : "another party");
}

export function closeItemsFor(t: GuidanceInput): CloseItem[] {
  const stay = activeGuestStay(t, t.now);
  const items: CloseItem[] = [
    { label: "Issue resolution summary", done: Boolean(t.resolution_notes?.trim()) },
  ];
  if (stay) items.push({ label: "Guest update completed", done: Boolean(t.guest_update_at) });
  if (t.openWorkOrders + t.completeWorkOrders > 0) {
    items.push({ label: "Linked Work Order complete", done: t.openWorkOrders === 0 });
  }
  if (t.requiredOpenSteps > 0) items.push({ label: "Required steps finished", done: false });
  items.push({ label: "Required evidence present", done: !t.missingEvidence });
  items.push({ label: "No active unresolved dependency", done: !t.waiting_on });
  return items;
}

export function ticketGuidance(t: GuidanceInput): Guidance {
  const now = t.now ?? new Date();
  const closeItems = closeItemsFor(t);
  const remaining = closeItems.filter((i) => !i.done).length;
  const base = { closeItems, remaining, waiting: null as Guidance["waiting"] };
  const stay = activeGuestStay(t, now);

  if (t.closed) {
    return { ...base, stage: "closed", step: null, title: "Closed", body: "This ticket is filed." };
  }
  if (!t.acknowledged_at) {
    return {
      ...base,
      stage: "needs_acknowledgment",
      step: null,
      title: "Acknowledge this ticket",
      body: "Let the team know you have it.",
    };
  }
  if (stay && !t.guest_update_at) {
    return {
      ...base,
      stage: "needs_acknowledgment",
      step: "guest_update",
      title: "Update the guest",
      body: "This issue is affecting an active guest stay. Acknowledge the issue and tell the guest what will happen next.",
    };
  }

  // Waiting on someone: show who, and what happens next.
  if (t.waiting_on) {
    const overdue = t.next_review_at && new Date(t.next_review_at) <= now;
    const guestDue = stay && t.next_guest_update_at && new Date(t.next_guest_update_at) <= now;
    const waiting = {
      on: waitingLabel(t.waiting_on),
      next: t.waiting_reason?.trim() || "Resolve brings this back to you when it is time to check in.",
      guestUpdateDue: stay ? (t.next_guest_update_at ?? null) : null,
    };
    if (overdue || guestDue) {
      return {
        ...base,
        waiting,
        stage: "needs_follow_up",
        step: null,
        title: guestDue ? "Send the guest an update" : `Follow up: ${waiting.on}`,
        body: guestDue
          ? "The next guest update is due. Tell them where things stand."
          : "The check-in time has passed. Follow up and record what you learned.",
      };
    }
    return { ...base, waiting, stage: "waiting", step: null, title: `Waiting on ${waiting.on}`, body: waiting.next };
  }

  const hasRepair = t.openWorkOrders + t.completeWorkOrders > 0;
  if (!t.resolution_path && !hasRepair) {
    return {
      ...base,
      stage: "needs_decision",
      step: "decide",
      title: "How should this issue be resolved?",
      body: "Pick the path. Resolve guides you from there.",
    };
  }

  if (t.resolution_path === "guest" && !hasRepair) {
    const ts = t.troubleshooting;
    // Stay on this step until it is fixed or someone is sent — even after every
    // step is answered, so the Coordinator is never left without a next action.
    if (ts && !ts.fixed) {
      return {
        ...base,
        stage: "needs_action",
        step: "troubleshoot",
        title: "Troubleshoot with the guest",
        body: "Work one step at a time. If it is still not fixed, send someone.",
      };
    }
  }

  if (t.resolution_path === "field" && !hasRepair && !t.selected_vendor_org_id) {
    return {
      ...base,
      stage: "needs_action",
      step: "choose_vendor",
      title: "Choose who should handle this",
      body: "Pick the vendor or team for this property's market and trade.",
    };
  }

  if (t.openWorkOrders > 0) {
    return {
      ...base,
      waiting: { on: "Vendor", next: "The Work Order is open. Watch for completion, then verify.", guestUpdateDue: stay ? (t.next_guest_update_at ?? null) : null },
      stage: "waiting",
      step: null,
      title: "Waiting on the field visit",
      body: "The Work Order under this ticket is open.",
    };
  }

  if (remaining === 0 || (t.resolution_path === "already_resolved" && remaining <= 1)) {
    return {
      ...base,
      stage: "ready_to_close",
      step: null,
      title: remaining === 0 ? "Ready to Close" : `Ready to Close — ${remaining} item${remaining === 1 ? "" : "s"} remaining`,
      body: "Record what fixed it, then close.",
    };
  }
  if (t.requiredOpenSteps === 0 && (t.resolution_path === "already_resolved" || t.completeWorkOrders > 0 || t.troubleshooting?.fixed)) {
    return {
      ...base,
      stage: "ready_to_close",
      step: null,
      title: `Ready to Close — ${remaining} item${remaining === 1 ? "" : "s"} remaining`,
      body: "Finish the items below, then close.",
    };
  }
  return { ...base, stage: "needs_action", step: null, title: "Work the next step", body: "" };
}
