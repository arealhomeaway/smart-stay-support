import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/page";
import { usDate } from "@/lib/dates";
import {
  PRIORITY_LABEL,
  coverageByCategory,
  matchesCoverageSearch,
  uncoveredCategories,
  type CoverageVendor,
} from "@/lib/vendor-coverage";
import { VENDOR_STATUS_LABELS, type VendorStatus } from "@/lib/vendors";
import { getPropertyVendorCoverage } from "@/lib/vendor-coverage.functions";

const money = (n: number | null) =>
  n == null ? null : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/** Staging & trade coverage lookup for one home. Read-only reference. */
export function VendorCoveragePanel({ propertyId }: { propertyId: string }) {
  const load = useServerFn(getPropertyVendorCoverage);
  const { data, isLoading, error } = useQuery({
    queryKey: ["vendor-coverage", propertyId],
    queryFn: () => load({ data: { propertyId } }),
  });
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    if (!data) return [];
    const vendors = (data.vendors as CoverageVendor[]).filter((v) =>
      matchesCoverageSearch(v, search),
    );
    return coverageByCategory(vendors, data.categories).filter((g) => g.vendors.length > 0);
  }, [data, search]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading vendor coverage…</p>;
  if (error || !data)
    return <p className="text-sm text-muted-foreground">Vendor coverage could not be loaded.</p>;

  const gaps = uncoveredCategories(data.vendors as CoverageVendor[], data.categories);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div>
          <CardTitle className="text-base">Staging &amp; trade coverage</CardTitle>
          <CardDescription>
            Who can work at this home
            {data.zip ? ` (ZIP ${data.zip})` : ""} — cleared vendors first, with pricing tier and a
            backup. Look-up only; dispatch still happens from the Work Order.
          </CardDescription>
        </div>
        <Input
          placeholder="Search vendor, market or trade"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {gaps.length > 0 && (
          <p className="text-xs text-destructive">
            No cleared vendor for: {gaps.join(", ")}. Line up coverage before staging is scheduled.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {groups.length === 0 ? (
          <p className="text-muted-foreground">
            No vendor covers this home yet. Add coverage from the Vendor Hub.
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.category} className="space-y-2">
              <p className="eyebrow">{group.category}</p>
              {group.vendors.map((v) => (
                <div key={`${group.category}-${v.orgId}`} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{v.name}</span>
                    <Chip>{PRIORITY_LABEL[v.coveragePriority] ?? v.coveragePriority}</Chip>
                    {v.tier && <Chip>Tier {v.tier}</Chip>}
                    {v.status !== "approved" && <Chip>Not cleared ({VENDOR_STATUS_LABELS[v.status as VendorStatus] ?? v.status})</Chip>}
                    {v.excluded && <Chip>Excluded at this home</Chip>}
                    {v.emergencyAvailable && <Chip>After hours</Chip>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {v.source === "property" ? "Assigned to this home" : "Covers this ZIP"}
                    {v.markets.length ? ` · ${v.markets.join(", ")}` : ""}
                    {v.approvalLimit != null ? ` · approves to ${money(v.approvalLimit)}` : ""}
                    {v.lastVerifiedAt ? ` · verified ${usDate(v.lastVerifiedAt)}` : ""}
                  </p>
                  {v.pricingNote && <p className="text-muted-foreground">{v.pricingNote}</p>}
                  {v.responseTimeNote && (
                    <p className="text-xs text-muted-foreground">{v.responseTimeNote}</p>
                  )}
                  {v.excluded && v.exclusionReason && (
                    <p className="text-xs text-destructive">{v.exclusionReason}</p>
                  )}
                  {(v.contactName || v.contactPhone || v.contactEmail) && (
                    <p className="text-xs text-muted-foreground">
                      {[v.contactName, v.contactPhone, v.contactEmail].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
