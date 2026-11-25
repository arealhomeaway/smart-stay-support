/** Integrations page, Admin only: cleaning reviews (Departure Review) for real homes. Forward-only start line. */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { usDateTime } from "@/lib/dates";

type Rpc = { rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };

export function DepartureReviewLiveSwitch() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["departure-review-live"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "departure_review_live_homes").maybeSingle();
      return (data?.value ?? null) as { enabled?: boolean; started_at?: string } | null;
    },
  });
  const on = q.data?.enabled === true;
  async function flip() {
    const { error } = await (supabase as unknown as Rpc).rpc("set_departure_review_live", { _on: !on });
    if (error) { toast.error(error.message.includes("Admin") ? error.message : "Not saved. This switch is ready once its update is applied."); return; }
    toast.success(on ? "Turned off." : "Turned on.");
    void qc.invalidateQueries({ queryKey: ["departure-review-live"] });
  }
  return (
    <SectionCard title="Cleaning reviews for real homes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {on ? `On since ${usDateTime(q.data?.started_at ?? null)}. Each finished departure clean from then on gets a cleaning review in Team B.` : "Off. Only demo homes get cleaning reviews."}
        </p>
        <Button className="min-h-11" variant={on ? "outline" : "default"} onClick={() => void flip()}>{on ? "Turn off" : "Turn on"}</Button>
      </div>
    </SectionCard>
  );
}
