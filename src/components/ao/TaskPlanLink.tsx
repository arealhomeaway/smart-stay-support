import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { loadHomeProgramStatus, loadTaskPlanCard } from "@/lib/ao-data";
import { VERIFY_BADGE, canSendToActiveOwner } from "@/lib/ao-engine";
import { showVerifyBadge } from "@/lib/ao-ui";
import type { ReactNode } from "react";

/** "Homeowner completed: verify" badge. Hidden while the plan engine is not set up. */
export function TaskVerifyBadge({ taskId }: { taskId: string }) {
  const q = useQuery({ queryKey: ["ao-task-plan", taskId], queryFn: () => loadTaskPlanCard(taskId), retry: false });
  const pc = q.data?.available ? q.data.data : null;
  if (!showVerifyBadge(pc)) return null;
  return (
    <Link to="/owner-contributions" search={{ planCard: pc?.id ?? "" }}>
      <Badge variant="secondary">{VERIFY_BADGE}</Badge>
    </Link>
  );
}

/** Renders the existing Send to Active Owner control only when the home's program is active. */
export function SendToActiveOwnerGate({ propertyId, children }: { propertyId: string; children: ReactNode }) {
  const q = useQuery({ queryKey: ["ao-program-status", propertyId], queryFn: () => loadHomeProgramStatus(propertyId) });
  if (!canSendToActiveOwner(q.data)) return null;
  return <>{children}</>;
}
