import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Tickets automatic assignment could not place — an uncovered overnight
 * period, a vacant seat, an ineligible seat holder. They are never quietly
 * dropped: each one carries the recorded reason and surfaces here for a
 * supervisor to place by hand.
 */
export function AssignmentExceptionQueue() {
  const { data, isLoading } = useQuery({
    queryKey: ["assignment-exceptions"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, title, priority, status, assignment_note, created_at")
        .is("assigned_to", null)
        .not("assignment_note", "is", null)
        .not("status", "in", "(resolved,closed,cancelled)")
        .is("archived_at", null)
        .eq("is_demo", false)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4" /> Assignment exceptions
          {(data?.length ?? 0) > 0 && <Badge variant="outline">{data!.length}</Badge>}
        </CardTitle>
        <CardDescription>
          Work the routing rules could not place. Each entry records why, so nothing sits unassigned without a
          reason. Assign these by hand from the ticket.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {(data?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground">Nothing waiting — every open ticket has an owner.</p>
        ) : (
          data!.map((t) => (
            <Link
              key={t.id}
              to="/tickets/$ticketId"
              params={{ ticketId: t.id }}
              className="block rounded-lg border border-border p-3 hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{t.title}</span>
                <Badge variant="outline" className="uppercase">
                  {t.priority}
                </Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{t.assignment_note}</p>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
