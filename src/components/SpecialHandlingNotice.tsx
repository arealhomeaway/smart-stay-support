/**
 * Special Handling, surfaced at the moment it matters.
 *
 * Read live from the canonical list on the property, never copied onto the
 * ticket. No generic "I acknowledge" checkbox: if a rule can be applied, it is
 * stated as an instruction and the surrounding workflow honours it.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  isBlocking,
  ruleTypeLabel,
  rulesForMoment,
  type SpecialHandlingMoment,
  type SpecialHandlingRow,
} from "@/lib/special-handling";

export function usePropertySpecialHandling(propertyId: string | null | undefined) {
  return useQuery({
    queryKey: ["special-handling", propertyId],
    enabled: Boolean(propertyId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("special_handling")
        .select("*")
        .eq("property_id", propertyId!)
        .eq("active", true)
        .order("severity");
      if (error) throw error;
      return (data ?? []) as unknown as SpecialHandlingRow[];
    },
  });
}

export function SpecialHandlingNotice({
  propertyId,
  moment,
  trade,
  className,
}: {
  propertyId: string | null | undefined;
  moment: SpecialHandlingMoment;
  trade?: string | null;
  className?: string;
}) {
  const { data } = usePropertySpecialHandling(propertyId);
  const rules = rulesForMoment(data ?? [], moment, trade);
  if (rules.length === 0) return null;

  const critical = rules.some(isBlocking);

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        critical ? "border-warning/50 bg-warning/5" : "border-border bg-muted/30"
      } ${className ?? ""}`}
    >
      <p className="flex items-center gap-2 text-sm font-semibold">
        {critical ? (
          <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
        ) : (
          <Info className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
        Special handling at this home
      </p>
      <ul className="mt-2 space-y-1.5">
        {rules.map((r) => (
          <li key={r.id} className="text-sm leading-relaxed">
            <span className="font-medium">{ruleTypeLabel(r.rule_type)}</span>
            {r.vendor_name ? <span className="font-medium"> — {r.vendor_name}</span> : null}
            {r.threshold_amount != null ? (
              <span className="font-medium"> — ${Number(r.threshold_amount).toLocaleString()}</span>
            ) : null}
            <span className="text-muted-foreground"> · {r.instruction}</span>
          </li>
        ))}
      </ul>
      {propertyId && (
        <Link
          to="/property/$propertyId"
          params={{ propertyId }}
          className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
        >
          See the whole property profile
        </Link>
      )}
    </div>
  );
}
