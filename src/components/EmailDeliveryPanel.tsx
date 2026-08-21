import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmailDelivery, resendEmail } from "@/lib/email.functions";

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const PURPOSE_LABEL: Record<string, string> = {
  team_invite: "Team invite",
  owner_alert: "Homeowner alert",
  general: "General",
};

export function EmailDeliveryPanel() {
  const queryClient = useQueryClient();
  const deliveryFn = useServerFn(getEmailDelivery);
  const resendFn = useServerFn(resendEmail);

  const delivery = useQuery({ queryKey: ["email-delivery"], queryFn: () => deliveryFn() });

  const resend = useMutation({
    mutationFn: (logId: string) => resendFn({ data: { logId } }),
    onSuccess: (res) => {
      if (res.status === "sent") toast.success("Sent.");
      else toast.error(res.error ?? "Still could not send that one.");
      void queryClient.invalidateQueries({ queryKey: ["email-delivery"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Resend failed."),
  });

  const data = delivery.data;
  const rows = data?.rows ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Mail className="size-4" /> Email delivery
          <Badge variant={data && data.failed > 0 ? "destructive" : "default"}>
            {data ? `${data.failed} failed` : "Checking…"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Everything Resolve sends goes out of the shared mailbox and is recorded here, so a homeowner alert or
          invite that never arrived is visible instead of silent. Throttles and outages retry automatically.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {delivery.isLoading ? <p className="text-muted-foreground">Loading recent messages…</p> : null}

        {data ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label="Delivered" value={String(data.sent)} />
            <Stat label="Failed" value={String(data.failed)} />
            <Stat label="Skipped" value={String(data.skipped)} />
          </div>
        ) : null}

        {rows.length === 0 && !delivery.isLoading ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5" /> Nothing sent yet.
          </p>
        ) : null}

        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-md border border-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{row.recipient}</span>
                <Badge variant={row.status === "sent" ? "outline" : row.status === "failed" ? "destructive" : "secondary"}>
                  {row.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {PURPOSE_LABEL[row.purpose] ?? row.purpose} · {when(row.sent_at ?? row.created_at)}
                  {row.attempts > 1 ? ` · ${row.attempts} attempts` : ""}
                </span>
                {row.status !== "sent" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={resend.isPending}
                    onClick={() => resend.mutate(row.id)}
                  >
                    <RefreshCw className={`size-3.5 ${resend.isPending ? "animate-spin" : ""}`} />
                    Resend
                  </Button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{row.subject}</p>
              {row.error_message ? (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {row.error_message}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
