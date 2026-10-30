/**
 * What an Onboarding Task needs from the homeowner (browser-safe).
 *
 * These are different things and must never be merged:
 *   information       — facts, documents, records or uploads ARHA needs
 *   feedback          — owner input; ARHA continues under its approved process
 *   acknowledge       — the owner has reviewed / acknowledged something
 *   business_decision — a real authorization; the ONLY type that gates a Task
 *
 * Each maps onto the existing Owner Collaboration response types, so there is
 * one owner-request system, not two.
 */
export type OwnerDependency = "none" | "information" | "feedback" | "acknowledge" | "business_decision";

/** A business decision always requires a recorded homeowner approval. */
export function homeownerApprovalRequired(task: { owner_dependency?: string | null; requires_owner_approval?: boolean | null }): boolean {
  return task.owner_dependency === "business_decision" || task.requires_owner_approval === true;
}

export const OWNER_DEPENDENCIES: { code: OwnerDependency; label: string; blurb: string }[] = [
  { code: "none", label: "None", blurb: "No homeowner input is needed." },
  {
    code: "information",
    label: "Owner information / documentation",
    blurb: "ARHA needs facts, documents or uploads. Nothing is approved.",
  },
  {
    code: "feedback",
    label: "Owner feedback",
    blurb: "ARHA wants the owner's input and continues under its approved process.",
  },
  {
    code: "acknowledge",
    label: "Review / acknowledge",
    blurb: "The owner reviews or acknowledges information. Not an authorization.",
  },
  {
    code: "business_decision",
    label: "Business decision required",
    blurb: "A real owner authorization. Only this Task waits on it.",
  },
];

/** Types staff may choose on a live Task. A new Business Decision gate is not created from here. */
export const SELECTABLE_DEPENDENCIES: OwnerDependency[] = ["none", "information", "feedback", "acknowledge"];

/** The Owner Collaboration response type each dependency asks for. */
export const DEPENDENCY_RESPONSE_TYPE: Record<Exclude<OwnerDependency, "none">, "documentation" | "feedback" | "acknowledge" | "decision"> = {
  information: "documentation",
  feedback: "feedback",
  acknowledge: "acknowledge",
  business_decision: "decision",
};

export function effectiveDependency(task: {
  owner_dependency?: string | null;
  requires_owner_approval?: boolean | null;
}): OwnerDependency {
  const d = task.owner_dependency;
  if (d === "information" || d === "feedback" || d === "acknowledge" || d === "none") return d;
  if (d === "business_decision" || task.requires_owner_approval) return "business_decision";
  return "none";
}

/** Plain waiting language for non-decision dependencies — never approval words. */
export function dependencyWaitingLabel(dep: OwnerDependency, title?: string | null): string | null {
  if (dep === "information")
    return /document|upload|rules|record|file|agreement|policy|hoa/i.test(title ?? "")
      ? "Waiting on owner documentation"
      : "Waiting on owner information";
  if (dep === "feedback") return "Owner feedback requested — work continues";
  if (dep === "acknowledge") return "Owner review / acknowledgment requested";
  return null;
}
