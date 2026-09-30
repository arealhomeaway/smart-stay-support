/**
 * Safe exit from the vendor step: when nobody eligible is available the PC can
 * escalate or request a new vendor. Sourcing is owned by the vendor Program
 * Owner / Director of Operations, never by the PC (DB RPC request_new_vendor).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVendorWorkspace, errorText } from "@/components/vendors/useVendorWorkspace";

export const SOURCING_STATE_LABELS: Record<string, string> = {
  requested: "Requested",
  sourcing: "Sourcing",
  candidate_identified: "Candidate Identified",
  vendor_setup: "Vendor Setup / Qualification",
  ready: "Ready for Use",
  closed: "Closed / No Vendor Needed",
};

export function useTicketSourcing(ticketId: string) {
  return useQuery({
    queryKey: ["ticket-sourcing", ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_sourcing_requests")
        .select("id, market, service_category, state, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function NoEligibleVendor({
  ticketId,
  market,
  category,
  onEscalate,
  escalating,
}: {
  ticketId: string;
  market: string | null;
  category: string | null;
  onEscalate: () => void;
  escalating: boolean;
}) {
  const ws = useVendorWorkspace();
  const qc = useQueryClient();
  const [mkt, setMkt] = useState(market ?? "");
  const [cat, setCat] = useState(category ?? "");
  const requests = useTicketSourcing(ticketId);
  const request = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_new_vendor", { _ticket: ticketId, _market: mkt, _category: cat });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Vendor request sent to the vendor Program Owner and Director of Operations.");
      await qc.invalidateQueries({ queryKey: ["ticket-sourcing", ticketId] });
    },
    onError: (e) => toast.error(errorText(e)),
  });
  const open = (requests.data ?? []).filter((r) => r.state !== "closed");

  return (
    <div className="rounded-md border border-border bg-muted/40 p-4 space-y-3">
      <div>
        <p className="font-semibold">No eligible vendor found</p>
        <p className="text-sm text-muted-foreground">
          Nobody here can take this work right now. Escalate it, or ask for a new vendor. You won't be responsible for finding one.
        </p>
      </div>
      {open.length > 0 && (
        <ul className="text-sm space-y-1">
          {open.map((r) => (
            <li key={r.id}>
              Vendor request — {r.service_category} in {r.market}: <strong>{SOURCING_STATE_LABELS[r.state] ?? r.state}</strong>
              {r.state === "ready" && " — a vendor is ready. Choose them above."}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Select value={mkt} onValueChange={setMkt}>
          <SelectTrigger aria-label="Market"><SelectValue placeholder="Market" /></SelectTrigger>
          <SelectContent>{(ws.data?.markets ?? []).map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger aria-label="Service needed"><SelectValue placeholder="Service needed" /></SelectTrigger>
          <SelectContent>{(ws.data?.categories ?? []).map((c) => <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onEscalate} disabled={escalating}>Escalate to Supervisor</Button>
        <Button onClick={() => request.mutate()} disabled={!mkt || !cat || request.isPending}>Request New Vendor</Button>
      </div>
    </div>
  );
}
