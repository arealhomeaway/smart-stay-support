import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, MailCheck, RefreshCw, Eye, Radio } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMailboxStatus,
  refreshMailboxSubscription,
  runMailboxSync,
} from "@/lib/mailbox.functions";
import { usDateTime } from "@/lib/dates";

/**
 * Administrative view of Outlook intake.
 *
 * Deliberately small: what was created, what was prevented, what failed, and
 * whether Microsoft is still telling us about new mail. Outlook remains the
 * email client — this is not an inbox.
 */
export function MailboxIntakePanel() {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getMailboxStatus);
  const syncFn = useServerFn(runMailboxSync);
  const subscribeFn = useServerFn(refreshMailboxSubscription);

  const status = useQuery({ queryKey: ["mailbox-status"], queryFn: () => statusFn() });

  const sync = useMutation({
    mutationFn: (dryRun: boolean) => syncFn({ data: { dryRun } }),
    onSuccess: (result, dryRun) => {
      if (!result.ok) {
        toast.error(result.error ?? "The inbox could not be read.");
        return;
      }
      toast.success(
        dryRun
          ? `Preview: ${result.created} ticket${result.created === 1 ? "" : "s"} and ${result.leadsCreated} lead${
              result.leadsCreated === 1 ? "" : "s"
            } would be created from ${result.scanned} message${result.scanned === 1 ? "" : "s"}.`
          : `${result.created} ticket${result.created === 1 ? "" : "s"} · ${result.leadsCreated} lead${
              result.leadsCreated === 1 ? "" : "s"
            } · ${result.threaded} filed on existing records · ${result.skipped} left alone.`,
      );
      if (!dryRun) {
        void queryClient.invalidateQueries({ queryKey: ["mailbox-status"] });
        void queryClient.invalidateQueries({ queryKey: ["tickets"] });
        void queryClient.invalidateQueries({ queryKey: ["leads"] });
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Inbox sync failed."),
  });

  const subscribe = useMutation({
    mutationFn: () => subscribeFn(),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "The notification subscription could not be set up.");
        return;
      }
      toast.success(`Microsoft notifications ${result.action}.`);
      void queryClient.invalidateQueries({ queryKey: ["mailbox-status"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Subscription refresh failed."),
  });

  const connected = status.data?.connected ?? false;
  const subscription = status.data?.subscription ?? null;
  const preview = sync.data ?? null;
  const events = status.data?.events ?? [];
  const failures = events.filter((e) => e.status === "failed" || e.error_message);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="size-4" /> Outlook intake
            </CardTitle>
            <CardDescription className="mt-1">
              Nothing is created automatically. A message becomes work only when someone in the
              shared inbox applies{" "}
              <span className="font-medium text-foreground">Resolve: create ticket</span> or{" "}
              <span className="font-medium text-foreground">
                Resolve: lead management- create a ticket
              </span>
              . Resolve then swaps that category for{" "}
              <span className="font-medium text-foreground">Resolve: ticket created</span>, and
              moves it to{" "}
              <span className="font-medium text-foreground">Resolve: ticket closed</span> once the
              record is settled.
            </CardDescription>
          </div>
          <Badge variant={connected ? "default" : "secondary"}>
            {connected ? "Connected" : "Not connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Mailbox: <span className="font-medium text-foreground">{status.data?.mailbox}</span> ·
            uncategorised mail is left completely alone, replies on a thread that already produced
            work are filed on that record rather than opening a second one, and each message is only
            ever acted on once.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={subscription?.status === "active" ? "default" : "secondary"}
            className="gap-1"
          >
            <Radio className="size-3.5" />
            {subscription?.status === "active" ? "Live notifications" : "Notifications not set up"}
          </Badge>
          {subscription?.expiresAt ? (
            <span className="text-xs text-muted-foreground">
              renews before {usDateTime(subscription.expiresAt)}
            </span>
          ) : null}
          {subscription?.error ? (
            <span className="text-xs text-destructive">{subscription.error}</span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!connected || sync.isPending}
            onClick={() => sync.mutate(true)}
          >
            <Eye className="size-4" /> Preview
          </Button>
          <Button
            size="sm"
            disabled={!connected || sync.isPending}
            onClick={() => sync.mutate(false)}
          >
            <RefreshCw className={`size-4 ${sync.isPending ? "animate-spin" : ""}`} /> Run intake
            now
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!connected || subscribe.isPending}
            onClick={() => subscribe.mutate()}
          >
            <Radio className="size-4" /> Refresh notifications
          </Button>
        </div>

        {preview && preview.ok ? (
          <div className="rounded-md border border-border">
            <div className="flex flex-wrap gap-4 border-b border-border px-3 py-2 text-sm">
              <span>{preview.scanned} scanned</span>
              <span className="font-medium">{preview.created} tickets</span>
              <span className="font-medium">{preview.leadsCreated} leads</span>
              <span>{preview.threaded} threaded</span>
              <span className="text-muted-foreground">{preview.skipped} left alone</span>
              {preview.completedTagged > 0 ? (
                <span>{preview.completedTagged} marked closed</span>
              ) : null}
              {preview.reopenedTagged > 0 ? <span>{preview.reopenedTagged} reopened</span> : null}
              {preview.recategoriseRetried > 0 ? (
                <span>{preview.recategoriseRetried} category retries succeeded</span>
              ) : null}
              {preview.failed > 0 ? (
                <span className="text-destructive">{preview.failed} failed</span>
              ) : null}
            </div>
            <ul className="max-h-64 divide-y divide-border overflow-y-auto text-sm">
              {preview.items.map((item, i) => (
                <li
                  key={`${item.subject}-${i}`}
                  className="flex flex-wrap items-center gap-2 px-3 py-2"
                >
                  <Badge
                    variant={
                      item.outcome === "created" || item.outcome === "lead"
                        ? "default"
                        : item.outcome === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {item.outcome}
                    {item.ref ? ` · ARHA-${item.ref}` : ""}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">{item.subject}</span>
                  <span className="truncate text-muted-foreground">{item.from}</span>
                  {item.reason ? (
                    <span className="text-xs text-muted-foreground">{item.reason}</span>
                  ) : null}
                </li>
              ))}
              {preview.items.length === 0 ? (
                <li className="px-3 py-3 text-muted-foreground">No new mail since the last run.</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {failures.length ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">
              {failures.length} message(s) need attention
            </p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              {failures.slice(0, 5).map((f) => (
                <li key={f.id} className="truncate">
                  {usDateTime(f.created_at)} · {f.error_message ?? f.status}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {events.length ? (
          <div className="text-sm text-muted-foreground">
            <MailCheck className="mr-1 inline size-4" />
            Last activity {usDateTime(status.data?.lastRunAt)} · {events.length} recent messages
            handled ({events.filter((e) => e.status === "created").length} created,{" "}
            {events.filter((e) => e.status === "linked").length} linked to existing records,{" "}
            {events.filter((e) => e.status === "closed").length} closed).
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
