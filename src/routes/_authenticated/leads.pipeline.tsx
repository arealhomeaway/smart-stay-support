/** Pipeline — the whole book of business, by stage. Secondary to the queue. */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingRows, PageHeader, SectionCard } from "@/components/ui/page";
import { LeadListSection, useLeads, useLeadsWithProperties } from "@/components/leads/LeadList";
import { useRole } from "@/hooks/useRole";
import { PIPELINE, STAGE_LABELS, leadSort } from "@/lib/leads";

export const Route = createFileRoute("/_authenticated/leads/pipeline")({
  component: Pipeline,
});

function Pipeline() {
  const leads = useLeads();
  const linked = useLeadsWithProperties();
  const { readOnly } = useRole();
  const [term, setTerm] = useState("");

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (leads.data ?? [])
      .filter((l) =>
        !q
          ? true
          : [l.contact_name, l.company, l.email, l.phone, l.market]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q)),
      )
      .sort(leadSort);
  }, [leads.data, term]);

  const withProperties = linked.data ?? new Set<string>();

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenant leads"
        title="Pipeline"
        description="Every opportunity by stage, including closed history."
        actions={
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name, company, market…"
            className="w-64"
            aria-label="Search leads"
          />
        }
      />

      {leads.isLoading ? (
        <LoadingRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState title="No leads match" hint="Try a different name, company or market." />
      ) : (
        PIPELINE.map((stage) => {
          const stageRows = rows.filter((l) => l.stage === stage);
          if (stageRows.length === 0) return null;
          return (
            <SectionCard
              key={stage}
              title={STAGE_LABELS[stage]}
              description={`${stageRows.length}`}
            >
              <LeadListSection
                leads={stageRows}
                withProperties={withProperties}
                canEdit={!readOnly}
              />
            </SectionCard>
          );
        })
      )}
    </div>
  );
}
