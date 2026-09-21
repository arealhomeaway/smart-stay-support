import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PlugZap, ExternalLink } from "lucide-react";
import { PageHeader, SectionCard, EmptyState } from "@/components/ui/page";
import { StatusBadge } from "@/components/ui/status";
import { getInboundStatus, listImportedMatters } from "@/lib/inbound.functions";
import { SupervisorOnly } from "@/components/SupervisorOnly";
import { EmailDeliveryPanel } from "@/components/EmailDeliveryPanel";
import { NotionSyncPanel } from "@/components/NotionSyncPanel";
import { MailboxIntakePanel } from "@/components/MailboxIntakePanel";
import { FeatureFlagsPanel } from "@/components/FeatureFlagsPanel";
import { SharePointConnectionPanel } from "@/components/SharePointConnectionPanel";
import { BreezewayConnectionPanel } from "@/components/BreezewayConnectionPanel";
import { BreezewayWebhookPanel } from "@/components/BreezewayWebhookPanel";
import { BreezewayOutboundReviewPanel } from "@/components/BreezewayOutboundReviewPanel";

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
          "Pull OwnerRez tasks and inbound messages into Resolve so every ticket is tracked, documented and closed in one place.",
      },
      { property: "og:title", content: "Integrations & inbound sync | Resolve" },
      {
        property: "og:description",
        content: "Keep OwnerRez work in sync with the Resolve tickets queue.",
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
  const statusFn = useServerFn(getInboundStatus);
  const importedFn = useServerFn(listImportedMatters);

  const status = useQuery({ queryKey: ["inbound-status"], queryFn: () => statusFn() });
  const imported = useQuery({ queryKey: ["imported-matters"], queryFn: () => importedFn() });

  const rows = imported.data?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Integrations & inbound sync"
        description="Work created in OwnerRez or sent in by message lands here with the same ownership and clocks as anything logged directly."
      />

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <PlugZap className="size-4" /> OwnerRez
          </span>
        }
        actions={
          <StatusBadge tone={status.data?.ownerrez ? "resolved" : "closed"}>
            {status.data?.ownerrez ? "Connected" : "Not connected"}
          </StatusBadge>
        }
        description="Homes and live occupancy sync both ways. Occupancy still sets the starting priority when a ticket opens."
      >
        <p className="text-sm text-muted-foreground">
          OwnerRez does not publish maintenance tasks, so there is nothing to import from it
          directly — use the message intake below to pull its notifications and guest or owner
          emails into the queue.
        </p>
      </SectionCard>

      <SharePointConnectionPanel />

      <BreezewayConnectionPanel />
      <BreezewayWebhookPanel />
      <BreezewayOutboundReviewPanel />
      <BreezewaySyncReviewPanel />

      <DocumentCompletionPanel />

      <FeatureFlagsPanel />

      <MailboxIntakePanel />

      <NotionSyncPanel />

      <EmailDeliveryPanel />

      <SectionCard
        title={
          <span className="flex items-center gap-2">
            <PlugZap className="size-4" /> Message intake
          </span>
        }
        actions={<StatusBadge tone="progress">Live</StatusBadge>}
        description="Anything that arrives as a message can become a ticket automatically."
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Point an email forwarding rule or webhook at the intake endpoint below. Resolve reads
            it, matches the home, sets a starting priority and drops it in the queue.
          </p>
          <code className="block overflow-x-auto rounded-md bg-muted px-3 py-2 text-xs text-foreground">
            POST https://smart-stay-support.lovable.app/api/public/intake/email
            <br />
            header: x-intake-secret
            <br />
            body: {"{ subject, body, from, property }"}
          </code>
          <p>
            Duplicate deliveries are ignored automatically, so retries never create a second ticket.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Imported tickets"
        description="The most recent work pulled in from an outside system."
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing imported yet"
            hint="Run a sync above once a source system is connected."
          />
        ) : (
          <div className="space-y-2">
            {rows.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border px-3 py-2 text-sm"
              >
                <StatusBadge tone="context">{t.external_source}</StatusBadge>
                <Link
                  to="/tickets/$ticketId"
                  params={{ ticketId: t.id }}
                  className="font-medium hover:underline"
                >
                  #{t.ref} {t.title}
                </Link>
                <span className="text-muted-foreground">
                  {(t.properties as { name: string } | null)?.name ?? "No home linked"}
                </span>
                <StatusBadge tone="closed">{t.priority?.toUpperCase()}</StatusBadge>
                <span className="text-muted-foreground">{t.external_status ?? t.status}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  synced {timeAgo(t.external_synced_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ExternalLink className="size-3" />A scheduled job can call the inbound sync automatically
        so the queue stays current without anyone clicking.
      </p>
    </div>
  );
}
