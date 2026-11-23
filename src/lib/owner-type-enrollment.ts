/**
 * Owner Type "Active Owner" enrolls the home (Help: Nov 20 code change; every path and
 * every role since Nov 23). Pure, browser-safe rules; the server side runs the one
 * automatic path (autoEnrollHome in active-owner-auto-enroll.server.ts).
 */
export const ACTIVE_OWNER_TYPE = "Active Owner";

/** Only a real change TO Active Owner starts enrollment. Changing away removes nothing. */
export function ownerTypeTurnsOnActiveOwner(before: string | null | undefined, after: string | null | undefined) {
  return (after ?? "").trim() === ACTIVE_OWNER_TYPE && (before ?? "").trim() !== ACTIVE_OWNER_TYPE;
}

/** Program states that already count as enrolled: a second program is never created for them. */
const NOT_LIVE = new Set(["draft", "closed", "completed", "complete"]);
export function isLiveProgram(p: { status: string; archived_at: string | null }) {
  return !p.archived_at && !NOT_LIVE.has(p.status);
}

/**
 * Closing date for enrollment: the project's planned closing, else the home's.
 * A confirmed actual closing wins, because the Enroll path refuses to change a
 * confirmed date without a reason.
 */
export function enrollmentClosingDate(d: {
  actualClosingOn: string | null;
  projectPlannedClosingOn: string | null;
  propertyPlannedClosingOn: string | null;
}) {
  return d.actualClosingOn ?? d.projectPlannedClosingOn ?? d.propertyPlannedClosingOn ?? null;
}

export type OwnerTypeOutcome =
  | { kind: "enrolled"; email: string; welcomeHeld: boolean }
  | { kind: "enrolled_no_email" }
  | { kind: "waiting_closing" }
  | { kind: "already_enrolled" }
  | { kind: "needs_authority" }
  | { kind: "needs_owner_record" }
  | { kind: "needs_email" }
  | { kind: "needs_closing" }
  | { kind: "needs_attention"; detail: string };

/** What the person sees after saving Owner Type. Plain words only. */
export function ownerTypeMessage(o: OwnerTypeOutcome | null | undefined): { tone: "success" | "warning"; text: string } | null {
  if (!o || o.kind === "already_enrolled") return null;
  switch (o.kind) {
    case "enrolled":
      return {
        tone: "success",
        text: o.welcomeHeld
          ? "Saved. This home is enrolled in Active Owner. The welcome email is held until its wording is approved."
          : `Saved. This home is enrolled in Active Owner. Welcome email sent to ${o.email}.`,
      };
    case "enrolled_no_email":
      return { tone: "warning", text: "Saved. This home is enrolled in Active Owner. Add the homeowner's email to send the login and welcome." };
    case "waiting_closing":
      return { tone: "warning", text: "Saved. Add the closing date to finish Active Owner setup." };
    case "needs_authority":
      return { tone: "warning", text: "Saved. The Director of Onboarding or an Admin sets up Active Owner for this home." };
    case "needs_owner_record":
      return { tone: "warning", text: "Saved. Link this home to its homeowner record to set up Active Owner." };
    case "needs_email":
      return { tone: "warning", text: "Saved. This home is on the Active Owner tab. Add the owner email there to finish setup." };
    case "needs_closing":
      return { tone: "warning", text: "Saved. Add the closing date on the Active Owner tab to finish setup." };
    case "needs_attention":
      return { tone: "warning", text: `Saved. Active Owner setup needs attention: ${o.detail}` };
  }
}

/** Which finishing button a program shows on the Active Owner tab, if any. */
export function finishSetupLabel(p: { ownerLinked: boolean; ownerEmail: string | null; propertyCount: number }) {
  if (p.ownerLinked || p.propertyCount === 0) return null;
  return p.ownerEmail ? "Finish setup" : "Add owner email";
}
