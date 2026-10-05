import { useState } from "react";
import { useClaims, usePropertyNames } from "@/components/claims/ClaimList";
import { ClaimDrawer } from "@/components/claims/ClaimDrawer";
import { useStaffDirectory } from "@/hooks/useTeam";
import { useRole } from "@/hooks/useRole";
import { EmptyState, LoadingRows } from "@/components/ui/page";
import { awaitingReceipt, financeTreatmentPending, financiallySettled, formatMoney } from "@/lib/claims";

/**
 * Finance outstanding work: every claim whose money is not settled, whatever its
 * operational stage. Closing a claim never removes it from this list.
 */
export function UnsettledClaims({ demoMode }: { demoMode: boolean }) {
  const claims = useClaims();
  const names = usePropertyNames();
  const [open, setOpen] = useState<string | null>(null);
  const people = useStaffDirectory().data ?? [];
  const { readOnly } = useRole();
  const rows = (claims.data ?? []).filter((c) => {
    const x = c as unknown as { is_demo?: boolean; submitted_amount?: number | null; approved_amount?: number | null };
    if (Boolean(x.is_demo) !== demoMode) return false;
    if (!(Number(x.submitted_amount ?? 0) > 0 || Number(x.approved_amount ?? 0) > 0)) return false;
    return !financiallySettled(c as never);
  });
  if (claims.isLoading) return <LoadingRows />;
  if (rows.length === 0) return <EmptyState title="No unsettled claims" hint="Claims with money still to receive or treat appear here, even after they close." />;
  return (
    <>
      <ul className="divide-y divide-border text-sm">
        {rows.map((c) => {
          const m = c as never;
          const pending = financeTreatmentPending(m);
          const waiting = awaitingReceipt(m);
          return (
            <li key={c.id}>
              <button type="button" onClick={() => setOpen(c.id)} className="flex w-full flex-wrap items-center justify-between gap-2 py-2.5 text-left hover:bg-muted/40">
                <span>
                  <span className="font-medium">{c.title}</span>
                  <span className="text-muted-foreground"> · {names.data?.get(c.property_id ?? "") ?? "Home"}</span>
                  {c.stage === "closed" ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">Closed — not settled</span> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  Requested {formatMoney(c.submitted_amount)} · Approved {formatMoney(c.approved_amount)} · Received {formatMoney(c.recovered_amount ?? 0)}
                  {waiting > 0 ? ` · Awaiting ${formatMoney(waiting)}` : ""}
                  {pending === "treatment" ? " · Finance treatment pending" : pending === "leadership" ? " · Leadership decision pending" : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ClaimDrawer
        claim={rows.find((c) => c.id === open) ?? (claims.data ?? []).find((c) => c.id === open) ?? null}
        people={people}
        canEdit={!readOnly}
        propertyName={names.data?.get((claims.data ?? []).find((c) => c.id === open)?.property_id ?? "") ?? ""}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
