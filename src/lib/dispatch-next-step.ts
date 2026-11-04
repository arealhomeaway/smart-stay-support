/**
 * The one next dispatch step for an open Work Order, shown inside Fix it.
 * Pure. Order: vendor on the Work Order, acceptance, authorization,
 * appointment, then the send. Server checks still run on every action.
 */
import type { AuthorizationState } from "@/lib/vendor-sourcing";

export type DispatchStep =
  | { kind: "reconcile"; title: string; body: string }
  | { kind: "add_vendor"; title: string; body: string }
  | { kind: "accept"; title: string; body: string; candidateId: string; button: string }
  | { kind: "authorize"; title: string; body: string }
  | { kind: "appointment"; title: string; body: string; button: string }
  | { kind: "send_breezeway"; title: string; body: string; button: string; retry: boolean }
  | { kind: "send_email"; title: string; body: string }
  | { kind: "checking"; title: string; body: string };

export function dispatchNextStep(input: {
  closed: boolean;
  dispatched: boolean;
  handoffStatus: string | null | undefined;
  accepted: { name: string } | null;
  candidate: { id: string; name: string } | null;
  auth: Pick<AuthorizationState, "satisfied" | "label">;
  hasAppointment: boolean;
  /** From the server's email rule: email when Breezeway cannot reach this vendor. null = not known yet. */
  sendBy: "breezeway" | "email" | null;
}): DispatchStep | null {
  const h = input.handoffStatus ?? "not_sent";
  if (input.closed || input.dispatched || h === "sent" || h === "simulated") return null;
  if (h === "uncertain")
    return {
      kind: "reconcile",
      title: "Check Breezeway before sending again",
      body: "The last send may have reached Breezeway. Open the Work Order and record what you find there first.",
    };
  if (!input.accepted) {
    if (!input.candidate)
      return { kind: "add_vendor", title: "Add the vendor to this Work Order", body: "Open the Work Order and add who will do the work." };
    return {
      kind: "accept",
      title: `Has ${input.candidate.name} agreed to do the work?`,
      body: "Contacting a vendor is not the same as acceptance. Mark it once they say yes.",
      candidateId: input.candidate.id,
      button: `Mark ${input.candidate.name} accepted`,
    };
  }
  if (!input.auth.satisfied)
    return { kind: "authorize", title: "Get the spending approved", body: `${input.auth.label}. Open the Work Order to request or record the approval.` };
  if (!input.hasAppointment)
    return { kind: "appointment", title: `When is ${input.accepted.name} coming?`, body: "Set the appointment date and time.", button: "Set the appointment" };
  if (input.sendBy === null) return { kind: "checking", title: "Checking how to send this", body: "One moment." };
  if (input.sendBy === "email")
    return { kind: "send_email", title: `Email the work order to ${input.accepted.name}`, body: "This vendor is not reached through Breezeway for this home." };
  return {
    kind: "send_breezeway",
    title: `Send to Breezeway for ${input.accepted.name}`,
    body: "Creates the task in Breezeway with the appointment.",
    button: h === "failed" ? "Try sending to Breezeway again" : "Send to Breezeway",
    retry: h === "failed",
  };
}

/** The guest update saved when a PC confirms they replied to the guest. */
export function ownerRezGuestUpdate(note: string, nextUpdateAt: string | null, now: Date) {
  const extra = note.trim();
  return {
    patch: {
      guest_update_at: now.toISOString(),
      guest_update_note: extra ? `Responded to the guest. ${extra}` : "Responded to the guest.",
      next_guest_update_at: nextUpdateAt,
    },
    history: extra ? `Guest updated: ${extra}` : "Guest updated.",
  };
}
