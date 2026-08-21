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
import { NotionSyncPanel } from "@/components/NotionSyncPanel";

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
          "Pull OwnerRez tasks and inbound messages into Resolve so every matter is tracked, documented and closed in one place.",
      },
      { property: "og:title", content: "Integrations & inbound sync | Resolve" },
      {
        property: "og:description",
        content: "Keep OwnerRez work in sync with the Resolve matters queue.",
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
    mutationFn: (source: "all" | "ownerrez") => syncFn({ data: { source } }),
    onSuccess: (res) => {
      for (const r of res.results) {
        const name = "OwnerRez";
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
          Resolve is the primary platform. Anything created in OwnerRez or sent in by message is pulled in here so it gets
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
              Homes and live occupancy sync both ways into Resolve. Occupancy still sets the priority floor when a
              matter is opened.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            OwnerRez does not publish maintenance tasks through its API, so there is nothing for Resolve to import
            from it — a task sync will always come back empty. Homes, stays and occupancy keep syncing normally. Use
            the message intake below to get OwnerRez notifications and guest or owner emails into the queue.
          </CardContent>
        </Card>



      </div>

      <NotionSyncPanel />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="size-4" /> Message intake
            <Badge>Live</Badge>
          </CardTitle>
          <CardDescription>
            The workaround for OwnerRez: anything that arrives as a message can become a matter automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Point an email forwarding rule or webhook at the intake endpoint below. Resolve reads the subject and
            body, matches the home by name, sets a starting priority (safety and “urgent” language lands as P1) and
            drops it in the queue with a full timeline entry.
          </p>
          <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs text-foreground">
            POST https://smart-stay-support.lovable.app/api/public/intake/email
            <br />
            header: x-intake-secret
            <br />
            body: {"{ subject, body, from, property }"}
          </code>
          <p>
            Duplicate deliveries are ignored when the sender includes an <code>externalId</code>, so retries never
            create a second matter.
          </p>
        </CardContent>
      </Card>

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
