import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { ComplianceBadge } from "@/components/vendors/ComplianceBadge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useShellPageLabel } from "@/components/nav/ShellNav";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, LoadingRows, PageHeader, SectionBand } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { VendorOrgSheet } from "@/components/VendorOrgSheet";
import { VENDOR_STATUS_BLURBS, VENDOR_STATUS_LABELS, type VendorStatus } from "@/lib/vendors";
import { DISPATCH_METHOD_LABELS, type DispatchMethod } from "@/lib/vendor-gold";
import { usDate } from "@/lib/dates";
import { STATUS_TONE } from "@/components/vendors/VendorDirectory";
import { coverageFor, useVendorWorkspace } from "@/components/vendors/useVendorWorkspace";

export const Route = createFileRoute("/_authenticated/vendors/$vendorId")({
  head: () => ({
    meta: [
      { title: "Vendor profile — Resolve Operations" },
      { name: "description", content: "One vendor's contacts, coverage, qualification gates and history." },
      { property: "og:title", content: "Vendor profile — Resolve Operations" },
      { property: "og:description", content: "Contacts, coverage, gates and history for one vendor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: z.object({ gate: z.string().uuid().optional() }),
  component: VendorProfile,
});

function VendorProfile() {
  const { vendorId } = Route.useParams();
  const { can, readOnly } = useRole();
  const canManage = can("vendor_admin") && !readOnly;
  const ws = useVendorWorkspace();
  const { gate } = Route.useSearch();
  const [sheet, setSheet] = useState(Boolean(gate));
  const v = ws.data?.vendors.find((x) => x.id === vendorId);
  useShellPageLabel(v?.display_name ?? null);
  const properties = useQuery({
    queryKey: ["vendor-coverage-properties"],
    enabled: sheet,
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("id, name, nickname").eq("active", true).order("name");
      if (error) throw error;
      return (data ?? []).map((p) => ({ id: p.id, label: p.nickname || p.name }));
    },
  });

  if (ws.isLoading) return <LoadingRows rows={5} />;
  if (!v) return <EmptyState title="Vendor not found" hint="It may be restricted to leadership." />;
  const cov = coverageFor(v.id, ws.data!.coverage);
  const g = ws.data!.gateStatus.get(v.id);
  const legacy = Object.entries((v.legacy_fields as Record<string, unknown>) ?? {});

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Vendor"
        title={v.display_name}
        description={VENDOR_STATUS_BLURBS[v.status as VendorStatus]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/vendors" search={{ tab: "directory" }}>Back to Directory</Link></Button>
            <Button onClick={() => setSheet(true)}>{canManage ? "Screening & coverage" : "View screening"}</Button>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={STATUS_TONE[v.status] ?? "context"}>{VENDOR_STATUS_LABELS[v.status as VendorStatus]}</StatusBadge>
        <Chip>{DISPATCH_METHOD_LABELS[v.dispatch_method as DispatchMethod] ?? v.dispatch_method}</Chip>
        <ComplianceBadge state={ws.data!.compliance.get(v.id)?.state} />
        {g && <Chip>{g.passed}/{g.total} gates</Chip>}
        {!v.is_active && <Chip>Inactive</Chip>}
      </div>

      <section className="space-y-2">
        <SectionBand title="Contact" />
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <Field k="Contact" v={v.primary_contact_name} />
          <Field k="Phone" v={v.primary_contact_phone} />
          <Field k="Email" v={v.primary_contact_email} />
          <Field k="Website" v={v.website} />
          <Field k="Pricing" v={v.pricing_note} />
          <Field k="Payment" v={v.payment_terms} />
        </dl>
      </section>

      {(ws.data!.compliance.get(v.id)?.items.length ?? 0) > 0 && (
        <section className="space-y-2">
          <SectionBand title="Expiring credentials" hint="Usable through the expiration date; On Hold from the day after until renewed proof is recorded." />
          <ul className="space-y-1.5">
            {ws.data!.compliance.get(v.id)!.items.map((i) => (
              <li key={i.requirementId} className="surface-row flex flex-wrap items-center gap-2 py-2 pl-4 pr-3 text-sm">
                <span className="font-medium">{i.label}</span>
                <ComplianceBadge state={i.state} />
                <span className="text-muted-foreground">Expires {usDate(i.expiresOn)}</span>
                <Button size="sm" variant="outline" className="ml-auto" asChild>
                  <Link to="/vendors/$vendorId" params={{ vendorId: v.id }} search={{ gate: i.requirementId }} onClick={() => setSheet(true)}>Open check</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <SectionBand title="Market coverage" />
        {cov.length === 0 ? (
          <p className="text-sm text-muted-foreground">No market coverage recorded.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {cov.map((c) => <Chip key={c.id}>{c.market} · {c.service_category} · {c.preference}</Chip>)}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <SectionBand title="Gold Standard" />
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <Field k="Qualification score" v={String(v.qualification_score ?? 0)} />
          <Field k="Performance score" v={v.performance_score == null ? null : String(v.performance_score)} />
          <Field k="Next review" v={v.next_review_on ? usDate(v.next_review_on) : null} />
          <Field k="Corrective action" v={v.open_corrective_action} />
        </dl>
      </section>

      {v.notes && (
        <section className="space-y-2"><SectionBand title="Notes" /><p className="whitespace-pre-wrap text-sm">{v.notes}</p></section>
      )}

      {canManage && legacy.length > 0 && (
        <section className="space-y-2">
          <SectionBand title="Legacy Notion fields" hint="Kept exactly as imported; not used for dispatch." />
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {legacy.map(([k, val]) => <Field key={k} k={k} v={String(val)} />)}
          </dl>
        </section>
      )}

      <VendorOrgSheet
        orgId={sheet ? v.id : null}
        onOpenChange={(o) => setSheet(o)}
        properties={properties.data ?? []}
        canManage={canManage}
        focusRequirementId={gate ?? null}
      />
    </div>
  );
}

function Field({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="break-words">{v || "—"}</dd>
    </div>
  );
}
