import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox, MailCheck, RefreshCw, Eye } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getMailboxStatus, runMailboxSync } from "@/lib/mailbox.functions";

/**
 * Supervisor control for inbox intake: read the team inbox and open matters
 * for the mail that is real work. Preview first, then run it for real.
 */
export function MailboxIntakePanel() {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(getMailboxStatus);
  const syncFn = useServerFn(runMailboxSync);

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
          ? `Preview: ${result.created} of ${result.scanned} unread would open a matter (${result.skipped} skipped).`
          : `${result.created} matter${result.created === 1 ? "" : "s"} opened · ${result.threaded} filed on existing matters · ${result.skipped} skipped.`,
      );
      if (!dryRun) {
        void queryClient.invalidateQueries({ queryKey: ["mailbox-status"] });
        void queryClient.invalidateQueries({ queryKey: ["imported-matters"] });
        void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Inbox sync failed."),
  });

  const connected = status.data?.connected ?? false;
  const preview = sync.data && sync.variables ? sync.data : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="size-4" /> Inbox intake
            </CardTitle>
            <CardDescription className="mt-1">
              Opens a ticket only for mail someone has categorised “Resolve: create task” in the shared inbox.
              Replies carrying an [ARHA-000] tag are filed on the original ticket instead of opening a duplicate.
            </CardDescription>
          </div>
          <Badge variant={connected ? "default" : "secondary"}>{connected ? "Connected" : "Not connected"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Mailbox: <span className="font-medium text-foreground">{status.data?.mailbox}</span> · untagged mail is
            left alone. Once the ticket is saved the category becomes “Resolve: task created”, and when the ticket is
            closed it becomes “Resolve task: task completed”. Your other categories are never changed, and each
            message is only ever read once.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!connected || sync.isPending}
            onClick={() => sync.mutate(true)}
          >
            <Eye className="size-4" /> Preview unread
          </Button>
          <Button size="sm" disabled={!connected || sync.isPending} onClick={() => sync.mutate(false)}>
            <RefreshCw className={`size-4 ${sync.isPending ? "animate-spin" : ""}`} /> Read inbox &amp; open matters
          </Button>
        </div>

        {preview && preview.ok ? (
          <div className="rounded-md border border-border">
            <div className="flex flex-wrap gap-4 border-b border-border px-3 py-2 text-sm">
              <span>{preview.scanned} unread scanned</span>
              <span className="font-medium">{preview.created} matters</span>
              <span>{preview.threaded} threaded</span>
              <span className="text-muted-foreground">{preview.skipped} skipped</span>
              {preview.failed > 0 ? <span className="text-destructive">{preview.failed} failed</span> : null}
            </div>
            <ul className="max-h-64 divide-y divide-border overflow-y-auto text-sm">
              {preview.items.map((item, i) => (
                <li key={`${item.subject}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <Badge
                    variant={
                      item.outcome === "created" ? "default" : item.outcome === "failed" ? "destructive" : "secondary"
                    }
                  >
                    {item.outcome}
                    {item.ref ? ` · ARHA-${item.ref}` : ""}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">{item.subject}</span>
                  <span className="truncate text-muted-foreground">{item.from}</span>
                  {item.reason ? <span className="text-xs text-muted-foreground">{item.reason}</span> : null}
                </li>
              ))}
              {preview.items.length === 0 ? (
                <li className="px-3 py-3 text-muted-foreground">Nothing unread in the inbox right now.</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {status.data?.events?.length ? (
          <div className="text-sm text-muted-foreground">
            <MailCheck className="mr-1 inline size-4" />
            Last sweep {new Date(status.data.lastRunAt ?? "").toLocaleString()} · {status.data.events.length} recent
            messages handled.
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
