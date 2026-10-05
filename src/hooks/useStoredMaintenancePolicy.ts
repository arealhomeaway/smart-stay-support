import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { applyStoredMaintenancePolicy } from "@/lib/maintenance-policy";

/** Loads the one stored Maintenance Authority Policy into the shared evaluator. */
export function useStoredMaintenancePolicy() {
  useQuery({
    queryKey: ["maintenance-authority-policy"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "maintenance_authority_policy").maybeSingle();
      return applyStoredMaintenancePolicy(data?.value ?? null);
    },
  });
}
