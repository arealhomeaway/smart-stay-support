/**
 * Claims Home — action first.
 *
 * The page answers "what will we lose money on if nobody touches it today?".
 * Every section is derived from evidence, amounts and dates already on the
 * claim, so no one has to maintain a status by hand.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard, StatTile } from "@/components/ui/page";
import {
  ClaimListSection,
  useClaimRequirements,
  useClaims,
  usePropertyNames,
} from "@/components/claims/ClaimList";
import { useRole } from "@/hooks/useRole";
import {
  BUCKET_LABELS,
  BUCKET_ORDER,
  amountAtRisk,
  claimBucket,
  claimSort,
  formatMoney,
  isOpenClaim,
  unrecovered,
  type ClaimBucket,
} from "@/lib/claims";
import type { ClaimRow } from "@/lib/claim-types";

export const Route = createFileRoute("/_authenticated/claims/")({
  component: ClaimsHome,
});

const BUCKET_HELP: Record<ClaimBucket, string> = {
  needs_attention: "Deadline today or passed, a decision to record, or someone is waiting on us.",
  deadline_approaching: "Submission window closes within a week.",
  evidence_missing: "Cannot be submitted until the evidence is in.",
  ready_to_submit: "Evidence and cost are in — send it.",
  waiting_external: "With the platform, insurer or guest. Nothing to do until the follow-up date.",
  recently_recovered: "Money in during the last 30 days.",
};

function ClaimsHome() {
  const claims = useClaims();
  const requirements = useClaimRequirements();
  const propertyNames = usePropertyNames();
  const { readOnly } = useRole();

  const reqMap = requirements.data ?? new Map<string, never[]>();

  const buckets = useMemo(() => {
    const rows = [...(claims.data ?? [])].sort(claimSort);
    const map = new Map<ClaimBucket, ClaimRow[]>();
    for (const b of BUCKET_ORDER) map.set(b, []);
    for (const claim of rows) {
      const bucket = claimBucket(claim, { requirements: reqMap.get(claim.id) ?? [] });
      if (bucket) map.get(bucket)!.push(claim);
    }
    return map;
  }, [claims.data, reqMap]);

  const open = (claims.data ?? []).filter((c) => isOpenClaim(c.stage));
  const atRisk = open.reduce((sum, c) => sum + (amountAtRisk(c) ?? 0), 0);
  const outstanding = open.reduce((sum, c) => sum + (unrecovered(c) ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Claims"
        title="Today"
        description="Recoverable incidents, ordered by what we stand to lose first. Create a claim from the ticket where the incident was handled."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Needs attention" value={buckets.get("needs_attention")?.length ?? 0} tone="critical" />
        <StatTile label="Ready to submit" value={buckets.get("ready_to_submit")?.length ?? 0} />
        <StatTile label="Open value at risk" value={formatMoney(atRisk)} />
        <StatTile label="Submitted, not yet recovered" value={formatMoney(outstanding)} />
      </div>

      {claims.isLoading ? (
        <LoadingRows rows={5} />
      ) : open.length === 0 && (buckets.get("recently_recovered")?.length ?? 0) === 0 ? (
        <EmptyState
          title="No claims yet"
          description="Open a claim from a ticket whenever damage, extra cleaning or a loss looks recoverable from a guest, platform, insurer or owner."
        />
      ) : (
        BUCKET_ORDER.map((bucket) => {
          const rows = buckets.get(bucket) ?? [];
          if (rows.length === 0) return null;
          return (
            <SectionCard key={bucket} title={`${BUCKET_LABELS[bucket]} (${rows.length})`} description={BUCKET_HELP[bucket]}>
              <ClaimListSection
                claims={rows}
                requirements={reqMap as Map<string, never[]>}
                propertyNames={propertyNames.data ?? new Map()}
                canEdit={!readOnly}
              />
            </SectionCard>
          );
        })
      )}
    </div>
  );
}
