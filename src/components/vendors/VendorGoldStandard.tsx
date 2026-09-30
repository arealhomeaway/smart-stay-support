import { qualificationHold } from "@/components/vendors/useVendorWorkspace";
import { ComplianceBadge } from "@/components/vendors/ComplianceBadge";
import { Link } from "@tanstack/react-router";
import { EmptyState, LoadingRows } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { VENDOR_STATUS_LABELS, type VendorStatus } from "@/lib/vendors";
import { COMPLIANCE_LABELS, PILOT_THRESHOLD } from "@/lib/vendor-gold";
import { usDate } from "@/lib/dates";
import { STATUS_TONE } from "./VendorDirectory";
import { useVendorWorkspace } from "./useVendorWorkspace";

/** Gold Standard overview. Edits happen on the Vendor Profile. */
export function VendorGoldStandard() {
  const ws = useVendorWorkspace();
  if (ws.isLoading) return <LoadingRows rows={5} />;
  if (!ws.data) return <EmptyState title="Could not load vendors" hint="Refresh to try again." />;
  const list = ws.data.vendors;
  if (!list.length) return <EmptyState title="No vendors yet" hint="Add a vendor or finish the Notion migration." />;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        A failed non-negotiable gate cannot be overridden by a high score. {PILOT_THRESHOLD}+ is eligible for a paid
        pilot. Rolling performance scoring arrives once Work Orders are connected.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-secondary/50 text-left">
            <tr>
              {["Vendor", "Gold Standard", "Gates", "Compliance", "Qual. Score", "Perf. Score", "90-Day Jobs", "Critical Failure", "Last Review", "Next Review", "Corrective Action"].map((h) => (
                <th key={h} className="whitespace-nowrap p-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((v) => {
              const g = ws.data!.gateStatus.get(v.id);
              return (
                <tr key={v.id} className="border-t border-border">
                  <td className="p-2 font-medium">
                    <Link to="/vendors/$vendorId" params={{ vendorId: v.id }} className="hover:underline">{v.display_name}</Link>
                  </td>
                  <td className="p-2">
                    <StatusBadge tone={STATUS_TONE[v.status] ?? "context"}>{VENDOR_STATUS_LABELS[v.status as VendorStatus]}</StatusBadge>
                  </td>
                  <td className="p-2">
                    <StatusBadge tone={g?.blockingClear ? "resolved" : "waiting"}>{g ? `${g.passed}/${g.total}` : "—"}</StatusBadge>
                    {g && g.expired > 0 && <span className="ml-1 text-xs text-destructive">{g.expired} expired</span>}
                    {qualificationHold(v, ws.data!.gateStatus) && <span className="ml-1 text-xs text-destructive">On hold</span>}
                  </td>
                  <td className="p-2"><ComplianceBadge state={ws.data!.compliance.get(v.id)?.state} /></td>
                  <td className="p-2 numeric">
                    {v.qualification_score ?? 0}
                    {(v.qualification_score ?? 0) >= PILOT_THRESHOLD && <span className="ml-1 text-xs text-success">pilot-eligible</span>}
                  </td>
                  <td className="p-2 numeric">{v.performance_score ?? "—"}</td>
                  <td className="p-2 numeric">{v.jobs_90d}</td>
                  <td className="p-2">{v.critical_failure ? <StatusBadge tone="escalated">Yes</StatusBadge> : "No"}</td>
                  <td className="p-2">{v.last_review_on ? usDate(v.last_review_on) : "—"}</td>
                  <td className="p-2">{v.next_review_on ? usDate(v.next_review_on) : "—"}</td>
                  <td className="p-2">
                    {v.open_corrective_action ? `${v.open_corrective_action}${v.corrective_action_due ? ` · due ${usDate(v.corrective_action_due)}` : ""}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
