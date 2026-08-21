import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { PhoneCall, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ownerContactAlerts, resolveOwnerContactAlert } from "@/lib/owner-alerts.functions";
import { relativeTime } from "@/lib/owner-notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Owner texts and calls stay human. When an urgent matter needs voice contact,
 * it lands here for a coordinator to handle and close out.
 */
export function OwnerContactAlerts() {
  const qc = useQueryClient();
  const load = useServerFn(ownerContactAlerts);
  const resolve = useServerFn(resolveOwnerContactAlert);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const alerts = useQuery({
    queryKey: ["owner-contact-alerts"],
    queryFn: () => load(),
    refetchInterval: 60_000,
  });

  const handled = useMutation({
    mutationFn: (id: string) => resolve({ data: { id, note: notes[id] ?? "" } }),
    onSuccess: () => {
      toast.success("Marked handled.");
      void qc.invalidateQueries({ queryKey: ["owner-contact-alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = alerts.data?.rows ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const recent = rows.filter((r) => r.status !== "pending").slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PhoneCall className="size-4" /> Call or text this owner
          {pending.length > 0 && <Badge variant="destructive">{pending.length} waiting</Badge>}
        </CardTitle>
        <CardDescription>
          Resolve sends email and in-app alerts automatically. Urgent matters that deserve a voice or
          text come here so a teammate reaches the homeowner personally.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.isLoading && <Skeleton className="h-24 w-full" />}
        {!alerts.isLoading && pending.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing waiting. Every urgent owner has been reached.
          </p>
        )}

        {pending.map((a) => (
          <div key={a.id} className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive">{a.priority.toUpperCase()}</Badge>
              <span className="font-medium">{a.owner_name ?? "Homeowner"}</span>
              {a.owner_phone ? (
                <a className="text-sm font-medium text-primary underline" href={`tel:${a.owner_phone}`}>
                  {a.owner_phone}
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">No phone on file</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">{relativeTime(a.created_at)}</span>
            </div>
            <p className="mt-2 text-sm font-medium">{a.title}</p>
            {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{a.reason}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {a.ticket_id && (
                <Button asChild variant="outline" size="sm">
                  <Link to="/tickets/$ticketId" params={{ ticketId: a.ticket_id }}>
                    Open the matter
                  </Link>
                </Button>
              )}
              <Input
                className="h-9 max-w-xs"
                placeholder="What you told them (optional)"
                value={notes[a.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                maxLength={500}
              />
              <Button size="sm" onClick={() => handled.mutate(a.id)} disabled={handled.isPending}>
                <CheckCircle2 className="size-4" /> I reached them
              </Button>
            </div>
          </div>
        ))}

        {recent.length > 0 && (
          <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            {recent.map((a) => (
              <p key={a.id}>
                Handled · {a.owner_name ?? "Homeowner"} — {a.title}
                {a.handled_note ? ` · ${a.handled_note}` : ""}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
