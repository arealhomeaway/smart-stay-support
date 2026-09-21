/**
 * Guest refunds & credits reporting — what it cost, by home and by month.
 *
 * Reads the guest_recovery_ledger reporting view, the same surface the Finance
 * workspace will read when it ships, so Operations and Finance can never be
 * looking at two different definitions of "issued".
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LoadingRows, SectionCard, StatTile } from "@/components/ui/page";
import { formatMoney } from "@/lib/guest-recovery";
import {
  recoveryTotals,
  totalsByMonth,
  totalsByProperty,
  type LedgerRow,
} from "@/lib/recovery-reporting";

export function useRecoveryLedger() {
  return useQuery({
    queryKey: ["guest-recovery-ledger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_recovery_ledger")
        .select("*")
        .order("logged_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as LedgerRow[];
    },
  });
}

export function RecoveryReportingPanel() {
  const ledger = useRecoveryLedger();
  const rows = ledger.data ?? [];
  const totals = recoveryTotals(rows);
  const byProperty = totalsByProperty(rows).slice(0, 8);
  const byMonth = totalsByMonth(rows).slice(0, 6);

  return (
    <SectionCard
      title="What recovery has cost"
      description="Every recovery with the ticket and home it came from. Test records are excluded. This is the same record the Finance workspace will read."
    >
      {ledger.isLoading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has been logged yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Recoveries logged" value={totals.count} />
            <StatTile label="Proposed" value={formatMoney(totals.proposed)} />
            <StatTile label="Approved" value={formatMoney(totals.approved)} />
            <StatTile label="Issued to guests" value={formatMoney(totals.issued)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium">By home</p>
              <ul className="space-y-1 text-sm">
                {byProperty.map((group) => (
                  <li key={group.key} className="flex justify-between gap-3">
                    <span className="truncate">{group.label}</span>
                    <span className="text-muted-foreground">
                      {group.totals.count} · {formatMoney(group.totals.issued)} issued
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">By month</p>
              <ul className="space-y-1 text-sm">
                {byMonth.map((group) => (
                  <li key={group.key} className="flex justify-between gap-3">
                    <span>{group.label}</span>
                    <span className="text-muted-foreground">
                      {group.totals.count} · {formatMoney(group.totals.issued)} issued
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
