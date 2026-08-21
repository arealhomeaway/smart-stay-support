import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Download, PlugZap, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInboundStatus, listImportedMatters, runInboundSync } from "@/lib/inbound.functions";
import { SupervisorOnly } from "@/components/SupervisorOnly";

export const Route = createFileRoute("/_authenticated/integrations")({
  component: () => (
    <SupervisorOnly>
      <IntegrationsPage />
    </SupervisorOnly>
  ),
  head: () => ({
    meta: [
      { title: "Integrations & inbound sync | Resolve" },
      {
        name: "description",
        content:
          "Pull OwnerRez and Breezeway tasks into Resolve so every matter is tracked, documented and closed in one place.",
      },
      { property: "og:title", content: "Integrations & inbound sync | Resolve" },
      {
        property: "og:description",
        content: "Keep OwnerRez and Breezeway work in sync with the Resolve matters queue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function IntegrationsPage() {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getInboundStatus);
  const importedFn = useServerFn(listImportedMatters);
  const syncFn = useServerFn(runInboundSync);

  const status = useQuery({ queryKey: ["inbound-status"], queryFn: () => statusFn() });
  const imported = useQuery({ queryKey: ["imported-matters"], queryFn: () => importedFn() });

  const sync = useMutation({
    mutationFn: (source: "all" | "breezeway" | "ownerrez") => syncFn({ data: { source } }),
    onSuccess: (res) => {
      for (const r of res.results) {
        const name = r.source === "breezeway" ? "Breezeway" : "OwnerRez";
        if (!r.ok) {
          toast.error(`${name}: ${r.error}`);
          continue;
        }
        toast.success(
          `${name}: ${r.created} imported, ${r.updated} updated${r.unlinked ? `, ${r.unlinked} without a linked home` : ""}.`,
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["imported-matters"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Sync failed"),
  });

  const rows = imported.data?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">Integrations & inbound sync</h1>
        <p className="text-sm text-muted-foreground">
          Resolve is the primary platform. Anything created in OwnerRez or Breezeway is pulled in here so it gets
          the same ownership, clocks and closure standards as work logged by the team.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => sync.mutate("all")} disabled={sync.isPending}>
          <RefreshCw className={`size-4 ${sync.isPending ? "animate-spin" : ""}`} />
          Sync everything now
        </Button>
        <Button variant="outline" onClick={() => sync.mutate("ownerrez")} disabled={sync.isPending}>
          <Download className="size-4" /> OwnerRez only
        </Button>
        <Button variant="outline" onClick={() => sync.mutate("breezeway")} disabled={sync.isPending}>
          <Download className="size-4" /> Breezeway only
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="size-4" /> OwnerRez
              <Badge variant={status.data?.ownerrez ? "default" : "secondary"}>
                {status.data?.ownerrez ? "Connected" : "Not connected"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Homes, live occupancy and maintenance tasks. Occupancy still sets the priority floor when a matter is
              opened.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Inbound sync imports OwnerRez maintenance tasks as matters. If your OwnerRez plan does not expose tasks
            through the API, the sync will say so and property and stay sync keep working.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="size-4" /> Breezeway
              <Badge variant={status.data?.breezeway ? "default" : "secondary"}>
                {status.data?.breezeway ? "Connected" : "Awaiting API access"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Field tasks in both directions: Resolve dispatches with full instructions, and Breezeway tasks and
              status changes flow back here.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Once the Breezeway Client ID and Secret are added, every task created in Breezeway appears in the matters
            queue and status changes are logged on the timeline.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Imported matters</CardTitle>
          <CardDescription>The most recent work pulled in from an outside system.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing imported yet. Run a sync above once a source system is connected.
            </p>
          ) : (
            rows.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 text-sm"
              >
                <Badge variant="outline" className="uppercase">
                  {t.external_source}
                </Badge>
                <Link to="/tickets/$ticketId" params={{ ticketId: t.id }} className="font-medium hover:underline">
                  #{t.ref} {t.title}
                </Link>
                <span className="text-muted-foreground">
                  {(t.properties as { name: string } | null)?.name ?? "No home linked"}
                </span>
                <Badge variant="secondary">{t.priority?.toUpperCase()}</Badge>
                <span className="text-muted-foreground">{t.external_status ?? t.status}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  synced {timeAgo(t.external_synced_at)}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ExternalLink className="size-3" />
        A scheduled job can call the inbound sync automatically so the queue stays current without anyone clicking.
      </p>
    </div>
  );
}
