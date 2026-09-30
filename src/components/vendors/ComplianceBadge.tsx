import { StatusBadge } from "@/components/ui/status";
import { COMPLIANCE_STATE_LABELS, COMPLIANCE_STATE_TONE, type ComplianceState } from "@/lib/vendor-compliance";

/** The one compliance indicator every vendor view shows. */
export function ComplianceBadge({ state }: { state: ComplianceState | undefined }) {
  const s = state ?? "current";
  return <StatusBadge tone={COMPLIANCE_STATE_TONE[s]}>{COMPLIANCE_STATE_LABELS[s]}</StatusBadge>;
}
