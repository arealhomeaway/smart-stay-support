/**
 * Closed claims: searchable, with full history through the claim drawer.
 * Closing never hides unresolved money — unsettled claims are flagged here
 * and also stay in Finance's outstanding work.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, LoadingRows, PageHeader, SectionCard } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ClaimListSection,
  useClaimRequirements,
  useClaims,
  usePropertyNames,
  usePropertyPhotos,
} from "@/components/claims/ClaimList";
import { useRole } from "@/hooks/useRole";
import { useDemo } from "@/components/DemoProvider";
import { financiallySettled } from "@/lib/claims";

export const Route = createFileRoute("/_authenticated/claims/closed")({
  head: () => ({
    meta: [
      { title: "Closed claims — Resolve" },
      { name: "description", content: "Search closed damage claims and see whether each is financially settled." },
      { property: "og:title", content: "Closed claims — Resolve" },
      { property: "og:description", content: "Closed claims with full history and settlement status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClosedClaims,
});

function ClosedClaims() {
  const claims = useClaims();
  const requirements = useClaimRequirements();
  const names = usePropertyNames();
  const photos = usePropertyPhotos();
  const { readOnly } = useRole();
  const { demoMode } = useDemo();
  const [find, setFind] = useState("");
  const [onlyUnsettled, setOnlyUnsettled] = useState(false);

  const closed = useMemo(
    () =>
      (claims.data ?? []).filter(
        (c) => c.stage === "closed" && Boolean((c as { is_demo?: boolean }).is_demo) === demoMode,
      ),
    [claims.data, demoMode],
  );
  const unsettled = closed.filter((c) => !financiallySettled(c as never));
  const q = find.trim().toLowerCase();
  const rows = (onlyUnsettled ? unsettled : closed).filter((c) => {
    if (!q) return true;
    const home = names.data?.get(c.property_id ?? "") ?? "";
    return `${c.title ?? ""} ${home} ${(c as { platform_reference?: string | null }).platform_reference ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Claims"
        title="Closed claims"
        description="Every closed claim and its full history. Closed does not mean settled — unsettled claims stay in Finance's outstanding work."
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={find}
          onChange={(e) => setFind(e.target.value)}
          placeholder="Search by claim, home or reference"
          aria-label="Search closed claims"
          className="w-72"
        />
        <Button size="sm" variant={onlyUnsettled ? "default" : "outline"} onClick={() => setOnlyUnsettled((v) => !v)}>
          Financially unsettled ({unsettled.length})
        </Button>
      </div>
      {claims.isLoading ? (
        <LoadingRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState title="No closed claims match" hint="Try a different search." />
      ) : (
        <SectionCard title={`Closed claims (${rows.length})`}>
          <ClaimListSection
            claims={rows}
            requirements={(requirements.data ?? new Map()) as Map<string, never[]>}
            propertyNames={names.data ?? new Map()}
            propertyPhotos={photos.data ?? new Map()}
            canEdit={!readOnly}
          />
        </SectionCard>
      )}
    </div>
  );
}
