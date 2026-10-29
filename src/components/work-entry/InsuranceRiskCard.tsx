import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SectionCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { OPEN_STATUSES } from "@/lib/tickets";
import { useDemo } from "@/components/DemoProvider";
import { insuranceRiskLabel } from "@/lib/work-entry";
import { formatPropertyLabel } from "@/lib/property-label";

/**
 * Oversight-only view of open Maintenance Tickets flagged Yes/Unsure for
 * insurance risk. Visibility only — nothing goes to insurers or owners.
 */
export function InsuranceRiskCard() {
  const { demoMode } = useDemo();
  const { data = [] } = useQuery({
    queryKey: ["oversight-insurance-risk", demoMode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, ref, title, insurance_risk, status, properties(name, address_line1, unit, city, state, postal_code)")
        .eq("entry_kind", "maintenance")
        .in("insurance_risk", ["yes", "unsure"])
        .in("status", OPEN_STATUSES)
        .is("archived_at", null)
        .eq("is_demo", demoMode)
        .order("reported_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div id="group-insurance" data-testid="insurance-risk-card">
      <SectionCard
        title={`Insurance risk (${data.length})`}
        description="Open Maintenance flagged for a possible insured loss. Visibility only — nothing is sent to insurers or owners."
      >
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open Maintenance is flagged.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((t) => (
              <li key={t.id}>
                <Link
                  to="/tickets/$ticketId"
                  params={{ ticketId: t.id }}
                  className="flex flex-wrap items-center gap-2 py-2 text-sm hover:text-primary"
                >
                  <ShieldAlert className="size-4 shrink-0" />
                  <Badge variant={t.insurance_risk === "yes" ? "destructive" : "secondary"}>
                    {insuranceRiskLabel(t.insurance_risk)}
                  </Badge>
                  <span className="min-w-0 flex-1 font-medium">
                    ARHA-{t.ref} {t.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatPropertyLabel(t.properties).primary}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
