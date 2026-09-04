/** The recoveries this employee is responsible for right now. */
import { createFileRoute } from "@tanstack/react-router";
import { EmptyState, LoadingRows, PageHeader } from "@/components/ui/page";
import {
  RecoveryListSection,
  useRecoveries,
  useRecoveryPropertyNames,
  useRecoveryPropertyPhotos,
  useRecoveryRequirements,
} from "@/components/recovery/RecoveryList";
import { useRole } from "@/hooks/useRole";
import { useCurrentUserId } from "@/hooks/useTeam";
import type { RequirementLike } from "@/lib/claims";
import { effectiveOwner, isOpenRecovery, recoverySort } from "@/lib/guest-recovery";

export const Route = createFileRoute("/_authenticated/recovery/my-recoveries")({
  component: MyRecoveries,
});

function MyRecoveries() {
  const recoveries = useRecoveries();
  const requirements = useRecoveryRequirements();
  const propertyNames = useRecoveryPropertyNames();
  const propertyPhotos = useRecoveryPropertyPhotos();
  const { readOnly } = useRole();
  const userId = useCurrentUserId();

  const rows = [...(recoveries.data ?? [])]
    // A requested handoff does not move responsibility until it is accepted.
    .filter((r) => effectiveOwner(r) === userId && isOpenRecovery(r.stage))
    .sort(recoverySort);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Guest recovery"
        title="Mine"
        description="Recoveries you own. A handoff you requested stays here until someone accepts it."
      />
      {recoveries.isLoading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing assigned to you" hint="Pick one up from Today." />
      ) : (
        <RecoveryListSection
          recoveries={rows}
          requirements={requirements.data ?? new Map<string, RequirementLike[]>()}
          propertyNames={propertyNames.data ?? new Map()}
          propertyPhotos={propertyPhotos.data ?? new Map()}
          canEdit={!readOnly}
        />
      )}
    </div>
  );
}
