/** Oversight: overdue arrival checks and the one-step bulk close (change 3 of 5). Leaders only. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/page";

type Db = { from: (t: string) => any; rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> }; // eslint-disable-line @typescript-eslint/no-explicit-any

export function OverdueArrivalChecksCard() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["overdue-arrival-checks"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await (supabase as unknown as Db).from("arrival_checks")
        .select("id", { count: "exact", head: true })
        .eq("status", "open").is("cleared_at", null).lt("deadline_at", new Date().toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });
  const n = q.data ?? 0;
  async function closeAll() {
    setBusy(true);
    const { data, error } = await (supabase as unknown as Db).rpc("bulk_close_overdue_arrival_checks");
    setBusy(false);
    if (error) { toast.error("Not closed. Try again."); return; }
    toast.success(`${Number(data ?? 0)} closed as completed outside Resolve.`);
    await qc.invalidateQueries({ queryKey: ["overdue-arrival-checks"] });
  }
  return (
    <SectionCard title="Overdue arrival checks">
      <div className="flex flex-wrap items-center justify-between gap-3" data-testid="overdue-arrival-checks">
        <p className="numeric text-2xl font-semibold">{n}</p>
        <Button className="min-h-11" variant="outline" disabled={n === 0 || busy} onClick={() => void closeAll()}>
          {busy ? "Closing..." : "Bulk close as completed outside Resolve"}
        </Button>
      </div>
    </SectionCard>
  );
}
