import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BookOpen, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getNotionOverview,
  resolveNotionConflict,
  runNotionPropertySync,
} from "@/lib/notion.functions";

function when(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function NotionSyncPanel() {
  const queryClient = useQueryClient();
  const overviewFn = useServerFn(getNotionOverview);
  const syncFn = useServerFn(runNotionPropertySync);
  const resolveFn = useServerFn(resolveNotionConflict);

  const overview = useQuery({ queryKey: ["notion-overview"], queryFn: () => overviewFn() });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["notion-overview"] });

  const sync = useMutation({
    mutationFn: (sourceKey: string) => syncFn({ data: { sourceKey } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.error ?? "Sync failed.");
      } else {
        toast.success(
          `${res.scanned} rows read — ${res.created} homes added, ${res.updated} updated, ${res.conflicts} need a decision.`,
        );
      }
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Sync failed."),
  });

  const decide = useMutation({
    mutationFn: (input: { conflictId: string; choice: "resolve" | "notion" }) =>
      resolveFn({ data: input }),
    onSuccess: () => {
      toast.success("Value settled.");
      refresh();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not settle that value."),
  });

  const data = overview.data;
  const sources = data?.sources ?? [];
  const conflicts = data?.conflicts ?? [];
  const failedEvents = (data?.events ?? []).filter((e) => e.status === "failed");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <BookOpen className="size-4" /> Notion — property master &amp; onboarding
          <Badge variant={data?.connectionError ? "secondary" : "default"}>
            {data?.connectionError ? "Unavailable" : "Connected"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Notion stays the record of truth for property master information and approved SOPs.
          Resolve keeps a mirror so permissions, workflows and reporting all point at one home
          record. Read-only for now — nothing is written back to Notion yet.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 text-sm">
        {overview.isLoading ? <p className="text-muted-foreground">Checking Notion…</p> : null}

        {data?.connectionError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
            {data.connectionError}
          </p>
        ) : null}

        {data ? (
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label="Homes mirrored" value={String(data.mirroredCount)} />
            <Stat label="Last successful sync" value={when(data.status.lastSuccessAt)} />
            <Stat label="Waiting on a decision" value={String(data.status.conflicts)} />
          </div>
        ) : null}

        <div className="space-y-2">
          {sources.map((source) => (
            <div key={source.key} className="rounded-md border border-border px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{source.title ?? source.label}</span>
                <Badge variant={source.shared ? "outline" : "secondary"}>
                  {source.shared ? source.object : "not shared yet"}
                </Badge>
                {source.shared && source.object === "database" && source.kind !== "plan_types" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    disabled={sync.isPending}
                    onClick={() => sync.mutate(source.key)}
                  >
                    <RefreshCw className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
                    Sync homes
                  </Button>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{source.blurb}</p>
              {!source.shared ? (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {source.error ??
                    "Open this page in Notion, use the ⋯ menu → Connections, and add the Lovable connection."}
                </p>
              ) : source.fields.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {source.fields.length} fields:{" "}
                  {source.fields
                    .slice(0, 8)
                    .map((f) => f.name)
                    .join(", ")}
                  {source.fields.length > 8 ? "…" : ""}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        {conflicts.length > 0 ? (
          <div className="space-y-2">
            <h3 className="font-medium">Values that disagree</h3>
            <p className="text-xs text-muted-foreground">
              Resolve never overwrites a value silently. Pick the one that is correct.
            </p>
            {conflicts.map((c) => (
              <div key={c.id} className="rounded-md border border-border px-3 py-2">
                <div className="text-sm font-medium">{c.field_label}</div>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-1.5 text-left text-xs hover:border-primary"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ conflictId: c.id, choice: "resolve" })}
                  >
                    <span className="block text-muted-foreground">Keep Resolve</span>
                    {c.resolve_value ?? "—"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-1.5 text-left text-xs hover:border-primary"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ conflictId: c.id, choice: "notion" })}
                  >
                    <span className="block text-muted-foreground">Take Notion</span>
                    {c.external_value ?? "—"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : data && !data.connectionError ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5" /> No conflicting values waiting.
          </p>
        ) : null}

        {failedEvents.length > 0 ? (
          <div className="space-y-1">
            <h3 className="font-medium">Recent failures</h3>
            {failedEvents.slice(0, 5).map((e) => (
              <p key={e.id} className="text-xs text-muted-foreground">
                {when(e.created_at)} — {e.operation}: {e.error_message}
              </p>
            ))}
          </div>
        ) : null}
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
