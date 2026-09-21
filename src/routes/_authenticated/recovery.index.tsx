/**
 * Guest recovery — action first.
 *
 * The page answers "which guest is still waiting on us today?". Every section
 * is derived from stage, evidence, amounts and the communication clock, so
 * nobody maintains a status by hand.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard, StatTile } from "@/components/ui/page";
import {
  RecoveryListSection,
  useRecoveries,
  useRecoveryPropertyNames,
  useRecoveryPropertyPhotos,
  useRecoveryRequirements,
} from "@/components/recovery/RecoveryList";
import { useRole } from "@/hooks/useRole";
import type { RequirementLike } from "@/lib/claims";
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  POLICY_VERSION,
  formatMoney,
  isOpenRecovery,
  recoveryBucket,
  recoverySort,
  type RecoveryBucket,
} from "@/lib/guest-recovery";
import type { RecoveryRow } from "@/lib/recovery-types";

export const Route = createFileRoute("/_authenticated/recovery/")({
  // Approval notifications deep-link straight to the recovery being decided.
  validateSearch: (search: Record<string, unknown>) => ({
    open: typeof search["open"] === "string" ? (search["open"] as string) : undefined,
  }),
  component: RecoveryHome,
});

const BUCKET_HELP: Record<RecoveryBucket, string> = {
  needs_attention: "A guest update is due, checkout is close, or nobody has moved this on.",
  waiting_evidence: "The remedy cannot be decided until the impact is confirmed.",
  approval_required: "Waiting on James or Micah under ARHA policy thresholds.",
  approved_action_needed: "Approved — deliver it and record what was issued.",
  waiting_guest: "Offered to the guest. Follow up if there is no reply today.",
  reassess: "Declined, returned or the guest is still unhappy.",
  recently_resolved: "Closed or delivered in the last 30 days.",
};

function RecoveryHome() {
  const { open: deepLinkId } = Route.useSearch();
  const recoveries = useRecoveries();
  const requirements = useRecoveryRequirements();
  const propertyNames = useRecoveryPropertyNames();
  const propertyPhotos = useRecoveryPropertyPhotos();
  const { readOnly } = useRole();

  const reqMap = requirements.data ?? new Map<string, RequirementLike[]>();

  const buckets = useMemo(() => {
    const rows = [...(recoveries.data ?? [])].sort(recoverySort);
    const map = new Map<RecoveryBucket, RecoveryRow[]>();
    for (const b of BUCKET_ORDER) map.set(b, []);
    for (const row of rows) {
      const bucket = recoveryBucket(row, { requirements: reqMap.get(row.id) ?? [] });
      if (bucket) map.get(bucket)!.push(row);
    }
    return map;
  }, [recoveries.data, reqMap]);

  const open = (recoveries.data ?? []).filter((r) => isOpenRecovery(r.stage));
  const proposed = open.reduce((sum, r) => sum + (r.proposed_amount ?? 0), 0);
  const issued = (recoveries.data ?? []).reduce((sum, r) => sum + (r.delivered_amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Guest recovery"
        title="Today"
        description="What each guest is still owed, ordered by who is waiting longest. A recovery always sits on the ticket where the situation is being handled."
        actions={<LogRecoveryDialog />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Needs attention"
          value={buckets.get("needs_attention")?.length ?? 0}
          tone="critical"
        />
        <StatTile label="Approval required" value={buckets.get("approval_required")?.length ?? 0} />
        <StatTile label="Proposed, open" value={formatMoney(proposed)} />
        <StatTile label="Issued to guests" value={formatMoney(issued)} />
      </div>

      {recoveries.isLoading ? (
        <LoadingRows />
      ) : open.length === 0 && (buckets.get("recently_resolved")?.length ?? 0) === 0 ? (
        <EmptyState
          title="No guest recoveries open"
          hint="Recoveries start on the ticket where the guest situation is being handled."
        />
      ) : (
        BUCKET_ORDER.map((bucket) => {
          const rows = buckets.get(bucket) ?? [];
          if (rows.length === 0) return null;
          return (
            <SectionCard
              key={bucket}
              title={BUCKET_LABELS[bucket]}
              description={BUCKET_HELP[bucket]}
            >
              <RecoveryListSection
                recoveries={rows}
                requirements={reqMap}
                propertyNames={propertyNames.data ?? new Map()}
                propertyPhotos={propertyPhotos.data ?? new Map()}
                canEdit={!readOnly}
                initialOpenId={deepLinkId ?? null}
              />
            </SectionCard>
          );
        })
      )}

      <p className="text-xs text-muted-foreground">{POLICY_VERSION}</p>
    </div>
  );
}
