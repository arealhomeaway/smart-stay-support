import { PRIORITIES, type PriorityValue } from "@/lib/tickets";

export function priorityCorrection(
  calculated: string | null,
  previous: string,
  next: string,
  reason: string,
): { priority: PriorityValue; reason: string; activity: string } {
  if (!PRIORITIES.some((item) => item.value === next)) {
    throw new Error("Choose a P1, P2 or P3 priority.");
  }
  if (previous === next) throw new Error("Choose a different priority.");
  const explanation = reason.trim();
  if (explanation.length < 10) throw new Error("Explain the operational reason in at least 10 characters.");
  return {
    priority: next as PriorityValue,
    reason: explanation,
    activity: `Priority corrected from ${previous.toUpperCase()} to ${next.toUpperCase()} (calculated ${
      calculated?.toUpperCase() ?? "not recorded"
    }). Reason: ${explanation}`,
  };
}
