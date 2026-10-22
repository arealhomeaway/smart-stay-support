/**
 * Manager oversight for claims.
 *
 * Supervisors are looking for exposure and drift: money sitting unsubmitted,
 * deadlines closing, claims stuck waiting, and outcomes worth arguing with.
 * The filters name those questions directly.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard, StatTile } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import {
  ClaimListSection,
  useClaimRequirements,
  useClaims,
  usePropertyNames,
  usePropertyPhotos,
} from "@/components/claims/ClaimList";
import { useRole } from "@/hooks/useRole";
import { RequireCapability } from "@/components/RequireCapability";

import {
  MANAGER_FILTER_LABELS,
  amountAtRisk,
  claimSort,
  formatMoney,
  isOpenClaim,
  matchesFilter,
  unrecovered,
  type ManagerFilter,
} from "@/lib/claims";

export const Route = createFileRoute("/_authenticated/claims/manager")({
  component: () => (
    <RequireCapability capability="claims_oversight" title="Supervisor view">
      <ClaimsManager />
    </RequireCapability>
  ),
});

const FILTERS: ManagerFilter[] = [
  "unsubmitted",
  "deadline_risk",
  "overdue",
  "high_value",
  "evidence_missing",
  "long_wait",
  "denied_partial",
];

function ClaimsManager() {
  const claims = useClaims();
  const requirements = useClaimRequirements();
  const propertyNames = usePropertyNames();
  const propertyPhotos = usePropertyPhotos();
  const { readOnly } = useRole();
  const [active, setActive] = useState<ManagerFilter | null>(null);
  const reqMap = requirements.data ?? new Map<string, never[]>();

  const counts = useMemo(() => {
    const map = new Map<ManagerFilter, number>();
    for (const f of FILTERS) {
      map.set(
        f,
        (claims.data ?? []).filter((c) =>
          matchesFilter(c, f, { requirements: reqMap.get(c.id) ?? [] }),
        ).length,
      );
    }
    return map;
  }, [claims.data, reqMap]);

  const rows = useMemo(() => {
    const all = [...(claims.data ?? [])].sort(claimSort);
    if (!active) return all.filter((c) => isOpenClaim(c.stage));
    return all.filter((c) => matchesFilter(c, active, { requirements: reqMap.get(c.id) ?? [] }));
  }, [claims.data, active, reqMap]);

  const open = (claims.data ?? []).filter((c) => isOpenClaim(c.stage));
  const recovered = (claims.data ?? []).reduce((s, c) => s + Number(c.recovered_amount ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Claims"
        title="Supervisor view"
        description="Exposure across every open recovery, and the claims most likely to be lost through delay."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Open claims" value={open.length} />
        <StatTile
          label="Value at risk"
          value={formatMoney(open.reduce((s, c) => s + (amountAtRisk(c) ?? 0), 0))}
        />
        <StatTile
          label="Submitted, outstanding"
          value={formatMoney(open.reduce((s, c) => s + (unrecovered(c) ?? 0), 0))}
        />
        <StatTile label="Recovered to date" value={formatMoney(recovered)} tone="positive" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={active === null ? "default" : "outline"}
          onClick={() => setActive(null)}
        >
          All open ({open.length})
        </Button>
        {FILTERS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={active === f ? "default" : "outline"}
            onClick={() => setActive(active === f ? null : f)}
          >
            {MANAGER_FILTER_LABELS[f]} ({counts.get(f) ?? 0})
          </Button>
        ))}
      </div>

      {claims.isLoading ? (
        <LoadingRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing matches" hint="No claims fall into this view right now." />
      ) : (
        <SectionCard
          title={`${active ? MANAGER_FILTER_LABELS[active] : "All open claims"} (${rows.length})`}
        >
          <ClaimListSection
            claims={rows}
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
