import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Mail, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getOutlookSource } from "@/lib/mailbox.functions";
import { usDateTime } from "@/lib/dates";

/**
 * "Created from Outlook" — compact provenance for a Ticket or Lead that began
 * as an email. Enough to understand where the work came from and to open the
 * original message; deliberately not a copy of the inbox.
 */
export function OutlookSourceCard({
  entityType,
  entityId,
}: {
  entityType: "ticket" | "lead";
  entityId: string;
}) {
  const fetchSource = useServerFn(getOutlookSource);
  const { data } = useQuery({
    queryKey: ["outlook-source", entityType, entityId],
    queryFn: () => fetchSource({ data: { entityType, entityId } }),
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return null;

  const received = data.receivedAt ? usDateTime(data.receivedAt) : null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Mail className="size-4 text-muted-foreground" />
        <span className="font-medium">Created from Outlook</span>
        {data.syncState === "linked" ? (
          <Badge variant="secondary">Filed on this record</Badge>
        ) : null}
        {data.syncState === "failed" || data.syncState === "recategorise_pending" ? (
          <Badge variant="destructive">Category sync pending</Badge>
        ) : null}
        {data.webLink ? (
          <a
            className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
            href={data.webLink}
            target="_blank"
            rel="noreferrer"
          >
            Open in Outlook <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-muted-foreground sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="inline font-medium text-foreground">From: </dt>
          <dd className="inline break-words">
            {data.fromName ? `${data.fromName} · ` : ""}
            {data.fromAddress ?? "unknown sender"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="inline font-medium text-foreground">Mailbox: </dt>
          <dd className="inline break-words">{data.mailbox}</dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="inline font-medium text-foreground">Subject: </dt>
          <dd className="inline break-words">{data.subject}</dd>
        </div>
        {received ? (
          <div>
            <dt className="inline font-medium text-foreground">Received: </dt>
            <dd className="inline">{received}</dd>
          </div>
        ) : null}
        {data.attachments?.length ? (
          <div className="min-w-0">
            <dt className="inline font-medium text-foreground">
              <Paperclip className="mr-1 inline size-3.5" />
              Attachments:{" "}
            </dt>
            <dd className="inline break-words">{data.attachments.map((a) => a.name).join(", ")}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
