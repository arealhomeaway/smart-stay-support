import { useQuery } from "@tanstack/react-query";
import { Moon, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Who is on call today, for Operations staff.
 *
 * The roster is date-based. The after-hours start/end times have not been
 * defined by the business yet, so this card names the person and says plainly
 * that the coverage window is still pending — it never invents hours, and no
 * after-hours routing runs off it.
 */
function chicagoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function OnCallNowCard({ className }: { className?: string }) {
  const today = chicagoToday();

  const { data, isLoading } = useQuery({
    queryKey: ["oncall-today", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oncall_roster")
        .select("id, user_id, starts_on, ends_on")
        .lte("starts_on", today)
        .gte("ends_on", today)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", data.user_id)
        .maybeSingle();
      return { name: profile?.full_name ?? profile?.email ?? "Unknown" };
    },
  });

  if (isLoading) return <Skeleton className={className ?? "h-32 w-full"} />;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Moon className="size-4" /> On call today
        </CardTitle>
        <CardDescription>{today}, Central</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-lg font-semibold">{data?.name ?? "No one scheduled"}</p>
        <p className="flex items-start gap-2 text-muted-foreground">
          <Phone className="mt-0.5 size-4 shrink-0" />
          Guests reach the on-call person on the ARHA Grasshopper number. Anything needing follow-up, escalation,
          vendor action, owner contact or a promised call-back gets a Resolve Ticket — a question fully answered on
          the call does not.
        </p>
        <p className="text-muted-foreground">
          After-hours start and end times are still pending business input, so nothing routes automatically on this
          roster yet and the overnight handoff view stays off.
        </p>
      </CardContent>
    </Card>
  );
}
