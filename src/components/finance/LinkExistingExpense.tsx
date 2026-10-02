/**
 * Link an expense that already exists (e.g. an invoice Finance entered) to
 * this piece of work. Never creates an expense and never copies the amount —
 * one amount, one financial history.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money, type LinkType } from "@/lib/expenses";

type Candidate = {
  id: string; payee: string | null; amount: number | null; expense_date: string | null; vendor_invoice_ref: string | null;
  is_estimate: boolean; duplicate_flag: string | null; expense_links: { link_type: string; target_id: string }[] | null;
};

export function LinkExistingExpense({
  propertyId, isDemo, payeeHint, linkType, targetId, visitId, extraLinks = [], onLinked,
}: {
  propertyId: string | null;
  isDemo: boolean;
  payeeHint?: string | null;
  linkType: LinkType;
  targetId: string;
  /** When linking from a visit, the expense also records which visit it pays for. */
  visitId?: string;
  extraLinks?: { link_type: LinkType; target_id: string }[];
  onLinked: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["expenses", "linkable", propertyId, isDemo, linkType, targetId],
    enabled: open && !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses")
        .select("id, payee, amount, expense_date, vendor_invoice_ref, is_estimate, duplicate_flag, expense_links(link_type, target_id)")
        .eq("property_id", propertyId!).eq("is_demo", isDemo).is("archived_at", null).order("expense_date", { ascending: false }).limit(100);
      if (error) throw error;
      const rows = ((data ?? []) as unknown as Candidate[]).filter((e) => !(e.expense_links ?? []).some((l) => l.link_type === linkType && l.target_id === targetId));
      const hint = (payeeHint ?? "").trim().toLowerCase();
      return rows.sort((a, b) => Number((b.payee ?? "").toLowerCase() === hint) - Number((a.payee ?? "").toLowerCase() === hint));
    },
  });

  if (!propertyId) return null;
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Link an invoice already entered</Button>;

  const rows = q.data ?? [];
  const label = (e: Candidate) =>
    `${e.payee ?? "No payee"} · ${money(e.amount)} · ${e.expense_date ?? "no date"}${e.vendor_invoice_ref ? ` · #${e.vendor_invoice_ref}` : ""}${e.is_estimate ? " · estimate" : ""}${e.duplicate_flag === "suspected" ? " · possible duplicate" : ""}`;

  async function link() {
    setBusy(true);
    try {
      const links = [{ link_type: linkType, target_id: targetId }, ...extraLinks].map((l) => ({ expense_id: pick, ...l }));
      const { error } = await supabase.from("expense_links").upsert(links, { onConflict: "expense_id,link_type,target_id", ignoreDuplicates: true });
      if (error) throw error;
      if (visitId) {
        const { error: e2 } = await supabase.from("expenses").update({ work_order_visit_id: visitId }).eq("id", pick).is("work_order_visit_id", null);
        if (e2) throw e2;
      }
      toast.success("Linked the existing expense. No new expense was created.");
      setPick(""); setOpen(false); onLinked();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link the expense");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="link-existing-expense">
      {q.isLoading ? <span className="text-xs text-muted-foreground">Loading expenses…</span> : rows.length === 0 ? (
        <span className="text-xs text-muted-foreground">No other expenses on this home to link.</span>
      ) : (
        <Select value={pick} onValueChange={setPick}>
          <SelectTrigger className="w-80" aria-label="Existing expense"><SelectValue placeholder="Choose an existing expense" /></SelectTrigger>
          <SelectContent>{rows.map((e) => <SelectItem key={e.id} value={e.id}>{label(e)}</SelectItem>)}</SelectContent>
        </Select>
      )}
      <Button size="sm" variant="outline" disabled={!pick || busy} onClick={() => void link()}>Link expense</Button>
      <Button size="sm" variant="ghost" onClick={() => { setOpen(false); setPick(""); }}>Cancel</Button>
    </div>
  );
}
