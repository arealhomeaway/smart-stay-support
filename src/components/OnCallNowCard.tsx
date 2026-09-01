import { useQuery } from "@tanstack/react-query";
import { Moon, Phone, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { coverageNow, windowLabel, type CoverageConfig } from "@/lib/coverage";

/**
 * Who owns escalation right now.
 *
 * Inside the configured after-hours window the rostered on-call person is the
 * active escalation owner; outside it, normal seat routing applies. The window
 * comes from business configuration, never from a constant in this file.
 */
export function OnCallNowCard({ className }: { className?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["oncall-now"],
    queryFn: async () => {
      const { data: cfg } = await supabase
        .from("coverage_config")
        .select("after_hours_start_minute, after_hours_end_minute, timezone")
        .maybeSingle();

      const state = coverageNow(cfg as CoverageConfig | null);
      const lookupDate = state.rosterDate ?? new Date().toISOString().slice(0, 10);

      const { data: entry } = await supabase
        .from("oncall_roster")
        .select("user_id, starts_on, ends_on")
        .lte("starts_on", lookupDate)
        .gte("ends_on", lookupDate)
        .limit(1)
        .maybeSingle();

      let name: string | null = null;
      if (entry) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", entry.user_id)
          .maybeSingle();
        name = profile?.full_name ?? profile?.email ?? "Unknown";
      }

      return { cfg: (cfg ?? null) as CoverageConfig | null, state, name, rosterDate: lookupDate };
    },
    refetchInterval: 5 * 60 * 1000,
  });

  if (isLoading || !data) return <Skeleton className={className ?? "h-32 w-full"} />;

  const { state, cfg, name, rosterDate } = data;
  const window = windowLabel(cfg);
  const active = state.configured && state.afterHours;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {active ? <Moon className="size-4" /> : <Sun className="size-4" />}
          On call — {rosterDate}
          <Badge variant="outline" className={active ? "border-warning/40 bg-warning/10" : undefined}>
            {active ? "After hours now" : "Daytime routing"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {window ? `After-hours coverage runs ${window}, adjusted automatically for daylight saving.` : "Coverage window not configured."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-lg font-semibold">{name ?? "No one scheduled"}</p>
        <p className="text-muted-foreground">
          {active
            ? "Active escalation owner until the window closes, when normal Operations routing resumes."
            : "Becomes the active escalation owner when the after-hours window opens."}
        </p>
        <p className="flex items-start gap-2 text-muted-foreground">
          <Phone className="mt-0.5 size-4 shrink-0" />
          Guests reach the on-call person on the ARHA Grasshopper number. Anything needing follow-up, escalation,
          vendor action, owner contact or a promised call-back gets a Resolve Ticket — a question fully answered on
          the call does not. Overnight does not mean P1; classify P1/P2/P3 on the actual impact.
        </p>
      </CardContent>
    </Card>
  );
}
