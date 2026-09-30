import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { EmptyState, LoadingRows, SegmentedControl } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { COVERAGE_STATUS_LABELS, coverageMatrix, type Preference } from "@/lib/vendor-gold";
import { useVendorWorkspace } from "./useVendorWorkspace";

/** Market × Category: who is Primary, who is Backup, and where the gaps are. */
export function VendorMarketCoverage({ focusMarket }: { focusMarket?: string }) {
  const ws = useVendorWorkspace();
  const [tier, setTier] = useState<"critical" | "core" | "specialty" | "all">("critical");
  const [gapsOnly, setGapsOnly] = useState(false);

  const cells = useMemo(() => {
    if (!ws.data) return [];
    const nameById = new Map(ws.data.vendors.map((v) => [v.id, v]));
    const rows = ws.data.coverage.flatMap((c) => {
      const v = nameById.get(c.org_id);
      return v
        ? [{ orgId: v.id, orgName: v.display_name, market: c.market, category: c.service_category, preference: c.preference as Preference, status: v.status, isActive: v.is_active }]
        : [];
    });
    const cats = ws.data.categories.filter((c) => tier === "all" || c.tier === tier);
    const markets = focusMarket ? ws.data.markets.filter((m) => m === focusMarket) : ws.data.markets;
    return coverageMatrix(markets, cats, rows).filter((c) => !gapsOnly || c.status !== "complete");
  }, [ws.data, tier, gapsOnly, focusMarket]);

  if (ws.isLoading) return <LoadingRows rows={6} />;
  if (!ws.data) return <EmptyState title="Could not load coverage" hint="Refresh to try again." />;
  const gaps = cells.filter((c) => c.status !== "complete").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          value={tier}
          onChange={setTier}
          options={[
            { value: "critical", label: "Critical" },
            { value: "core", label: "Core" },
            { value: "specialty", label: "Specialty" },
            { value: "all", label: "All" },
          ]}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)} /> Gaps only
        </label>
        <span className="text-sm text-muted-foreground">{gaps} gap{gaps === 1 ? "" : "s"}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Critical categories need a qualified Primary and Backup in every market. Only Pilot, Approved, Gold and
        Corrective Action vendors count as qualified.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left">
            <tr>
              <th className="p-2">Market</th>
              <th className="p-2">Service Category</th>
              <th className="p-2">Primary</th>
              <th className="p-2">Backup</th>
              <th className="p-2">Coverage Status</th>
            </tr>
          </thead>
          <tbody>
            {cells.map((c) => (
              <tr key={`${c.market}-${c.category}`} className="border-t border-border">
                <td className="p-2 font-medium">{c.market}</td>
                <td className="p-2">
                  {c.category}
                  {c.tier === "critical" && <span className="ml-1 text-xs text-danger">critical</span>}
                </td>
                <td className="p-2">{names(c.primary)}</td>
                <td className="p-2">{names(c.backup)}</td>
                <td className="p-2">
                  <StatusBadge tone={c.status === "complete" ? "resolved" : c.tier === "critical" ? "escalated" : "waiting"}>
                    {COVERAGE_STATUS_LABELS[c.status]}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function names(list: { orgId: string; orgName: string }[]) {
  if (!list.length) return <span className="text-muted-foreground">—</span>;
  return list.map((r, i) => (
    <span key={r.orgId}>
      {i > 0 && ", "}
      <Link to="/vendors/$vendorId" params={{ vendorId: r.orgId }} className="underline-offset-2 hover:underline">
        {r.orgName}
      </Link>
    </span>
  ));
}
