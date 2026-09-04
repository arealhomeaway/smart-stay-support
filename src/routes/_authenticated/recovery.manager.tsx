/**
 * Manager oversight for Guest Recovery.
 *
 * Operational oversight, not analytics: each filter is a list of cases a
 * supervisor may need to act on today, plus properties showing a pattern.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { RequireCapability } from "@/components/RequireCapability";
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
  MANAGER_FILTER_LABELS,
  POLICY_VERSION,
  matchesManagerFilter,
  recoverySort,
  repeatProperties,
  type ManagerFilter,
} from "@/lib/guest-recovery";

export const Route = createFileRoute("/_authenticated/recovery/manager")({
  component: () => (
    <RequireCapability capability="claims_oversight" title="Recovery oversight">
      <RecoveryManager />
    </RequireCapability>
  ),
});

const FILTERS = Object.keys(MANAGER_FILTER_LABELS) as ManagerFilter[];

function RecoveryManager() {
  const recoveries = useRecoveries();
  const requirements = useRecoveryRequirements();
  const propertyNames = useRecoveryPropertyNames();
  const propertyPhotos = useRecoveryPropertyPhotos();
  const { readOnly } = useRole();
  const [filter, setFilter] = useState<ManagerFilter>("pending_approvals");

  const rows = useMemo(
    () =>
      [...(recoveries.data ?? [])].filter((r) => matchesManagerFilter(r, filter)).sort(recoverySort),
    [recoveries.data, filter],
  );

  const repeats = useMemo(() => repeatProperties(recoveries.data ?? []), [recoveries.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Guest recovery"
        title="Manager"
        description="Approvals waiting on you, decisions that need documenting, and guests nobody has updated."
      />

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={f === filter ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {MANAGER_FILTER_LABELS[f]}
          </Button>
        ))}
      </div>

      {recoveries.isLoading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing in this view" hint="Nothing currently matches this filter." />
      ) : (
        <RecoveryListSection
          recoveries={rows}
          requirements={requirements.data ?? new Map<string, RequirementLike[]>()}
          propertyNames={propertyNames.data ?? new Map()}
          propertyPhotos={propertyPhotos.data ?? new Map()}
          canEdit={!readOnly}
        />
      )}

      {repeats.length > 0 ? (
        <SectionCard
          title="Properties with repeat recoveries"
          description="More than one guest recovery on the same home — usually a property problem, not a guest problem."
        >
          <ul className="space-y-1 text-sm">
            {repeats.map((r) => (
              <li key={r.property_id}>
                {propertyNames.data?.get(r.property_id) ?? "Property"} — {r.count} recoveries
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <p className="text-xs text-muted-foreground">{POLICY_VERSION}</p>
    </div>
  );
}
