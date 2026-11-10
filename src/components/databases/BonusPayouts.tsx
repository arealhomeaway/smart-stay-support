/**
 * Databases, Bonus payouts (Build 13; register BN6): one row per person per period, for the
 * Finance lead, the COO, the CEO and Admin. Unverified rows show Waiting and no amount; verified
 * rows show the total, each goal's measure, level and dollars, who verified and when. Read only,
 * with an Export CSV for payroll. The database decides who can read it (public.bonus_payouts).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status";
import {
  PAYOUTS_COPY,
  centralStamp,
  dollars,
  filterPayouts,
  goalLine,
  measureText,
  payoutAmount,
  payoutsCsv,
  type BonusPayoutRow,
  type PayoutFilter,
} from "@/lib/bonus";

const SELECT_CLASS = "h-11 rounded-lg border border-input bg-background px-3 text-[15px] text-foreground";
const LABEL_CLASS = "flex flex-col gap-1 text-[13px] text-muted-foreground";

export function BonusPayouts() {
  const q = useQuery({
    queryKey: ["bonus-payouts"],
    queryFn: async (): Promise<BonusPayoutRow[]> => {
      const { data, error } = await supabase.rpc("bonus_payouts");
      if (error) throw error;
      return (data ?? []) as unknown as BonusPayoutRow[];
    },
  });
  const rows = q.data ?? [];
  const [f, setF] = useState<PayoutFilter>({});
  const shown = useMemo(() => filterPayouts(rows, f), [rows, f]);
  const periods = Array.from(new Set(rows.map((r) => r.label)));
  const people = Array.from(new Map(rows.map((r) => [r.user_id, r.person])).entries());
  const plans = Array.from(new Map(rows.map((r) => [r.plan, r.plan_name])).entries());
  const download = () => {
    const blob = new Blob([payoutsCsv(shown)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bonus-payouts.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  if (q.isPending) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (q.error) return <p role="alert" className="text-sm">This list could not be loaded. Try again in a moment.</p>;
  return (
    <div className="space-y-4" data-bonus-payouts>
      <div className="grid grid-cols-1 gap-3 rounded-[14px] border border-border p-3.5 sm:grid-cols-2">
        <label className={LABEL_CLASS}>
          {PAYOUTS_COPY.filters.period}
          <select className={SELECT_CLASS} value={f.period ?? ""} onChange={(e) => setF({ ...f, period: e.target.value || null })}>
            <option value="">{PAYOUTS_COPY.all}</option>
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          {PAYOUTS_COPY.filters.person}
          <select className={SELECT_CLASS} value={f.person ?? ""} onChange={(e) => setF({ ...f, person: e.target.value || null })}>
            <option value="">{PAYOUTS_COPY.all}</option>
            {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          {PAYOUTS_COPY.filters.plan}
          <select className={SELECT_CLASS} value={f.plan ?? ""} onChange={(e) => setF({ ...f, plan: e.target.value || null })}>
            <option value="">{PAYOUTS_COPY.all}</option>
            {plans.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label className={LABEL_CLASS}>
          {PAYOUTS_COPY.filters.status}
          <select
            className={SELECT_CLASS}
            value={f.status ?? ""}
            onChange={(e) => setF({ ...f, status: (e.target.value || null) as PayoutFilter["status"] })}
          >
            <option value="">{PAYOUTS_COPY.all}</option>
            <option value="ready">{PAYOUTS_COPY.waiting}</option>
            <option value="verified">{PAYOUTS_COPY.verified}</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-medium">
          {shown.length} {shown.length === 1 ? "row" : "rows"}, verified total{" "}
          {dollars(shown.filter((r) => r.status === "verified").reduce((t, r) => t + Number(r.total ?? 0), 0))}
        </p>
        <Button variant="outline" className="ml-auto min-h-11" onClick={download} disabled={!shown.some((r) => r.status === "verified")} data-bonus-csv>
          {PAYOUTS_COPY.exportCsv}
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-[14px] border border-border p-6 text-[15px]">{PAYOUTS_COPY.none}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="rounded-[14px] border border-border p-4" data-bonus-payout-row>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.person}</span>
                <span className="text-sm text-muted-foreground">
                  {r.plan_name}, {r.label}
                </span>
                <StatusBadge tone={r.status === "verified" ? "resolved" : "waiting"}>
                  {r.status === "verified" ? PAYOUTS_COPY.verified : PAYOUTS_COPY.waiting}
                </StatusBadge>
                <span className="ml-auto text-lg font-bold">{payoutAmount(r)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{r.pays_on}</p>
              {r.status === "verified" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Verified by {r.verified_by ?? "the reviewer"}, {centralStamp(r.verified_at)}
                  </p>
                  <ul className="mt-2 divide-y divide-border text-sm">
                    {r.goals.map((g) => (
                      <li key={g.name} className="flex flex-wrap gap-2 py-1.5">
                        <span className="min-w-0 flex-1">{g.name}</span>
                        <span>{measureText(g.value, g.unit)}</span>
                        <span className="text-muted-foreground">{goalLine({ status: g.status, level: g.level, denominator: null, code: "" })}</span>
                        <span className="font-medium">{g.dollars === null ? "" : dollars(g.dollars)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
