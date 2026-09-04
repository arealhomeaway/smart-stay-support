/**
 * My claims — the recovery work assigned to the person looking at it.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard, StatTile } from "@/components/ui/page";
import {
  ClaimListSection,
  useClaimRequirements,
  useClaims,
  usePropertyNames,
  usePropertyPhotos,
} from "@/components/claims/ClaimList";
import { useCurrentUserId } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import { amountAtRisk, claimSort, deadlineState, formatMoney, isOpenClaim } from "@/lib/claims";

export const Route = createFileRoute("/_authenticated/claims/my-claims")({
  component: MyClaims,
});

function MyClaims() {
  const claims = useClaims();
  const requirements = useClaimRequirements();
  const propertyNames = usePropertyNames();
  const propertyPhotos = usePropertyPhotos();
  const userId = useCurrentUserId();
  const { readOnly } = useRole();
  const reqMap = requirements.data ?? new Map<string, never[]>();

  const mine = useMemo(
    () =>
      (claims.data ?? [])
        .filter((c) => c.assigned_to === userId && isOpenClaim(c.stage))
        .sort(claimSort),
    [claims.data, userId],
  );

  const urgent = mine.filter((c) =>
    ["overdue", "today", "approaching"].includes(deadlineState(c.deadline_on)),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Claims"
        title="My claims"
        description="Everything you are responsible for recovering, soonest deadline first."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Open claims" value={mine.length} />
        <StatTile
          label="Deadline within a week"
          value={urgent.length}
          tone={urgent.length ? "critical" : "neutral"}
        />
        <StatTile
          label="Value at risk"
          value={formatMoney(mine.reduce((s, c) => s + (amountAtRisk(c) ?? 0), 0))}
        />
      </div>
      {claims.isLoading ? (
        <LoadingRows rows={4} />
      ) : mine.length === 0 ? (
        <EmptyState title="Nothing assigned to you" hint="Claims you take on will appear here." />
      ) : (
        <SectionCard title={`Assigned to you (${mine.length})`}>
          <ClaimListSection
            claims={mine}
            requirements={reqMap as Map<string, never[]>}
            propertyNames={propertyNames.data ?? new Map()}
            propertyPhotos={propertyPhotos.data ?? new Map()}
            canEdit={!readOnly}
          />
        </SectionCard>
      )}
    </div>
  );
}
